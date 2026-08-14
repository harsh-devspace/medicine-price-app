const express = require('express');
const cors = require('cors');
const multer = require('multer');
const csvParser = require('csv-parser');
const fs = require('fs');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const frontendDist = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
}

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}
const upload = multer({ dest: uploadsDir });

const normalize = (str) => (str ? str.toString().trim().toLowerCase() : '');

// Helper for CSV escaping
const escapeCsvCell = (val) => {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
};

// 1. GET /api/medicines - List with search, filter, sorting, and lowest PTR flag
app.get('/api/medicines', async (req, res) => {
  try {
    const { q, agency, minPtr, maxPtr, minMrp, maxMrp, sortBy } = req.query;

    let query = 'SELECT * FROM medicines WHERE 1=1';
    const params = [];

    if (q) {
      query += ' AND (LOWER(product_name) LIKE ? OR LOWER(contain) LIKE ? OR LOWER(agency) LIKE ?)';
      const searchTerm = `%${q.trim().toLowerCase()}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (agency) {
      query += ' AND LOWER(agency) = LOWER(?)';
      params.push(agency.trim());
    }

    if (minPtr) {
      query += ' AND ptr >= ?';
      params.push(parseFloat(minPtr));
    }

    if (maxPtr) {
      query += ' AND ptr <= ?';
      params.push(parseFloat(maxPtr));
    }

    if (minMrp) {
      query += ' AND mrp >= ?';
      params.push(parseFloat(minMrp));
    }

    if (maxMrp) {
      query += ' AND mrp <= ?';
      params.push(parseFloat(maxMrp));
    }

    // Sorting
    switch (sortBy) {
      case 'ptr_asc':
        query += ' ORDER BY ptr ASC';
        break;
      case 'ptr_desc':
        query += ' ORDER BY ptr DESC';
        break;
      case 'mrp_asc':
        query += ' ORDER BY mrp ASC';
        break;
      case 'mrp_desc':
        query += ' ORDER BY mrp DESC';
        break;
      case 'product_name_desc':
        query += ' ORDER BY product_name DESC';
        break;
      default:
        query += ' ORDER BY product_name ASC, ptr ASC';
        break;
    }

    const rows = await db.all(query, params);

    // Grouping to find lowest PTR per product/contain across entire database
    const allRows = await db.all('SELECT product_name, contain, agency, MIN(ptr) as min_ptr, COUNT(*) as supplier_count FROM medicines GROUP BY LOWER(TRIM(product_name)), LOWER(TRIM(contain))');
    
    const minPtrMap = new Map();
    for (const r of allRows) {
      const key = `${normalize(r.product_name)}||${normalize(r.contain)}`;
      minPtrMap.set(key, { min_ptr: r.min_ptr, supplier_count: r.supplier_count });
    }

    const enrichedRows = rows.map((item) => {
      const key = `${normalize(item.product_name)}||${normalize(item.contain)}`;
      const info = minPtrMap.get(key);
      const isLowest = info && info.supplier_count > 1 && Math.abs(item.ptr - info.min_ptr) < 0.01;
      return {
        ...item,
        is_lowest_ptr: !!isLowest,
        supplier_count: info ? info.supplier_count : 1,
        min_ptr: info ? info.min_ptr : item.ptr
      };
    });

    res.json({ success: true, data: enrichedRows });
  } catch (err) {
    console.error('Error fetching medicines:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 2. GET /api/dashboard/stats
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const totalRow = await db.get('SELECT COUNT(*) as count FROM medicines');
    const agencyRow = await db.get('SELECT COUNT(DISTINCT LOWER(agency)) as count FROM medicines');
    const productRow = await db.get('SELECT COUNT(DISTINCT LOWER(product_name)) as count FROM medicines');
    const recentMedicines = await db.all('SELECT * FROM medicines ORDER BY id DESC LIMIT 5');

    res.json({
      success: true,
      stats: {
        totalMedicines: totalRow ? totalRow.count : 0,
        totalAgencies: agencyRow ? agencyRow.count : 0,
        uniqueProducts: productRow ? productRow.count : 0,
        recentMedicines
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. GET /api/agencies
app.get('/api/agencies', async (req, res) => {
  try {
    const rows = await db.all('SELECT DISTINCT agency FROM medicines ORDER BY agency ASC');
    const agencies = rows.map(r => r.agency);
    res.json({ success: true, agencies });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 4. GET /api/medicines/quick-compare
app.get('/api/medicines/quick-compare', async (req, res) => {
  try {
    const { product_name, contain, id } = req.query;
    let targetProduct = product_name;
    let targetContain = contain;

    if (id) {
      const item = await db.get('SELECT product_name, contain FROM medicines WHERE id = ?', [id]);
      if (item) {
        targetProduct = item.product_name;
        targetContain = item.contain;
      }
    }

    if (!targetProduct && !targetContain) {
      return res.status(400).json({ success: false, message: 'product_name or contain is required' });
    }

    const rows = await db.all(`
      SELECT * FROM medicines 
      WHERE LOWER(TRIM(product_name)) = LOWER(TRIM(?)) OR LOWER(TRIM(contain)) = LOWER(TRIM(?))
      ORDER BY ptr ASC
    `, [targetProduct || '', targetContain || '']);

    const lowestPtr = rows.length > 0 ? rows[0].ptr : 0;
    const highestPtr = rows.length > 0 ? rows[rows.length - 1].ptr : 0;

    const formatted = rows.map((r) => ({
      ...r,
      is_best_deal: Math.abs(r.ptr - lowestPtr) < 0.01,
      price_diff_vs_lowest: parseFloat((r.ptr - lowestPtr).toFixed(2)),
      savings_pct: lowestPtr > 0 ? parseFloat((((r.ptr - lowestPtr) / r.ptr) * 100).toFixed(1)) : 0
    }));

    res.json({
      success: true,
      product_name: targetProduct,
      contain: targetContain,
      lowest_ptr: lowestPtr,
      max_savings: parseFloat((highestPtr - lowestPtr).toFixed(2)),
      suppliers: formatted
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 5. POST /api/medicines - Add new medicine (with Duplicate Check)
app.post('/api/medicines', async (req, res) => {
  try {
    const { product_name, contain, ptr, mrp, agency, force_update } = req.body;

    if (!product_name || !contain || ptr === undefined || mrp === undefined || !agency) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    const numPtr = parseFloat(ptr);
    const numMrp = parseFloat(mrp);

    if (isNaN(numPtr) || isNaN(numMrp)) {
      return res.status(400).json({ success: false, message: 'PTR and MRP must be valid numbers.' });
    }

    // Check duplicate: exact Product Name + Contain + Agency match
    const existing = await db.get(`
      SELECT * FROM medicines 
      WHERE LOWER(TRIM(product_name)) = LOWER(TRIM(?))
        AND LOWER(TRIM(contain)) = LOWER(TRIM(?))
        AND LOWER(TRIM(agency)) = LOWER(TRIM(?))
    `, [product_name, contain, agency]);

    if (existing && !force_update) {
      return res.json({
        success: true,
        isDuplicate: true,
        existingRecord: existing,
        message: `An entry for "${product_name}" from agency "${agency}" already exists.`
      });
    }

    if (existing && force_update) {
      await db.run(`
        UPDATE medicines 
        SET ptr = ?, mrp = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [numPtr, numMrp, existing.id]);

      const updatedRow = await db.get('SELECT * FROM medicines WHERE id = ?', [existing.id]);
      return res.json({
        success: true,
        isDuplicate: false,
        action: 'updated',
        data: updatedRow,
        message: 'Existing record updated successfully.'
      });
    }

    const result = await db.run(`
      INSERT INTO medicines (product_name, contain, ptr, mrp, agency)
      VALUES (?, ?, ?, ?, ?)
    `, [product_name.trim(), contain.trim(), numPtr, numMrp, agency.trim()]);

    const newRow = await db.get('SELECT * FROM medicines WHERE id = ?', [result.lastID]);
    res.json({
      success: true,
      isDuplicate: false,
      action: 'created',
      data: newRow,
      message: 'Medicine added successfully.'
    });
  } catch (err) {
    console.error('Error adding medicine:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 6. PUT /api/medicines/:id - Edit existing medicine
app.put('/api/medicines/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { product_name, contain, ptr, mrp, agency } = req.body;

    if (!product_name || !contain || ptr === undefined || mrp === undefined || !agency) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    const numPtr = parseFloat(ptr);
    const numMrp = parseFloat(mrp);

    const result = await db.run(`
      UPDATE medicines 
      SET product_name = ?, contain = ?, ptr = ?, mrp = ?, agency = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [product_name.trim(), contain.trim(), numPtr, numMrp, agency.trim(), id]);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: 'Medicine record not found.' });
    }

    const updatedRow = await db.get('SELECT * FROM medicines WHERE id = ?', [id]);
    res.json({ success: true, data: updatedRow, message: 'Medicine updated successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 7. DELETE /api/medicines/:id - Delete record
app.delete('/api/medicines/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.run('DELETE FROM medicines WHERE id = ?', [id]);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: 'Medicine record not found.' });
    }

    res.json({ success: true, message: 'Medicine record deleted successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 8. GET /api/export/csv - Export CSV
app.get('/api/export/csv', async (req, res) => {
  try {
    const rows = await db.all('SELECT id, product_name, contain, ptr, mrp, agency, created_at FROM medicines ORDER BY product_name ASC');
    
    const headers = ['Sr. No.', 'Product Name', 'Contain', 'PTR', 'MRP', 'Agency', 'Date Added'];
    const csvRows = [headers.join(',')];

    rows.forEach((row, idx) => {
      const line = [
        idx + 1,
        escapeCsvCell(row.product_name),
        escapeCsvCell(row.contain),
        row.ptr,
        row.mrp,
        escapeCsvCell(row.agency),
        escapeCsvCell(row.created_at)
      ];
      csvRows.push(line.join(','));
    });

    const csvContent = csvRows.join('\n');
    res.header('Content-Type', 'text/csv');
    res.attachment(`medicine_prices_${Date.now()}.csv`);
    return res.send(csvContent);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 9. POST /api/import/csv - Import CSV
app.post('/api/import/csv', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No CSV file uploaded.' });
  }

  const results = [];
  fs.createReadStream(req.file.path)
    .pipe(csvParser())
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      let importedCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;

      try {
        for (const row of results) {
          const product_name = row.product_name || row['Product Name'] || row['productName'];
          const contain = row.contain || row['Contain'] || row['composition'];
          const ptr = parseFloat(row.ptr || row['PTR']);
          const mrp = parseFloat(row.mrp || row['MRP']);
          const agency = row.agency || row['Agency'] || row['dealer'];

          if (product_name && contain && !isNaN(ptr) && !isNaN(mrp) && agency) {
            const existing = await db.get(`
              SELECT id FROM medicines 
              WHERE LOWER(TRIM(product_name)) = LOWER(TRIM(?))
                AND LOWER(TRIM(contain)) = LOWER(TRIM(?))
                AND LOWER(TRIM(agency)) = LOWER(TRIM(?))
            `, [product_name, contain, agency]);

            if (existing) {
              await db.run(`
                UPDATE medicines 
                SET ptr = ?, mrp = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
              `, [ptr, mrp, existing.id]);
              updatedCount++;
            } else {
              await db.run(`
                INSERT INTO medicines (product_name, contain, ptr, mrp, agency)
                VALUES (?, ?, ?, ?, ?)
              `, [product_name.trim(), contain.trim(), ptr, mrp, agency.trim()]);
              importedCount++;
            }
          } else {
            skippedCount++;
          }
        }

        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }

        res.json({
          success: true,
          message: `Import complete: ${importedCount} new entries added, ${updatedCount} existing entries updated, ${skippedCount} skipped.`,
          stats: { importedCount, updatedCount, skippedCount }
        });
      } catch (err) {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ success: false, message: err.message });
      }
    });
});

app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    const indexPath = path.join(__dirname, '../frontend/dist/index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
  }
  res.status(404).send('Not Found');
});

app.listen(PORT, () => {
  console.log(`Medicine Price Comparison Server running on http://localhost:${PORT}`);
});
