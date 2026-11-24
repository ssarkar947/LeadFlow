/**
 * SaaS FitScore — Transactional Email Delivery
 * Integrates Hostinger SMTP via nodemailer
 * Sends personalised scorecard results, executive summary, and secure report link.
 */

const nodemailer = require('nodemailer');

const SMTP_CONFIG = {
  host: process.env.SMTP_HOST || 'smtp.hostinger.com',
  port: parseInt(process.env.SMTP_PORT || '465', 10),
  secure: (process.env.SMTP_PORT === '465' || !process.env.SMTP_PORT),
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || ''
  }
};

const SENDER_NAME = process.env.SMTP_FROM_NAME || 'Sourav Sarkar | AdsVise';
const SENDER_EMAIL = process.env.SMTP_USER || 'sourav@adsvise.in';
const ADMIN_EMAIL = process.env.NOTIFICATION_EMAIL || 'ssarkar947@gmail.com';
const BASE_URL = process.env.BASE_URL || 'https://adsvise.in';

/**
 * Format and send the personalized FitScore report email
 */
async function sendFitScoreEmail(recipientEmail, founderName, reportData) {
  const secureReportUrl = `${BASE_URL}/saas-fitscore?token=${reportData.reportToken}`;
  const paidProductUrl = `${BASE_URL}/system-to-choose`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #09090b; color: #f4f4f5; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #18181b; border-radius: 16px; border: 1px solid #27272a; padding: 32px; }
        .header { text-align: center; margin-bottom: 24px; }
        .logo { font-size: 22px; font-weight: 800; color: #fff; letter-spacing: -0.5px; }
        .logo span { color: #3b82f6; }
        .badge { display: inline-block; padding: 4px 12px; background: rgba(59,130,246,0.15); border: 1px solid rgba(59,130,246,0.3); border-radius: 99px; color: #3b82f6; font-size: 12px; font-weight: 700; text-transform: uppercase; margin-bottom: 16px; }
        .score-box { background: #111113; border: 1px solid #27272a; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0; }
        .score-number { font-size: 56px; font-weight: 800; color: #fff; line-height: 1; }
        .score-label { font-size: 16px; font-weight: 700; color: #a3e635; margin-top: 8px; }
        .dimensions-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .dimensions-table td { padding: 10px 0; border-bottom: 1px solid #27272a; font-size: 14px; }
        .dim-name { color: #a1a1aa; font-weight: 500; }
        .dim-val { color: #fff; font-weight: 700; text-align: right; }
        .cta-btn { display: inline-block; background: #3b82f6; color: #fff !important; text-decoration: none; padding: 14px 28px; border-radius: 99px; font-weight: 700; font-size: 15px; text-align: center; margin: 20px 0; }
        .paid-box { background: rgba(59,130,246,0.06); border: 1px solid rgba(59,130,246,0.2); border-radius: 12px; padding: 20px; margin-top: 30px; }
        .footer { text-align: center; margin-top: 32px; font-size: 12px; color: #71717a; border-top: 1px solid #27272a; padding-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">Ads<span>Vise</span></div>
          <div class="badge">Growth Intelligence</div>
          <h1 style="color:#fff; font-size:24px; margin: 8px 0;">Your SaaS FitScore is Ready</h1>
          <p style="color:#a1a1aa; font-size:14px;">Hi ${founderName}, here is your personalized commercial readiness scorecard.</p>
        </div>

        <div class="score-box">
          <div style="font-size: 12px; color: #71717a; text-transform: uppercase; letter-spacing: 0.5px;">Overall SaaS FitScore</div>
          <div class="score-number">${reportData.overallScore}</div>
          <div style="font-size: 14px; color: #71717a;">out of 100</div>
          <div class="score-label">${reportData.overallRating}</div>
        </div>

        <h3 style="color:#fff; font-size:16px; margin-bottom: 8px;">Five Commercial Dimensions Breakdown:</h3>
        <table class="dimensions-table">
          <tr>
            <td class="dim-name">1. Positioning</td>
            <td class="dim-val">${reportData.dimensions?.positioning?.score || 70}/100</td>
          </tr>
          <tr>
            <td class="dim-name">2. Acquisition</td>
            <td class="dim-val">${reportData.dimensions?.acquisition?.score || 80}/100</td>
          </tr>
          <tr>
            <td class="dim-name">3. Activation</td>
            <td class="dim-val">${reportData.dimensions?.activation?.score || 68}/100</td>
          </tr>
          <tr>
            <td class="dim-name">4. Monetisation</td>
            <td class="dim-val">${reportData.dimensions?.monetisation?.score || 78}/100</td>
          </tr>
          <tr>
            <td class="dim-name">5. Retention</td>
            <td class="dim-val">${reportData.dimensions?.retention?.score || 75}/100</td>
          </tr>
        </table>

        <div style="text-align: center;">
          <a href="${secureReportUrl}" class="cta-btn">View Full Scorecard & 90-Day Roadmap &rarr;</a>
        </div>

        <div class="paid-box">
          <h4 style="color:#3b82f6; margin:0 0 8px 0; font-size:15px;">Next Step: Nail Your Positioning</h4>
          <p style="color:#a1a1aa; font-size:13px; line-height:1.5; margin:0 0 12px 0;">
            One of the biggest reasons SaaS companies fail to convert the right customers is that buyers understand what the product does, but not why they should choose it over the alternatives. Explore our deep strategic framework: <strong>System to Make the Right Buyers Choose You</strong>.
          </p>
          <a href="${paidProductUrl}" style="color:#3b82f6; font-size:13px; font-weight:700; text-decoration:none;">Learn More About the System &rarr;</a>
        </div>

        <div class="footer">
          &copy; 2026 AdsVise Marketing Intelligence. All rights reserved.<br>
          Delivered directly to ${recipientEmail} via AdsVise SaaS FitScore.
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `Hi ${founderName},\n\nYour SaaS FitScore is ready.\n\nOverall Score: ${reportData.overallScore}/100 (${reportData.overallRating})\n\nDimension Scores:\n- Positioning: ${reportData.dimensions?.positioning?.score || 70}/100\n- Acquisition: ${reportData.dimensions?.acquisition?.score || 80}/100\n- Activation: ${reportData.dimensions?.activation?.score || 68}/100\n- Monetisation: ${reportData.dimensions?.monetisation?.score || 78}/100\n- Retention: ${reportData.dimensions?.retention?.score || 75}/100\n\nAccess your interactive scorecard, evidence findings, and 90-day action plan here:\n${secureReportUrl}\n\nBest regards,\nSourav Sarkar\nAdsVise Marketing Intelligence\nhttps://adsvise.in/`;

  if (SMTP_CONFIG.auth.user && SMTP_CONFIG.auth.pass) {
    try {
      const transporter = nodemailer.createTransport(SMTP_CONFIG);
      const mailOptions = {
        from: `"${SENDER_NAME}" <${SENDER_EMAIL}>`,
        to: recipientEmail,
        bcc: ADMIN_EMAIL,
        subject: `Your SaaS FitScore is ready: ${reportData.overallScore}/100 (${reportData.overallRating})`,
        text: textContent,
        html: htmlContent
      };

      const info = await transporter.sendMail(mailOptions);
      console.log(`[Hostinger SMTP] FitScore email sent to ${recipientEmail} (MessageId: ${info.messageId})`);
      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.error(`[Hostinger SMTP Error] Failed sending to ${recipientEmail}:`, err.message);
      return { success: false, error: err.message };
    }
  } else {
    console.log(`[Hostinger SMTP Mock] FitScore email prepared for ${recipientEmail}:`);
    console.log(`  Overall: ${reportData.overallScore}/100 (${reportData.overallRating})`);
    console.log(`  Report Link: ${secureReportUrl}`);
    console.log(`  (Configure SMTP_USER & SMTP_PASS in .env to deliver live emails)\n`);
    return { success: true, mock: true };
  }
}

/**
 * Send full customer lead information to ssarkar947@gmail.com for every assessment request generated
 */
async function sendCustomerLeadNotification(customerData, diagnosticId, reportData = null) {
  const adminRecipient = ADMIN_EMAIL; // ssarkar947@gmail.com
  const companyName = customerData.company || 'New SaaS Lead';
  const subject = reportData
    ? `[SaaS FitScore Lead & Scorecard] ${companyName} (${reportData.overallScore}/100) - ${customerData.websiteUrl}`
    : `[New SaaS FitScore Lead Request] ${companyName} - ${customerData.websiteUrl}`;

  const challengesList = Array.isArray(customerData.challenges)
    ? customerData.challenges.join(', ')
    : (customerData.challenges || 'None selected');

  const adminDashboardUrl = `${BASE_URL}/saas-fitscore/admin`;
  const reportUrl = reportData ? `${BASE_URL}/saas-fitscore?token=${reportData.reportToken}` : null;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #09090b; color: #f4f4f5; margin: 0; padding: 20px; }
        .container { max-width: 650px; margin: 0 auto; background: #18181b; border-radius: 16px; border: 1px solid #27272a; padding: 32px; }
        .badge { display: inline-block; padding: 4px 12px; background: rgba(163,230,53,0.15); border: 1px solid rgba(163,230,53,0.3); border-radius: 99px; color: #a3e635; font-size: 12px; font-weight: 700; text-transform: uppercase; margin-bottom: 12px; }
        h2 { color: #fff; margin-top: 0; font-size: 22px; }
        .info-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .info-table th, .info-table td { padding: 10px 12px; border-bottom: 1px solid #27272a; font-size: 14px; text-align: left; }
        .info-table th { color: #a1a1aa; width: 38%; font-weight: 600; }
        .info-table td { color: #ffffff; font-weight: 500; }
        .score-pill { display: inline-block; padding: 6px 14px; background: #27272a; border-radius: 8px; font-weight: 700; color: #a3e635; margin-top: 4px; }
        .btn { display: inline-block; background: #3b82f6; color: #fff !important; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 700; font-size: 14px; margin-top: 16px; margin-right: 12px; }
        .footer { margin-top: 24px; font-size: 12px; color: #71717a; border-top: 1px solid #27272a; padding-top: 16px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="badge">New Customer Request</div>
        <h2>SaaS FitScore Lead Received</h2>
        <p style="color: #a1a1aa; font-size: 14px; margin-bottom: 20px;">
          A new founder has requested a SaaS FitScore growth evaluation on AdsVise. Here are their complete customer intake details:
        </p>

        <table class="info-table">
          <tr>
            <th>Founder Name</th>
            <td><strong>${customerData.name || 'N/A'}</strong></td>
          </tr>
          <tr>
            <th>Work Email</th>
            <td><a href="mailto:${customerData.email}" style="color: #3b82f6;">${customerData.email || 'N/A'}</a></td>
          </tr>
          <tr>
            <th>SaaS Website</th>
            <td><a href="${customerData.websiteUrl}" target="_blank" style="color: #3b82f6;">${customerData.websiteUrl || 'N/A'}</a></td>
          </tr>
          <tr>
            <th>Derived Company</th>
            <td>${customerData.company || 'N/A'}</td>
          </tr>
          <tr>
            <th>Primary Business Model</th>
            <td>${customerData.businessModel || 'N/A'}</td>
          </tr>
          <tr>
            <th>Pricing Model</th>
            <td>${customerData.pricingModel || 'N/A'}</td>
          </tr>
          <tr>
            <th>Growth Challenges</th>
            <td>${challengesList}</td>
          </tr>
          <tr>
            <th>Main Drop-Off Point</th>
            <td><span style="color: #ef4444; font-weight: 600;">${customerData.dropOff || 'N/A'}</span></td>
          </tr>
          <tr>
            <th>Monthly Signups</th>
            <td>${customerData.monthlySignups || 'N/A'}</td>
          </tr>
          <tr>
            <th>Free-to-Paid Conversion</th>
            <td>${customerData.freeToPaidConversion || 'N/A'}</td>
          </tr>
          <tr>
            <th>Approx. Monthly Revenue (MRR)</th>
            <td>${customerData.approxMrr || 'N/A'}</td>
          </tr>
          <tr>
            <th>Next 90 Days Goal</th>
            <td>${customerData.next90DaysGoal || 'None specified'}</td>
          </tr>
          <tr>
            <th>Diagnostic ID</th>
            <td><code style="background: #27272a; padding: 2px 6px; border-radius: 4px; color: #a1a1aa;">${diagnosticId}</code></td>
          </tr>
          <tr>
            <th>Submitted At</th>
            <td>${customerData.submittedAt || new Date().toISOString()}</td>
          </tr>
          ${reportData ? `
          <tr>
            <th>FitScore Overall Score</th>
            <td><span class="score-pill">${reportData.overallScore}/100 (${reportData.overallRating})</span></td>
          </tr>
          ` : ''}
        </table>

        <div>
          ${reportUrl ? `<a href="${reportUrl}" class="btn">View Live Scorecard &rarr;</a>` : ''}
          <a href="${adminDashboardUrl}" class="btn" style="background: #27272a; border: 1px solid #3f3f46;">Open Admin Dashboard</a>
        </div>

        <div class="footer">
          Notification dispatched automatically to ${adminRecipient} by AdsVise SaaS FitScore Engine.
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `[New SaaS FitScore Lead Request]\n\n` +
    `Founder Name: ${customerData.name}\n` +
    `Work Email: ${customerData.email}\n` +
    `SaaS Website: ${customerData.websiteUrl}\n` +
    `Company: ${customerData.company}\n` +
    `Business Model: ${customerData.businessModel}\n` +
    `Pricing Model: ${customerData.pricingModel}\n` +
    `Growth Challenges: ${challengesList}\n` +
    `Drop-Off Bottleneck: ${customerData.dropOff}\n` +
    `Monthly Signups: ${customerData.monthlySignups}\n` +
    `Free-to-Paid Conversion: ${customerData.freeToPaidConversion}\n` +
    `Approx. MRR: ${customerData.approxMrr}\n` +
    `Next 90 Days Goal: ${customerData.next90DaysGoal || 'None'}\n` +
    `Diagnostic ID: ${diagnosticId}\n` +
    (reportData ? `Overall Score: ${reportData.overallScore}/100 (${reportData.overallRating})\nScorecard: ${reportUrl}\n` : '') +
    `Admin Dashboard: ${adminDashboardUrl}\n`;

  if (SMTP_CONFIG.auth.user && SMTP_CONFIG.auth.pass) {
    try {
      const transporter = nodemailer.createTransport(SMTP_CONFIG);
      const mailOptions = {
        from: `"${SENDER_NAME}" <${SENDER_EMAIL}>`,
        to: adminRecipient,
        subject: subject,
        text: textContent,
        html: htmlContent
      };
      const info = await transporter.sendMail(mailOptions);
      console.log(`[Hostinger SMTP] Customer intake notification sent to ${adminRecipient} (MessageId: ${info.messageId})`);
      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.error(`[Hostinger SMTP Error] Failed sending admin notification to ${adminRecipient}:`, err.message);
      return { success: false, error: err.message };
    }
  } else {
    console.log(`[Hostinger SMTP Mock] Customer intake notification prepared for ${adminRecipient}:`);
    console.log(`  Customer: ${customerData.name} (${customerData.email}) - ${customerData.websiteUrl}`);
    console.log(`  Business: ${customerData.company} | ${customerData.businessModel} | ${customerData.pricingModel}`);
    console.log(`  Drop-Off: ${customerData.dropOff} | MRR: ${customerData.approxMrr}`);
    console.log(`  (Configure SMTP_USER & SMTP_PASS in .env to deliver live emails)\n`);
    return { success: true, mock: true };
  }
}

module.exports = {
  sendFitScoreEmail,
  sendCustomerLeadNotification,
  ADMIN_EMAIL,
  SMTP_CONFIG
};
