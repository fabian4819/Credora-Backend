import { createPublicClient, http, parseAbiItem } from "viem";

const DEPLOYED = {
  agentPassport: "0x40A9cB62D2a02189be10eC4657ae02B2c235174e",
  decisionLogger: "0x2dFf6D5eB709b368df0c11bd80209eB92591658c",
  outcomeRegistry: "0x67479A2F63ecAc78fb52D696df7D7455e2347983",
  chainId: 5003,
  rpcUrl: "https://rpc.sepolia.mantle.xyz",
  explorerUrl: "https://explorer.sepolia.mantle.xyz"
};

const CHAIN = {
  id: DEPLOYED.chainId,
  name: "Mantle Sepolia",
  rpcUrls: { default: { http: [process.env.MANTLE_RPC_URL ?? DEPLOYED.rpcUrl] } },
  nativeCurrency: { name: "MNT", symbol: "MNT", decimals: 18 }
};

const DECISION_SUBMITTED = parseAbiItem(
  "event DecisionSubmitted(uint256 indexed decisionId, uint256 indexed agentId, uint256 indexed seasonId, bytes32 marketHash, uint8 action, uint16 confidence, uint16 riskScore, uint64 targetWindowSeconds, bytes32 dataHash, bytes32 rationaleHash, string evidenceURI)"
);

const OUTCOME_SUBMITTED = parseAbiItem(
  "event OutcomeSubmitted(uint256 indexed outcomeId, uint256 indexed decisionId, uint256 indexed agentId, uint256 seasonId, uint8 status, int256 roiBps, uint16 confidenceCalibration, bytes32 metricsHash, string evidenceURI)"
);

const AGENT_REGISTERED = parseAbiItem(
  "event AgentRegistered(uint256 indexed agentId, address indexed owner, address indexed operator, string name, string strategyType, string metadataURI, bytes32 strategyHash)"
);

const ACTION_MAP = ["LONG", "SHORT", "HOLD", "ALERT"];
const OUTCOME_MAP = ["pending", "success", "failed", "neutral", "inconclusive"];

let _client = null;
let _seenDecisionIds = new Set();
let _seenOutcomeIds = new Set();
let _seenAgentIds = new Set();
let _lastBlock = 0n;

function getClient() {
  if (!_client) {
    _client = createPublicClient({ chain: CHAIN, transport: http(process.env.MANTLE_RPC_URL ?? DEPLOYED.rpcUrl) });
  }
  return _client;
}

async function getLatestBlock() {
  const client = getClient();
  try {
    return await client.getBlockNumber();
  } catch {
    return _lastBlock;
  }
}

async function fetchLogs(fromBlock, toBlock, address, event) {
  const client = getClient();
  try {
    return await client.getLogs({ address, event, fromBlock, toBlock });
  } catch (err) {
    console.warn(`indexer: log fetch failed (${fromBlock}-${toBlock}):`, err.message);
    return [];
  }
}

async function processAgentRegistered(logs, season, agents) {
  for (const log of logs) {
    const { agentId, name, strategyType } = log.args;
    const id = String(agentId);
    if (_seenAgentIds.has(id)) continue;
    _seenAgentIds.add(id);

    const existing = agents.find((a) => a.id === id);
    if (!existing) {
      agents.push({
        id,
        name,
        source: "onchain",
        strategyType,
        tradingPlatform: "DEX",
        riskProfile: "medium",
        supportedMarkets: [],
        onChainAgentId: Number(agentId),
        indexedAt: new Date().toISOString()
      });
      console.log(`indexer: new on-chain agent #${agentId} "${name}"`);
    }
  }
}

