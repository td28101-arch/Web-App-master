const { ethers } = require('ethers');

const ENDPOINTS = {
  mainnet: {
    spot: 'https://mainnet-gw.sodex.dev/api/v1/spot',
    perps: 'https://mainnet-gw.sodex.dev/api/v1/perps',
    chainId: 286623,
  },
  testnet: {
    spot: 'https://testnet-gw.sodex.dev/api/v1/spot',
    perps: 'https://testnet-gw.sodex.dev/api/v1/perps',
    chainId: 138565,
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

function parseBody(event) {
  if (!event.body) return {};

  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;

  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function orderedOrder({ side, quantity, price }) {
  const item = {
    clOrdID: `webapp-${Date.now()}`,
    modifier: 1,
    side,
    type: price ? 1 : 2,
    timeInForce: price ? 1 : 3,
    quantity: String(quantity),
    reduceOnly: false,
    positionSide: 1,
  };

  if (price) {
    item.price = String(price);
  }

  return item;
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return response(405, { error: 'Method not allowed' });
    }

    const apiKeyName = process.env.SODEX_API_KEY_NAME;
    const privateKey = process.env.SODEX_API_PRIVATE_KEY;

    if (!apiKeyName || !privateKey) {
      return response(500, {
        error:
          'Missing SODEX_API_KEY_NAME or SODEX_API_PRIVATE_KEY in Netlify environment variables',
      });
    }

    const body = parseBody(event);

    const market = body.market === 'spot' ? 'spot' : 'perps';
    const network = process.env.SODEX_NETWORK || 'mainnet';

    const base = process.env.SODEX_REST_BASE || ENDPOINTS[network]?.[market];
    const chainId = Number(process.env.SODEX_CHAIN_ID || ENDPOINTS[network]?.chainId);

    if (!base || !chainId) {
      return response(500, {
        error: 'Invalid SoDEX endpoint configuration',
      });
    }

    const symbolID = Number(body.symbolID);
    const side = Number(body.side);
    const quantity = String(body.quantity || '').trim();
    const accountIDRaw = String(process.env.SODEX_ACCOUNT_ID || '').trim();

    if (!symbolID || ![1, 2].includes(side) || !quantity) {
      return response(400, {
        error: 'symbolID, side and quantity are required',
      });
    }

    const params = {
      symbolID,
      orders: [
        orderedOrder({
          side,
          quantity,
          price: body.price,
        }),
      ],
    };

    // SODEX_ACCOUNT_ID is optional.
    // If it is empty, SoDEX should use the primary/default account.
    if (accountIDRaw) {
      params.accountID = Number(accountIDRaw);
    }

    const signingPayload = {
      type: 'newOrder',
      params,
    };

    const payloadHash = ethers.keccak256(
      ethers.toUtf8Bytes(JSON.stringify(signingPayload))
    );

    const nonce = Date.now();

    const domain = {
      name: market === 'spot' ? 'spot' : 'futures',
      version: '1',
      chainId,
      verifyingContract: '0x0000000000000000000000000000000000000000',
    };

    const types = {
      ExchangeAction: [
        { name: 'payloadHash', type: 'bytes32' },
        { name: 'nonce', type: 'uint64' },
      ],
    };

    const wallet = new ethers.Wallet(privateKey);

    const signature = await wallet.signTypedData(domain, types, {
      payloadHash,
      nonce,
    });

    const typedSignature = `0x01${signature.slice(2)}`;

    const upstream = await fetch(`${base}/trade/orders`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        'X-API-Key': apiKeyName,
        'X-API-Sign': typedSignature,
        'X-API-Nonce': String(nonce),
      },
      body: JSON.stringify(params),
    });

    const text = await upstream.text();

    return response(upstream.status, text, {
      'content-type': upstream.headers.get('content-type') || 'application/json',
    });
  } catch (error) {
    return response(500, {
      error: 'SoDEX order request failed',
      message: error.message,
    });
  }
};