let _viem = null;
let _db = null;

async function getDb() {
  if (_db) return _db;
  try {
    const mod = await import("./db.mjs");
    _db = await mod.getDb();
    return _db;
  } catch {
    return null;
  }
}

async function getViem() {
  if (!_viem) _viem = await import("viem");
  return _viem;
}

let _parsed = null;
async function getEvents() {
  if (!_parsed) {
    const v = await getViem();
    _parsed = {
      decision: v.parseAbiItem("event DecisionSubmitted(uint256 indexed decisionId, uint256 indexed agentId, uint256 indexed seasonId, bytes32 marketHash, uint8 action, uint16 confidence, uint16 riskScore, uint64 targetWindowSeconds, bytes32 dataHash, bytes32 rationaleHash, string evidenceURI)"),
      outcome: v.parseAbiItem("event OutcomeSubmitted(uint256 indexed outcomeId, uint256 indexed decisionId, uint256 indexed agentId, uint256 seasonId, uint8 status, int256 roiBps, uint16 confidenceCalibration, bytes32 metricsHash, string evidenceURI)"),
      agent: v.parseAbiItem("event AgentRegistered(uint256 indexed agentId, address indexed owner, address indexed operator, string name, string strategyType, string metadataURI, bytes32 strategyHash)")
    };
  }
  return _parsed;
}

const DEPLOYED = {
  agentPassport: "0x40A9cB62D2a02189be10eC4657ae02B2c235174e",
  decisionLogger: "0x2dFf6D5eB709b368df0c11bd80209eB92591658c",
  outcomeRegistry: "0x67479A2F63ecAc78fb52D696df7D7455e2347983",
  chainId: 5003,
  rpcUrl: "https://rpc.sepolia.mantle.xyz",
  explorerUrl: "https://explorer.sepolia.mantle.xyz"
};

const CHAIN = {
  id: 5003, name: "Mantle Sepolia",
  rpcUrls: { default: { http: ["https://rpc.sepolia.mantle.xyz"] } },
  nativeCurrency: { name: "MNT", symbol: "MNT", decimals: 18 }
};

const ACTION_MAP = ["LONG", "SHORT", "HOLD", "ALERT"];
const OUTCOME_MAP = ["pending", "success", "failed", "neutral", "inconclusive"];

let _client = null;
let _seenDecisionIds = new Set();
let _seenOutcomeIds = new Set();
let _seenAgentIds = new Set();
let _lastBlock = 0n;

async function getClient() {
  if (!_client) {
    const v = await getViem();
    _client = v.createPublicClient({
      chain: CHAIN,
      transport: v.http(process.env.MANTLE_RPC_URL ?? DEPLOYED.rpcUrl)
    });
  }
  return _client;
}

async function getLatestBlock() {
  try {
    return await (await getClient()).getBlockNumber();
  } catch (_) {
    return _lastBlock;
  }
}

async function fetchLogs(fromBlock, toBlock, address, event) {
  try {
    return await (await getClient()).getLogs({ address, event, fromBlock, toBlock });
  } catch (err) {
    console.warn(`indexer: fetchLogs failed (${fromBlock}-${toBlock}):`, err.message);
    return [];
  }
}

async function processAgentRegistered(logs, agents) {
  for (const log of logs) {
    const { agentId, name, strategyType } = log.args;
    const id = String(agentId);
    if (_seenAgentIds.has(id)) continue;
    _seenAgentIds.add(id);
    if (!agents.find((a) => a.id === id)) {
      const record = { id, name, source: "onchain", strategyType, tradingPlatform: "DEX", riskProfile: "medium", supportedMarkets: [], onChainAgentId: Number(agentId), indexedAt: new Date().toISOString() };
      agents.push(record);
      const db = await getDb();
      if (db) {
        await db.collection("agents").updateOne({ id }, { $setOnInsert: { ...record, createdAt: new Date() } }, { upsert: true }).catch(() => {});
      }
      console.log(`indexer: new on-chain agent #${agentId} "${name}"`);
    }
  }
}

