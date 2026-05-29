const BASE_URL = process.env.SOSOVALUE_BASE_URL || 'https://openapi.sosovalue.com/openapi/v1';

const RESOURCE_PATHS = {
  currencies: '/currencies',
  indices: '/indices',
  etfs: '/etfs',
  'news': '/news',
  'news-hot': '/news/hot',
  'news-featured': '/news/featured',
  'btc-treasuries': '/btc-treasuries',
  'crypto-stocks': '/crypto-stocks',
  'fundraising-projects': '/fundraising/projects',
  'macro-events': '/macro/events',
  analyses: '/analyses',
};

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    const apiKey = process.env.SOSOVALUE_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Missing SOSOVALUE_API_KEY in Vercel environment variables' });

    const { resource = 'indices', ...query } = req.query;
    const path = RESOURCE_PATHS[resource];
    if (!path) return res.status(400).json({ error: `Invalid resource: ${resource}` });

    const url = new URL(`${BASE_URL}${path}`);
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
    }

    const upstream = await fetch(url, {
      headers: {
        accept: 'application/json',
        'x-soso-api-key': apiKey,
      },
    });
    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader('content-type', upstream.headers.get('content-type') || 'application/json');
    return res.send(text);
  } catch (error) {
    return res.status(500).json({ error: 'SoSoValue proxy failed', message: error.message });
  }
};
