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

export function getSnapshot(market) {
  const snapshot = snapshots.find((item) => item.market === market);
  if (!snapshot) throw new Error(`No snapshot for ${market}`);
  return snapshot;
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
  if (decisions.length) return;
  agents.forEach((agent, index) => {
    const snapshot = snapshots[index] ?? snapshots[0];
    const decision = runAgent(agent, snapshot);
    decisions.push(decision);
    outcomes.push(calculateOutcome(decision, exitPrices[decision.market] ?? decision.entryPrice));
  });
}

export function leaderboard() {
  seed();
  const scores = agents.map((agent) => {
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
      decisions: agentDecisions.length,
      accuracy: Math.round(accuracy * 10000) / 100,
      roiPct: Math.round(roiPct * 100) / 100,
      consistency: Math.round(consistency * 10000) / 100,
      avgRisk: Math.round(avgRisk * 100) / 100,
      credoraScore
    };
  });
  return scores.sort((a, b) => b.credoraScore - a.credoraScore).map((score, index) => ({ ...score, rank: index + 1 }));
}

export function proof(decisionId) {
  seed();
  const decision = decisions.find((item) => item.id === decisionId);
  if (!decision) return undefined;
  return {
    agent: agents.find((item) => item.id === decision.agentId),
    decision,
    outcome: outcomes.find((item) => item.decisionId === decisionId),
    proof: {
      dataHash: decision.dataHash,
      rationaleHash: decision.rationaleHash,
      txHash: "0xDemoTxHashReplaceAfterMantleDeploy",
      explorerUrl: "https://explorer.sepolia.mantle.xyz/"
    }
  };
}

