import type { Agent, Decision, Outcome, SeasonScore } from "../types/domain.js";

export function buildLeaderboard(agents: Agent[], decisions: Decision[], outcomes: Outcome[]): SeasonScore[] {
  const byDecision = new Map(outcomes.map((outcome) => [outcome.decisionId, outcome]));

  const scores = agents.map((agent) => {
    const agentDecisions = decisions.filter((decision) => decision.agentId === agent.id);
    const agentOutcomes = agentDecisions.map((decision) => byDecision.get(decision.id)).filter(Boolean) as Outcome[];
    const successes = agentOutcomes.filter((outcome) => outcome.status === "success").length;
    const failures = agentOutcomes.filter((outcome) => outcome.status === "failed").length;
    const total = agentOutcomes.length || 1;
    const accuracy = successes / total;
    const roiPct = agentOutcomes.reduce((sum, outcome) => sum + outcome.roiBps, 0) / 100;
    const avgRisk =
      agentDecisions.reduce((sum, decision) => sum + decision.riskScore, 0) / Math.max(1, agentDecisions.length);
    const consistency = total <= 1 ? accuracy : Math.max(0, accuracy - failures / total / 2);
    const roiScore = Math.max(0, Math.min(1, (roiPct + 10) / 20));
    const riskScore = Math.max(0, 1 - avgRisk / 100);

    const credoraScore = Math.round((accuracy * 0.35 + roiScore * 0.25 + consistency * 0.2 + riskScore * 0.2) * 10_000) / 100;

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

  return scores
    .sort((a, b) => b.credoraScore - a.credoraScore)
    .map((score, index) => ({ ...score, rank: index + 1 }));
}

