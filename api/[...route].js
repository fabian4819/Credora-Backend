import {
  agents,
  calculateOutcome,
  decisions,
  getSnapshot,
  leaderboard,
  outcomes,
  proof,
  runAgent,
  season,
  seed
} from "../runtime/credora.mjs";

seed();

function send(res, status, body) {
  res.status(status).json(body);
}

export default async function handler(req, res) {
  const route = Array.isArray(req.query.route) ? req.query.route : [];
  const path = `/${route.join("/")}`;

  try {
    if (req.method === "GET" && path === "/health") {
      return send(res, 200, { ok: true, service: "credora-backend", season: season.id });
    }

    if (req.method === "GET" && path === "/season/current") {
      return send(res, 200, season);
    }

    if (req.method === "GET" && path === "/agents") {
      return send(res, 200, { agents });
    }

    if (req.method === "GET" && path === "/decisions") {
      return send(res, 200, { decisions });
    }

    if (req.method === "GET" && path === "/outcomes") {
      return send(res, 200, { outcomes });
    }

    if (req.method === "GET" && path === "/leaderboard") {
      return send(res, 200, { season, leaderboard: leaderboard() });
    }

    if (req.method === "GET" && path.startsWith("/proof/")) {
      const decisionId = decodeURIComponent(path.replace("/proof/", ""));
      const result = proof(decisionId);
      return result ? send(res, 200, result) : send(res, 404, { error: "Decision not found" });
    }

    if (req.method === "POST" && path === "/agents/run") {
      const body = typeof req.body === "object" && req.body !== null ? req.body : {};
      const agent = agents.find((item) => item.id === String(body.agentId ?? ""));
      if (!agent) {
        return send(res, 404, { error: "Agent not found" });
      }

      const snapshot = getSnapshot(String(body.market ?? agent.supportedMarkets[0]));
      const decision = runAgent(agent, snapshot);
      const outcome = calculateOutcome(decision, snapshot.price);
      decisions.push(decision);
      outcomes.push(outcome);

      return send(res, 201, { decision, outcome, leaderboard: leaderboard() });
    }

    if (req.method === "GET" && path === "/discovery") {
      return send(res, 200, {
        schema: "credora.discovery.v1",
        name: "Credora",
        description: "Competitive reputation arena for AI trading agents.",
        services: [
          { type: "leaderboard", endpoint: "/api/leaderboard" },
          { type: "proof", endpoint: "/api/proof/{decisionId}" },
          { type: "run-demo-agent", endpoint: "/api/agents/run" }
        ]
      });
    }

    return send(res, 404, { error: "Route not found", path });
  } catch (error) {
    return send(res, 500, { error: error instanceof Error ? error.message : "Unknown error" });
  }
}

