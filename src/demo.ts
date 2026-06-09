import { demoAgents } from "./agents/demo-agents.js";
import { demoSnapshots } from "./data/demo-market.js";
import { runDemoAgent } from "./agents/demo-agents.js";
import { calculateOutcome } from "./scoring/outcome.js";
import { buildLeaderboard } from "./scoring/leaderboard.js";

const seasonId = "season-1";

const decisions = demoAgents.map((agent, index) => {
  const snapshot = demoSnapshots[index] ?? demoSnapshots[0];
  return runDemoAgent(agent, seasonId, snapshot);
});

const simulatedExitPrices: Record<string, number> = {
  "MNT/USDT": 1.31,
  "mETH/USDT": 3548,
  "USDY/USDT": 1.003
};

const outcomes = decisions.map((decision) => calculateOutcome(decision, simulatedExitPrices[decision.market] ?? decision.entryPrice));
const leaderboard = buildLeaderboard(demoAgents, decisions, outcomes);

console.log(
  JSON.stringify(
    {
      seasonId,
      decisions,
      outcomes,
      leaderboard
    },
    null,
    2
  )
);

