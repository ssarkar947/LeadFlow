/**
 * SaaS FitScore — Backend API Router
 * Seamlessly integrates into server.js
 * 
 * Endpoints:
 * - POST /api/saas-fitscore/submit (submit assessment, starts async pipeline)
 * - GET  /api/saas-fitscore/status/:diagnosticId (poll status)
 * - GET  /api/saas-fitscore/report?token=XYZ (fetch report by secure token)
 * - POST /api/saas-fitscore/create-paid-order (Razorpay order for paid product)
 * - POST /api/saas-fitscore/verify-paid-payment (Razorpay payment verification)
 * - POST /api/saas-fitscore/webhook (Razorpay webhook verification)
 * - GET  /api/saas-fitscore/admin/overview (protected admin monitoring & leads)
 * - POST /api/saas-fitscore/admin/retry/:diagnosticId (retry failed stage)
 */

const crypto = require('crypto');
const firestore = require('./firestore');
const { crawlSaaSWebsite } = require('./crawler');
const { calculateFitScore } = require('./scoring');
const { analyzeWithGemini } = require('./gemini');
const { sendFitScoreEmail, sendCustomerLeadNotification } = require('./mailer');

const PAID_PRODUCT_AMOUNT_PAISE = parseInt(process.env.PAID_PRODUCT_PRICE_PAISE || '499900', 10); // ₹4,999

/**
 * Checks rate limit: One free assessment per email per 30 days
 */
async function checkEmailRateLimit(email) {
  try {
    const leads = await firestore.listDocuments('leads');
    const matching = leads.filter(l => l.email && l.email.toLowerCase() === email.toLowerCase());
    if (matching.length === 0) return { allowed: true };

    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const recent = matching.find(l => {
      const created = new Date(l.created_at || l.createdAt).getTime();
      return created > thirtyDaysAgo;
    });

    if (recent) {
      return {
        allowed: false,
        message: 'A free assessment was already generated for this email within the last 30 days. Please check your inbox or view your previous report.'
      };
    }
  } catch (err) {
    console.warn('[Rate Limit Warning]', err.message);
  }
  return { allowed: true };
}

/**
 * Background Execution Pipeline:
 * 1. Crawl public website (up to 10 pages) with SSRF guard
 * 2. Deterministic five-dimension scoring
 * 3. Gemini positioning & growth consultative analysis
 * 4. Save report with cryptographically random token
 * 5. Send results email via Hostinger SMTP
 */
