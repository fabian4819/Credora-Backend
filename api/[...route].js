import {
  agents,
  calculateOutcome,
  dataSources,
  decisions,
  getLiveSnapshot,
  getSnapshot,
  hasLivePrices,
  leaderboard,
  normalizeTrackRecord,
  outcomes,
  proof,
  runAgent,
  season,
  seed,
  strategyAccountProof,
  strategyAccounts,
  upsertStrategyAccount
} from "../runtime/credora.mjs";
import {
  ensureAgentRegistered,
  submitDecisionOnChain,
  submitOutcomeOnChain,
  submitSeasonScoreOnChain
} from "../runtime/contracts.mjs";
import { getDb, seedMongoIfEmpty } from "../runtime/db.mjs";
import { loadLocalEnv } from "../runtime/env.mjs";

loadLocalEnv();

const _seeded = { done: false };
function ensureSeeded() {
  if (_seeded.done) return;
  seed();
  _seeded.done = true;
}

function setCors(res) {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
  res.setHeader("access-control-allow-headers", "Content-Type");
}

function send(res, status, body) {
  setCors(res);
  res.status(status).json(body);
}

function sendSse(res, body) {
  setCors(res);
  res.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive"
  });
  res.write(": connected\n\n");
  res.write(`data: ${JSON.stringify(body)}\n\n`);
}

async function getReadyDb() {
  try {
    const db = await getDb();
    if (!db) return undefined;
    await seedMongoIfEmpty({ agents, season, decisions, outcomes, leaderboard: leaderboard(), strategyAccounts });
    return db;
  } catch (_) {
    return undefined;
  }
}

function normalizeRouteParam(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") return value.split("/").filter(Boolean);
  return [];
}

function getRequestPath(req) {
  const route = normalizeRouteParam(req.query?.route);
  if (route.length) return `/${route.join("/")}`;

  const url = new URL(req.url ?? "/", "https://credora.local");
  if (url.pathname === "/.well-known/credora-agent.json") return "/discovery";
  if (url.pathname.startsWith("/api/")) return url.pathname.slice("/api".length);
  return url.pathname;
}

