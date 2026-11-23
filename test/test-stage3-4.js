/**
 * Stage 3 & 4 Automated Verification Test Suite
 * Tests SSRF Protection, Crawler HTML extraction, and Firestore CRUD operations
 */

const assert = require('assert');
const { validateUrlForSSRF, isSameOrSubDomain, isForbiddenIPv4 } = require('../lib/saas-fitscore/ssrf-guard');
const { extractHtmlText } = require('../lib/saas-fitscore/crawler');
const firestore = require('../lib/saas-fitscore/firestore');

async function runTests() {
  console.log('═══════════════════════════════════════════════════');
  console.log('🧪 Starting Stage 3 & 4 Verification Tests');
  console.log('═══════════════════════════════════════════════════\n');

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${name}:`, err.message);
    }
  }

  async function asyncTest(name, fn) {
    total++;
    try {
      await fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${name}:`, err.message);
    }
  }

  // ─── 1. SSRF GUARD TESTS ───
  console.log('--- 1. SSRF Guard Tests ---');

  test('isForbiddenIPv4 identifies loopback and private ranges', () => {
    assert.strictEqual(isForbiddenIPv4('127.0.0.1'), true, '127.0.0.1 must be blocked');
    assert.strictEqual(isForbiddenIPv4('127.255.255.255'), true, '127.x must be blocked');
    assert.strictEqual(isForbiddenIPv4('10.0.0.1'), true, '10.x must be blocked');
    assert.strictEqual(isForbiddenIPv4('172.16.0.5'), true, '172.16.x must be blocked');
    assert.strictEqual(isForbiddenIPv4('192.168.1.1'), true, '192.168.x must be blocked');
    assert.strictEqual(isForbiddenIPv4('169.254.169.254'), true, 'Cloud metadata must be blocked');
    assert.strictEqual(isForbiddenIPv4('8.8.8.8'), false, 'Public DNS 8.8.8.8 must be allowed');
    assert.strictEqual(isForbiddenIPv4('1.1.1.1'), false, 'Public IP 1.1.1.1 must be allowed');
  });

  await asyncTest('validateUrlForSSRF blocks forbidden localhost & metadata URLs', async () => {
    const r1 = await validateUrlForSSRF('http://localhost:3000');
    assert.strictEqual(r1.valid, false, 'localhost should be blocked');

    const r2 = await validateUrlForSSRF('http://127.0.0.1/admin');
    assert.strictEqual(r2.valid, false, '127.0.0.1 should be blocked');

    const r3 = await validateUrlForSSRF('http://169.254.169.254/latest/meta-data/');
    assert.strictEqual(r3.valid, false, '169.254.169.254 should be blocked');

    const r4 = await validateUrlForSSRF('ftp://example.com/file');
    assert.strictEqual(r4.valid, false, 'ftp protocol should be blocked');

    const r5 = await validateUrlForSSRF('http://admin:secret@example.com');
    assert.strictEqual(r5.valid, false, 'Embedded credentials must be blocked');
  });

  test('isSameOrSubDomain correctly identifies domain boundaries', () => {
    assert.strictEqual(isSameOrSubDomain('https://adsvise.in/pricing', 'adsvise.in'), true);
    assert.strictEqual(isSameOrSubDomain('https://app.adsvise.in/signup', 'adsvise.in'), true);
    assert.strictEqual(isSameOrSubDomain('https://malicious.com', 'adsvise.in'), false);
    assert.strictEqual(isSameOrSubDomain('https://notadsvise.in', 'adsvise.in'), false);
  });

  // ─── 2. CRAWLER HTML EXTRACTOR TESTS ───
  console.log('\n--- 2. Crawler HTML Extractor Tests ---');

  test('extractHtmlText strips scripts and preserves headings/text', () => {
    const sampleHtml = `
      <!DOCTYPE html>
      <html>
      <head><title>SaaS Product — AI Growth Engine</title></head>
      <body>
        <script>const secret = "should_not_appear";</script>
        <style>.hide { display: none; }</style>
        <h1>Turn Visitors Into Customers</h1>
        <p>Our pricing starts at $49/mo for early-stage teams.</p>
        <a href="/pricing">View Pricing</a>
        <a href="https://external.com/blog">External</a>
      </body>
      </html>
    `;

    const extracted = extractHtmlText(sampleHtml);
    assert.strictEqual(extracted.title, 'SaaS Product — AI Growth Engine');
    assert.ok(extracted.text.includes('Turn Visitors Into Customers'), 'Must contain h1');
    assert.ok(extracted.text.includes('$49/mo'), 'Must contain pricing text');
    assert.ok(!extracted.text.includes('secret ='), 'Must strip script tags');
    assert.ok(!extracted.text.includes('.hide'), 'Must strip style tags');
    assert.ok(extracted.links.includes('/pricing'), 'Must discover internal links');
  });

  // ─── 3. FIRESTORE & DATA PERSISTENCE TESTS ───
  console.log('\n--- 3. Firestore & Data Persistence Tests ---');

  await asyncTest('createLead and retrieve lead record', async () => {
    const testLead = {
      name: 'Stage Test Founder',
      email: 'stage_test@saasfitscore.io',
      company: 'TestMetrics Inc',
      websiteUrl: 'https://testmetrics.io',
      consentGranted: true
    };

    const lead = await firestore.createLead(testLead);
    assert.ok(lead.id, 'Lead must have generated ID');
    assert.strictEqual(lead.email, 'stage_test@saasfitscore.io');
    assert.strictEqual(lead.consentRecord.granted, true);

    const fetched = await firestore.getDocument('leads', lead.id);
    assert.ok(fetched, 'Must fetch created lead');
    assert.strictEqual(fetched.company, 'TestMetrics Inc');
  });

  await asyncTest('createDiagnostic and update stages', async () => {
    const diag = await firestore.createDiagnostic({
      leadId: 'test_lead_123',
      websiteUrl: 'https://testmetrics.io',
      questionnaireAnswers: {
        businessModel: 'Freemium',
        pricingModel: 'Tiered plans',
        challenges: ['Attracting qualified visitors']
      }
    });

    assert.ok(diag.id, 'Diagnostic must have ID');
    assert.strictEqual(diag.status, 'submitted');

    // Update to crawled
    const updated = await firestore.updateDiagnostic(diag.id, {
      status: 'crawling',
      stage: 'crawled'
    });

    assert.strictEqual(updated.stage, 'crawled');
  });

  await asyncTest('createCrawlRecord stores crawled pages', async () => {
    const crawl = await firestore.createCrawlRecord({
      diagnosticId: 'diag_test_999',
      targetUrl: 'https://testmetrics.io',
      pages: [
        {
          url: 'https://testmetrics.io',
          pageTitle: 'Home',
          extractedContent: 'Sample homepage content',
          crawlStatus: 'success',
          timestamp: new Date().toISOString(),
          sourceType: 'http_fallback'
        },
        {
          url: 'https://testmetrics.io/pricing',
          pageTitle: 'Pricing',
          extractedContent: 'Starter $29, Pro $79',
          crawlStatus: 'success',
          timestamp: new Date().toISOString(),
          sourceType: 'http_fallback'
        }
      ]
    });

    assert.ok(crawl.id, 'Crawl must have ID');
    assert.strictEqual(crawl.pagesCount, 2);
    assert.strictEqual(crawl.pages[1].pageTitle, 'Pricing');
  });

  await asyncTest('createReport and retrieve by secure token', async () => {
    const sampleReport = {
      diagnosticId: 'diag_test_999',
      overallScore: 78,
      overallRating: 'Strong Foundation',
      dimensions: {
        positioning: { score: 72 },
        acquisition: { score: 85 }
      },
      topConstraints: ['Positioning needs tighter outcome articulation']
    };

    const rep = await firestore.createReport(sampleReport);
    assert.ok(rep.reportToken, 'Report must generate cryptographically secure token');

    const fetchedByToken = await firestore.getReportByToken(rep.reportToken);
    assert.ok(fetchedByToken, 'Report must be retrievable by non-guessable token');
    assert.strictEqual(fetchedByToken.overallScore, 78);
  });

  await asyncTest('recordEvent logs event in events collection', async () => {
    const ev = await firestore.recordEvent('assessment_submitted', {
      email: 'stage_test@saasfitscore.io',
      source: 'web_form'
    });

    assert.ok(ev.id, 'Event must have ID');
    assert.strictEqual(ev.name, 'assessment_submitted');
  });

  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`📊 Test Results: ${passed}/${total} passed (${Math.round((passed/total)*100)}%)`);
  console.log(`═══════════════════════════════════════════════════\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
