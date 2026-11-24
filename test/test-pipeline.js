/**
 * End-to-End Pipeline & Integration Test Suite
 * Tests deterministic scoring, Gemini/consultative analysis, email generation, and API pipeline
 */

const fs = require('fs');
const path = require('path');

// Load environment variables from local .env file
try {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const envData = fs.readFileSync(envPath, 'utf8');
    envData.split(/\r?\n/).forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        process.env[key] = value;
      }
    });
  }
} catch (e) {}

const assert = require('assert');
const { calculateFitScore } = require('../lib/saas-fitscore/scoring');
const { analyzeWithGemini } = require('../lib/saas-fitscore/gemini');
const { sendFitScoreEmail, sendCustomerLeadNotification, ADMIN_EMAIL } = require('../lib/saas-fitscore/mailer');
const { selectTargetedSaaSUrls, PROMPT_TARGET_CATEGORIES, EXCLUDED_PATTERNS } = require('../lib/saas-fitscore/crawler');
const { runAssessmentPipeline, checkEmailRateLimit } = require('../lib/saas-fitscore/router');
const firestore = require('../lib/saas-fitscore/firestore');

async function runPipelineTests() {
  console.log('═══════════════════════════════════════════════════');
  console.log('🧪 Starting Full Pipeline & Scoring Integration Tests');
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

  // ─── 1. DETERMINISTIC SCORING ENGINE ───
  console.log('--- 1. Deterministic Scoring Engine Tests ---');

  test('calculateFitScore produces valid weighted 5-dimension scores', () => {
    const founderAnswers = {
      name: 'Elena Rostova',
      email: 'elena@flowdesk.io',
      company: 'FlowDesk',
      websiteUrl: 'https://flowdesk.io',
      productDescription: 'Automated workflow intelligence for enterprise customer support teams',
      idealCustomer: 'VP of Customer Experience at B2B SaaS companies with 50+ agents',
      businessModel: 'Freemium',
      pricingModel: 'Tiered plans',
      monthlySignups: '500–2,000',
      freeToPaidConversion: '3–5%',
      approxMrr: '$10,000–$25,000',
      dropOff: 'Users activate but do not pay',
      challenges: ['Converting free users into paying customers', 'Improving pricing and packaging']
    };

    const mockCrawledPages = [
      {
        url: 'https://flowdesk.io',
        pageTitle: 'FlowDesk — Support Automation',
        extractedContent: 'FlowDesk helps reduce support ticket resolution times and increase revenue through AI automation. Free trial available.',
        crawlStatus: 'success',
        sourceType: 'http_fallback'
      },
      {
        url: 'https://flowdesk.io/pricing',
        pageTitle: 'Pricing Plans — FlowDesk',
        extractedContent: 'Starter $49/mo, Pro $149/mo, Enterprise custom. Per seat billing with annual discounts.',
        crawlStatus: 'success',
        sourceType: 'http_fallback'
      },
      {
        url: 'https://flowdesk.io/integrations',
        pageTitle: 'Integrations',
        extractedContent: 'Connect with Zendesk, Salesforce, Slack, and Jira in minutes. SOC2 compliant and GDPR ready.',
        crawlStatus: 'success',
        sourceType: 'http_fallback'
      }
    ];

    const result = calculateFitScore(founderAnswers, mockCrawledPages);

    assert.ok(result.overallScore >= 0 && result.overallScore <= 100, 'Overall score must be 0-100');
    assert.ok(result.overallRating, 'Must include rating interpretation');
    assert.ok(result.evidenceCoverage >= 0 && result.evidenceCoverage <= 100, 'Coverage must be 0-100');
    
    // Check all 5 dimensions
    const dims = ['positioning', 'acquisition', 'activation', 'monetisation', 'retention'];
    dims.forEach(dim => {
      assert.ok(result.dimensions[dim], `Must have ${dim} score`);
      assert.ok(result.dimensions[dim].score >= 0 && result.dimensions[dim].score <= 100);
      assert.strictEqual(result.dimensions[dim].weight, '20%');
    });

    console.log(`   Sample FitScore: ${result.overallScore}/100 (${result.overallRating}) | Coverage: ${result.evidenceCoverage}%`);
  });

  // ─── 2. GEMINI / CONSULTATIVE ANALYSIS ───
  console.log('\n--- 2. Consultative Analysis Engine Tests ---');

  await asyncTest('analyzeWithGemini returns complete structured schema', async () => {
    const founderAnswers = {
      name: 'Alex Chen',
      email: 'alex@metricvault.com',
      company: 'MetricVault',
      idealCustomer: 'Mid-market CFOs and Finance teams',
      productDescription: 'Unified cloud cost analytics and automated wastage reduction',
      businessModel: 'Free trial',
      dropOff: 'Visitors do not sign up',
      challenges: ['Attracting qualified visitors', 'Differentiating from competitors']
    };

    const mockScores = {
      overallScore: 68,
      overallRating: 'Developing',
      dimensions: {
        positioning: { score: 62 },
        acquisition: { score: 70 },
        activation: { score: 65 },
        monetisation: { score: 72 },
        retention: { score: 70 }
      }
    };

    const analysis = await analyzeWithGemini(founderAnswers, [], mockScores);

    assert.ok(analysis.executiveSummary, 'Must contain executive summary');
    assert.ok(Array.isArray(analysis.topConstraints), 'Must have topConstraints array');
    assert.ok(analysis.topConstraints.length >= 2, 'Must identify top constraints (at least 2-3)');
    assert.ok(Array.isArray(analysis.findings), 'Must have findings array');
    assert.ok(analysis.findings.length >= 3, 'Must have at least 3 detailed findings');
    
    // Check finding properties
    const firstFinding = analysis.findings[0];
    assert.ok(firstFinding.dimension, 'Finding must have dimension');
    assert.ok(firstFinding.evidenceType, 'Finding must specify evidenceType');
    assert.ok(firstFinding.severity, 'Finding must specify severity');
    assert.ok(firstFinding.recommendedAction, 'Finding must specify recommendedAction');

    // Check action plan horizons
    assert.ok(Array.isArray(analysis.actionPlan.thirtyDays), 'Must have 30-day action plan');
    assert.ok(Array.isArray(analysis.actionPlan.sixtyDays), 'Must have 60-day action plan');
    assert.ok(Array.isArray(analysis.actionPlan.ninetyDays), 'Must have 90-day action plan');
    assert.ok(Array.isArray(analysis.recommendedMetrics), 'Must recommend metrics');
  });

  // ─── 3. TARGETED CRAWLER SCOPING & TRANSACTIONAL EMAIL TESTS ───
  console.log('\n--- 3. Targeted Crawler & Email Dispatch Tests ---');

  test('selectTargetedSaaSUrls strictly scopes crawl to prompt-defined pages and rejects blogs/legal/terms', () => {
    const candidateUrls = [
      'https://saascloud.io',
      'https://saascloud.io/pricing',
      'https://saascloud.io/features',
      'https://saascloud.io/solutions/fintech',
      'https://saascloud.io/integrations',
      'https://saascloud.io/blog/scaling-tips-2026',
      'https://saascloud.io/privacy-policy.html',
      'https://saascloud.io/terms-of-service',
      'https://saascloud.io/careers/backend-lead',
      'https://saascloud.io/app/dashboard',
      'https://saascloud.io/docs/quickstart'
    ];

    const targets = selectTargetedSaaSUrls('https://saascloud.io', candidateUrls, 10);
    const targetUrls = targets.map(t => t.url);

    assert.ok(targetUrls.includes('https://saascloud.io'), 'Must include homepage');
    assert.ok(targetUrls.includes('https://saascloud.io/pricing'), 'Must include pricing');
    assert.ok(targetUrls.includes('https://saascloud.io/features'), 'Must include features');
    assert.ok(targetUrls.includes('https://saascloud.io/solutions/fintech'), 'Must include solutions');
    assert.ok(targetUrls.includes('https://saascloud.io/integrations'), 'Must include integrations');
    assert.ok(targetUrls.includes('https://saascloud.io/docs/quickstart'), 'Must include docs');

    // Strict Exclusions
    assert.strictEqual(targetUrls.includes('https://saascloud.io/blog/scaling-tips-2026'), false, 'Blog must be excluded');
    assert.strictEqual(targetUrls.includes('https://saascloud.io/privacy-policy.html'), false, 'Privacy policy must be excluded');
    assert.strictEqual(targetUrls.includes('https://saascloud.io/terms-of-service'), false, 'Terms must be excluded');
    assert.strictEqual(targetUrls.includes('https://saascloud.io/careers/backend-lead'), false, 'Careers must be excluded');
    assert.strictEqual(targetUrls.includes('https://saascloud.io/app/dashboard'), false, 'In-app pages must be excluded');
    assert.ok(targets.length <= 10, 'Must not exceed max 10 pages');
  });

  await asyncTest('sendCustomerLeadNotification dispatches customer info to ssarkar947@gmail.com', async () => {
    assert.strictEqual(ADMIN_EMAIL, 'ssarkar947@gmail.com', 'Admin recipient must be ssarkar947@gmail.com');

    const customerData = {
      name: 'Rohan Sharma',
      email: 'rohan@finflow.io',
      websiteUrl: 'https://finflow.io',
      company: 'Finflow',
      businessModel: 'Free trial',
      pricingModel: 'Tiered plans',
      challenges: ['Getting visitors to sign up', 'Differentiating from competitors'],
      dropOff: 'Visitors do not sign up',
      monthlySignups: '500–2,000',
      freeToPaidConversion: '3–5%',
      approxMrr: '$10,000–$25,000',
      next90DaysGoal: 'Double conversion rate to 6%'
    };

    const notifRes = await sendCustomerLeadNotification(customerData, 'diag_test_12345');
    assert.strictEqual(notifRes.success, true, 'Customer lead notification dispatch must succeed');
  });

  await asyncTest('sendFitScoreEmail builds HTML and dispatches gracefully', async () => {
    const mockReport = {
      reportToken: 'test_token_abcdef123456',
      overallScore: 76,
      overallRating: 'Strong Foundation',
      dimensions: {
        positioning: { score: 72 },
        acquisition: { score: 82 },
        activation: { score: 68 },
        monetisation: { score: 80 },
        retention: { score: 76 }
      }
    };

    const emailRes = await sendFitScoreEmail('founder_test@example.com', 'Alex Chen', mockReport);
    assert.strictEqual(emailRes.success, true, 'Email dispatch must succeed (or log mock if credentials not set)');
  });

  // ─── 4. FULL ASYNC PIPELINE INTEGRATION ───
  console.log('\n--- 4. Full Asynchronous Pipeline Execution Tests ---');

  await asyncTest('runAssessmentPipeline executes end-to-end and updates status to completed', async () => {
    // 1. Create Lead
    const lead = await firestore.createLead({
      name: 'Marcus Vance',
      email: 'marcus@leadpipeline.io',
      company: 'LeadPipeline',
      websiteUrl: 'https://adsvise.in', // use local or existing safe domain
      consentGranted: true
    });

    // 2. Create Diagnostic
    const diag = await firestore.createDiagnostic({
      leadId: lead.id,
      websiteUrl: 'https://adsvise.in',
      questionnaireAnswers: {
        name: 'Marcus Vance',
        email: 'marcus@leadpipeline.io',
        company: 'LeadPipeline',
        websiteUrl: 'https://adsvise.in',
        productDescription: 'B2B Marketing intelligence platform',
        idealCustomer: 'B2B Founders & Marketing Leaders',
        businessModel: 'Paid subscription',
        pricingModel: 'Monthly subscription',
        monthlySignups: '100–500',
        freeToPaidConversion: '3–5%',
        approxMrr: '$5,000–$10,000',
        dropOff: 'Visitors do not sign up',
        challenges: ['Getting visitors to sign up']
      }
    });

    // 3. Run Pipeline
    await runAssessmentPipeline(diag.id, diag.questionnaireAnswers);

    // 4. Inspect final diagnostic record
    const updatedDiag = await firestore.getDocument('diagnostics', diag.id);
    assert.strictEqual(updatedDiag.status, 'completed', 'Diagnostic must complete successfully');
    assert.ok(updatedDiag.reportId, 'Diagnostic must be linked to reportId');
    assert.ok(updatedDiag.reportToken, 'Diagnostic must have reportToken');

    // 5. Inspect final report
    const report = await firestore.getDocument('reports', updatedDiag.reportId);
    assert.ok(report, 'Report document must exist');
    assert.ok(report.overallScore > 0, 'Report must have positive overall score');
    assert.strictEqual(report.reportToken, updatedDiag.reportToken);

    // 6. Test retrieving by secure token
    const fetchedByToken = await firestore.getReportByToken(report.reportToken);
    assert.ok(fetchedByToken, 'Report must be retrievable by public token');
    assert.strictEqual(fetchedByToken.id, report.id);
  });

  // ─── 5. RATE LIMIT VERIFICATION ───
  console.log('\n--- 5. 30-Day Email Rate Limit Verification ---');

  await asyncTest('checkEmailRateLimit blocks duplicate submissions within 30 days', async () => {
    // We already inserted marcus@leadpipeline.io in the test above
    const rateCheck = await checkEmailRateLimit('marcus@leadpipeline.io');
    assert.strictEqual(rateCheck.allowed, false, 'Duplicate email within 30 days must be blocked');

    // Fresh email must be allowed
    const freshCheck = await checkEmailRateLimit('fresh_unseen_founder_' + Date.now() + '@example.com');
    assert.strictEqual(freshCheck.allowed, true, 'Unseen email must be allowed');
  });

  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`📊 All Integration Tests: ${passed}/${total} passed (${Math.round((passed/total)*100)}%)`);
  console.log(`═══════════════════════════════════════════════════\n`);

  if (passed !== total) process.exit(1);
}

runPipelineTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
