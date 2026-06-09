import { createServer } from "node:http";
import { URL } from "node:url";
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
} from "./runtime/credora.mjs";

const port = Number(process.env.PORT ?? 8787);

function sendJson(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type"
  });
  res.end(JSON.stringify(body, null, 2));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}

seed();

const server = createServer(async (req, res) => {
  if (!req.url) return sendJson(res, 400, { error: "Missing URL" });
  if (req.method === "OPTIONS") return sendJson(res, 204, {});

  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);
  const path = url.pathname;

  try {
    if (req.method === "GET" && path === "/api/health") return sendJson(res, 200, { ok: true, service: "credora-backend", season: season.id });
    if (req.method === "GET" && path === "/api/season/current") return sendJson(res, 200, season);
    if (req.method === "GET" && path === "/api/agents") return sendJson(res, 200, { agents });
    if (req.method === "GET" && path === "/api/decisions") return sendJson(res, 200, { decisions });
    if (req.method === "GET" && path === "/api/outcomes") return sendJson(res, 200, { outcomes });
    if (req.method === "GET" && path === "/api/leaderboard") return sendJson(res, 200, { season, leaderboard: leaderboard() });
    if (req.method === "GET" && path.startsWith("/api/proof/")) {
      const result = proof(decodeURIComponent(path.replace("/api/proof/", "")));
      return result ? sendJson(res, 200, result) : sendJson(res, 404, { error: "Decision not found" });
    }
    if (req.method === "POST" && path === "/api/agents/run") {
      const body = await readBody(req);
      const agent = agents.find((item) => item.id === String(body.agentId ?? ""));
      if (!agent) return sendJson(res, 404, { error: "Agent not found" });
      const snapshot = getSnapshot(String(body.market ?? agent.supportedMarkets[0]));
      const decision = runAgent(agent, snapshot);
      const outcome = calculateOutcome(decision, snapshot.price);
      decisions.push(decision);
      outcomes.push(outcome);
      return sendJson(res, 201, { decision, outcome, leaderboard: leaderboard() });
    }
    if (req.method === "GET" && path === "/.well-known/credora-agent.json") {
      return sendJson(res, 200, {
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
    return sendJson(res, 404, { error: "Route not found" });
  } catch (error) {
    return sendJson(res, 500, { error: error instanceof Error ? error.message : "Unknown error" });
  }
});

server.listen(port, () => console.log(`Credora backend listening on http://localhost:${port}`));

