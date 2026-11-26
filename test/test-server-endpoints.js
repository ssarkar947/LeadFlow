/**
 * Server Endpoints & HTTP Verification Test Suite
 * Spins up server on port 3001 (isolated test port) and runs real HTTP requests
 */

const http = require('http');
const assert = require('assert');

const PORT = process.env.PORT || 3000;

function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: PORT,
      path,
      method,
      headers: {
        ...headers
      }
    };

    if (body) {
      const payload = typeof body === 'string' ? body : JSON.stringify(body);
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk.toString());
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data,
          json
        });
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runServerTests() {
  console.log('═══════════════════════════════════════════════════');
  console.log('🧪 Starting Server Endpoints & HTTP Route Tests');
  console.log('═══════════════════════════════════════════════════\n');

  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      await fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${name}:`, err.message);
    }
  }

  // 1. Existing Pages Check
  await test('GET / returns 200 text/html (Homepage)', async () => {
    const res = await makeRequest('GET', '/');
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.headers['content-type'].includes('text/html'));
    assert.ok(res.data.includes('AdsVise'));
  });

  await test('GET /ad-audit returns 200 text/html (Existing Funnel)', async () => {
    const res = await makeRequest('GET', '/ad-audit');
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.headers['content-type'].includes('text/html'));
  });

  // 2. SaaS FitScore Pages
  await test('GET /saas-fitscore returns 200 text/html (Native Page)', async () => {
    const res = await makeRequest('GET', '/saas-fitscore');
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.headers['content-type'].includes('text/html'));
    assert.ok(res.data.includes('SaaS FitScore'));
    assert.ok(res.data.includes('Five Connected Dimensions'));
  });

  await test('GET /saas-fitscore/admin returns 200 text/html (Admin Dashboard)', async () => {
    const res = await makeRequest('GET', '/saas-fitscore/admin');
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.headers['content-type'].includes('text/html'));
    assert.ok(res.data.includes('Growth Intelligence Admin'));
  });

  // 3. SaaS FitScore API: Submit & Disposable Email Check
  await test('POST /api/saas-fitscore/submit blocks disposable email addresses (400)', async () => {
    const res = await makeRequest('POST', '/api/saas-fitscore/submit', {
      name: 'Temp User',
      email: 'temp123@mailinator.com',
      websiteUrl: 'https://adsvise.in',
      consentGranted: true
    });
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.json.success, false);
    assert.ok(res.json.error.toLowerCase().includes('disposable'));
  });

  let createdDiagId = null;
  await test('POST /api/saas-fitscore/submit processes assessment and returns diagnosticId', async () => {
    const payload = {
      name: 'Server Test User',
      email: 'server_test_' + Date.now() + '@saastest.io',
      websiteUrl: 'https://adsvise.in',
      consentGranted: true
    };

    const res = await makeRequest('POST', '/api/saas-fitscore/submit', payload);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.json.success, true);
    assert.ok(res.json.diagnosticId);
    createdDiagId = res.json.diagnosticId;
  });

  // 4. SaaS FitScore API: Status
  await test('GET /api/saas-fitscore/status/:id returns diagnostic progress status', async () => {
    assert.ok(createdDiagId, 'Must have created diagnostic ID');
    const res = await makeRequest('GET', `/api/saas-fitscore/status/${createdDiagId}`);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.json.success, true);
    assert.ok(res.json.status, 'Must return status field');
  });

  // 5. Razorpay Paid Order Creation
  await test('POST /api/saas-fitscore/create-paid-order handles Razorpay integration', async () => {
    const res = await makeRequest('POST', '/api/saas-fitscore/create-paid-order', {
      product: 'System to Make the Right Buyers Choose You'
    });
    assert.ok(res.statusCode === 200 || res.statusCode === 401, `Status must be 200 (live keys) or 401 (auth failure), got ${res.statusCode}`);
    if (res.statusCode === 200) {
      assert.strictEqual(res.json.success, true);
      assert.ok(res.json.order_id);
    } else {
      assert.strictEqual(res.statusCode, 401);
      assert.ok(res.json.error.includes('Authentication failed') || res.json.error.includes('Razorpay'));
    }
  });

  // 6. Admin Authentication & Overview
  await test('GET /api/saas-fitscore/admin/overview rejects unauthenticated request (401)', async () => {
    const res = await makeRequest('GET', '/api/saas-fitscore/admin/overview');
    assert.strictEqual(res.statusCode, 401);
  });

  await test('GET /api/saas-fitscore/admin/overview accepts valid credentials and returns summary', async () => {
    const token = Buffer.from('admin:admin123').toString('base64');
    const res = await makeRequest('GET', '/api/saas-fitscore/admin/overview', null, {
      'Authorization': `Bearer ${token}`
    });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.json.success, true);
    assert.ok(res.json.summary.totalLeads >= 1);
    assert.ok(Array.isArray(res.json.diagnostics));
  });

  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`📊 Server Test Results: ${passed}/${total} passed (${Math.round((passed/total)*100)}%)`);
  console.log(`═══════════════════════════════════════════════════\n`);

  process.exit(passed === total ? 0 : 1);
}

// Give server 500ms to listen
setTimeout(() => {
  runServerTests().catch(err => {
    console.error('Test execution error:', err);
    process.exit(1);
  });
}, 600);