async function runAssessmentPipeline(diagnosticId, founderData) {
  console.log(`[Pipeline] Starting background evaluation for diagnostic ${diagnosticId}`);

  try {
    // ── STAGE 1: CRAWL ──
    await firestore.updateDiagnostic(diagnosticId, { status: 'crawling', stage: 'crawled' });
    await firestore.recordEvent('crawl_started', { diagnosticId, url: founderData.websiteUrl });

    const crawlResult = await crawlSaaSWebsite(founderData.websiteUrl, 10);
    await firestore.createCrawlRecord({
      diagnosticId,
      targetUrl: founderData.websiteUrl,
      pages: crawlResult.pages,
      crawlStatus: crawlResult.success ? 'completed' : 'partial'
    });
    await firestore.recordEvent('crawl_completed', {
      diagnosticId,
      pagesCrawled: crawlResult.pagesCrawled,
      sourceType: crawlResult.sourceType
    });

    // ── STAGE 2: DETERMINISTIC SCORING ──
    await firestore.updateDiagnostic(diagnosticId, { status: 'scoring', stage: 'scored' });
    const deterministicScores = calculateFitScore(founderData, crawlResult.pages);

    // ── STAGE 3: GEMINI POSITIONING & GROWTH ANALYSIS ──
    await firestore.updateDiagnostic(diagnosticId, { status: 'analyzing', stage: 'analyzed' });
    const qualitativeAnalysis = await analyzeWithGemini(founderData, crawlResult.pages, deterministicScores);
    await firestore.recordEvent('analysis_completed', { diagnosticId });

    // ── STAGE 4: COMPILE & SAVE REPORT ──
    const reportToken = crypto.randomBytes(24).toString('hex');
    const reportPayload = {
      diagnosticId,
      reportToken,
      overallScore: deterministicScores.overallScore,
      overallRating: deterministicScores.overallRating,
      interpretationLabel: deterministicScores.interpretationLabel,
      dimensions: deterministicScores.dimensions,
      evidenceCoverage: deterministicScores.evidenceCoverage,
      topConstraints: qualitativeAnalysis.topConstraints,
      findings: qualitativeAnalysis.findings,
      actionPlan: qualitativeAnalysis.actionPlan,
      recommendedMetrics: qualitativeAnalysis.recommendedMetrics,
      executiveSummary: qualitativeAnalysis.executiveSummary,
      websiteUrl: founderData.websiteUrl,
      company: founderData.company,
      founderName: founderData.name
    };

    const savedReport = await firestore.createReport(reportPayload);
    await firestore.recordEvent('report_generated', { diagnosticId, reportId: savedReport.id });

    // ── STAGE 5: SEND EMAIL VIA HOSTINGER SMTP ──
    await sendFitScoreEmail(founderData.email, founderData.name, reportPayload);
    await firestore.recordEvent('email_sent', { diagnosticId, email: founderData.email });

    // Send completed report scorecard update to admin (ssarkar947@gmail.com)
    await sendCustomerLeadNotification(founderData, diagnosticId, reportPayload).catch(e => {
      console.warn('[Admin Report Notification Notice]', e.message);
    });

    // Mark completed
    await firestore.updateDiagnostic(diagnosticId, {
      status: 'completed',
      stage: 'completed',
      reportId: savedReport.id,
      reportToken: savedReport.reportToken,
      completed_at: new Date().toISOString()
    });

    console.log(`[Pipeline Success] Diagnostic ${diagnosticId} completed with score ${deterministicScores.overallScore}/100!`);
  } catch (pipelineErr) {
    console.error(`[Pipeline Error] Failed on diagnostic ${diagnosticId}:`, pipelineErr);
    await firestore.updateDiagnostic(diagnosticId, {
      status: 'failed',
      error: pipelineErr.message,
      failed_at: new Date().toISOString()
    });
    await firestore.recordEvent('pipeline_failed', { diagnosticId, error: pipelineErr.message });
  }
}

/**
 * Handle incoming SaaS FitScore API Requests
 * Returns true if handled, false if not matched
 */
