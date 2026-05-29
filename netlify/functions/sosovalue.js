const BASE_URL = process.env.SOSOVALUE_BASE_URL || 'https://openapi.sosovalue.com/openapi/v1';

const RESOURCE_PATHS = {
  currencies: '/currencies',
  indices: '/indices',
  etfs: '/etfs',
  news: '/news',
  'news-hot': '/news/hot',
  'news-featured': '/news/featured',
  'btc-treasuries': '/btc-treasuries',
  'crypto-stocks': '/crypto-stocks',
  'fundraising-projects': '/fundraising/projects',
  'macro-events': '/macro/events',
  analyses: '/analyses',
};

function response(statusCode, body, headers = {}) {
  const isString = typeof body === 'string';
  return {
    statusCode,
    headers: {
      'content-type': isString ? 'application/json' : 'application/json',
      'cache-control': 'no-store',
      ...headers,
    },
    body: isString ? body : JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'GET') return response(405, { error: 'Method not allowed' });

    const apiKey = process.env.SOSOVALUE_API_KEY;
    if (!apiKey) return response(500, { error: 'Missing SOSOVALUE_API_KEY in Netlify environment variables' });

    const query = { ...(event.queryStringParameters || {}) };
    const resource = query.resource || 'indices';
    delete query.resource;

    const path = RESOURCE_PATHS[resource];
    if (!path) return response(400, { error: `Invalid resource: ${resource}` });

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
    return response(upstream.status, text, {
      'content-type': upstream.headers.get('content-type') || 'application/json',
    });
  } catch (error) {
    return response(500, { error: 'SoSoValue proxy failed', message: error.message });
  }
};
