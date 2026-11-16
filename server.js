const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
let Razorpay = null;
try {
  Razorpay = require('razorpay');
} catch (e) {
  // razorpay loaded dynamically
}

// Load environment variables from local .env file if it exists
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envData = fs.readFileSync(envPath, 'utf8');
    envData.split(/\r?\n/).forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        // Remove quotes if any
        if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
          value = value.substring(1, value.length - 1);
        }
        process.env[key] = value;
      }
    });
  }
} catch (e) {
  // Ignore env loading errors
}

// ─── SMTP Email Configuration ───
const SMTP_CONFIG = {
  host: process.env.SMTP_HOST || '',
  port: process.env.SMTP_PORT || 587,
  secure: process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || ''
  }
};
const EMAIL_TO = process.env.EMAIL_TO || 'digitaladsexpresso@gmail.com';

// ─── Supabase Backend Configuration ───
// Storing secret keys on the backend prevents client-side exposure.
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://srblcdevmvdjhfdedmnr.supabase.co'; 
const SUPABASE_KEY = process.env.SUPABASE_KEY || ''; 

let nodemailer = null;
try {
  nodemailer = require('nodemailer');
} catch (e) {
  // nodemailer package is optional
}

let createClient = null;
try {
  createClient = require('@supabase/supabase-js').createClient;
} catch (e) {
  // @supabase/supabase-js package is optional
}

const LEADS_FILE = path.join(__dirname, 'leads.json');

function saveLeadLocally(lead) {
  fs.readFile(LEADS_FILE, (err, data) => {
    let leads = [];
    if (!err) {
      try {
        leads = JSON.parse(data.toString());
      } catch (e) {
        leads = [];
      }
    }
    
    // Check if this lead email already exists to update it, or add new
    const existingIndex = leads.findIndex(l => l.email === lead.email && lead.email);
    if (existingIndex > -1) {
      // Merge properties (e.g. add call outcomes to existing signup details)
      leads[existingIndex] = { ...leads[existingIndex], ...lead, updated_at: new Date().toISOString() };
    } else {
      lead.id = Date.now();
      lead.created_at = new Date().toISOString();
      leads.push(lead);
    }
    
    fs.writeFile(LEADS_FILE, JSON.stringify(leads, null, 2), writeErr => {
      if (writeErr) console.error('[Error] Failed to save lead locally:', writeErr.message);
    });
  });
}

