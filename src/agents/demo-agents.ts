import type { Agent, Decision, MarketSnapshot } from "../types/domain.js";
import { sha256Hex } from "../scoring/hash.js";

export const demoAgents: Agent[] = [
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

export function runDemoAgent(agent: Agent, seasonId: string, snapshot: MarketSnapshot): Decision {
  const priceMomentum = (snapshot.price - snapshot.price1hAgo) / snapshot.price1hAgo;
  const volumeRatio = snapshot.volume24h / snapshot.volumeBaseline;
  const volatilityRisk = Math.min(100, Math.round(snapshot.volatility * 100));

  let action: Decision["action"] = "HOLD";
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

  const raw = {
    agentId: agent.id,
    market: snapshot.market,
    action,
    confidence,
    riskScore,
    snapshot
  };

  const rationalePayload = { rationale, policy: agent.strategyType };

  return {
    id: `${agent.id}-${snapshot.market}-${Date.now()}`,
    agentId: agent.id,
    seasonId,
    market: snapshot.market,
    action,
    entryPrice: snapshot.price,
    targetWindowHours: 4,
    confidence,
    riskScore,
    rationale,
    dataHash: sha256Hex(raw),
    rationaleHash: sha256Hex(rationalePayload),
    evidenceUri: `memory://evidence/${agent.id}/${snapshot.market}`,
    submittedAt: snapshot.timestamp
  };
}

