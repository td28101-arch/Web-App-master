const state = { indices: [], etfs: [], news: [], currencies: [] };

const $ = (id) => document.getElementById(id);
const fmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const money = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? `$${fmt.format(n)}` : '--';
};

function pick(obj, keys) {
  for (const key of keys) {
    if (obj && obj[key] !== undefined && obj[key] !== null && obj[key] !== '') return obj[key];
  }
  return undefined;
}

function normalizeList(payload) {
  const data = payload?.data ?? payload;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.list)) return data.list;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(payload?.list)) return payload.list;
  return [];
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  if (!res.ok || json?.error) {
    const message = json?.message || json?.error || res.statusText || 'Request failed';
    throw new Error(message);
  }
  return json;
}

function setStatus(ok, message) {
  const dot = $('api-dot');
  dot.className = ok ? 'status-dot ok' : 'status-dot bad';
  $('api-status').textContent = ok ? 'Live APIs connected' : 'API connection failed';
  $('api-message').textContent = message;
}

function renderMarket() {
  const grid = $('market-grid');
  const rows = state.currencies.slice(0, 6);
  if (!rows.length) {
    grid.innerHTML = '<div class="metric-card empty">No live currency rows returned.</div>';
    return;
  }
  grid.innerHTML = rows.map((c) => {
    const name = pick(c, ['name', 'currency_name', 'full_name', 'symbol', 'ticker']) || 'Asset';
    const symbol = pick(c, ['symbol', 'ticker', 'currency_symbol']) || '';
    const price = pick(c, ['price', 'current_price', 'market_price', 'last_price', 'close']);
    const change = Number(pick(c, ['price_change_percentage_24h', 'change_24h', 'price_change_24h', 'change_rate_24h']));
    const cap = pick(c, ['market_cap', 'marketcap', 'fdv']);
    return `<article class="metric-card">
      <small>${symbol}</small>
      <h3>${name}</h3>
      <div class="price">${money(price)}</div>
      <p class="change ${change >= 0 ? 'up' : 'down'}">24h ${Number.isFinite(change) ? change.toFixed(2) + '%' : '--'}</p>
      <small>Market cap: ${money(cap)}</small>
    </article>`;
  }).join('');
}

function renderIndices() {
  $('index-count').textContent = state.indices.length || '--';
  $('indices-list').innerHTML = state.indices.length ? state.indices.slice(0, 8).map((idx) => {
    const ticker = pick(idx, ['ticker', 'index_ticker', 'symbol', 'name']) || 'SSI';
    const name = pick(idx, ['name', 'index_name', 'title']) || ticker;
    const value = pick(idx, ['price', 'value', 'index_value', 'nav']);
    return `<div class="item"><div class="item-row"><div><strong>${name}</strong><br><small>${ticker}</small></div><span class="pill">${money(value)}</span></div></div>`;
  }).join('') : '<div class="empty">No index rows returned from /indices.</div>';
}

function renderEtfs() {
  $('etf-count').textContent = state.etfs.length || '--';
  $('etf-list').innerHTML = state.etfs.length ? state.etfs.slice(0, 8).map((etf) => {
    const ticker = pick(etf, ['ticker', 'symbol', 'etf_ticker']) || 'ETF';
    const name = pick(etf, ['name', 'etf_name', 'issuer']) || ticker;
    const flow = pick(etf, ['net_inflow', 'net_flow', 'total_net_inflow', 'flow']);
    return `<div class="item"><div class="item-row"><div><strong>${ticker}</strong><br><small>${name}</small></div><span class="pill">${money(flow)}</span></div></div>`;
  }).join('') : '<div class="empty">No ETF rows returned from /etfs.</div>';
}

function renderNews() {
  $('news-count').textContent = state.news.length || '--';
  $('news-list').innerHTML = state.news.length ? state.news.slice(0, 9).map((n) => {
    const title = pick(n, ['title', 'headline', 'name']) || 'Untitled news';
    const source = pick(n, ['source', 'source_name', 'author']) || 'Live Feed';
    const summary = pick(n, ['summary', 'description', 'content', 'text']) || '';
    const url = pick(n, ['url', 'link']);
    return `<article class="news-card">
      <small>${source}</small>
      <h3>${url ? `<a href="${url}" target="_blank" rel="noreferrer">${title}</a>` : title}</h3>
      <p>${String(summary).slice(0, 160)}</p>
    </article>`;
  }).join('') : '<div class="news-card empty">No live news returned from /news/hot.</div>';
}

async function loadLiveData() {
  $('refresh-btn').disabled = true;
  try {
    const [indices, etfs, news, currencies] = await Promise.all([
      api('/api/sosovalue?resource=indices&page_size=20'),
      api('/api/sosovalue?resource=etfs&page_size=20'),
      api('/api/sosovalue?resource=news-hot&page_size=12'),
      api('/api/sosovalue?resource=currencies&page_size=20'),
    ]);
    state.indices = normalizeList(indices);
    state.etfs = normalizeList(etfs);
    state.news = normalizeList(news);
    state.currencies = normalizeList(currencies);
    renderMarket(); renderIndices(); renderEtfs(); renderNews();
    setStatus(true, 'Using live responses from Vercel serverless API routes.');
  } catch (err) {
    setStatus(false, err.message);
    ['market-grid','indices-list','etf-list','news-list'].forEach(id => $(id).innerHTML = `<div class="empty error">${err.message}</div>`);
  } finally {
    $('refresh-btn').disabled = false;
  }
}

$('refresh-btn').addEventListener('click', loadLiveData);

$('account-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const address = $('wallet-address').value.trim();
  $('account-output').textContent = 'Loading live account state…';
  try {
    const result = await api(`/api/sodex-account?address=${encodeURIComponent(address)}&market=perps`);
    $('account-output').textContent = JSON.stringify(result, null, 2);
  } catch (err) {
    $('account-output').textContent = `Error: ${err.message}`;
  }
});

$('order-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const ok = confirm('This will submit a REAL signed order using the keys in Netlify. Continue?');
  if (!ok) return;
  const price = $('price').value.trim();
  const body = {
    market: $('market-type').value,
    symbolID: Number($('symbol-id').value),
    side: Number($('order-side').value),
    quantity: $('quantity').value.trim(),
    price: price || undefined,
  };
  $('order-output').textContent = 'Signing and submitting live order…';
  try {
    const result = await api('/api/sodex-order', { method: 'POST', body: JSON.stringify(body) });
    $('order-output').textContent = JSON.stringify(result, null, 2);
  } catch (err) {
    $('order-output').textContent = `Error: ${err.message}`;
  }
});

loadLiveData();
