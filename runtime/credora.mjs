import { createHash } from "node:crypto";

export const season = {
  id: "season-1",
  name: "Mantle AI Alpha Challenge",
  marketScope: "MNT, mETH, USDY",
  startTime: "2026-06-09T00:00:00.000Z",
  endTime: "2026-06-16T00:00:00.000Z",
  status: "active"
};

export const agents = [
  {
    id: "1",
    name: "MNTScout",
    source: "momentum",
    strategyType: "Momentum and volume confirmation",
    tradingPlatform: "demo",
    riskProfile: "medium",
    supportedMarkets: ["MNT/USDT"]
  },
  {
    id: "2",
    name: "DeltaMind",
    source: "mean-reversion",
    strategyType: "Mean reversion",
    tradingPlatform: "demo",
    riskProfile: "low",
    supportedMarkets: ["mETH/USDT"]
  },
  {
    id: "3",
    name: "GuardRail",
    source: "risk-aware",
    strategyType: "Risk-aware alpha filter",
    tradingPlatform: "demo",
    riskProfile: "low",
    supportedMarkets: ["USDY/USDT"]
  }
];

export const snapshots = [
  {
    market: "MNT/USDT",
    timestamp: "2026-06-09T02:00:00.000Z",
    price: 1.25,
    price1hAgo: 1.21,
    price4hAgo: 1.18,
    volume24h: 18400000,
    volumeBaseline: 11200000,
    volatility: 0.42
  },
  {
    market: "mETH/USDT",
    timestamp: "2026-06-09T02:00:00.000Z",
    price: 3610,
    price1hAgo: 3632,
    price4hAgo: 3695,
    volume24h: 8100000,
    volumeBaseline: 9000000,
    volatility: 0.31
  },
  {
    market: "USDY/USDT",
    timestamp: "2026-06-09T02:00:00.000Z",
    price: 1.002,
    price1hAgo: 1.001,
    price4hAgo: 1.001,
    volume24h: 2200000,
    volumeBaseline: 2100000,
    volatility: 0.04
  }
];

export const decisions = [];
export const outcomes = [];
export const strategyAccounts = [];

const exitPrices = {
  "MNT/USDT": 1.31,
  "mETH/USDT": 3548,
  "USDY/USDT": 1.003
};

function canonicalize(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  return `{${Object.entries(value)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, child]) => `${JSON.stringify(key)}:${canonicalize(child)}`)
    .join(",")}}`;
}

function hash(value) {
  return `0x${createHash("sha256").update(canonicalize(value)).digest("hex")}`;
}

export const dataSources = [
  {
    id: "bybit-copy-trading",
    name: "Bybit Copy Trading / Leaderboard",
    sourceType: "cex",
    verificationMode: "public_leaderboard_or_read_only_api",
    requiredProof: ["sourceProofUrl", "period", "roiPct", "winRatePct", "tradeCount", "maxDrawdownPct"],
    notes: "Best for importing existing Master Trader or bot strategy performance."
  },
  {
    id: "nansen-smart-money",
    name: "Nansen Smart Money",
    sourceType: "onchain_analytics",
    verificationMode: "api_or_curated_wallet_label",
    requiredProof: ["walletAddress", "chain", "smartMoneyLabel", "period", "roiPct"],
    notes: "Best for observed on-chain wallets, including Mantle smart trader labels when available."
  },
  {
    id: "mantle-wallet-tracker",
    name: "Mantle Wallet Tracker",
    sourceType: "onchain",
    verificationMode: "wallet_activity",
    requiredProof: ["walletAddress", "chain", "txHashes", "period"],
    notes: "Best for Mantle-native DEX wallets and agent-controlled trading wallets."
  },
  {
    id: "manual-evidence-import",
    name: "Manual Evidence Import",
    sourceType: "manual",
    verificationMode: "csv_or_json_attestation",
    requiredProof: ["sourceProofUrl", "period", "metrics"],
    notes: "Hackathon-friendly fallback for importing public leaderboard snapshots."
  }
];

