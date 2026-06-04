module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method Not Allowed' });
    return;
  }

  try {
    const { username, password } = req.body;
    const envUser = process.env.DASHBOARD_USER || 'admin';
    const envPass = process.env.DASHBOARD_PASSWORD || 'admin123';

    if (username === envUser && password === envPass) {
      // In a real app, generate a JWT. For this lightweight implementation,
      // return a fixed token that the client sends and the backend verifies.
      const token = Buffer.from(`${envUser}:${envPass}`).toString('base64');
      res.status(200).json({ success: true, token });
    } else {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
  } catch (err) {
    res.status(400).json({ success: false, error: 'Invalid JSON payload' });
  }
};
