require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const csvParser = require('csv-parser');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { supabase } = require('./supabaseClient');
const { authMiddleware } = require('./middleware/auth');

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

// Create a Supabase client scoped to the authenticated user's token
// This guarantees database-level Row Level Security (RLS) enforcement!
const getClientForUser = (token) => {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY,
    {
      global: {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );
};

// Health check endpoint (Public)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ==========================================
// AUTHENTICATED API ENDPOINTS
// All endpoints below enforce multi-user isolation using Supabase Auth + RLS
// ==========================================

// 0. GET /api/user/profile - Get current user profile
app.get('/api/user/profile', authMiddleware, async (req, res) => {
  try {
    const dbClient = getClientForUser(req.token);
    const { data: profile, error } = await dbClient
      .from('profiles')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.warn('Profile fetch notice:', error.message);
    }

    res.json({
      success: true,
      user: {
        id: req.user.id,
        email: req.user.email,
        full_name: profile?.full_name || req.user.user_metadata?.full_name || req.user.email?.split('@')[0],
        created_at: req.user.created_at,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 1. GET /api/medicines - List with search, filter, sorting, company name & lowest PTR flag
app.get('/api/medicines', authMiddleware, async (req, res) => {
  try {
    const { q, agency, company, minPtr, maxPtr, minMrp, maxMrp, sortBy } = req.query;
    const userId = req.user.id;
    const dbClient = getClientForUser(req.token);

    let query = dbClient.from('medicines').select('*').eq('user_id', userId);

    if (q && q.trim()) {
      const term = q.trim();
      query = query.or(
        `product_name.ilike.%${term}%,contain.ilike.%${term}%,agency.ilike.%${term}%,company_name.ilike.%${term}%`
      );
    }

    if (agency && agency.trim()) {
      query = query.ilike('agency', agency.trim());
    }

    if (company && company.trim()) {
      query = query.ilike('company_name', company.trim());
    }

    if (minPtr) {
      const p = parseFloat(minPtr);
      if (!isNaN(p)) query = query.gte('ptr', p);
    }

    if (maxPtr) {
      const p = parseFloat(maxPtr);
      if (!isNaN(p)) query = query.lte('ptr', p);
    }

    if (minMrp) {
      const m = parseFloat(minMrp);
      if (!isNaN(m)) query = query.gte('mrp', m);
    }

    if (maxMrp) {
      const m = parseFloat(maxMrp);
      if (!isNaN(m)) query = query.lte('mrp', m);
    }

    // Apply Sorting
    switch (sortBy) {
      case 'ptr_asc':
        query = query.order('ptr', { ascending: true });
        break;
      case 'ptr_desc':
        query = query.order('ptr', { ascending: false });
        break;
      case 'mrp_asc':
        query = query.order('mrp', { ascending: true });
        break;
      case 'mrp_desc':
        query = query.order('mrp', { ascending: false });
        break;
      case 'product_name_desc':
        query = query.order('product_name', { ascending: false });
        break;
      case 'company_name_asc':
        query = query.order('company_name', { ascending: true }).order('product_name', { ascending: true });
        break;
      case 'company_name_desc':
        query = query.order('company_name', { ascending: false }).order('product_name', { ascending: true });
        break;
      default:
        query = query.order('product_name', { ascending: true }).order('ptr', { ascending: true });
        break;
    }

    const { data: rows, error } = await query;
    if (error) throw error;

    // Fetch all user's medicines to compute lowest PTR per formula (scoped strictly to this user!)
    const { data: allUserMeds, error: allMedsErr } = await dbClient
      .from('medicines')
      .select('product_name, contain, ptr')
      .eq('user_id', userId);

    if (allMedsErr) throw allMedsErr;

    const minPtrMap = new Map();
    (allUserMeds || []).forEach((r) => {
      const key = `${normalize(r.product_name)}||${normalize(r.contain)}`;
      const numPtr = parseFloat(r.ptr);
      if (!minPtrMap.has(key)) {
        minPtrMap.set(key, { min_ptr: numPtr, supplier_count: 1 });
      } else {
        const entry = minPtrMap.get(key);
        entry.supplier_count += 1;
        if (numPtr < entry.min_ptr) {
          entry.min_ptr = numPtr;
        }
      }
    });

    const enrichedRows = (rows || []).map((item) => {
      const key = `${normalize(item.product_name)}||${normalize(item.contain)}`;
      const info = minPtrMap.get(key);
      const numPtr = parseFloat(item.ptr);
      const isLowest = info && info.supplier_count > 1 && Math.abs(numPtr - info.min_ptr) < 0.01;
      return {
        ...item,
        ptr: numPtr,
        mrp: parseFloat(item.mrp),
        is_lowest_ptr: !!isLowest,
        supplier_count: info ? info.supplier_count : 1,
        min_ptr: info ? info.min_ptr : numPtr,
      };
    });

    res.json({ success: true, data: enrichedRows });
  } catch (err) {
    console.error('Error fetching medicines:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 2. GET /api/dashboard/stats - User-specific statistics
app.get('/api/dashboard/stats', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const dbClient = getClientForUser(req.token);

    const { data: rows, error } = await dbClient
      .from('medicines')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const medicines = rows || [];
    const totalMedicines = medicines.length;

    const uniqueAgencies = new Set(medicines.map((m) => normalize(m.agency)).filter(Boolean)).size;
    const uniqueProducts = new Set(medicines.map((m) => normalize(m.product_name)).filter(Boolean)).size;
    const uniqueCompanies = new Set(medicines.map((m) => normalize(m.company_name)).filter(Boolean)).size;
    const recentMedicines = medicines.slice(0, 5).map((m) => ({
      ...m,
      ptr: parseFloat(m.ptr),
      mrp: parseFloat(m.mrp),
    }));

    res.json({
      success: true,
      stats: {
        totalMedicines,
        totalAgencies: uniqueAgencies,
        uniqueProducts,
        totalCompanies: uniqueCompanies,
        recentMedicines,
      },
    });
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. GET /api/agencies - Unique agencies for authenticated user
app.get('/api/agencies', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const dbClient = getClientForUser(req.token);
    const { data: rows, error } = await dbClient
      .from('medicines')
      .select('agency')
      .eq('user_id', userId);

    if (error) throw error;

    const agenciesMap = new Map();
    (rows || []).forEach((r) => {
      if (r.agency && r.agency.trim()) {
        const key = normalize(r.agency);
        if (!agenciesMap.has(key)) {
          agenciesMap.set(key, r.agency.trim());
        }
      }
    });

    const agencies = Array.from(agenciesMap.values()).sort((a, b) => a.localeCompare(b));
    res.json({ success: true, agencies });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 4. GET /api/companies - Unique companies for authenticated user
app.get('/api/companies', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const dbClient = getClientForUser(req.token);
    const { data: rows, error } = await dbClient
      .from('medicines')
      .select('company_name')
      .eq('user_id', userId);

    if (error) throw error;

    const companiesMap = new Map();
    (rows || []).forEach((r) => {
      if (r.company_name && r.company_name.trim()) {
        const key = normalize(r.company_name);
        if (!companiesMap.has(key)) {
          companiesMap.set(key, r.company_name.trim());
        }
      }
    });

    const companies = Array.from(companiesMap.values()).sort((a, b) => a.localeCompare(b));
    res.json({ success: true, companies });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 5. GET /api/medicines/quick-compare - User-specific price comparison
app.get('/api/medicines/quick-compare', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const dbClient = getClientForUser(req.token);
    const { product_name, contain, id } = req.query;
    let targetProduct = product_name;
    let targetContain = contain;

    if (id) {
      const { data: item, error: itemErr } = await dbClient
        .from('medicines')
        .select('product_name, contain')
        .eq('id', id)
        .eq('user_id', userId)
        .single();

      if (item && !itemErr) {
        targetProduct = item.product_name;
        targetContain = item.contain;
      }
    }

    if (!targetProduct && !targetContain) {
      return res.status(400).json({ success: false, message: 'product_name or contain is required' });
    }

    let query = dbClient
      .from('medicines')
      .select('*')
      .eq('user_id', userId);

    if (targetProduct && targetContain) {
      query = query.or(
        `product_name.ilike.%${targetProduct.trim()}%,contain.ilike.%${targetContain.trim()}%`
      );
    } else if (targetProduct) {
      query = query.ilike('product_name', `%${targetProduct.trim()}%`);
    } else {
      query = query.ilike('contain', `%${targetContain.trim()}%`);
    }

    const { data: rows, error } = await query.order('ptr', { ascending: true });
    if (error) throw error;

    const formattedRows = (rows || []).map((r) => ({
      ...r,
      ptr: parseFloat(r.ptr),
      mrp: parseFloat(r.mrp),
    }));

    const lowestPtr = formattedRows.length > 0 ? formattedRows[0].ptr : 0;
    const highestPtr = formattedRows.length > 0 ? formattedRows[formattedRows.length - 1].ptr : 0;

    const formatted = formattedRows.map((r) => ({
      ...r,
      is_best_deal: Math.abs(r.ptr - lowestPtr) < 0.01,
      price_diff_vs_lowest: parseFloat((r.ptr - lowestPtr).toFixed(2)),
      savings_pct: lowestPtr > 0 ? parseFloat((((r.ptr - lowestPtr) / r.ptr) * 100).toFixed(1)) : 0,
    }));

    res.json({
      success: true,
      product_name: targetProduct,
      contain: targetContain,
      lowest_ptr: lowestPtr,
      max_savings: parseFloat((highestPtr - lowestPtr).toFixed(2)),
      suppliers: formatted,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 6. POST /api/medicines - Add new medicine (with Duplicate Check)
app.post('/api/medicines', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const dbClient = getClientForUser(req.token);
    const { company_name, product_name, contain, ptr, mrp, agency, force_update } = req.body;

    if (!product_name || !contain || ptr === undefined || mrp === undefined || !agency) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    const trimmedCompany = (company_name || 'Unknown').trim();
    const trimmedProduct = product_name.trim();
    const trimmedContain = contain.trim();
    const trimmedAgency = agency.trim();

    const numPtr = parseFloat(ptr);
    const numMrp = parseFloat(mrp);

    if (isNaN(numPtr) || isNaN(numMrp)) {
      return res.status(400).json({ success: false, message: 'PTR and MRP must be valid numbers.' });
    }

    // Check duplicate: match product_name, contain, and agency for this user
    const { data: existingRows, error: searchErr } = await dbClient
      .from('medicines')
      .select('*')
      .eq('user_id', userId)
      .ilike('product_name', trimmedProduct)
      .ilike('contain', trimmedContain)
      .ilike('agency', trimmedAgency);

    if (searchErr) throw searchErr;

    const existing = existingRows && existingRows.length > 0 ? existingRows[0] : null;

    if (existing && !force_update) {
      return res.json({
        success: true,
        isDuplicate: true,
        existingRecord: {
          ...existing,
          ptr: parseFloat(existing.ptr),
          mrp: parseFloat(existing.mrp),
        },
        message: `An entry for "${trimmedProduct}" from agency "${trimmedAgency}" already exists.`,
      });
    }

    if (existing && force_update) {
      const { data: updated, error: updateErr } = await dbClient
        .from('medicines')
        .update({
          company_name: trimmedCompany,
          ptr: numPtr,
          mrp: numMrp,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .eq('user_id', userId)
        .select()
        .single();

      if (updateErr) throw updateErr;

      return res.json({
        success: true,
        isDuplicate: false,
        action: 'updated',
        data: {
          ...updated,
          ptr: parseFloat(updated.ptr),
          mrp: parseFloat(updated.mrp),
        },
        message: 'Existing record updated successfully.',
      });
    }

    // Insert new record
    const { data: inserted, error: insertErr } = await dbClient
      .from('medicines')
      .insert({
        user_id: userId,
        company_name: trimmedCompany,
        product_name: trimmedProduct,
        contain: trimmedContain,
        ptr: numPtr,
        mrp: numMrp,
        agency: trimmedAgency,
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    res.json({
      success: true,
      isDuplicate: false,
      action: 'created',
      data: {
        ...inserted,
        ptr: parseFloat(inserted.ptr),
        mrp: parseFloat(inserted.mrp),
      },
      message: 'Medicine added successfully.',
    });
  } catch (err) {
    console.error('Error adding medicine:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 7. PUT /api/medicines/:id - Edit existing medicine
app.put('/api/medicines/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const dbClient = getClientForUser(req.token);
    const { id } = req.params;
    const { company_name, product_name, contain, ptr, mrp, agency } = req.body;

    if (!product_name || !contain || ptr === undefined || mrp === undefined || !agency) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    const numPtr = parseFloat(ptr);
    const numMrp = parseFloat(mrp);

    if (isNaN(numPtr) || isNaN(numMrp)) {
      return res.status(400).json({ success: false, message: 'PTR and MRP must be valid numbers.' });
    }

    const { data: updated, error } = await dbClient
      .from('medicines')
      .update({
        company_name: (company_name || 'Unknown').trim(),
        product_name: product_name.trim(),
        contain: contain.trim(),
        ptr: numPtr,
        mrp: numMrp,
        agency: agency.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !updated) {
      return res.status(404).json({ success: false, message: 'Medicine record not found or not owned.' });
    }

    res.json({
      success: true,
      data: {
        ...updated,
        ptr: parseFloat(updated.ptr),
        mrp: parseFloat(updated.mrp),
      },
      message: 'Medicine updated successfully.',
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 8. DELETE /api/medicines/:id - Delete record
app.delete('/api/medicines/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const dbClient = getClientForUser(req.token);
    const { id } = req.params;

    const { data, error } = await dbClient
      .from('medicines')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select();

    if (error || !data || data.length === 0) {
      return res.status(404).json({ success: false, message: 'Medicine record not found or not owned.' });
    }

    res.json({ success: true, message: 'Medicine record deleted successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 9. GET /api/export/csv - Export CSV
app.get('/api/export/csv', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const dbClient = getClientForUser(req.token);

    const { data: rows, error } = await dbClient
      .from('medicines')
      .select('*')
      .eq('user_id', userId)
      .order('product_name', { ascending: true });

    if (error) throw error;

    const headers = ['Sr. No.', 'Company Name', 'Product Name', 'Contain', 'PTR', 'MRP', 'Agency', 'Date Added'];
    const csvRows = [headers.join(',')];

    (rows || []).forEach((row, idx) => {
      const line = [
        idx + 1,
        escapeCsvCell(row.company_name || 'Unknown'),
        escapeCsvCell(row.product_name),
        escapeCsvCell(row.contain),
        parseFloat(row.ptr).toFixed(2),
        parseFloat(row.mrp).toFixed(2),
        escapeCsvCell(row.agency),
        escapeCsvCell(row.created_at),
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

// 10. POST /api/import/csv - Import CSV
app.post('/api/import/csv', authMiddleware, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No CSV file uploaded.' });
  }

  const userId = req.user.id;
  const dbClient = getClientForUser(req.token);
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
          const company_name =
            row.company_name || row['Company Name'] || row['company'] || row['Company'] || 'Unknown';
          const product_name =
            row.product_name || row['Product Name'] || row['productName'] || row['Product'];
          const contain =
            row.contain || row['Contain'] || row['composition'] || row['Composition'];
          const ptr = parseFloat(row.ptr || row['PTR']);
          const mrp = parseFloat(row.mrp || row['MRP']);
          const agency =
            row.agency || row['Agency'] || row['dealer'] || row['Dealer'] || row['Supplier'];

          if (product_name && contain && !isNaN(ptr) && !isNaN(mrp) && agency) {
            const trimmedCompany = String(company_name).trim();
            const trimmedProduct = String(product_name).trim();
            const trimmedContain = String(contain).trim();
            const trimmedAgency = String(agency).trim();

            const { data: existingRows } = await dbClient
              .from('medicines')
              .select('id')
              .eq('user_id', userId)
              .ilike('product_name', trimmedProduct)
              .ilike('contain', trimmedContain)
              .ilike('agency', trimmedAgency);

            if (existingRows && existingRows.length > 0) {
              await dbClient
                .from('medicines')
                .update({
                  company_name: trimmedCompany,
                  ptr,
                  mrp,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', existingRows[0].id)
                .eq('user_id', userId);
              updatedCount++;
            } else {
              await dbClient.from('medicines').insert({
                user_id: userId,
                company_name: trimmedCompany,
                product_name: trimmedProduct,
                contain: trimmedContain,
                ptr,
                mrp,
                agency: trimmedAgency,
              });
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
          stats: { importedCount, updatedCount, skippedCount },
        });
      } catch (err) {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ success: false, message: err.message });
      }
    });
});

// Serve frontend static build if available
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    const indexPath = path.join(__dirname, '../frontend/dist/index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
  }
  res.status(404).send('Not Found');
});

// Export app for tests and start server if executed directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Medicine Price Comparison Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