export default async function handler(req, res) {
  ensureSeeded();
  const path = getRequestPath(req);

  try {
    if (req.method === "OPTIONS") {
      setCors(res);
      return res.status(204).end();
    }

    const db = await getReadyDb();

    if (req.method === "GET" && path === "/health") {
      return send(res, 200, {
        ok: true,
        service: "credora-backend",
        season: season.id,
        database: db ? "mongodb" : "memory"
      });
    }

    if (req.method === "GET" && path === "/status") {
      return send(res, 200, {
        ok: true,
        service: "credora-backend",
        season: season.id,
        database: db ? "mongodb" : "memory",
        livePrices: hasLivePrices(),
        chainIndexer: Boolean(process.env.MANTLE_RPC_URL),
        bridgeActive: true,
        bridgeDataMode: Boolean(process.env.BYBIT_API_KEY) ? "configured" : "not_configured",
        onChainWrites: Boolean(process.env.PRIVATE_KEY && process.env.MANTLE_RPC_URL),
        chainId: 5003,
        mantleExplorer: "https://explorer.sepolia.mantle.xyz",
        contracts: {
          agentPassport: "0x40A9cB62D2a02189be10eC4657ae02B2c235174e",
          decisionLogger: "0x2dFf6D5eB709b368df0c11bd80209eB92591658c",
          outcomeRegistry: "0x67479A2F63ecAc78fb52D696df7D7455e2347983",
          reputationEngine: "0xc84D1e8FECaDa44487242E5D855AEE7F752A12EA"
        }
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
        const importedAccounts = await db.collection("strategy_accounts").find({}, { projection: { _id: 0 } }).toArray();
        const importedScores = importedAccounts.map((record) => ({
          agentId: record.id,
          agentName: record.displayName,
          entryType: record.accountType,
          source: record.sourcePlatform,
          verificationLevel: record.verificationLevel,
          period: record.period,
          markets: record.markets,
          decisions: record.metrics?.tradeCount ?? 0,
          accuracy: record.metrics?.winRatePct ?? 0,
          winRate: record.metrics?.winRatePct ?? 0,
          roiPct: record.metrics?.roiPct ?? 0,
          consistency: record.metrics?.consistencyPct ?? 0,
          avgRisk: record.metrics?.maxDrawdownPct ?? 0,
          credoraScore: record.credoraScore ?? 0,
          dataHash: record.dataHash,
          sourceProofUrl: record.sourceProofUrl
        }));
        const snapshot = await db
          .collection("leaderboard_snapshots")
          .find({ seasonId: season.id }, { projection: { _id: 0 } })
          .sort({ computedAt: -1 })
          .limit(1)
          .next();
        const demoRows = (snapshot?.leaderboard ?? leaderboard())
          .filter((row) => row.entryType !== "observed_strategy_account" && row.entryType !== "verified_agent")
          .map((row) => ({
            entryType: "demo_agent",
            source: "demo",
            verificationLevel: "demo_generated",
            ...row
          }));
        const rows = [...demoRows, ...importedScores]
          .sort((a, b) => b.credoraScore - a.credoraScore)
          .map((row, index) => ({ ...row, rank: index + 1 }));
        return send(res, 200, { season, leaderboard: rows });
      }
      return send(res, 200, { season, leaderboard: leaderboard() });
    }

    if (req.method === "GET" && path === "/sources") {
      return send(res, 200, { sources: dataSources });
    }

    if (req.method === "GET" && path === "/stream/leaderboard") {
      const rows = db
        ? await db
            .collection("leaderboard_snapshots")
            .find({ seasonId: season.id }, { projection: { _id: 0 } })
            .sort({ computedAt: -1 })
            .limit(1)
            .next()
        : undefined;
      const currentLeaderboard = rows?.leaderboard ?? leaderboard();

      sendSse(res, { season, leaderboard: currentLeaderboard, timestamp: Date.now() });

      const heartbeat = setInterval(() => {
        res.write(`data: ${JSON.stringify({ season, leaderboard: currentLeaderboard, timestamp: Date.now() })}\n\n`);
      }, 5000);

      req.on?.("close", () => clearInterval(heartbeat));
      setTimeout(() => {
        clearInterval(heartbeat);
        res.end();
      }, 25000);
      return;
    }

    if (req.method === "GET" && path === "/strategy-accounts") {
      const rows = db
        ? await db.collection("strategy_accounts").find({}, { projection: { _id: 0 } }).sort({ credoraScore: -1 }).toArray()
        : strategyAccounts;
      return send(res, 200, { strategyAccounts: rows });
    }

    if (req.method === "GET" && path.startsWith("/strategy-accounts/") && path.endsWith("/proof")) {
      const id = decodeURIComponent(path.replace("/strategy-accounts/", "").replace("/proof", ""));
      let result = strategyAccountProof(id);

      if (db) {
        const account = await db.collection("strategy_accounts").findOne({ id }, { projection: { _id: 0 } });
        if (account) {
          result = {
            account,
            proof: {
              dataHash: account.dataHash,
              sourceProofUrl: account.sourceProofUrl,
              txHashes: account.txHashes ?? [],
              proofStatus: account.proofStatus,
              explorerUrls: (account.txHashes ?? []).map((txHash) => `https://explorer.sepolia.mantle.xyz/tx/${txHash}`)
            }
          };
        }
      }

      return result ? send(res, 200, result) : send(res, 404, { error: "Strategy account not found" });
    }

    if (req.method === "POST" && path === "/strategy-accounts/import") {
      const body = typeof req.body === "object" && req.body !== null ? req.body : {};
      const account = normalizeTrackRecord(body);
      upsertStrategyAccount(account);
      const nextLeaderboard = leaderboard();

      if (db) {
        await db.collection("strategy_accounts").updateOne(
          { id: account.id },
          { $set: { ...account, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
          { upsert: true }
        );
        await db.collection("leaderboard_snapshots").insertOne({
          seasonId: season.id,
          leaderboard: nextLeaderboard,
          computedAt: new Date()
        });
      }

      return send(res, 201, {
        strategyAccount: account,
        proof: {
          dataHash: account.dataHash,
          proofStatus: account.proofStatus,
          sourceProofUrl: account.sourceProofUrl
        }
      });
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
          const hasRealTx = decision.onChainTxHash || outcome?.onChainTxHash;
          result = {
            agent,
            decision,
            outcome,
            proof: {
              dataHash: decision.dataHash,
              rationaleHash: decision.rationaleHash,
              metricsHash: outcome?.metricsHash,
              decisionTxHash: decision.onChainTxHash ?? undefined,
              outcomeTxHash: outcome?.onChainTxHash ?? undefined,
              txHash: hasRealTx
                ? (outcome?.onChainTxHash || decision.onChainTxHash)
                : "0xDemoTxHashReplaceAfterMantleDeploy",
              explorerUrl: hasRealTx
                ? `https://explorer.sepolia.mantle.xyz/tx/${outcome?.onChainTxHash || decision.onChainTxHash}`
                : "https://explorer.sepolia.mantle.xyz/"
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

      const snapshot = getLiveSnapshot(String(body.market ?? agent.supportedMarkets[0]));
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

      const timeoutMs = (process.env.VERCEL ? 18000 : 60000);

      const onChainResult = await Promise.race([
        (async () => {
          const decisionReceipt = await submitDecisionOnChain(decision, agent);
          if (decisionReceipt) {
            decision.onChainTxHash = decisionReceipt.txHash;
            decision.onChainExplorerUrl = decisionReceipt.explorerUrl;
            decision.onChainDecisionId = decisionReceipt.onChainDecisionId;
            const outcomeReceipt = await submitOutcomeOnChain(
              decisionReceipt.onChainDecisionId,
              agent.id,
              outcome
            );
            if (outcomeReceipt) {
              outcome.onChainTxHash = outcomeReceipt.txHash;
              outcome.onChainExplorerUrl = outcomeReceipt.explorerUrl;
            }
            const agentScore = nextLeaderboard.find((r) => r.agentId === agent.id);
            if (agentScore) {
              await submitSeasonScoreOnChain(agent.id, agent.name, agentScore);
            }
            if (db) {
              await db.collection("decisions").updateOne(
                { id: decision.id },
                { $set: { onChainTxHash: decision.onChainTxHash, onChainExplorerUrl: decision.onChainExplorerUrl, onChainDecisionId: decision.onChainDecisionId } }
              );
              if (outcome.onChainTxHash) {
                await db.collection("outcomes").updateOne(
                  { decisionId: outcome.decisionId },
                  { $set: { onChainTxHash: outcome.onChainTxHash, onChainExplorerUrl: outcome.onChainExplorerUrl } }
                );
              }
            }
          }
        })(),
        new Promise((r) => setTimeout(r, timeoutMs))
      ]);

      return send(res, 201, { decision, outcome, leaderboard: nextLeaderboard, onChainTimedOut: !onChainResult });
    }

    if (req.method === "GET" && path === "/discovery") {
      return send(res, 200, {
        schema: "credora.discovery.v1",
        name: "Credora",
        description: "Competitive reputation arena for AI trading agents.",
        services: [
          { type: "leaderboard", endpoint: "/api/leaderboard" },
          { type: "proof", endpoint: "/api/proof/{decisionId}" },
          { type: "strategy-account-import", endpoint: "/api/strategy-accounts/import" },
          { type: "run-demo-agent", endpoint: "/api/agents/run" }
        ]
      });
    }

    return send(res, 404, { error: "Route not found", path });
  } catch (error) {
    return send(res, 500, { error: error instanceof Error ? error.message : "Unknown error" });
  }
}