const seededStrategyInputs = [
  {
    source: "bybit-copy-trading",
    sourcePlatform: "Bybit",
    externalAccountId: "bybit-master-alpha-30d-demo",
    displayName: "AlphaMaster 30D",
    accountType: "observed_strategy_account",
    verificationLevel: "public_track_record",
    markets: ["BTC/USDT", "ETH/USDT", "MNT/USDT"],
    period: "30d",
    metrics: {
      roiPct: 18.4,
      winRatePct: 64.2,
      maxDrawdownPct: 7.8,
      tradeCount: 126,
      volumeUsd: 820000,
      consistencyPct: 71
    },
    sourceProofUrl: "https://www.bybit.com/copyTrading",
    notes: "Demo import shape for an existing copy-trading strategy account."
  },
  {
    source: "nansen-smart-money",
    sourcePlatform: "Nansen / Mantle",
    externalAccountId: "mantle-smart-trader-demo",
    displayName: "Mantle Smart Wallet",
    accountType: "observed_strategy_account",
    verificationLevel: "analytics_label",
    walletAddress: "0x1111111111111111111111111111111111111111",
    chain: "mantle",
    markets: ["MNT", "mETH", "USDY"],
    period: "90d",
    metrics: {
      roiPct: 12.9,
      winRatePct: 59.5,
      maxDrawdownPct: 5.1,
      tradeCount: 88,
      volumeUsd: 430000,
      consistencyPct: 76
    },
    sourceProofUrl: "https://docs.nansen.ai/api/smart-money",
    notes: "Demo import shape for a Smart Money wallet tracked from on-chain analytics."
  },
  {
    source: "mantle-wallet-tracker",
    sourcePlatform: "Mantle DEX",
    externalAccountId: "mnt-dex-bot-wallet-demo",
    displayName: "MNT DEX Strategy Wallet",
    accountType: "verified_agent",
    verificationLevel: "wallet_observed",
    walletAddress: "0x2222222222222222222222222222222222222222",
    chain: "mantle",
    markets: ["MNT/USDT", "mETH/MNT"],
    period: "14d",
    metrics: {
      roiPct: 8.7,
      winRatePct: 61.8,
      maxDrawdownPct: 4.6,
      tradeCount: 42,
      volumeUsd: 117000,
      consistencyPct: 68
    },
    txHashes: [
      "0xabf8c2bf714512d201c5b19927017806e0213079ab2ed0c045239d0fecec27df",
      "0x20275306eeaa6b41f20026febbdd62492f982b54dd0425af2721ec337ba0c0fc"
    ],
    sourceProofUrl: "https://explorer.sepolia.mantle.xyz/",
    notes: "Demo import shape for a wallet-tracked agent strategy on Mantle."
  }
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function scoreTrackRecord(record) {
  const metrics = record.metrics ?? {};
  const roiPct = toNumber(metrics.roiPct);
  const winRatePct = toNumber(metrics.winRatePct, 50);
  const maxDrawdownPct = toNumber(metrics.maxDrawdownPct, 20);
  const tradeCount = toNumber(metrics.tradeCount);
  const consistencyPct = toNumber(metrics.consistencyPct, winRatePct);

  const roiScore = clamp((roiPct + 10) / 50, 0, 1);
  const winRateScore = clamp(winRatePct / 100, 0, 1);
  const riskScore = clamp(1 - maxDrawdownPct / 50, 0, 1);
  const consistencyScore = clamp(consistencyPct / 100, 0, 1);
  const sampleSizeScore = clamp(tradeCount / 100, 0, 1);
  const sourceCredibility = {
    verified_agent: 1,
    observed_strategy_account: 0.82,
    imported_public_account: 0.72
  }[record.accountType] ?? 0.7;

  const credoraScore =
    roiScore * 0.28 +
    winRateScore * 0.2 +
    riskScore * 0.2 +
    consistencyScore * 0.17 +
    sampleSizeScore * 0.1 +
    sourceCredibility * 0.05;

  return Math.round(credoraScore * 10000) / 100;
}

export function normalizeTrackRecord(input) {
  const now = new Date().toISOString();
  const source = String(input.source ?? "manual-evidence-import");
  const externalAccountId = String(input.externalAccountId ?? input.walletAddress ?? `manual-${Date.now()}`);
  const payload = {
    id: `${source}:${externalAccountId}`,
    source,
    sourceType: dataSources.find((item) => item.id === source)?.sourceType ?? "manual",
    sourcePlatform: String(input.sourcePlatform ?? source),
    externalAccountId,
    displayName: String(input.displayName ?? input.agentName ?? externalAccountId),
    accountType: String(input.accountType ?? "observed_strategy_account"),
    verificationLevel: String(input.verificationLevel ?? "public_track_record"),
    walletAddress: input.walletAddress ? String(input.walletAddress) : undefined,
    chain: input.chain ? String(input.chain) : undefined,
    markets: Array.isArray(input.markets) ? input.markets.map(String) : [],
    period: String(input.period ?? "30d"),
    metrics: {
      roiPct: toNumber(input.metrics?.roiPct ?? input.roiPct),
      winRatePct: toNumber(input.metrics?.winRatePct ?? input.winRatePct, 50),
      maxDrawdownPct: toNumber(input.metrics?.maxDrawdownPct ?? input.maxDrawdownPct, 20),
      tradeCount: toNumber(input.metrics?.tradeCount ?? input.tradeCount),
      volumeUsd: toNumber(input.metrics?.volumeUsd ?? input.volumeUsd),
      consistencyPct: toNumber(input.metrics?.consistencyPct ?? input.consistencyPct, input.metrics?.winRatePct ?? 50)
    },
    txHashes: Array.isArray(input.txHashes) ? input.txHashes.map(String) : [],
    sourceProofUrl: String(input.sourceProofUrl ?? ""),
    notes: input.notes ? String(input.notes) : undefined,
    importedAt: input.importedAt ? String(input.importedAt) : now,
    proofStatus: "offchain_verified_pending_anchor"
  };
  payload.dataHash = hash({
    source: payload.source,
    externalAccountId: payload.externalAccountId,
    period: payload.period,
    metrics: payload.metrics,
    walletAddress: payload.walletAddress,
    txHashes: payload.txHashes,
    sourceProofUrl: payload.sourceProofUrl
  });
  payload.credoraScore = scoreTrackRecord(payload);
  return payload;
}

export function upsertStrategyAccount(account) {
  const existingIndex = strategyAccounts.findIndex((item) => item.id === account.id);
  if (existingIndex >= 0) {
    strategyAccounts[existingIndex] = account;
    return account;
  }
  strategyAccounts.push(account);
  return account;
}

export function seedStrategyAccounts() {
  if (strategyAccounts.length) return;
  seededStrategyInputs.forEach((input) => upsertStrategyAccount(normalizeTrackRecord(input)));
}

export function getSnapshot(market) {
  const snapshot = snapshots.find((item) => item.market === market);
  if (!snapshot) throw new Error(`No snapshot for ${market}`);
  return snapshot;
}

let _liveSnapshots = null;

export function setLiveSnapshots(snaps) {
  if (snaps && snaps.length) _liveSnapshots = snaps;
}

export function getLiveSnapshot(market) {
  if (!_liveSnapshots) return getSnapshot(market);
  const live = _liveSnapshots.find((s) => s.market === market);
  return live || getSnapshot(market);
}

export function hasLivePrices() {
  return Boolean(_liveSnapshots);
}

export function runAgent(agent, snapshot) {
  const priceMomentum = (snapshot.price - snapshot.price1hAgo) / snapshot.price1hAgo;
  const volumeRatio = snapshot.volume24h / snapshot.volumeBaseline;
  const volatilityRisk = Math.min(100, Math.round(snapshot.volatility * 100));

  let action = "HOLD";
  let confidence = 55;
  let riskScore = volatilityRisk;
  let rationale = "No strong signal detected.";

  if (agent.source === "momentum") {
    action = priceMomentum > 0.015 && volumeRatio > 1.25 ? "LONG" : "HOLD";
    confidence = Math.min(94, Math.round(60 + priceMomentum * 700 + (volumeRatio - 1) * 20));
    riskScore = Math.min(100, Math.round(volatilityRisk + (volumeRatio > 1.8 ? 12 : 0)));
    rationale = "Positive price momentum is confirmed by elevated volume.";
  }

  if (agent.source === "mean-reversion") {
    action = priceMomentum < -0.01 ? "LONG" : priceMomentum > 0.025 ? "SHORT" : "HOLD";
    confidence = Math.min(90, Math.round(58 + Math.abs(priceMomentum) * 900));
    riskScore = Math.min(100, Math.round(volatilityRisk + Math.abs(priceMomentum) * 500));
    rationale = "Price moved away from its short-term baseline, triggering mean reversion logic.";
  }

  if (agent.source === "risk-aware") {
    action = snapshot.volatility < 0.1 ? "HOLD" : "ALERT";
    confidence = snapshot.volatility < 0.1 ? 72 : 61;
    riskScore = volatilityRisk;
    rationale = "Risk-aware policy prioritizes low-volatility preservation over aggressive entries.";
  }

  const raw = { agentId: agent.id, market: snapshot.market, action, confidence, riskScore, snapshot };
  const rationalePayload = { rationale, policy: agent.strategyType };

  return {
    id: `${agent.id}-${snapshot.market}-${Date.now()}`,
    agentId: agent.id,
    seasonId: season.id,
    market: snapshot.market,
    action,
    entryPrice: snapshot.price,
    targetWindowHours: 4,
    confidence,
    riskScore,
    rationale,
    dataHash: hash(raw),
    rationaleHash: hash(rationalePayload),
    evidenceUri: `memory://evidence/${agent.id}/${snapshot.market}`,
    submittedAt: snapshot.timestamp
  };
}

export function calculateOutcome(decision, exitPrice) {
  const priceMove = (exitPrice - decision.entryPrice) / decision.entryPrice;
  const signedReturn = decision.action === "SHORT" ? -priceMove : decision.action === "LONG" ? priceMove : 0;
  const roiBps = Math.round(signedReturn * 10000);
  let status = "neutral";

  if (decision.action === "ALERT") status = Math.abs(priceMove) >= 0.015 ? "success" : "neutral";
  else if (decision.action === "HOLD") status = Math.abs(priceMove) <= 0.01 ? "success" : "neutral";
  else if (roiBps > 25) status = "success";
  else if (roiBps < -25) status = "failed";

  const realized = status === "success" ? 100 : status === "failed" ? 0 : 50;
  const confidenceCalibration = Math.max(0, 100 - Math.abs(decision.confidence - realized));
  const metrics = { decisionId: decision.id, priceBefore: decision.entryPrice, priceAfter: exitPrice, roiBps, status };

  return {
    decisionId: decision.id,
    agentId: decision.agentId,
    seasonId: decision.seasonId,
    status,
    priceBefore: decision.entryPrice,
    priceAfter: exitPrice,
    roiBps,
    confidenceCalibration,
    metricsHash: hash(metrics),
    evidenceUri: `memory://outcomes/${decision.id}`
  };
}

export function seed() {
  if (decisions.length) {
    seedStrategyAccounts();
    return;
  }
  agents.forEach((agent, index) => {
    const snapshot = snapshots[index] ?? snapshots[0];
    const decision = runAgent(agent, snapshot);
    decisions.push(decision);
    outcomes.push(calculateOutcome(decision, exitPrices[decision.market] ?? decision.entryPrice));
  });
  seedStrategyAccounts();
}

export function leaderboard() {
  seed();
  const demoScores = agents.map((agent) => {
    const agentDecisions = decisions.filter((decision) => decision.agentId === agent.id);
    const agentOutcomes = agentDecisions
      .map((decision) => outcomes.find((outcome) => outcome.decisionId === decision.id))
      .filter(Boolean);
    const successes = agentOutcomes.filter((outcome) => outcome.status === "success").length;
    const failures = agentOutcomes.filter((outcome) => outcome.status === "failed").length;
    const total = agentOutcomes.length || 1;
    const accuracy = successes / total;
    const roiPct = agentOutcomes.reduce((sum, outcome) => sum + outcome.roiBps, 0) / 100;
    const avgRisk = agentDecisions.reduce((sum, decision) => sum + decision.riskScore, 0) / Math.max(1, agentDecisions.length);
    const consistency = total <= 1 ? accuracy : Math.max(0, accuracy - failures / total / 2);
    const roiScore = Math.max(0, Math.min(1, (roiPct + 10) / 20));
    const riskScore = Math.max(0, 1 - avgRisk / 100);
    const credoraScore = Math.round((accuracy * 0.35 + roiScore * 0.25 + consistency * 0.2 + riskScore * 0.2) * 10000) / 100;
    return {
      agentId: agent.id,
      agentName: agent.name,
      entryType: "demo_agent",
      source: agent.tradingPlatform,
      verificationLevel: "demo_generated",
      decisions: agentDecisions.length,
      accuracy: Math.round(accuracy * 10000) / 100,
      roiPct: Math.round(roiPct * 100) / 100,
      consistency: Math.round(consistency * 10000) / 100,
      avgRisk: Math.round(avgRisk * 100) / 100,
      credoraScore
    };
  });

  const importedScores = strategyAccounts.map((record) => ({
    agentId: record.id,
    agentName: record.displayName,
    entryType: record.accountType,
    source: record.sourcePlatform,
    verificationLevel: record.verificationLevel,
    period: record.period,
    markets: record.markets,
    decisions: record.metrics.tradeCount,
    accuracy: Math.round(record.metrics.winRatePct * 100) / 100,
    roiPct: Math.round(record.metrics.roiPct * 100) / 100,
    consistency: Math.round(record.metrics.consistencyPct * 100) / 100,
    avgRisk: Math.round(record.metrics.maxDrawdownPct * 100) / 100,
    credoraScore: record.credoraScore,
    dataHash: record.dataHash,
    sourceProofUrl: record.sourceProofUrl
  }));

  return [...demoScores, ...importedScores]
    .sort((a, b) => b.credoraScore - a.credoraScore)
    .map((score, index) => ({ ...score, rank: index + 1 }));
}

export function strategyAccountProof(id) {
  seedStrategyAccounts();
  const record = strategyAccounts.find((item) => item.id === id);
  if (!record) return undefined;
  return {
    account: record,
    proof: {
      dataHash: record.dataHash,
      sourceProofUrl: record.sourceProofUrl,
      txHashes: record.txHashes,
      proofStatus: record.proofStatus,
      explorerUrls: record.txHashes.map((txHash) => `https://explorer.sepolia.mantle.xyz/tx/${txHash}`)
    }
  };
}

export function proof(decisionId) {
  seed();
  const decision = decisions.find((item) => item.id === decisionId);
  if (!decision) return undefined;
  const matchingOutcome = outcomes.find((item) => item.decisionId === decisionId);
  const decisionTxHash = decision.onChainTxHash;
  const outcomeTxHash = matchingOutcome?.onChainTxHash;
  const txHash = outcomeTxHash || decisionTxHash || null;
  const hasRealTx = Boolean(outcomeTxHash || decisionTxHash);
  return {
    agent: agents.find((item) => item.id === decision.agentId),
    decision,
    outcome: matchingOutcome,
    proof: {
      dataHash: decision.dataHash,
      rationaleHash: decision.rationaleHash,
      metricsHash: matchingOutcome?.metricsHash ?? undefined,
      decisionTxHash: decisionTxHash ?? undefined,
      outcomeTxHash: outcomeTxHash ?? undefined,
      txHash: txHash || (hasRealTx ? undefined : "0xDemoTxHashReplaceAfterMantleDeploy"),
      explorerUrl: txHash
        ? `https://explorer.sepolia.mantle.xyz/tx/${txHash}`
        : "https://explorer.sepolia.mantle.xyz/"
    }
  };
}
