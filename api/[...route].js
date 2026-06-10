import { loadLocalEnv } from "../runtime/env.mjs";
import { agents, decisions, leaderboard, outcomes, season, seed } from "../runtime/credora.mjs";

loadLocalEnv();

let _seeded = false;
function ensureSeeded() {
  if (_seeded) return;
  seed();
  _seeded = true;
}

function send(res, status, body) {
  res.status(status).json(body);
}

export default async function handler(req, res) {
  ensureSeeded();
  const route = Array.isArray(req.query.route) ? req.query.route : [];
  const path = `/${route.join("/")}`;

  try {
    if (req.method === "GET" && path === "/health") {
      return send(res, 200, { ok: true, service: "credora-backend", season: season.id, version: "v3-lite" });
    }

    if (req.method === "GET" && path === "/status") {
      return send(res, 200, {
        ok: true, season: season.id, livePrices: false, chainIndexer: false, bridgeActive: false,
        chainId: 5003, mantleExplorer: "https://explorer.sepolia.mantle.xyz",
        contracts: {
          agentPassport: "0x40A9cB62D2a02189be10eC4657ae02B2c235174e",
          decisionLogger: "0x2dFf6D5eB709b368df0c11bd80209eB92591658c",
          outcomeRegistry: "0x67479A2F63ecAc78fb52D696df7D7455e2347983",
          reputationEngine: "0xc84D1e8FECaDa44487242E5D855AEE7F752A12EA"
        }
      });
    }

    if (req.method === "GET" && path === "/agents") {
      return send(res, 200, { agents });
    }

    if (req.method === "GET" && path === "/leaderboard") {
      return send(res, 200, { season, leaderboard: leaderboard() });
    }

    if (req.method === "GET" && path === "/decisions") {
      return send(res, 200, { decisions });
    }

    if (req.method === "GET" && path === "/outcomes") {
      return send(res, 200, { outcomes });
    }

    return send(res, 404, { error: "Route not found" });
  } catch (error) {
    return send(res, 500, { error: error.message, stack: error.stack?.split("\n")?.slice(0, 3) });
  }
}
