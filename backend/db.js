const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'medprice.db');
const db = new sqlite3.Database(dbPath);

const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const all = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

const initDb = async () => {
  await run(`
    CREATE TABLE IF NOT EXISTS medicines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_name TEXT NOT NULL,
      contain TEXT NOT NULL,
      ptr REAL NOT NULL,
      mrp REAL NOT NULL,
      agency TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const row = await get('SELECT COUNT(*) AS count FROM medicines');
  if (row && row.count === 0) {
    console.log('Seeding initial medicine price comparison records...');
    const seedMedicines = [
      { product_name: 'Dolo 650', contain: 'Paracetamol 650 mg', ptr: 18.00, mrp: 35.00, agency: 'ABC Pharma' },
      { product_name: 'Dolo 650', contain: 'Paracetamol 650 mg', ptr: 16.00, mrp: 35.00, agency: 'XYZ Pharma' },
      { product_name: 'Dolo 650', contain: 'Paracetamol 650 mg', ptr: 20.00, mrp: 35.00, agency: 'PQR Healthcare' },
      { product_name: 'Pan 40', contain: 'Pantoprazole 40 mg', ptr: 32.50, mrp: 60.00, agency: 'Alkem Agency' },
      { product_name: 'Pan 40', contain: 'Pantoprazole 40 mg', ptr: 28.00, mrp: 60.00, agency: 'Sun Pharma Dist.' },
      { product_name: 'Pan 40', contain: 'Pantoprazole 40 mg', ptr: 35.00, mrp: 60.00, agency: 'City Pharma' },
      { product_name: 'Azithral 500', contain: 'Azithromycin 500 mg', ptr: 75.00, mrp: 120.00, agency: 'Cipla Supplier' },
      { product_name: 'Azithral 500', contain: 'Azithromycin 500 mg', ptr: 68.50, mrp: 120.00, agency: 'Apex Pharma' },
      { product_name: 'Augmentin 625', contain: 'Amoxicillin 500mg + Clavulanic Acid 125mg', ptr: 142.00, mrp: 200.00, agency: 'GSK Representative' },
      { product_name: 'Augmentin 625', contain: 'Amoxicillin 500mg + Clavulanic Acid 125mg', ptr: 125.00, mrp: 200.00, agency: 'MedPlus Wholesale' },
      { product_name: 'Telma 40', contain: 'Telmisartan 40 mg', ptr: 45.00, mrp: 90.00, agency: 'Glenmark MR' },
      { product_name: 'Telma 40', contain: 'Telmisartan 40 mg', ptr: 42.00, mrp: 90.00, agency: 'ABC Pharma' },
      { product_name: 'Crocin 500', contain: 'Paracetamol 500 mg', ptr: 14.00, mrp: 28.00, agency: 'XYZ Pharma' },
      { product_name: 'Calpol 650', contain: 'Paracetamol 650 mg', ptr: 17.50, mrp: 33.00, agency: 'GSK Representative' }
    ];

    for (const item of seedMedicines) {
      await run(
        'INSERT INTO medicines (product_name, contain, ptr, mrp, agency) VALUES (?, ?, ?, ?, ?)',
        [item.product_name, item.contain, item.ptr, item.mrp, item.agency]
      );
    }
    console.log(`Seeded ${seedMedicines.length} medicine records.`);
  }
};

initDb().catch(console.error);

module.exports = {
  db,
  run,
  get,
  all
};
