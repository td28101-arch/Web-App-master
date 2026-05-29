const ENDPOINTS = {
  mainnet: {
    spot: 'https://mainnet-gw.sodex.dev/api/v1/spot',
    perps: 'https://mainnet-gw.sodex.dev/api/v1/perps',
  },
  testnet: {
    spot: 'https://testnet-gw.sodex.dev/api/v1/spot',
    perps: 'https://testnet-gw.sodex.dev/api/v1/perps',
  },
};

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    const address = String(req.query.address || '').trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return res.status(400).json({ error: 'Invalid wallet address' });

    const network = process.env.SODEX_NETWORK || 'mainnet';
    const market = req.query.market === 'spot' ? 'spot' : 'perps';
    const base = process.env.SODEX_REST_BASE || ENDPOINTS[network]?.[market];
    if (!base) return res.status(500).json({ error: 'Invalid SODEX_NETWORK or SODEX_REST_BASE' });

    const upstream = await fetch(`${base}/accounts/${address}/state`, { headers: { accept: 'application/json' } });
    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader('content-type', upstream.headers.get('content-type') || 'application/json');
    return res.send(text);
  } catch (error) {
    return res.status(500).json({ error: 'SoDEX account request failed', message: error.message });
  }
};