async function handleSaaSFitScoreApi(req, res) {
  const urlParts = req.url.split('?');
  const pathname = urlParts[0];

  // Helper to send JSON response
  function sendJson(statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }

  // 1. POST /api/saas-fitscore/submit
  if (req.method === 'POST' && pathname === '/api/saas-fitscore/submit') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);

        // Auto-derive company name from websiteUrl if missing
        if (!data.company && data.websiteUrl) {
          try {
            const parsed = new URL(data.websiteUrl.startsWith('http') ? data.websiteUrl : 'https://' + data.websiteUrl);
            const host = parsed.hostname.replace(/^www\./i, '');
            const namePart = host.split('.')[0] || 'Your SaaS';
            data.company = namePart.charAt(0).toUpperCase() + namePart.slice(1);
          } catch (e) {
            data.company = 'Your SaaS';
          }
        }

        // Validation
        if (!data.name || !data.email || !data.websiteUrl) {
          return sendJson(400, { success: false, error: 'Name, work email, and SaaS website URL are required.' });
        }

        if (!data.consentGranted) {
          return sendJson(400, { success: false, error: 'User consent is required for website analysis.' });
        }

        // Rate Limit Check (1 per email per 30 days)
        const rateLimit = await checkEmailRateLimit(data.email);
        if (!rateLimit.allowed) {
          return sendJson(429, { success: false, error: rateLimit.message });
        }

        // Create Lead
        const lead = await firestore.createLead({
          name: data.name,
          email: data.email,
          company: data.company,
          websiteUrl: data.websiteUrl,
          consentGranted: true,
          userAgent: req.headers['user-agent']
        });

        // Create Diagnostic
        const diag = await firestore.createDiagnostic({
          leadId: lead.id,
          websiteUrl: data.websiteUrl,
          questionnaireAnswers: data,
          status: 'submitted',
          stage: 'registered'
        });

        await firestore.recordEvent('assessment_submitted', { leadId: lead.id, diagnosticId: diag.id });

        // Immediate email notification to admin (ssarkar947@gmail.com) with customer information
        sendCustomerLeadNotification(data, diag.id).catch(mailErr => {
          console.error('[Admin Notification Error]', mailErr.message);
        });

        // Trigger async pipeline in background
        setImmediate(() => {
          runAssessmentPipeline(diag.id, data);
        });

        return sendJson(200, {
          success: true,
          diagnosticId: diag.id,
          leadId: lead.id,
          message: 'Assessment initiated'
        });
      } catch (err) {
        console.error('[API Submit Error]', err);
        return sendJson(400, { success: false, error: 'Invalid JSON payload' });
      }
    });
    return true;
  }

  // 2. GET /api/saas-fitscore/status/:id
  if (req.method === 'GET' && pathname.startsWith('/api/saas-fitscore/status/')) {
    const diagnosticId = pathname.replace('/api/saas-fitscore/status/', '').trim();
    try {
      const diag = await firestore.getDocument('diagnostics', diagnosticId);
      if (!diag) {
        return sendJson(404, { success: false, error: 'Diagnostic not found' });
      }

      let reportData = null;
      if (diag.status === 'completed' && diag.reportId) {
        reportData = await firestore.getDocument('reports', diag.reportId);
      }

      return sendJson(200, {
        success: true,
        diagnosticId,
        status: diag.status,
        stage: diag.stage,
        error: diag.error || null,
        report: reportData
      });
    } catch (err) {
      return sendJson(500, { success: false, error: err.message });
    }
  }

  // 3. GET /api/saas-fitscore/report?token=XYZ
  if (req.method === 'GET' && pathname === '/api/saas-fitscore/report') {
    const params = new URLSearchParams(urlParts[1] || '');
    const token = params.get('token');
    if (!token) {
      return sendJson(400, { success: false, error: 'Report token is required' });
    }

    try {
      const report = await firestore.getReportByToken(token);
      if (!report) {
        return sendJson(404, { success: false, error: 'Report not found or expired' });
      }

      await firestore.recordEvent('report_viewed', { reportToken: token, reportId: report.id });
      return sendJson(200, { success: true, report });
    } catch (err) {
      return sendJson(500, { success: false, error: err.message });
    }
  }

  // 4. POST /api/saas-fitscore/create-paid-order (Razorpay order for paid product)
  if (req.method === 'POST' && pathname === '/api/saas-fitscore/create-paid-order') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const data = body ? JSON.parse(body) : {};
        const keyId = process.env.RAZORPAY_KEY_ID;
        const keySecret = process.env.RAZORPAY_KEY_SECRET;

        if (!keyId || !keySecret) {
          return sendJson(500, { success: false, error: 'Razorpay credentials not configured on server' });
        }

        let Razorpay;
        try {
          Razorpay = require('razorpay');
        } catch {
          return sendJson(500, { success: false, error: 'Razorpay SDK missing' });
        }

        const rzp = new Razorpay({ key_id: keyId, key_secret: keySecret });
        const receipt = 'fitscore_sys_' + Date.now();
        const order = await rzp.orders.create({
          amount: PAID_PRODUCT_AMOUNT_PAISE,
          currency: 'INR',
          receipt,
          notes: {
            product: 'System to Make the Right Buyers Choose You',
            leadId: data.leadId || ''
          }
        });

        await firestore.createPaymentRecord({
          leadId: data.leadId || '',
          product: 'System to Make the Right Buyers Choose You',
          orderId: order.id,
          status: 'order_created',
          amount: PAID_PRODUCT_AMOUNT_PAISE / 100,
          currency: 'INR'
        });

        await firestore.recordEvent('payment_initiated', { orderId: order.id, amount: order.amount });

        return sendJson(200, {
          success: true,
          order_id: order.id,
          amount: order.amount,
          currency: order.currency,
          key_id: keyId
        });
      } catch (err) {
        console.error('[SaaS FitScore Razorpay Error]:', err);
        const statusCode = (err && (err.statusCode === 401 || (err.error && err.error.code === 'BAD_REQUEST_ERROR' && err.statusCode === 401))) ? 401 : 500;
        return sendJson(statusCode, {
          success: false,
          error: (err.error && err.error.description) ? err.error.description : (err.message || 'Razorpay order creation failed')
        });
      }
    });
    return true;
  }

  // 5. POST /api/saas-fitscore/verify-paid-payment
  if (req.method === 'POST' && pathname === '/api/saas-fitscore/verify-paid-payment') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const orderId = data.razorpay_order_id;
        const paymentId = data.razorpay_payment_id;
        const signature = data.razorpay_signature;

        if (!orderId || !paymentId || !signature) {
          return sendJson(400, { success: false, error: 'Missing payment verification fields' });
        }

        const keySecret = process.env.RAZORPAY_KEY_SECRET;
        const expectedSignature = crypto
          .createHmac('sha256', keySecret)
          .update(`${orderId}|${paymentId}`)
          .digest('hex');

        if (expectedSignature !== signature) {
          console.warn(`[Razorpay Security Alert] Signature mismatch for order ${orderId}`);
          return sendJson(400, { success: false, error: 'Invalid payment signature. Verification failed.' });
        }

        // Update payment record
        await firestore.updatePaymentRecord(orderId, {
          paymentId,
          status: 'paid',
          verified: true,
          verified_at: new Date().toISOString()
        });

        await firestore.recordEvent('payment_completed', { orderId, paymentId });

        return sendJson(200, {
          success: true,
          message: 'Payment verified successfully',
          order_id: orderId,
          payment_id: paymentId
        });
      } catch (err) {
        return sendJson(400, { success: false, error: err.message });
      }
    });
    return true;
  }

  // 6. Admin Authentication & Overview
  function checkAdminAuth() {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    const envUser = process.env.DASHBOARD_USER || 'admin';
    const envPass = process.env.DASHBOARD_PASSWORD || 'admin123';
    const expected = Buffer.from(`${envUser}:${envPass}`).toString('base64');
    return token === expected;
  }

  if (req.method === 'GET' && pathname === '/api/saas-fitscore/admin/overview') {
    if (!checkAdminAuth()) {
      return sendJson(401, { error: 'Unauthorized' });
    }

    try {
      const [leads, diagnostics, reports, payments, events] = await Promise.all([
        firestore.listDocuments('leads'),
        firestore.listDocuments('diagnostics'),
        firestore.listDocuments('reports'),
        firestore.listDocuments('payments'),
        firestore.listDocuments('events')
      ]);

      return sendJson(200, {
        success: true,
        summary: {
          totalLeads: leads.length,
          totalDiagnostics: diagnostics.length,
          totalReports: reports.length,
          totalPayments: payments.length,
          completedRate: diagnostics.length > 0 ? Math.round((diagnostics.filter(d => d.status === 'completed').length / diagnostics.length) * 100) : 0
        },
        leads,
        diagnostics,
        reports,
        payments,
        recentEvents: events.slice(-50)
      });
    } catch (err) {
      return sendJson(500, { success: false, error: err.message });
    }
  }

  // 7. POST /api/saas-fitscore/admin/retry/:id
  if (req.method === 'POST' && pathname.startsWith('/api/saas-fitscore/admin/retry/')) {
    if (!checkAdminAuth()) {
      return sendJson(401, { error: 'Unauthorized' });
    }
    const diagnosticId = pathname.replace('/api/saas-fitscore/admin/retry/', '').trim();
    const diag = await firestore.getDocument('diagnostics', diagnosticId);
    if (!diag) return sendJson(404, { success: false, error: 'Diagnostic not found' });

    // Rerun pipeline
    setImmediate(() => {
      runAssessmentPipeline(diagnosticId, diag.questionnaireAnswers);
    });

    return sendJson(200, { success: true, message: `Retrying diagnostic ${diagnosticId}` });
  }

  return false;
}

module.exports = {
  handleSaaSFitScoreApi,
  runAssessmentPipeline,
  checkEmailRateLimit
};
