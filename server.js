const http = require('http');
const fs = require('fs');
const path = require('path');

// ─── SMTP Email Configuration ───
const SMTP_CONFIG = {
  host: '',         // e.g. 'smtp.gmail.com'
  port: 587,
  secure: false,
  auth: {
    user: '',
    pass: ''
  }
};
const EMAIL_TO = 'digitaladsexpresso@gmail.com';

// ─── Supabase Backend Configuration ───
// Storing secret keys on the backend prevents client-side exposure.
// Load these from process environment variables for security.
const SUPABASE_URL = process.env.SUPABASE_URL || ''; 
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
  '.gif': 'image/gif',
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
        console.log(`Business: ${data.business}`);
        console.log(`Phone:    ${data.phone}`);
        if (data.source) {
          console.log(`Source:   ${data.source}`);
        }
        console.log('==========================================================\n');

        // Save locally to JSON DB
        const lead = {
          name: data.name,
          email: data.email,
          business: data.business,
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
            text: `A new user has registered to access the Live Call Demo.\n\n` +
                  `Name:          ${data.name}\n` +
                  `Email:         ${data.email}\n` +
                  `Business Name: ${data.business}\n` +
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
                source: data.source || 'Live Call Demo'
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
            text: `A user has just completed a simulated live voice call on the LeadFlow mockup.\n\n` +
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

  if (req.method === 'GET' && req.url === '/api/leads') {
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
  
  // Normalize path and set default index.html
  let filePath = req.url === '/' ? '/index.html' : req.url;
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
