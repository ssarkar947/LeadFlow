const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    const data = req.body;
    
    // SMTP config from environment variables
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT || 587;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const emailTo = process.env.EMAIL_TO || 'digitaladsexpresso@gmail.com';

    // Email notification
    if (smtpHost && smtpUser && smtpPass) {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(smtpPort, 10),
        secure: parseInt(smtpPort, 10) === 465,
        auth: { user: smtpUser, pass: smtpPass }
      });

      const mailOptions = {
        from: smtpUser,
        to: emailTo,
        subject: `🔥 New Lead Registered: ${data.name}`,
        text: `New early access signup from ${data.name} on the AdsVise website (https://adsvise.in/).\n\n` +
              `Name:          ${data.name}\n` +
              `Email:         ${data.email}\n` +
              `Business Name: ${data.company || data.business}\n` +
              (data.companySize ? `Company Size:  ${data.companySize}\n` : '') +
              `Contact Phone: ${data.phone}\n` +
              (data.source ? `Lead Source:   ${data.source}\n` : '')
      };
      await transporter.sendMail(mailOptions);
    }

    // Save to Supabase (backend)
    const supabaseUrl = process.env.SUPABASE_URL || 'https://srblcdevmvdjhfdedmnr.supabase.co';
    const supabaseKey = process.env.SUPABASE_KEY;

    if (!supabaseKey) {
      res.status(500).json({ 
        success: false, 
        error: 'SUPABASE_KEY environment variable is not defined on Vercel. Please check your Vercel Project Settings.' 
      });
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { error } = await supabase.from('leads').insert([
      {
        name: data.name,
        email: data.email,
        business: (data.company || data.business || '') + (data.companySize ? ` (${data.companySize})` : ''),
        phone: data.phone,
        source: data.source || 'Early Access Signup',
        website: 'https://adsvise.in/'
      }
    ]);
    if (error) throw error;

    res.status(200).json({ success: true, message: 'Registration processed' });
  } catch (err) {
    console.error('Serverless register error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};
