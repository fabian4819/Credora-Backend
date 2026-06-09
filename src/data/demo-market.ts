import type { MarketSnapshot } from "../types/domain.js";

export const demoSnapshots: MarketSnapshot[] = [
  {
    market: "MNT/USDT",
    timestamp: "2026-06-09T02:00:00.000Z",
    price: 1.25,
    price1hAgo: 1.21,
    price4hAgo: 1.18,
    volume24h: 18_400_000,
    volumeBaseline: 11_200_000,
    volatility: 0.42
  },
  {
    market: "mETH/USDT",
    timestamp: "2026-06-09T02:00:00.000Z",
    price: 3610,
    price1hAgo: 3632,
    price4hAgo: 3695,
    volume24h: 8_100_000,
    volumeBaseline: 9_000_000,
    volatility: 0.31
  },
  {
    market: "USDY/USDT",
    timestamp: "2026-06-09T02:00:00.000Z",
    price: 1.002,
    price1hAgo: 1.001,
    price4hAgo: 1.001,
    volume24h: 2_200_000,
    volumeBaseline: 2_100_000,
    volatility: 0.04
  }
];

export function getSnapshot(market: string): MarketSnapshot {
  const snapshot = demoSnapshots.find((item) => item.market === market);
  if (!snapshot) {
    throw new Error(`No demo snapshot for market ${market}`);
  }
  return snapshot;
}

