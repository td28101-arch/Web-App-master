# Web-App-master — SoSoValue Wave 2 Tool for Netlify

This is the upgraded version of the original `Crypto-Web-App-master` project for Wave 2: **Build Your One-Person On-Chain Finance Business with SoSoValue**.

This build is configured for **Netlify**, not Vercel. The frontend still calls `/api/...`, but Netlify redirects those paths to secure Netlify Functions in `netlify/functions`.

## What it does

- Loads live SoSoValue market data from `/currencies`.
- Loads live SSI index rows from `/indices`.
- Loads live ETF rows from `/etfs`.
- Loads live news from `/news/hot`.
- Fetches SoDEX account state from `GET /accounts/{address}/state`.
- Can submit a real signed SoDEX order through `/api/sodex-order` when SoDEX trading keys are configured.

## Why the keys are not in `script.js`

Browser JavaScript is public. API keys and trading private keys must never be shipped to the user browser. Put them in **Netlify Environment variables** only.

## Netlify environment variables

Add **all variables below** in **Netlify → Site configuration → Environment variables**.

```bash
SOSOVALUE_API_KEY=your_sosovalue_key
SOSOVALUE_BASE_URL=https://openapi.sosovalue.com/openapi/v1
SODEX_NETWORK=mainnet

SODEX_API_KEY_NAME=api-key-01
SODEX_API_PRIVATE_KEY=0x...
SODEX_ACCOUNT_ID=12345
SODEX_CHAIN_ID=286623
```

`SODEX_API_PRIVATE_KEY` must be the private key used for the SoDEX API signing account. Do not put it in frontend code.

Optional override:

```bash
SODEX_REST_BASE=https://mainnet-gw.sodex.dev/api/v1/perps
```

## Deploy on Netlify

Use these settings:

```bash
Build command: npm run build
Publish directory: .
Functions directory: netlify/functions
```

Recommended flow:

1. Upload this folder to GitHub.
2. Netlify → Add new site → Import from Git.
3. Select the repo.
4. Set build command to `npm run build`.
5. Set publish directory to `.`.
6. Add all environment variables.
7. Deploy.

## Local run with Netlify CLI

```bash
npm install
npx netlify dev
```

Open the local Netlify URL. The `/api/...` routes will be served by Netlify Functions.

## Project structure

```text
index.html                    Frontend UI
style.css                     Wave 2 app styling
script.js                     Frontend API calls and rendering
netlify.toml                  Netlify build + redirect config
netlify/functions/sosovalue.js     Secure SoSoValue proxy
netlify/functions/sodex-account.js SoDEX account-state route
netlify/functions/sodex-order.js   Real SoDEX EIP-712 signed order route
.env.example                  Environment variable template
```

## Important notes for SoDEX orders

Order submission is real. Test with small size / testnet first, and only use a dedicated SoDEX API key, not your master wallet private key.
