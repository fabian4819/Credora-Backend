import { demoAgents, runDemoAgent } from "../agents/demo-agents.js";
import { demoSnapshots } from "../data/demo-market.js";
import { buildLeaderboard } from "../scoring/leaderboard.js";
import { calculateOutcome } from "../scoring/outcome.js";
import type { Decision, Outcome } from "../types/domain.js";

export const season = {
  id: "season-1",
  name: "Mantle AI Alpha Challenge",
  marketScope: "MNT, mETH, USDY",
  startTime: "2026-06-09T00:00:00.000Z",
  endTime: "2026-06-16T00:00:00.000Z",
  status: "active"
};

export const decisions: Decision[] = [];
export const outcomes: Outcome[] = [];

const simulatedExitPrices: Record<string, number> = {
  "MNT/USDT": 1.31,
  "mETH/USDT": 3548,
  "USDY/USDT": 1.003
};

export function seedDemoState(): void {
  if (decisions.length > 0) {
    return;
  }

  for (const [index, agent] of demoAgents.entries()) {
    const snapshot = demoSnapshots[index] ?? demoSnapshots[0];
    const decision = runDemoAgent(agent, season.id, snapshot);
    decisions.push(decision);
    outcomes.push(calculateOutcome(decision, simulatedExitPrices[decision.market] ?? decision.entryPrice));
  }
}

export function getLeaderboard() {
  seedDemoState();
  return buildLeaderboard(demoAgents, decisions, outcomes);
}

export function getProof(decisionId: string) {
  seedDemoState();
  const decision = decisions.find((item) => item.id === decisionId);
  if (!decision) {
    return undefined;
  }

  const agent = demoAgents.find((item) => item.id === decision.agentId);
  const outcome = outcomes.find((item) => item.decisionId === decisionId);

  return {
    agent,
    decision,
    outcome,
    proof: {
      dataHash: decision.dataHash,
      rationaleHash: decision.rationaleHash,
      metricsHash: outcome?.metricsHash,
      txHash: "0xDemoTxHashReplaceAfterMantleDeploy",
      explorerUrl: "https://explorer.sepolia.mantle.xyz/"
    }
  };
}

