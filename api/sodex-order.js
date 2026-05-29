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

function orderedOrder({ side, quantity, price }) {
  const item = {
    clOrdID: `webapp-${Date.now()}`,
    modifier: 1,
    side,
    type: price ? 1 : 2,
    timeInForce: price ? 1 : 3,
  };
  if (price) item.price = String(price);
  item.quantity = String(quantity);
  item.reduceOnly = false;
  item.positionSide = 1;
  return item;
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const apiKeyName = process.env.SODEX_API_KEY_NAME;
    const privateKey = process.env.SODEX_API_PRIVATE_KEY;
    const accountID = Number(process.env.SODEX_ACCOUNT_ID);
    if (!apiKeyName || !privateKey || !accountID) {
      return res.status(500).json({ error: 'Missing SODEX_API_KEY_NAME, SODEX_API_PRIVATE_KEY or SODEX_ACCOUNT_ID in Vercel environment variables' });
    }

    const body = req.body || {};
    const market = body.market === 'spot' ? 'spot' : 'perps';
    const network = process.env.SODEX_NETWORK || 'mainnet';
    const base = process.env.SODEX_REST_BASE || ENDPOINTS[network]?.[market];
    const chainId = Number(process.env.SODEX_CHAIN_ID || ENDPOINTS[network]?.chainId);
    if (!base || !chainId) return res.status(500).json({ error: 'Invalid SoDEX endpoint configuration' });

    const symbolID = Number(body.symbolID);
    const side = Number(body.side);
    const quantity = String(body.quantity || '').trim();
    if (!symbolID || ![1, 2].includes(side) || !quantity) {
      return res.status(400).json({ error: 'symbolID, side and quantity are required' });
    }

    const params = {
      accountID,
      symbolID,
      orders: [orderedOrder({ side, quantity, price: body.price })],
    };
    const signingPayload = { type: 'newOrder', params };
    const payloadHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(signingPayload)));
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
    const signature = await wallet.signTypedData(domain, types, { payloadHash, nonce });
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
    res.status(upstream.status);
    res.setHeader('content-type', upstream.headers.get('content-type') || 'application/json');
    return res.send(text);
  } catch (error) {
    return res.status(500).json({ error: 'SoDEX order request failed', message: error.message });
  }
};
