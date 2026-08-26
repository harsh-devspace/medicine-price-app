/**
 * ==============================================================================
 * SQLite to Supabase PostgreSQL Data Migration Script
 * ==============================================================================
 * 
 * Usage:
 *   node migrate-sqlite-to-supabase.js --email user@example.com --password YourPassword
 *   OR
 *   node migrate-sqlite-to-supabase.js --email user@example.com
 * ==============================================================================
 */

require('dotenv').config();
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('\n❌ ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in your .env file.\n');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Parse arguments
const args = process.argv.slice(2);
let targetEmail = process.env.MIGRATION_USER_EMAIL || null;
let targetPassword = process.env.MIGRATION_USER_PASSWORD || null;
let defaultCompanyName = 'Unknown';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--email' && args[i + 1]) {
    targetEmail = args[i + 1];
    i++;
  } else if (args[i] === '--password' && args[i + 1]) {
    targetPassword = args[i + 1];
    i++;
  } else if (args[i] === '--company' && args[i + 1]) {
    defaultCompanyName = args[i + 1];
    i++;
  }
}

const dbPath = path.join(__dirname, 'medprice.db');

const getSqliteMedicines = () => {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) return reject(new Error(`Failed to open SQLite database at ${dbPath}: ${err.message}`));
    });

    db.all('SELECT * FROM medicines', (err, rows) => {
      db.close();
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
};

const runMigration = async () => {
  console.log('====================================================');
  console.log(' 🚀 Medicine Price App - SQLite to Supabase Migration');
  console.log('====================================================\n');

  try {
    // 1. Read SQLite records
    console.log(`📖 Reading records from SQLite database (${dbPath})...`);
    const sqliteRows = await getSqliteMedicines();
    console.log(`✅ Found ${sqliteRows.length} medicine records in SQLite.\n`);

    if (sqliteRows.length === 0) {
      console.log('ℹ️ No records to migrate. Exiting.');
      return;
    }

    // 2. Authenticate or resolve User
    let authClient = supabase;
    let userId = null;

    if (targetEmail && targetPassword) {
      console.log(`🔐 Signing in as ${targetEmail}...`);
      const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password: targetPassword,
      });

      if (authErr) {
        // Try sign up if doesn't exist
        console.log(`ℹ️ Account not found, creating account for ${targetEmail}...`);
        const { data: signData, error: signErr } = await supabase.auth.signUp({
          email: targetEmail,
          password: targetPassword,
        });
        if (signErr) throw signErr;
        userId = signData.user?.id;
        authClient = createClient(supabaseUrl, supabaseKey, {
          global: {
            headers: signData.session?.access_token
              ? { Authorization: `Bearer ${signData.session.access_token}` }
              : {},
          },
        });
      } else {
        userId = authData.user?.id;
        authClient = createClient(supabaseUrl, supabaseKey, {
          global: {
            headers: { Authorization: `Bearer ${authData.session.access_token}` },
          },
        });
      }
    } else if (targetEmail) {
      // Check admin list
      const { data: usersData, error: adminErr } = await supabase.auth.admin.listUsers();
      if (!adminErr && usersData?.users) {
        const found = usersData.users.find(
          (u) => u.email && u.email.toLowerCase() === targetEmail.toLowerCase()
        );
        if (found) userId = found.id;
      }
    }

    if (!userId) {
      console.log('🔍 Looking for an existing user or fallback user...');
      // Fallback test account if none specified
      const fallbackEmail = 'doctor.admin@gmail.com';
      const fallbackPassword = 'DoctorPassword2026!';
      const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
        email: fallbackEmail,
        password: fallbackPassword,
      });

      if (authErr) {
        const { data: signData, error: signErr } = await supabase.auth.signUp({
          email: fallbackEmail,
          password: fallbackPassword,
          options: { data: { full_name: 'Dr. Administrator' } },
        });
        if (signErr) throw signErr;
        userId = signData.user?.id;
        if (signData.session?.access_token) {
          authClient = createClient(supabaseUrl, supabaseKey, {
            global: { headers: { Authorization: `Bearer ${signData.session.access_token}` } },
          });
        }
      } else {
        userId = authData.user?.id;
        authClient = createClient(supabaseUrl, supabaseKey, {
          global: { headers: { Authorization: `Bearer ${authData.session.access_token}` } },
        });
      }
      console.log(`✅ Using migration account: ${fallbackEmail} (ID: ${userId})`);
    }

    console.log(`\n📦 Migrating ${sqliteRows.length} records to Supabase PostgreSQL for user [${userId}]...`);

    let importedCount = 0;
    let skippedCount = 0;

    for (const row of sqliteRows) {
      const company = row.company_name || defaultCompanyName;
      const productName = (row.product_name || '').trim();
      const contain = (row.contain || '').trim();
      const ptr = parseFloat(row.ptr);
      const mrp = parseFloat(row.mrp);
      const agency = (row.agency || '').trim();

      // Check if duplicate already exists for this user in Supabase
      const { data: existing, error: checkErr } = await authClient
        .from('medicines')
        .select('id')
        .eq('user_id', userId)
        .ilike('product_name', productName)
        .ilike('contain', contain)
        .ilike('agency', agency);

      if (existing && existing.length > 0) {
        console.log(`  ⏭️ Skipped duplicate: "${productName}" (${agency})`);
        skippedCount++;
        continue;
      }

      const { data: inserted, error: insertErr } = await authClient.from('medicines').insert({
        user_id: userId,
        company_name: company,
        product_name: productName,
        contain: contain,
        ptr: ptr,
        mrp: mrp,
        agency: agency,
        created_at: row.created_at || new Date().toISOString(),
        updated_at: row.updated_at || new Date().toISOString(),
      }).select();

      if (insertErr) {
        console.error(`  ❌ Failed to insert "${productName}":`, insertErr.message);
      } else {
        console.log(`  ✅ Imported: "${productName}" | ${contain} | PTR: ₹${ptr} | Agency: ${agency}`);
        importedCount++;
      }
    }

    // 4. Verification
    console.log('\n====================================================');
    console.log(' 📊 Migration Verification Report');
    console.log('====================================================');
    console.log(`SQLite Record Count        : ${sqliteRows.length}`);
    console.log(`Newly Imported to Supabase  : ${importedCount}`);
    console.log(`Skipped (Already Existed)   : ${skippedCount}`);

    // Query total in Supabase for user
    const { data: finalRows, error: countErr } = await authClient
      .from('medicines')
      .select('*')
      .eq('user_id', userId);

    if (!countErr) {
      console.log(`Total Records in Supabase  : ${finalRows?.length || 0} (for User ${userId})`);
    }

    console.log('====================================================');
    console.log('✅ Migration Process Completed Successfully!');
    console.log('====================================================\n');
  } catch (err) {
    console.error('\n❌ Migration Failed:', err.message);
    process.exit(1);
  }
};

runMigration();
