import { createServer } from "node:http";
import { URL } from "node:url";
import { demoAgents, runDemoAgent } from "./agents/demo-agents.js";
import { getSnapshot } from "./data/demo-market.js";
import { calculateOutcome } from "./scoring/outcome.js";
import { decisions, getLeaderboard, getProof, outcomes, season, seedDemoState } from "./state/demo-state.js";

const port = Number(process.env.PORT ?? 8787);

function sendJson(res: Parameters<Parameters<typeof createServer>[0]>[1], status: number, body: unknown): void {
  res.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type"
  });
  res.end(JSON.stringify(body, null, 2));
}

async function readBody(req: Parameters<Parameters<typeof createServer>[0]>[0]): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) {
    return {};
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
}

seedDemoState();

const server = createServer(async (req, res) => {
  if (!req.url) {
    sendJson(res, 400, { error: "Missing URL" });
    return;
  }

  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);
  const path = url.pathname;

  try {
    if (req.method === "GET" && path === "/api/health") {
      sendJson(res, 200, { ok: true, service: "credora-backend", season: season.id });
      return;
    }

    if (req.method === "GET" && path === "/api/season/current") {
      sendJson(res, 200, season);
      return;
    }

    if (req.method === "GET" && path === "/api/agents") {
      sendJson(res, 200, { agents: demoAgents });
      return;
    }

    if (req.method === "GET" && path === "/api/decisions") {
      sendJson(res, 200, { decisions });
      return;
    }

    if (req.method === "GET" && path === "/api/outcomes") {
      sendJson(res, 200, { outcomes });
      return;
    }

    if (req.method === "GET" && path === "/api/leaderboard") {
      sendJson(res, 200, { season, leaderboard: getLeaderboard() });
      return;
    }

    if (req.method === "GET" && path.startsWith("/api/proof/")) {
      const decisionId = decodeURIComponent(path.replace("/api/proof/", ""));
      const proof = getProof(decisionId);
      if (!proof) {
        sendJson(res, 404, { error: "Decision not found" });
        return;
      }
      sendJson(res, 200, proof);
      return;
    }

    if (req.method === "POST" && path === "/api/agents/run") {
      const body = await readBody(req);
      const agentId = String(body.agentId ?? "");
      const market = String(body.market ?? "");
      const agent = demoAgents.find((item) => item.id === agentId);
      if (!agent) {
        sendJson(res, 404, { error: "Agent not found" });
        return;
      }
      const snapshot = getSnapshot(market || agent.supportedMarkets[0]);
      const decision = runDemoAgent(agent, season.id, snapshot);
      const outcome = calculateOutcome(decision, snapshot.price);
      decisions.push(decision);
      outcomes.push(outcome);
      sendJson(res, 201, { decision, outcome, leaderboard: getLeaderboard() });
      return;
    }

    if (req.method === "GET" && path === "/.well-known/credora-agent.json") {
      sendJson(res, 200, {
        schema: "credora.discovery.v1",
        name: "Credora",
        description: "Competitive reputation arena for AI trading agents.",
        services: [
          { type: "leaderboard", endpoint: "/api/leaderboard" },
          { type: "proof", endpoint: "/api/proof/{decisionId}" },
          { type: "run-demo-agent", endpoint: "/api/agents/run" }
        ]
      });
      return;
    }

    sendJson(res, 404, { error: "Route not found" });
  } catch (error) {
    sendJson(res, 500, { error: error instanceof Error ? error.message : "Unknown error" });
  }
});

server.listen(port, () => {
  console.log(`Credora backend listening on http://localhost:${port}`);
});