async function processDecisionSubmitted(logs, decisions, agents) {
  const now = new Date().toISOString();
  for (const log of logs) {
    const { decisionId, agentId, action, confidence, riskScore, targetWindowSeconds, dataHash, rationaleHash, evidenceURI } = log.args;
    const dId = String(decisionId);
    if (_seenDecisionIds.has(dId)) continue;
    _seenDecisionIds.add(dId);
    const backendId = `${agentId}-onchain-${decisionId}`;
    if (!decisions.find((d) => d.id === backendId)) {
      const record = {
        id: backendId, agentId: String(agentId), seasonId: "season-1",
        market: "onchain", action: ACTION_MAP[action] ?? "HOLD",
        entryPrice: 0, targetWindowHours: Math.round(Number(targetWindowSeconds) / 3600),
        confidence: Number(confidence), riskScore: Number(riskScore),
        rationale: "Indexed from on-chain event",
        dataHash, rationaleHash, evidenceUri: evidenceURI, submittedAt: now,
        onChainTxHash: log.transactionHash,
        onChainExplorerUrl: `${DEPLOYED.explorerUrl}/tx/${log.transactionHash}`,
        onChainDecisionId: Number(decisionId), indexedFromChain: true, createdAt: now
      };
      decisions.push(record);
      const db = await getDb();
      if (db) {
        await db.collection("decisions").updateOne({ id: backendId }, { $setOnInsert: { ...record, createdAt: new Date() } }, { upsert: true }).catch(() => {});
      }
      console.log(`indexer: new on-chain decision #${decisionId} (agent #${agentId})`);
    }
  }
}

async function processOutcomeSubmitted(logs, outcomes) {
  const now = new Date().toISOString();
  for (const log of logs) {
    const { outcomeId, decisionId, agentId, status, roiBps, confidenceCalibration, metricsHash, evidenceURI } = log.args;
    const oId = String(outcomeId);
    if (_seenOutcomeIds.has(oId)) continue;
    _seenOutcomeIds.add(oId);
    const backendDecisionId = `${agentId}-onchain-${decisionId}`;
    if (!outcomes.find((o) => o.decisionId === backendDecisionId)) {
      const record = {
        decisionId: backendDecisionId, agentId: String(agentId), seasonId: "season-1",
        status: OUTCOME_MAP[status] ?? "neutral",
        priceBefore: 0, priceAfter: 0, roiBps: Number(roiBps),
        confidenceCalibration: Number(confidenceCalibration),
        metricsHash, evidenceUri: evidenceURI,
        onChainTxHash: log.transactionHash,
        onChainExplorerUrl: `${DEPLOYED.explorerUrl}/tx/${log.transactionHash}`,
        indexedFromChain: true, createdAt: now
      };
      outcomes.push(record);
      const db = await getDb();
      if (db) {
        await db.collection("outcomes").updateOne({ decisionId: backendDecisionId }, { $setOnInsert: { ...record, createdAt: new Date() } }, { upsert: true }).catch(() => {});
      }
      console.log(`indexer: new on-chain outcome #${outcomeId} for decision #${decisionId}`);
    }
  }
}

export function hasEnv() {
  return Boolean(process.env.MANTLE_RPC_URL);
}

export async function indexOnce(season, agents, decisions, outcomes) {
  if (!hasEnv()) return { indexed: false, reason: "no RPC" };
  try {
    const events = await getEvents();
    const latest = await getLatestBlock();
    if (_lastBlock === 0n) { _lastBlock = latest - 100000n; if (_lastBlock < 0n) _lastBlock = 0n; }
    if (_lastBlock >= latest) return { indexed: false, reason: "no new blocks" };

    const fromBlock = _lastBlock + 1n;
    const toBlock = latest;

    const [agentLogs, decisionLogs, outcomeLogs] = await Promise.all([
      fetchLogs(fromBlock, toBlock, DEPLOYED.agentPassport, events.agent),
      fetchLogs(fromBlock, toBlock, DEPLOYED.decisionLogger, events.decision),
      fetchLogs(fromBlock, toBlock, DEPLOYED.outcomeRegistry, events.outcome)
    ]);

    await processAgentRegistered(agentLogs, agents);
    await processDecisionSubmitted(decisionLogs, decisions, agents);
    await processOutcomeSubmitted(outcomeLogs, outcomes);

    const total = agentLogs.length + decisionLogs.length + outcomeLogs.length;
    if (total > 0) {
      console.log(`indexer: processed ${total} events up to block ${latest}`);
      const db = await getDb();
      if (db) {
        try {
          const leaderboardFn = (await import("./credora.mjs")).leaderboard;
          const lb = leaderboardFn();
          await db.collection("leaderboard_snapshots").insertOne({
            seasonId: "season-1", leaderboard: lb, computedAt: new Date()
          }).catch(() => {});
        } catch (_) {}
      }
    }
    _lastBlock = latest;
    return { indexed: true, events: total, block: Number(latest) };
  } catch (err) {
    console.warn("indexer: error:", err.message);
    return { indexed: false, reason: err.message };
  }
}

export function startIndexer({ season, agents, decisions, outcomes, intervalMs = 15000 }) {
  if (!hasEnv()) { console.log("indexer: RPC not configured, skipping"); return () => {}; }
  console.log("indexer: started, polling every", intervalMs / 1000, "s");
  const timer = setInterval(() => indexOnce(season, agents, decisions, outcomes).catch(() => {}), intervalMs);
  indexOnce(season, agents, decisions, outcomes).catch(() => {});
  return () => clearInterval(timer);
}
