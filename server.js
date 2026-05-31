const http = require('http');
const fs = require('fs');
const path = require('path');

// ─── SMTP Email Configuration ───
// To receive emails, fill out your SMTP credentials below.
// You can use a free SMTP service like Gmail (using an App Password), SendGrid, Mailgun, etc.
const SMTP_CONFIG = {
  host: '',         // e.g. 'smtp.gmail.com'
  port: 587,        // e.g. 587 (TLS) or 465 (SSL)
  secure: false,    // true for 465, false for other ports
  auth: {
    user: '',       // e.g. 'your-smtp-username@gmail.com'
    pass: ''        // e.g. 'your-smtp-password-or-app-password'
  }
};
const EMAIL_TO = 'digitaladsexpresso@gmail.com';

let nodemailer = null;
try {
  nodemailer = require('nodemailer');
} catch (e) {
  // nodemailer package is optional; we log mocks to the console if it is missing
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

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Registration processed' }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Invalid JSON payload' }));
      }
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
