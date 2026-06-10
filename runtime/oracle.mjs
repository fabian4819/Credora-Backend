const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

const TOKEN_MAP = [
  { market: "MNT/USDT", coingeckoId: "mantle" },
  { market: "mETH/USDT", coingeckoId: "mantle-staked-ether" },
  { market: "USDY/USDT", coingeckoId: "ondo-us-dollar-yield" }
];

const PRICE_HISTORY_LENGTH = 10;

let _priceHistory = {};
let _lastFetch = null;
let _snapshots = null;

async function fetchPrices() {
  const ids = TOKEN_MAP.map((t) => t.coingeckoId).join(",");
  const url = `${COINGECKO_BASE}/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_vol=true&include_24hr_change=true`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    _lastFetch = new Date().toISOString();
    return data;
  } catch (err) {
    console.warn("oracle: CoinGecko fetch failed:", err.message);
    return null;
  }
}

function updatePriceHistory(market, price, volume) {
  if (!_priceHistory[market]) _priceHistory[market] = [];
  _priceHistory[market].push({ price, volume, timestamp: Date.now() });
  if (_priceHistory[market].length > PRICE_HISTORY_LENGTH) {
    _priceHistory[market] = _priceHistory[market].slice(-PRICE_HISTORY_LENGTH);
  }
}

function getPriceHistory1h(market) {
  const history = _priceHistory[market] || [];
  if (history.length < 2) return history[0] || { price: 0, volume: 0 };
  const oneHourAgo = Date.now() - 3600000;
  const closest = history.reduce((best, entry) => {
    const diff = Math.abs(entry.timestamp - oneHourAgo);
    return diff < Math.abs(best.timestamp - oneHourAgo) ? entry : best;
  }, history[0]);
  return closest;
}

function getPriceHistory4h(market) {
  const history = _priceHistory[market] || [];
  if (history.length < 3) return getPriceHistory1h(market);
  const fourHoursAgo = Date.now() - 4 * 3600000;
  const closest = history.reduce((best, entry) => {
    const diff = Math.abs(entry.timestamp - fourHoursAgo);
    return diff < Math.abs(best.timestamp - fourHoursAgo) ? entry : best;
  }, history[0]);
  return closest;
}

export async function fetchSnapshots() {
  const prices = await fetchPrices();
  if (!prices) return _snapshots;

  const now = new Date().toISOString();

  _snapshots = TOKEN_MAP.map(({ market, coingeckoId }) => {
    const data = prices[coingeckoId] || {};
    const price = data.usd || 0;
    const volume24h = data.usd_24h_vol || 0;
    const change24h = data.usd_24h_change || 0;

    updatePriceHistory(market, price, volume24h);

    const price1hAgo = getPriceHistory1h(market).price || price;
    const price4hAgo = getPriceHistory4h(market).price || price;

    const priceMomentum = price1hAgo > 0 ? Math.abs((price - price1hAgo) / price1hAgo) : 0;
    const volatility = Math.min(1, priceMomentum * 3 + Math.abs(change24h) / 100);
    const volumeBaseline = volume24h > 0 ? volume24h * 0.7 : 1000000;

    return {
      market,
      timestamp: now,
      price,
      price1hAgo,
      price4hAgo,
      volume24h,
      volumeBaseline: Math.round(volumeBaseline),
      volatility: Math.round(volatility * 100) / 100,
      livePrice: true
    };
  });

  return _snapshots;
}

export function getLiveSnapshots(hardcodedSnapshots) {
  if (_snapshots && _lastFetch) {
    const secondsAgo = (Date.now() - new Date(_lastFetch).getTime()) / 1000;
    if (secondsAgo < 300) return _snapshots;
  }
  return hardcodedSnapshots;
}

export function getLastFetchTime() {
  return _lastFetch;
}

export function hasEnv() {
  return true;
}

export function startOracle({ intervalMs = 60000 }) {
  console.log("oracle: started, fetching prices every", intervalMs / 1000, "s");

  fetchSnapshots().then((snaps) => {
    if (snaps) console.log("oracle: initial fetch OK,", snaps.length, "markets");
  });

  const timer = setInterval(() => {
    fetchSnapshots().catch(() => {});
  }, intervalMs);

  return () => clearInterval(timer);
}