const PORT = 3000;

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);

  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/api/register') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        console.log('\n================ NEW ACCOUNT REGISTRATION ================');
        console.log(`Name:     ${data.name}`);
        console.log(`Email:    ${data.email}`);
        console.log(`Business: ${data.company || data.business}`);
        if (data.companySize) console.log(`Size:     ${data.companySize}`);
        console.log(`Phone:    ${data.phone}`);
        if (data.source) {
          console.log(`Source:   ${data.source}`);
        }
        console.log('==========================================================\n');

        // Save locally to JSON DB
        const lead = {
          name: data.name,
          email: data.email,
          business: (data.company || data.business || '') + (data.companySize ? ` (${data.companySize})` : ''),
          phone: data.phone,
          source: data.source || 'Early Access Signup',
          outcome: 'No Call Yet'
        };
        saveLeadLocally(lead);

        // Sending Email to digitaladsexpresso@gmail.com
        if (nodemailer && SMTP_CONFIG.host && SMTP_CONFIG.auth.user) {
          const transporter = nodemailer.createTransport(SMTP_CONFIG);
          const mailOptions = {
            from: SMTP_CONFIG.auth.user,
            to: EMAIL_TO,
            subject: `🔥 New Lead Registered: ${data.name}`,
            text: `A new user has registered to access the Live Call Demo on the AdsVise website (https://adsvise.in/).\n\n` +
                  `Name:          ${data.name}\n` +
                  `Email:         ${data.email}\n` +
                  `Business Name: ${data.company || data.business}\n` +
                  (data.companySize ? `Company Size:  ${data.companySize}\n` : '') +
                  `Contact Phone: ${data.phone}\n` +
                  (data.source ? `Lead Source:   ${data.source}\n` : '')
          };
          transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
              console.error(`[Error] Failed to send email to ${EMAIL_TO}:`, error.message);
            } else {
              console.log(`[Email] Notification email successfully sent to ${EMAIL_TO}`);
            }
          });
        } else {
          console.log(`[Email Mock] Details would be sent to ${EMAIL_TO}:`);
          console.log(`  Name:     ${data.name}`);
          console.log(`  Business: ${data.business}`);
          console.log(`  Phone:    ${data.phone}`);
          console.log(`  Email:    ${data.email}`);
          console.log(`  (Configure SMTP in server.js to enable real email notifications)\n`);
        }

        // Saving to Supabase (Backend Insertion using Service Key)
        if (createClient && SUPABASE_URL && SUPABASE_KEY) {
          try {
            const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
            supabase.from('leads').insert([
              {
                name: data.name,
                email: data.email,
                business: data.business,
                phone: data.phone,
                source: data.source || 'Live Call Demo',
                website: 'https://adsvise.in/'
              }
            ]).then(({ error }) => {
              if (error) {
                console.error('[Supabase Error] Failed to insert lead on backend:', error.message);
              } else {
                console.log('[Supabase] Successfully saved lead to database from backend.');
              }
            });
          } catch (supabaseErr) {
            console.error('[Supabase Error] Failed to initialize supabase client on backend:', supabaseErr.message);
          }
        } else {
          console.log(`[Supabase Backend Mock] Details would be inserted into Supabase leads table:`);
          console.log(`  Name:     ${data.name}`);
          console.log(`  (Configure SUPABASE_URL in server.js and run 'npm install @supabase/supabase-js' to enable backend database insertion)\n`);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Registration processed' }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Invalid JSON payload' }));
      }
    });
    return;
  }

  
  
  // ─── RAZORPAY STANDARD WEB CHECKOUT ENDPOINTS ───
  if (req.method === 'GET' && req.url === '/api/razorpay-key') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      key_id: process.env.RAZORPAY_KEY_ID || ''
    }));
    return;
  }

  // STEP 1: BACKEND - Create Order
  if (req.method === 'POST' && req.url === '/api/create-order') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const data = body ? JSON.parse(body) : {};
        const amount = parseInt(data.amount, 10);
        const currency = data.currency || 'INR';
        const receipt = data.receipt || ('rcpt_' + Date.now());

        // Error Handling: Validate amount >= 100 paise (minimum ₹1.00)
        if (!amount || isNaN(amount) || amount < 100) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: false,
            error: 'Invalid amount. Minimum amount is 100 paise (₹1.00).'
          }));
          return;
        }

        const keyId = process.env.RAZORPAY_KEY_ID;
        const keySecret = process.env.RAZORPAY_KEY_SECRET;

        // Error Handling: Handle auth / credential failures
        if (!keyId || !keySecret) {
          console.error('[Razorpay Error] Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET in environment');
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: false,
            error: 'Razorpay credentials not configured on server'
          }));
          return;
        }

        if (!Razorpay) {
          try {
            Razorpay = require('razorpay');
          } catch (loadErr) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              success: false,
              error: 'Razorpay SDK is not installed on server'
            }));
            return;
          }
        }

        const rzp = new Razorpay({
          key_id: keyId,
          key_secret: keySecret
        });

        const orderOptions = {
          amount: amount, // amount in paise
          currency: currency,
          receipt: receipt,
          notes: data.notes || {}
        };

        const order = await rzp.orders.create(orderOptions);
        console.log(`[Razorpay] Order created: ${order.id} | Amount: ${order.amount} paise (${order.currency}) | Receipt: ${receipt}`);

        // Return order_id, amount, currency, and key_id for frontend initialization
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          order_id: order.id,
          amount: order.amount,
          currency: order.currency,
          key_id: keyId
        }));
      } catch (err) {
        console.error('[Razorpay Create Order Error]:', err);
        const statusCode = (err && (err.statusCode === 401 || (err.error && err.error.code === 'BAD_REQUEST_ERROR' && err.statusCode === 401))) ? 401 : 500;
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: (err.error && err.error.description) ? err.error.description : (err.message || 'Razorpay order creation failed')
        }));
      }
    });
    return;
  }

  // STEP 3: BACKEND - Verify Signature
  if (req.method === 'POST' && req.url === '/api/verify-payment') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const data = body ? JSON.parse(body) : {};
        const orderId = data.razorpay_order_id || data.order_id;
        const paymentId = data.razorpay_payment_id || data.payment_id;
        const signature = data.razorpay_signature || data.signature;

        // Error Handling: Missing fields -> return 400
        if (!orderId || !paymentId || !signature) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: false,
            error: 'Missing required payment verification fields (razorpay_order_id, razorpay_payment_id, razorpay_signature)'
          }));
          return;
        }

        const keySecret = process.env.RAZORPAY_KEY_SECRET;
        if (!keySecret) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: false,
            error: 'Razorpay secret key not configured on server'
          }));
          return;
        }

        // Algorithm: HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
        const expectedSignature = crypto
          .createHmac('sha256', keySecret)
          .update(`${orderId}|${paymentId}`)
          .digest('hex');

        // Signature mismatch: return 400, do NOT mark as paid
        if (expectedSignature !== signature) {
          console.warn(`[Razorpay Security Alert] Signature mismatch for order ${orderId} with payment ${paymentId}`);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: false,
            error: 'Invalid payment signature. Verification failed.'
          }));
          return;
        }

        console.log(`[Razorpay Verification] Signature verified successfully for payment ${paymentId} on order ${orderId}`);

        // If bookingData or customer lead info is passed with the verification, record it
        if (data.bookingData) {
          const lead = {
            ...data.bookingData,
            payment_status: 'Paid (Razorpay Verified)',
            razorpay_payment_id: paymentId,
            razorpay_order_id: orderId
          };
          saveLeadLocally(lead);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          message: 'Payment verified successfully',
          order_id: orderId,
          payment_id: paymentId
        }));
      } catch (err) {
        console.error('[Razorpay Verify Payment Error]:', err);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: 'Invalid JSON payload'
        }));
      }
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/book-audit') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        console.log('\n================ NEW AD AUDIT BOOKING (₹1,999) ================');
        console.log(`Name:        ${data.name}`);
        console.log(`Email:       ${data.email}`);
        console.log(`Business:    ${data.business || data.company || 'Not provided'}`);
        console.log(`Phone:       ${data.phone}`);
        console.log(`Platform:    ${data.platform || 'Meta / Google'}`);
        console.log(`Spend:       ${data.spend || 'Not provided'}`);
        console.log(`Handle/URL:  ${data.websiteOrHandle || 'N/A'}`);
        console.log(`Notes:       ${data.notes || 'None'}`);
        console.log(`Payment:     ${data.paymentStatus || 'Initiated'}`);
        console.log(`Txn ID:      ${data.transactionId || 'Pending'}`);
        console.log('=================================================================\n');

        // Save locally to JSON DB
        const lead = {
          name: data.name,
          email: data.email,
          business: data.business || data.company || '',
          phone: data.phone,
          platform: data.platform || '',
          spend: data.spend || '',
          website_or_handle: data.websiteOrHandle || '',
          notes: data.notes || '',
          source: 'Ad Audit + Growth Plan (₹1,999)',
          payment_status: data.paymentStatus || 'Initiated',
          transaction_id: data.transactionId || '',
          amount: 1999,
          currency: 'INR'
        };
        saveLeadLocally(lead);

        // Sending Email to digitaladsexpresso@gmail.com
        if (nodemailer && SMTP_CONFIG.host && SMTP_CONFIG.auth.user) {
          const transporter = nodemailer.createTransport(SMTP_CONFIG);
          const mailOptions = {
            from: SMTP_CONFIG.auth.user,
            to: EMAIL_TO,
            subject: `🎯 New Ad Audit Booking: ₹1,999 from ${data.name} (${data.business || data.company || 'Business'})`,
            text: `A new Ad Audit & Growth Plan booking (₹1,999) has been placed on AdsVise (https://adsvise.in/ad-audit).\n\n` +
                  `Client Details:\n` +
                  `-----------------------------------------\n` +
                  `Name:            ${data.name}\n` +
                  `Business Name:   ${data.business || data.company || 'N/A'}\n` +
                  `Contact Phone:   ${data.phone}\n` +
                  `Email:           ${data.email}\n` +
                  `Website / IG:    ${data.websiteOrHandle || 'N/A'}\n` +
                  `Ad Platform:     ${data.platform || 'N/A'}\n` +
                  `Monthly Ad Spend:${data.spend || 'N/A'}\n` +
                  `Key Challenge:   ${data.notes || 'N/A'}\n` +
                  `Payment Status:  ${data.paymentStatus || 'Initiated'}\n` +
                  `Transaction ID:  ${data.transactionId || 'Pending'}\n` +
                  `Amount:          ₹1,999 (One-Time Payment)\n` +
                  `-----------------------------------------\n\n` +
                  `Next Step: Reach out to client on WhatsApp (${data.phone}) to confirm intake details and arrange view-only ad account access.`
          };
          transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
              console.error(`[Error] Failed to send email to ${EMAIL_TO}:`, error.message);
            } else {
              console.log(`[Email] Notification email successfully sent to ${EMAIL_TO}`);
            }
          });
        } else {
          console.log(`[Email Mock] Ad audit booking details would be sent to ${EMAIL_TO}`);
        }

        // Saving to Supabase if configured
        if (createClient && SUPABASE_URL && SUPABASE_KEY) {
          try {
            const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
            supabase.from('leads').insert([
              {
                name: data.name,
                email: data.email,
                business: data.business || data.company,
                phone: data.phone,
                source: 'Ad Audit + Growth Plan (₹1,999)',
                website: 'https://adsvise.in/ad-audit'
              }
            ]).then(({ error }) => {
              if (error) {
                console.error('[Supabase Error] Failed to insert audit booking:', error.message);
              } else {
                console.log('[Supabase] Successfully saved ad audit booking.');
              }
            });
          } catch (supabaseErr) {
            console.error('[Supabase Error]:', supabaseErr.message);
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Ad audit booking received successfully' }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Invalid JSON payload' }));
      }
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/call-event') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        console.log('\n================ DEMO SIMULATOR CALL COMPLETED ================');
        console.log(`Name:     ${data.name}`);
        console.log(`Email:    ${data.email || 'N/A'}`);
        console.log(`Business: ${data.business || 'N/A'}`);
        console.log(`Phone:    ${data.phone || 'N/A'}`);
        console.log(`Outcome:  ${data.outcome.toUpperCase()}`);
        if (data.details) {
          console.log(`Details:  ${data.details}`);
        }
        console.log('===============================================================\n');

        // Save locally to JSON DB
        const leadUpdate = {
          name: data.name,
          email: data.email,
          business: data.business,
          phone: data.phone,
          source: data.source || 'Live Call Demo',
          website: 'https://adsvise.in/',
          outcome: data.outcome,
          outcome_details: data.details
        };
        saveLeadLocally(leadUpdate);

        // Sending Email to digitaladsexpresso@gmail.com
        if (nodemailer && SMTP_CONFIG.host && SMTP_CONFIG.auth.user) {
          const transporter = nodemailer.createTransport(SMTP_CONFIG);
          const mailOptions = {
            from: SMTP_CONFIG.auth.user,
            to: EMAIL_TO,
            subject: `📞 Live Demo Call Attempt: ${data.name} (${data.outcome.toUpperCase()})`,
            text: `A user has just completed a simulated live voice call on the AdsVise website (https://adsvise.in/).\n\n` +
                  `Name:          ${data.name}\n` +
                  `Email:         ${data.email || 'N/A'}\n` +
                  `Business Name: ${data.business || 'N/A'}\n` +
                  `Contact Phone: ${data.phone || 'N/A'}\n\n` +
                  `Call Outcome:  ${data.outcome.toUpperCase()}\n` +
                  `Outcome Info:  ${data.details || ''}\n`
          };
          transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
              console.error(`[Error] Failed to send email to ${EMAIL_TO}:`, error.message);
            } else {
              console.log(`[Email] Notification email successfully sent to ${EMAIL_TO}`);
            }
          });
        } else {
          console.log(`[Email Mock] Demo Call details would be sent to ${EMAIL_TO}:`);
          console.log(`  Name:     ${data.name}`);
          console.log(`  Outcome:  ${data.outcome.toUpperCase()}`);
          console.log(`  Details:  ${data.details || ''}`);
          console.log(`  (Configure SMTP in server.js to enable real email notifications)\n`);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Call event processed' }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Invalid JSON payload' }));
      }
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/auth') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const envUser = process.env.DASHBOARD_USER || 'admin';
        const envPass = process.env.DASHBOARD_PASSWORD || 'admin123';
        if (payload.username === envUser && payload.password === envPass) {
          const token = Buffer.from(`${envUser}:${envPass}`).toString('base64');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, token }));
        } else {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Invalid credentials' }));
        }
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Invalid JSON payload' }));
      }
    });
    return;
  }

  // ─── AUTH MIDDLEWARE FOR PROTECTED ROUTES ───
  function checkAuth() {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    const envUser = process.env.DASHBOARD_USER || 'admin';
    const envPass = process.env.DASHBOARD_PASSWORD || 'admin123';
    const expectedToken = Buffer.from(`${envUser}:${envPass}`).toString('base64');
    return token === expectedToken;
  }

  if (req.method === 'GET' && req.url === '/api/leads') {
    if (!checkAuth()) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }
    fs.readFile(LEADS_FILE, (err, data) => {
      let leads = [];
      if (!err) {
        try {
          leads = JSON.parse(data.toString());
        } catch (e) {
          leads = [];
        }
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(leads));
    });
    return;
  }

  if (req.method === 'DELETE' && req.url.startsWith('/api/leads/')) {
    if (!checkAuth()) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }
    const leadId = parseInt(req.url.split('/').pop(), 10);
    fs.readFile(LEADS_FILE, (err, data) => {
      let leads = [];
      if (!err) {
        try {
          leads = JSON.parse(data.toString());
        } catch (e) {
          leads = [];
        }
      }
      leads = leads.filter(l => l.id !== leadId);
      fs.writeFile(LEADS_FILE, JSON.stringify(leads, null, 2), writeErr => {
        if (writeErr) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: writeErr.message }));
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        }
      });
    });
    return;
  }
  
  
  // Clean URL routing for case study and legal pages
  let urlPath = req.url.split('?')[0]; // Remove query params
  if (urlPath === '/work/gomata-ghee-branding' || urlPath === '/work/gomata-ghee-branding/') {
    urlPath = '/work/gomata-ghee-branding.html';
  } else if (urlPath === '/work/banglar-swad' || urlPath === '/work/banglar-swad/') {
    urlPath = '/work/banglar-swad.html';
  } else if (urlPath === '/privacy-policy' || urlPath === '/privacy-policy/' || urlPath === '/privacy' || urlPath === '/privacy/') {
    urlPath = '/privacy-policy.html';
  } else if (urlPath === '/water-can-manager' || urlPath === '/water-can-manager/' || 
             urlPath === '/water-can-manager/privacy' || urlPath === '/water-can-manager/privacy/' ||
             urlPath === '/water-can-manager/terms' || urlPath === '/water-can-manager/terms/') {
    urlPath = '/water-can-manager.html';
  } else if (urlPath === '/ad-audit' || urlPath === '/ad-audit/' || urlPath === '/audit' || urlPath === '/audit/') {
    urlPath = '/ad-audit.html';
  } else if (urlPath === '/test-checkout' || urlPath === '/test-checkout/' || urlPath === '/checkout' || urlPath === '/checkout/') {
    urlPath = '/test-checkout.html';
  }

  // Normalize path and set default index.html
  let filePath = urlPath === '/' ? '/index.html' : urlPath;
  // Prevent directory traversal
  filePath = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, '');
  const absPath = path.join(__dirname, filePath);

  fs.stat(absPath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(absPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(absPath, (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    });
  });
});

server.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`🚀 Preview Server Running at http://localhost:${PORT}`);
  console.log(`Press Ctrl+C to terminate`);
  console.log(`==================================================\n`);
});
