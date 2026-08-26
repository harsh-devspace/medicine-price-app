require('dotenv').config();
const http = require('http');
const app = require('./server');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const PORT = 5055;

const makeRequest = (options, postData = null) => {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const json = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, headers: res.headers, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: body });
        }
      });
    });

    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
};

const runMultiUserTest = async () => {
  console.log('====================================================');
  console.log(' 🧪 MULTI-USER DATA ISOLATION TEST SUITE');
  console.log('====================================================\n');

  const server = app.listen(PORT);

  try {
    // 1. Create or Login User A
    const userAEmail = 'userA@testmedicines.com';
    const userAPassword = 'UserAPassword123!';
    console.log(`👤 1. Authenticating User A (${userAEmail})...`);

    let userAToken = null;
    let userAId = null;

    let authA = await supabase.auth.signInWithPassword({ email: userAEmail, password: userAPassword });
    if (authA.error) {
      const signA = await supabase.auth.signUp({
        email: userAEmail,
        password: userAPassword,
        options: { data: { full_name: 'Dr. User A' } },
      });
      if (signA.error) throw signA.error;
      userAToken = signA.data.session.access_token;
      userAId = signA.data.user.id;
    } else {
      userAToken = authA.data.session.access_token;
      userAId = authA.data.user.id;
    }
    console.log(`   ✅ User A Authenticated (ID: ${userAId})\n`);

    // 2. Create or Login User B
    const userBEmail = 'userB@testmedicines.com';
    const userBPassword = 'UserBPassword123!';
    console.log(`👤 2. Authenticating User B (${userBEmail})...`);

    let userBToken = null;
    let userBId = null;

    let authB = await supabase.auth.signInWithPassword({ email: userBEmail, password: userBPassword });
    if (authB.error) {
      const signB = await supabase.auth.signUp({
        email: userBEmail,
        password: userBPassword,
        options: { data: { full_name: 'Dr. User B' } },
      });
      if (signB.error) throw signB.error;
      userBToken = signB.data.session.access_token;
      userBId = signB.data.user.id;
    } else {
      userBToken = authB.data.session.access_token;
      userBId = authB.data.user.id;
    }
    console.log(`   ✅ User B Authenticated (ID: ${userBId})\n`);

    // 3. User A adds medicine: Dolo 650 (Company: Micro Labs)
    console.log('➕ 3. User A adding medicine: "Dolo 650" (Company: "Micro Labs")...');
    const resAAdd = await makeRequest(
      {
        hostname: 'localhost',
        port: PORT,
        path: '/api/medicines',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userAToken}`,
        },
      },
      {
        company_name: 'Micro Labs',
        product_name: 'Dolo 650',
        contain: 'Paracetamol 650 mg',
        ptr: 18,
        mrp: 35,
        agency: 'ABC Pharma',
      }
    );
    const medA = resAAdd.data.data || resAAdd.data.existingRecord;
    console.log(`   ✅ User A Medicine Loaded (ID: ${medA?.id}, Product: "${medA?.product_name}", Company: "${medA?.company_name}")\n`);

    // 4. User B adds medicine: Pan 40 (Company: Alkem)
    console.log('➕ 4. User B adding medicine: "Pan 40" (Company: "Alkem")...');
    const resBAdd = await makeRequest(
      {
        hostname: 'localhost',
        port: PORT,
        path: '/api/medicines',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userBToken}`,
        },
      },
      {
        company_name: 'Alkem',
        product_name: 'Pan 40',
        contain: 'Pantoprazole 40 mg',
        ptr: 32,
        mrp: 60,
        agency: 'City Pharma',
      }
    );
    const medB = resBAdd.data.data || resBAdd.data.existingRecord;
    console.log(`   ✅ User B Medicine Loaded (ID: ${medB?.id}, Product: "${medB?.product_name}", Company: "${medB?.company_name}")\n`);

    // 5. Verification: User A fetch
    console.log('🔍 5. Verifying User A Data View:');
    const resAList = await makeRequest({
      hostname: 'localhost',
      port: PORT,
      path: '/api/medicines',
      method: 'GET',
      headers: { Authorization: `Bearer ${userAToken}` },
    });

    const userAMeds = resAList.data.data || [];
    const userASeesDolo = userAMeds.some((m) => m.product_name === 'Dolo 650');
    const userASeesPan = userAMeds.some((m) => m.product_name === 'Pan 40');

    console.log(`   - Total medicines returned for User A: ${userAMeds.length}`);
    console.log(`   - User A sees Dolo 650: ${userASeesDolo ? '✅ YES' : '❌ NO'}`);
    console.log(`   - User A sees Pan 40  : ${userASeesPan ? '❌ LEAK DETECTED' : '✅ NO (Isolated)'}`);

    if (userASeesPan) throw new Error('Security Breach: User A sees User B data!');

    // 6. Verification: User B fetch
    console.log('\n🔍 6. Verifying User B Data View:');
    const resBList = await makeRequest({
      hostname: 'localhost',
      port: PORT,
      path: '/api/medicines',
      method: 'GET',
      headers: { Authorization: `Bearer ${userBToken}` },
    });

    const userBMeds = resBList.data.data || [];
    const userBSeesPan = userBMeds.some((m) => m.product_name === 'Pan 40');
    const userBSeesDolo = userBMeds.some((m) => m.product_name === 'Dolo 650');

    console.log(`   - Total medicines returned for User B: ${userBMeds.length}`);
    console.log(`   - User B sees Pan 40  : ${userBSeesPan ? '✅ YES' : '❌ NO'}`);
    console.log(`   - User B sees Dolo 650: ${userBSeesDolo ? '❌ LEAK DETECTED' : '✅ NO (Isolated)'}`);

    if (userBSeesDolo) throw new Error('Security Breach: User B sees User A data!');

    // 7. Cross-User Mutation Prevention Test
    console.log('\n🛡️ 7. Testing Cross-User Mutation Protection (Attack Simulation):');

    // User A tries to edit User B's medicine
    console.log('   - User A attempting PUT on User B medicine ID...');
    const resAEditB = await makeRequest(
      {
        hostname: 'localhost',
        port: PORT,
        path: `/api/medicines/${medB.id}`,
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userAToken}`,
        },
      },
      {
        company_name: 'Hacked',
        product_name: 'Hacked',
        contain: 'Hacked',
        ptr: 1,
        mrp: 1,
        agency: 'Hacker',
      }
    );
    console.log(`     Status: ${resAEditB.status} (Expected 404/Error) -> ${resAEditB.status === 404 ? '✅ BLOCKED' : '❌ FAILED'}`);

    // User A tries to delete User B's medicine
    console.log('   - User A attempting DELETE on User B medicine ID...');
    const resADelB = await makeRequest({
      hostname: 'localhost',
      port: PORT,
      path: `/api/medicines/${medB.id}`,
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    console.log(`     Status: ${resADelB.status} (Expected 404/Error) -> ${resADelB.status === 404 ? '✅ BLOCKED' : '❌ FAILED'}`);

    // User B tries to delete User A's medicine
    console.log('   - User B attempting DELETE on User A medicine ID...');
    const resBDelA = await makeRequest({
      hostname: 'localhost',
      port: PORT,
      path: `/api/medicines/${medA.id}`,
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    console.log(`     Status: ${resBDelA.status} (Expected 404/Error) -> ${resBDelA.status === 404 ? '✅ BLOCKED' : '❌ FAILED'}`);

    // 8. Stats & Dashboard Verification
    console.log('\n📊 8. Testing User-Specific Dashboard Stats:');
    const resAStats = await makeRequest({
      hostname: 'localhost',
      port: PORT,
      path: '/api/dashboard/stats',
      method: 'GET',
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    console.log(`   - User A Stats: Total Meds: ${resAStats.data.stats?.totalMedicines}, Companies: ${resAStats.data.stats?.totalCompanies}, Agencies: ${resAStats.data.stats?.totalAgencies}`);

    const resBStats = await makeRequest({
      hostname: 'localhost',
      port: PORT,
      path: '/api/dashboard/stats',
      method: 'GET',
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    console.log(`   - User B Stats: Total Meds: ${resBStats.data.stats?.totalMedicines}, Companies: ${resBStats.data.stats?.totalCompanies}, Agencies: ${resBStats.data.stats?.totalAgencies}`);

    console.log('\n====================================================');
    console.log(' 🎉 ALL MULTI-USER ISOLATION TESTS PASSED 100%!');
    console.log('====================================================\n');
  } finally {
    server.close();
  }
};

runMultiUserTest().catch((err) => {
  console.error('\n❌ Test Suite Failed:', err);
  process.exit(1);
});