async function processDecisionSubmitted(logs, decisions, agents) {
  const now = new Date().toISOString();
  for (const log of logs) {
    const { decisionId, agentId, seasonId, action, confidence, riskScore, targetWindowSeconds, dataHash, rationaleHash, evidenceURI } = log.args;
    const dId = String(decisionId);
    if (_seenDecisionIds.has(dId)) continue;
    _seenDecisionIds.add(dId);

    const backendId = `${agentId}-onchain-${decisionId}`;
    const existing = decisions.find((d) => d.id === backendId);
    if (!existing) {
      const agent = agents.find((a) => a.id === String(agentId)) || agents.find((a) => a.onChainAgentId === Number(agentId));
      decisions.push({
        id: backendId,
        agentId: String(agentId),
        seasonId: `season-${seasonId}`,
        market: "onchain",
        action: ACTION_MAP[action] ?? "HOLD",
        entryPrice: 0,
        targetWindowHours: Math.round(Number(targetWindowSeconds) / 3600),
        confidence: Number(confidence),
        riskScore: Number(riskScore),
        rationale: "Indexed from on-chain DecisionSubmitted event",
        dataHash: dataHash,
        rationaleHash: rationaleHash,
        evidenceUri: evidenceURI,
        submittedAt: now,
        onChainTxHash: log.transactionHash,
        onChainExplorerUrl: `${DEPLOYED.explorerUrl}/tx/${log.transactionHash}`,
        onChainDecisionId: Number(decisionId),
        indexedFromChain: true,
        createdAt: now
      });
      console.log(`indexer: new on-chain decision #${decisionId} (agent #${agentId})`);
    }
  }
}

async function processOutcomeSubmitted(logs, outcomes) {
  const now = new Date().toISOString();
  for (const log of logs) {
    const { outcomeId, decisionId, agentId, seasonId, status, roiBps, confidenceCalibration, metricsHash, evidenceURI } = log.args;
    const oId = String(outcomeId);
    if (_seenOutcomeIds.has(oId)) continue;
    _seenOutcomeIds.add(oId);

    const backendDecisionId = `${agentId}-onchain-${decisionId}`;
    const existing = outcomes.find((o) => o.decisionId === backendDecisionId);
    if (!existing) {
      outcomes.push({
        decisionId: backendDecisionId,
        agentId: String(agentId),
        seasonId: `season-${seasonId}`,
        status: OUTCOME_MAP[status] ?? "neutral",
        priceBefore: 0,
        priceAfter: 0,
        roiBps: Number(roiBps),
        confidenceCalibration: Number(confidenceCalibration),
        metricsHash,
        evidenceUri: evidenceURI,
        onChainTxHash: log.transactionHash,
        onChainExplorerUrl: `${DEPLOYED.explorerUrl}/tx/${log.transactionHash}`,
        indexedFromChain: true,
        createdAt: now
      });
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
    const latest = await getLatestBlock();
    if (_lastBlock === 0n) {
      _lastBlock = latest - 5000n;
      if (_lastBlock < 0n) _lastBlock = 0n;
    }
    if (_lastBlock >= latest) return { indexed: false, reason: "no new blocks" };

    const fromBlock = _lastBlock + 1n;
    const toBlock = latest;

    const [agentLogs, decisionLogs, outcomeLogs] = await Promise.all([
      fetchLogs(fromBlock, toBlock, DEPLOYED.agentPassport, AGENT_REGISTERED),
      fetchLogs(fromBlock, toBlock, DEPLOYED.decisionLogger, DECISION_SUBMITTED),
      fetchLogs(fromBlock, toBlock, DEPLOYED.outcomeRegistry, OUTCOME_SUBMITTED)
    ]);

    await processAgentRegistered(agentLogs, season, agents);
    await processDecisionSubmitted(decisionLogs, decisions, agents);
    await processOutcomeSubmitted(outcomeLogs, outcomes);

    _lastBlock = latest;
    const total = agentLogs.length + decisionLogs.length + outcomeLogs.length;
    if (total > 0) console.log(`indexer: processed ${total} events up to block ${latest}`);
    return { indexed: true, events: total, block: Number(latest) };
  } catch (err) {
    console.warn("indexer: error:", err.message);
    return { indexed: false, reason: err.message };
  }
}

export function startIndexer({ season, agents, decisions, outcomes, intervalMs = 15000 }) {
  if (!hasEnv()) {
    console.log("indexer: RPC not configured, skipping");
    return () => {};
  }
  console.log("indexer: started, polling every", intervalMs / 1000, "s");

  const timer = setInterval(() => {
    indexOnce(season, agents, decisions, outcomes).catch(() => {});
  }, intervalMs);

  indexOnce(season, agents, decisions, outcomes).catch(() => {});

  return () => clearInterval(timer);
}
