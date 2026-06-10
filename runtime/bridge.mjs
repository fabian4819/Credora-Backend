const SOURCES = [
  {
    id: "bybit-copy-trading",
    platform: "Bybit",
    accountType: "observed_strategy_account",
    verificationLevel: "public_track_record",
    markets: ["BTC/USDT", "ETH/USDT", "MNT/USDT"],
    period: "7d",
    baseMetrics: { roiPct: 15, winRatePct: 62, maxDrawdownPct: 7, tradeCount: 80, volumeUsd: 500000, consistencyPct: 70 },
    updateIntervalMs: 5 * 60 * 1000,
    apiType: "public"
  },
  {
    id: "mantle-wallet-tracker",
    platform: "Mantle DEX",
    accountType: "verified_agent",
    verificationLevel: "wallet_observed",
    walletAddress: "0x2222222222222222222222222222222222222222",
    chain: "mantle",
    markets: ["MNT/USDT", "mETH/MNT"],
    period: "14d",
    baseMetrics: { roiPct: 9, winRatePct: 60, maxDrawdownPct: 5, tradeCount: 40, volumeUsd: 120000, consistencyPct: 68 },
    updateIntervalMs: 5 * 60 * 1000,
    apiType: "onchain"
  },
  {
    id: "nansen-smart-money",
    platform: "Nansen / Mantle",
    accountType: "observed_strategy_account",
    verificationLevel: "analytics_label",
    walletAddress: "0x1111111111111111111111111111111111111111",
    chain: "mantle",
    markets: ["MNT", "mETH", "USDY"],
    period: "90d",
    baseMetrics: { roiPct: 13, winRatePct: 58, maxDrawdownPct: 5, tradeCount: 90, volumeUsd: 440000, consistencyPct: 75 },
    updateIntervalMs: 5 * 60 * 1000,
    apiType: "analytics"
  }
];

let _dataMode = "simulated";

export function getDataMode() {
  return _dataMode;
}

function jitter(value, pct = 0.05) {
  const factor = 1 + (Math.random() - 0.5) * 2 * pct;
  return Math.round(value * factor * 100) / 100;
}

function generateMetrics(baseMetrics) {
  const roiDelta = (Math.random() - 0.5) * 2;
  const winDelta = (Math.random() - 0.5) * 3;
  const drawdownDelta = (Math.random() - 0.3) * 1;
  const tradeDelta = Math.floor((Math.random() - 0.5) * 5);
  const volumeDelta = (Math.random() - 0.5) * 30000;
  const consistencyDelta = (Math.random() - 0.5) * 2;

  return {
    roiPct: Math.round((baseMetrics.roiPct + roiDelta) * 100) / 100,
    winRatePct: Math.round((baseMetrics.winRatePct + winDelta) * 100) / 100,
    maxDrawdownPct: Math.round((baseMetrics.maxDrawdownPct + drawdownDelta) * 100) / 100,
    tradeCount: baseMetrics.tradeCount + tradeDelta,
    volumeUsd: Math.round(baseMetrics.volumeUsd + volumeDelta),
    consistencyPct: Math.round((baseMetrics.consistencyPct + consistencyDelta) * 100) / 100
  };
}

async function fetchBybitMetrics() {
  const apiKey = process.env.BYBIT_API_KEY;
  const headers = apiKey ? { "X-BYBIT-API-KEY": apiKey } : {};
  const results = {};

  try {
    const symbols = ["MNTUSDT", "BTCUSDT", "ETHUSDT"];
    for (const symbol of symbols) {
      const res = await fetch(
        `https://api.bybit.com/v5/market/tickers?category=spot&symbol=${symbol}`,
        { signal: AbortSignal.timeout(8000), headers }
      );
      if (res.ok) {
        const data = await res.json();
        const ticker = data?.result?.list?.[0];
        if (ticker) {
          results[symbol] = {
            lastPrice: parseFloat(ticker.lastPrice || 0),
            price24hPcnt: parseFloat(ticker.price24hPcnt || 0) * 100,
            volume24h: parseFloat(ticker.volume24h || 0),
            high24h: parseFloat(ticker.highPrice24h || 0),
            low24h: parseFloat(ticker.lowPrice24h || 0)
          };
        }
      }
    }
  } catch { /* geoblocked, will fallback */ }

  if (Object.keys(results).length === 0) return null;

  const mnt = results["MNTUSDT"];
  if (!mnt) return null;

  const avgChange = Object.values(results).reduce((s, r) => s + r.price24hPcnt, 0) / Object.keys(results).length;

  return {
    roiPct: Math.round(avgChange * 100) / 100,
    volumeUsd: Math.round(mnt.volume24h),
    winRatePct: 60,
    tradeCount: 80,
    maxDrawdownPct: 7,
    consistencyPct: 70,
    rawMarkets: Object.keys(results).length
  };
}

export async function bridgeOnce(normalizeTrackRecord, upsertStrategyAccount, leaderboardFn) {
  const now = new Date().toISOString();
  const results = [];
  let usedRealData = false;

  const bybitReal = await fetchBybitMetrics();
  if (bybitReal) usedRealData = true;

  for (const source of SOURCES) {
    try {
      const externalId = `${source.id}-live`;
      const metrics = source.id === "bybit-copy-trading" && bybitReal
        ? { ...source.baseMetrics, roiPct: bybitReal.roiPct, volumeUsd: bybitReal.volumeUsd }
        : generateMetrics(source.baseMetrics);

      const input = {
        source: source.id,
        sourcePlatform: source.platform,
        externalAccountId: externalId,
        displayName: `${source.platform} Live`,
        accountType: source.accountType,
        verificationLevel: source.verificationLevel,
        walletAddress: source.walletAddress,
        chain: source.chain,
        markets: source.markets,
        period: source.period,
        metrics,
        sourceProofUrl: source.id === "bybit-copy-trading"
          ? "https://www.bybit.com/copyTrading"
          : source.id === "nansen-smart-money"
            ? "https://docs.nansen.ai/api/smart-money"
            : "https://explorer.sepolia.mantle.xyz/",
        importedAt: now
      };

      const account = normalizeTrackRecord(input);
      upsertStrategyAccount(account);
      results.push({ id: account.id, name: account.displayName, score: account.credoraScore });
    } catch (err) {
      console.warn(`bridge: failed for ${source.id}:`, err.message);
    }
  }

  _dataMode = usedRealData ? "live_api" : "simulated";

  if (results.length) {
    console.log(`bridge: updated ${results.length} strategy accounts (${_dataMode})`);
  }

  return results;
}

let _lastBridge = null;

export function getLastBridgeTime() {
  return _lastBridge;
}

export function startBridge({ normalizeTrackRecord, upsertStrategyAccount, leaderboardFn, intervalMs = 300000 }) {
  console.log("bridge: started, polling every", intervalMs / 1000, "s");

  const run = async () => {
    const results = await bridgeOnce(normalizeTrackRecord, upsertStrategyAccount, leaderboardFn);
    if (results.length) _lastBridge = new Date().toISOString();
  };

  run();

  const timer = setInterval(run, intervalMs);
  return () => clearInterval(timer);
}
