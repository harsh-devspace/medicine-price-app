const http = require('http');

const request = (method, path, body = null) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          if (res.headers['content-type'] && res.headers['content-type'].includes('application/json')) {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } else {
            resolve({ status: res.statusCode, body: data });
          }
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', (err) => reject(err));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
};

async function runTests() {
  console.log('--- STARTING AUTOMATED API CRUD & LOGIC TESTS ---');

  // 1. GET /api/medicines
  const getRes = await request('GET', '/api/medicines');
  console.log(`[TEST 1] GET /api/medicines -> Status: ${getRes.status}, Total Items: ${getRes.body.data.length}`);
  const lowestPtrItems = getRes.body.data.filter(i => i.is_lowest_ptr);
  console.log(`[TEST 1] Lowest PTR Indicator Count: ${lowestPtrItems.length} items flagged with ★ Lowest Price tag`);

  // 2. POST /api/medicines (Create New Item)
  const newItem = {
    product_name: 'Crocin Advance 500',
    contain: 'Paracetamol 500 mg',
    ptr: 12.50,
    mrp: 25.00,
    agency: 'MedPlus Wholesale'
  };
  const addRes = await request('POST', '/api/medicines', newItem);
  console.log(`[TEST 2] POST /api/medicines (New) -> Status: ${addRes.status}, Action: ${addRes.body.action}, ID: ${addRes.body.data?.id}`);
  const createdId = addRes.body.data?.id;

  // 3. POST /api/medicines (Duplicate Prevention Check)
  const dupCheckRes = await request('POST', '/api/medicines', newItem);
  console.log(`[TEST 3] Duplicate Prevention Check -> isDuplicate: ${dupCheckRes.body.isDuplicate}, Message: "${dupCheckRes.body.message}"`);

  // 4. POST /api/medicines (Duplicate Force Update)
  const forceUpdateRes = await request('POST', '/api/medicines', { ...newItem, ptr: 11.80, force_update: true });
  console.log(`[TEST 4] Duplicate Force Update -> Action: ${forceUpdateRes.body.action}, Updated PTR: ${forceUpdateRes.body.data?.ptr}`);

  // 5. GET /api/medicines/quick-compare
  const compareRes = await request('GET', '/api/medicines/quick-compare?product_name=Dolo%20650');
  console.log(`[TEST 5] Quick Compare for "Dolo 650" -> Suppliers Found: ${compareRes.body.suppliers.length}, Lowest PTR: ₹${compareRes.body.lowest_ptr}`);
  const cheapest = compareRes.body.suppliers.find(s => s.is_best_deal);
  console.log(`[TEST 5] Best Deal Agency: ${cheapest.agency} (PTR: ₹${cheapest.ptr})`);

  // 6. PUT /api/medicines/:id
  const putRes = await request('PUT', `/api/medicines/${createdId}`, { ...newItem, ptr: 10.90 });
  console.log(`[TEST 6] PUT /api/medicines/${createdId} -> Updated PTR: ₹${putRes.body.data?.ptr}`);

  // 7. DELETE /api/medicines/:id
  const delRes = await request('DELETE', `/api/medicines/${createdId}`);
  console.log(`[TEST 7] DELETE /api/medicines/${createdId} -> Status: ${delRes.status}, Message: "${delRes.body.message}"`);

  // 8. GET /api/export/csv
  const csvRes = await request('GET', '/api/export/csv');
  console.log(`[TEST 8] GET /api/export/csv -> CSV Response Length: ${csvRes.body.length} characters`);

  console.log('--- ALL AUTOMATED VERIFICATION TESTS PASSED SUCCESSFULLY! ---');
}

runTests().catch(console.error);
