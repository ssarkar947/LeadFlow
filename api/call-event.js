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
        subject: `📞 Live Demo Call Attempt: ${data.name} (${data.outcome.toUpperCase()})`,
        text: `A user has just completed a simulated live voice call on the LeadFlow mockup.\n\n` +
              `Name:          ${data.name}\n` +
              `Email:         ${data.email || 'N/A'}\n` +
              `Business Name: ${data.business || 'N/A'}\n` +
              `Contact Phone: ${data.phone || 'N/A'}\n\n` +
              `Call Outcome:  ${data.outcome.toUpperCase()}\n` +
              `Outcome Info:  ${data.details || ''}\n`
      };
      await transporter.sendMail(mailOptions);
    }

    // Update Supabase lead call details
    const supabaseUrl = process.env.SUPABASE_URL || 'https://srblcdevmvdjhfdedmnr.supabase.co';
    const supabaseKey = process.env.SUPABASE_KEY;

    if (supabaseUrl && supabaseKey && data.email) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      // Update by email matching
      const { error } = await supabase
        .from('leads')
        .update({
          outcome: data.outcome,
          outcome_details: data.details
        })
        .eq('email', data.email);
        
      if (error) throw error;
    }

    res.status(200).json({ success: true, message: 'Call event processed' });
  } catch (err) {
    console.error('Serverless call-event error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};
