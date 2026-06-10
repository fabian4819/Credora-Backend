import { createServer } from "node:http";
import { loadLocalEnv } from "./runtime/env.mjs";
import { startIndexer } from "./runtime/indexer.mjs";
import { startOracle, fetchSnapshots, getLiveSnapshots } from "./runtime/oracle.mjs";
import { startBridge } from "./runtime/bridge.mjs";
import handler from "./api/[...route].js";

loadLocalEnv();

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? "127.0.0.1";

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "Content-Type"
};

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  if (!chunks.length) return undefined;
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : undefined;
}

const context = {};

const _sseClients = new Set();

export function broadcastLeaderboard(leaderboard) {
  const data = `data: ${JSON.stringify({ leaderboard, timestamp: Date.now() })}\n\n`;
  for (const res of _sseClients) {
    try { res.write(data); } catch { _sseClients.delete(res); }
  }
}

const server = createServer(async (nodeReq, nodeRes) => {
  if (nodeReq.method === "OPTIONS") {
    nodeRes.writeHead(204, CORS_HEADERS);
    nodeRes.end();
    return;
  }

  if (!nodeReq.url) {
    nodeRes.writeHead(400, { ...CORS_HEADERS, "content-type": "application/json" });
    nodeRes.end(JSON.stringify({ error: "Missing URL" }));
    return;
  }

  const url = new URL(nodeReq.url, `http://${nodeReq.headers.host ?? `${host}:${port}`}`);
  const pathname = url.pathname;

  if (pathname === "/api/stream/leaderboard") {
    nodeRes.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      "connection": "keep-alive",
      "access-control-allow-origin": "*"
    });
    nodeRes.write(": connected\n\n");
    _sseClients.add(nodeRes);
    nodeReq.on("close", () => _sseClients.delete(nodeRes));
    return;
  }

  const routePath =
    pathname === "/.well-known/credora-agent.json"
      ? "/discovery"
      : pathname.startsWith("/api/")
        ? pathname.slice("/api".length)
        : pathname;

  const req = {
    method: nodeReq.method,
    url: nodeReq.url,
    query: { route: routePath.split("/").filter(Boolean) },
    body: await readJsonBody(nodeReq)
  };

  const res = {
    statusCode: 200,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      nodeRes.writeHead(this.statusCode, {
        ...CORS_HEADERS,
        "content-type": "application/json"
      });
      nodeRes.end(JSON.stringify(body, null, 2));
    }
  };

  req.ctx = context;
  await handler(req, res);
});

server.listen(port, host, () => {
  console.log(`Credora backend listening on http://${host}:${port}`);
  console.log(`  http://${host}:${port}/api/health`);

  import("./runtime/credora.mjs").then((credora) => {
    context.season = credora.season;
    context.agents = credora.agents;
    context.decisions = credora.decisions;
    context.outcomes = credora.outcomes;
    context.strategyAccounts = credora.strategyAccounts;
    context.snapshots = credora.snapshots;
    context.seed = credora.seed;
    context.leaderboard = credora.leaderboard;
    context.normalizeTrackRecord = credora.normalizeTrackRecord;
    context.upsertStrategyAccount = credora.upsertStrategyAccount;
    context.setLiveSnapshots = credora.setLiveSnapshots;
    context.getLiveSnapshot = credora.getLiveSnapshot;
    context.hasLivePrices = credora.hasLivePrices;
    context.broadcastLeaderboard = broadcastLeaderboard;

    startOracle({
      intervalMs: 60000
    });

    startIndexer({
      season: credora.season,
      agents: credora.agents,
      decisions: credora.decisions,
      outcomes: credora.outcomes,
      intervalMs: 15000
    });

    startBridge({
      normalizeTrackRecord: credora.normalizeTrackRecord,
      upsertStrategyAccount: credora.upsertStrategyAccount,
      leaderboardFn: credora.leaderboard,
      intervalMs: 300000
    });

    setInterval(() => {
      const live = getLiveSnapshots(credora.snapshots);
      credora.setLiveSnapshots(live);
      try {
        const lb = credora.leaderboard();
        if (_sseClients.size > 0) broadcastLeaderboard(lb);
      } catch {}
    }, 5000);
  });
});
