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

  // Verify Authentication
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  const envUser = process.env.DASHBOARD_USER || 'admin';
  const envPass = process.env.DASHBOARD_PASSWORD || 'admin123';
  const expectedToken = Buffer.from(`${envUser}:${envPass}`).toString('base64');
  
  if (token !== expectedToken) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL || 'https://srblcdevmvdjhfdedmnr.supabase.co';
  const supabaseKey = process.env.SUPABASE_KEY;

  if (!supabaseKey) {
    res.status(401).json({ error: 'Supabase API Key is not configured on Vercel.' });
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      res.status(200).json(data || []);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
    return;
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) {
      res.status(400).json({ error: 'Missing lead ID query parameter' });
      return;
    }

    try {
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', id);

      if (error) throw error;
      res.status(200).json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
    return;
  }

  res.status(405).json({ error: 'Method Not Allowed' });
};
