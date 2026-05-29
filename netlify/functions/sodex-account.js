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

function response(statusCode, body, headers = {}) {
  const isString = typeof body === 'string';
  return {
    statusCode,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      ...headers,
    },
    body: isString ? body : JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'GET') return response(405, { error: 'Method not allowed' });

    const query = event.queryStringParameters || {};
    const address = String(query.address || '').trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return response(400, { error: 'Invalid wallet address' });

    const network = process.env.SODEX_NETWORK || 'mainnet';
    const market = query.market === 'spot' ? 'spot' : 'perps';
    const base = process.env.SODEX_REST_BASE || ENDPOINTS[network]?.[market];
    if (!base) return response(500, { error: 'Invalid SODEX_NETWORK or SODEX_REST_BASE' });

    const upstream = await fetch(`${base}/accounts/${address}/state`, { headers: { accept: 'application/json' } });
    const text = await upstream.text();
    return response(upstream.status, text, {
      'content-type': upstream.headers.get('content-type') || 'application/json',
    });
  } catch (error) {
    return response(500, { error: 'SoDEX account request failed', message: error.message });
  }
};
