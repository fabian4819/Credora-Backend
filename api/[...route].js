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
import { getDb, seedMongoIfEmpty } from "../runtime/db.mjs";
import { loadLocalEnv } from "../runtime/env.mjs";

loadLocalEnv();
seed();

function send(res, status, body) {
  res.status(status).json(body);
}

async function getReadyDb() {
  const db = await getDb();
  if (!db) return undefined;
  await seedMongoIfEmpty({ agents, season, decisions, outcomes, leaderboard: leaderboard() });
  return db;
}

export default async function handler(req, res) {
  const route = Array.isArray(req.query.route) ? req.query.route : [];
  const path = `/${route.join("/")}`;

  try {
    const db = await getReadyDb();

    if (req.method === "GET" && path === "/health") {
      return send(res, 200, {
        ok: true,
        service: "credora-backend",
        season: season.id,
        database: db ? "mongodb" : "memory"
      });
    }

    if (req.method === "GET" && path === "/season/current") {
      const currentSeason = db ? await db.collection("seasons").findOne({ id: season.id }, { projection: { _id: 0 } }) : season;
      return send(res, 200, currentSeason ?? season);
    }

    if (req.method === "GET" && path === "/agents") {
      const rows = db ? await db.collection("agents").find({}, { projection: { _id: 0 } }).toArray() : agents;
      return send(res, 200, { agents: rows });
    }

    if (req.method === "GET" && path === "/decisions") {
      const rows = db
        ? await db.collection("decisions").find({}, { projection: { _id: 0 } }).sort({ createdAt: 1 }).toArray()
        : decisions;
      return send(res, 200, { decisions: rows });
    }

    if (req.method === "GET" && path === "/outcomes") {
      const rows = db
        ? await db.collection("outcomes").find({}, { projection: { _id: 0 } }).sort({ createdAt: 1 }).toArray()
        : outcomes;
      return send(res, 200, { outcomes: rows });
    }

    if (req.method === "GET" && path === "/leaderboard") {
      if (db) {
        const snapshot = await db
          .collection("leaderboard_snapshots")
          .find({ seasonId: season.id }, { projection: { _id: 0 } })
          .sort({ computedAt: -1 })
          .limit(1)
          .next();
        return send(res, 200, { season, leaderboard: snapshot?.leaderboard ?? leaderboard() });
      }
      return send(res, 200, { season, leaderboard: leaderboard() });
    }

    if (req.method === "GET" && path.startsWith("/proof/")) {
      const decisionId = decodeURIComponent(path.replace("/proof/", ""));
      let result = proof(decisionId);

      if (db) {
        const [decision, outcome] = await Promise.all([
          db.collection("decisions").findOne({ id: decisionId }, { projection: { _id: 0 } }),
          db.collection("outcomes").findOne({ decisionId }, { projection: { _id: 0 } })
        ]);

        if (decision) {
          const agent = await db.collection("agents").findOne({ id: decision.agentId }, { projection: { _id: 0 } });
          result = {
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
      }

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
      const nextLeaderboard = leaderboard();

      if (db) {
        await db.collection("decisions").insertOne({ ...decision, createdAt: new Date() });
        await db.collection("outcomes").insertOne({ ...outcome, createdAt: new Date() });
        await db.collection("leaderboard_snapshots").insertOne({
          seasonId: season.id,
          leaderboard: nextLeaderboard,
          computedAt: new Date()
        });
      }

      return send(res, 201, { decision, outcome, leaderboard: nextLeaderboard });
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
