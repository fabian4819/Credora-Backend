let _viem = null;
async function getViem() {
  if (!_viem) {
    const [core, accounts] = await Promise.all([
      import("viem"),
      import("viem/accounts")
    ]);
    _viem = { ...core, ...accounts };
  }
  return _viem;
}

const DEPLOYED = {
  agentPassport: "0x40A9cB62D2a02189be10eC4657ae02B2c235174e",
  decisionLogger: "0x2dFf6D5eB709b368df0c11bd80209eB92591658c",
  outcomeRegistry: "0x67479A2F63ecAc78fb52D696df7D7455e2347983",
  reputationEngine: "0xc84D1e8FECaDa44487242E5D855AEE7F752A12EA",
  seasonManager: "0xC425c96B30BF8a9190E7A273D990a6a8B6F49C3b",
  rpcUrl: "https://rpc.sepolia.mantle.xyz",
  explorerUrl: "https://explorer.sepolia.mantle.xyz",
  chainId: 5003
};

const AGENT_PASSPORT_ABI = [
  {
    type: "function", name: "registerAgent",
    inputs: [
      { name: "agentName", type: "string" },
      { name: "strategyType", type: "string" },
      { name: "metadataURI", type: "string" },
      { name: "operator", type: "address" },
      { name: "strategyHash", type: "bytes32" }
    ],
    outputs: [{ name: "agentId", type: "uint256" }],
    stateMutability: "nonpayable"
  },
  {
    type: "function", name: "nextAgentId",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function", name: "ownerOf",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view"
  }
];

const DECISION_LOGGER_ABI = [
  {
    type: "function", name: "submitDecision",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "seasonId", type: "uint256" },
      { name: "marketHash", type: "bytes32" },
      { name: "action", type: "uint8" },
      { name: "confidence", type: "uint16" },
      { name: "riskScore", type: "uint16" },
      { name: "targetWindowSeconds", type: "uint64" },
      { name: "dataHash", type: "bytes32" },
      { name: "rationaleHash", type: "bytes32" },
      { name: "evidenceURI", type: "string" }
    ],
    outputs: [{ name: "decisionId", type: "uint256" }],
    stateMutability: "nonpayable"
  },
  {
    type: "function", name: "nextDecisionId",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view"
  }
];

const OUTCOME_REGISTRY_ABI = [
  {
    type: "function", name: "submitOutcome",
    inputs: [
      { name: "decisionId", type: "uint256" },
      { name: "agentId", type: "uint256" },
      { name: "seasonId", type: "uint256" },
      { name: "status", type: "uint8" },
      { name: "roiBps", type: "int256" },
      { name: "confidenceCalibration", type: "uint16" },
      { name: "metricsHash", type: "bytes32" },
      { name: "evidenceURI", type: "string" }
    ],
    outputs: [{ name: "outcomeId", type: "uint256" }],
    stateMutability: "nonpayable"
  }
];

const REPUTATION_ENGINE_ABI = [
  {
    type: "function", name: "submitSeasonScore",
    inputs: [
      { name: "seasonId", type: "uint256" },
      { name: "agentId", type: "uint256" },
      { name: "decisions", type: "uint256" },
      { name: "successes", type: "uint256" },
      { name: "failures", type: "uint256" },
      { name: "neutrals", type: "uint256" },
      { name: "totalRoiBps", type: "int256" },
      { name: "totalRiskScore", type: "uint256" },
      { name: "finalScore", type: "uint256" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function", name: "submitSeasonRank",
    inputs: [
      { name: "seasonId", type: "uint256" },
      { name: "agentId", type: "uint256" },
      { name: "rank", type: "uint256" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  }
];

const ACTION_MAP = { LONG: 0, SHORT: 1, HOLD: 2, ALERT: 3 };
const OUTCOME_MAP = { success: 1, failed: 2, neutral: 3, inconclusive: 4 };
const SEASON_ID = 1;

function toBytes32(hex) {
  return hex.startsWith("0x") ? hex : `0x${hex}`;
}

async function marketHash(market) {
  const v = await getViem();
  return v.keccak256(v.stringToHex(market));
}

function hasEnv() {
  return Boolean(process.env.MANTLE_RPC_URL || process.env.PRIVATE_KEY);
}

let _walletClient = null;
let _publicClient = null;
let _account = null;
let _transport = null;

function getTransport() {
  if (!_transport) {
    _transport = getViem().then(v => v.http(process.env.MANTLE_RPC_URL ?? DEPLOYED.rpcUrl));
  }
  return _transport;
}

async function getAccount() {
  if (!_account && process.env.PRIVATE_KEY) {
    const v = await getViem();
    _account = v.privateKeyToAccount(`0x${process.env.PRIVATE_KEY.replace(/^0x/, "")}`);
  }
  return _account;
}

async function getWalletClient() {
  if (!_walletClient && process.env.PRIVATE_KEY) {
    const transport = await getTransport();
    const v = await getViem();
    _walletClient = v.createWalletClient({
      account: await getAccount(),
      chain: { id: DEPLOYED.chainId, name: "Mantle Sepolia", rpcUrls: { default: { http: [process.env.MANTLE_RPC_URL ?? DEPLOYED.rpcUrl] } }, nativeCurrency: { name: "MNT", symbol: "MNT", decimals: 18 } },
      transport
    });
  }
  return _walletClient;
}

async function getPublicClient() {
  if (!_publicClient) {
    const transport = await getTransport();
    const v = await getViem();
    _publicClient = v.createPublicClient({
      chain: { id: DEPLOYED.chainId, name: "Mantle Sepolia", rpcUrls: { default: { http: [process.env.MANTLE_RPC_URL ?? DEPLOYED.rpcUrl] } }, nativeCurrency: { name: "MNT", symbol: "MNT", decimals: 18 } },
      transport
    });
  }
  return _publicClient;
}

async function tryRead(promise) {
  try {
    return await promise;
  } catch (_) {
    return null;
  }
}

async function waitForTx(txHash) {
  try {
    const publicClient = await getPublicClient();
    await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 60000 });
  } catch (err) {
    console.warn("waitForTx failed:", err.message);
  }
}

export async function ensureAgentRegistered(backendAgentId, agentName, strategyType) {
  if (!hasEnv()) return null;
  try {
    const publicClient = await getPublicClient();
    const agentId = BigInt(backendAgentId);
    const owner = await tryRead(publicClient.readContract({
      address: DEPLOYED.agentPassport,
      abi: AGENT_PASSPORT_ABI,
      functionName: "ownerOf",
      args: [agentId]
    }));
    if (owner) return agentId;

    const walletClient = await getWalletClient();
    if (!walletClient) return null;

    const metadataURI = `ipfs://credora/${agentName.toLowerCase().replace(/\s+/g, "-")}`;
    const v = await getViem();
    const strategyHash = v.keccak256(v.stringToHex(strategyType));
    const account = await getAccount();

    const txHash = await walletClient.writeContract({
      address: DEPLOYED.agentPassport,
      abi: AGENT_PASSPORT_ABI,
      functionName: "registerAgent",
      args: [agentName, strategyType, metadataURI, account.address, strategyHash],
      account
    });

    await waitForTx(txHash);
    console.log(`Agent ${backendAgentId} (${agentName}) registered on-chain: ${txHash}`);
    return agentId;
  } catch (err) {
    console.warn("ensureAgentRegistered failed:", err.message);
    return null;
  }
}

export async function submitDecisionOnChain(decision, agent) {
  if (!hasEnv()) return null;
  try {
    const walletClient = await getWalletClient();
    if (!walletClient) return null;

    const agentId = BigInt(decision.agentId);
    const account = await getAccount();

    const txHash = await walletClient.writeContract({
      address: DEPLOYED.decisionLogger,
      abi: DECISION_LOGGER_ABI,
      functionName: "submitDecision",
      args: [
        agentId,
        BigInt(SEASON_ID),
        await marketHash(decision.market),
        ACTION_MAP[decision.action] ?? 2,
        decision.confidence,
        decision.riskScore,
        BigInt(decision.targetWindowHours * 3600),
        toBytes32(decision.dataHash),
        toBytes32(decision.rationaleHash),
        decision.evidenceUri
      ],
      account
    });

    const publicClient = await getPublicClient();
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    const onChainDecisionId = receipt.logs?.[0]?.topics?.[1]
      ? BigInt(receipt.logs[0].topics[1])
      : BigInt(await publicClient.readContract({
          address: DEPLOYED.decisionLogger,
          abi: DECISION_LOGGER_ABI,
          functionName: "nextDecisionId",
          args: []
        })) - 1n;

    return {
      txHash,
      explorerUrl: `${DEPLOYED.explorerUrl}/tx/${txHash}`,
      onChainDecisionId: Number(onChainDecisionId)
    };
  } catch (err) {
    console.warn("submitDecisionOnChain failed:", err.message);
    return null;
  }
}

export async function submitOutcomeOnChain(onChainDecisionId, agentId, outcome) {
  if (!hasEnv()) return null;
  try {
    const walletClient = await getWalletClient();
    if (!walletClient) return null;

    const account = await getAccount();
    const status = OUTCOME_MAP[outcome.status] ?? 3;

    const txHash = await walletClient.writeContract({
      address: DEPLOYED.outcomeRegistry,
      abi: OUTCOME_REGISTRY_ABI,
      functionName: "submitOutcome",
      args: [
        BigInt(onChainDecisionId),
        BigInt(agentId),
        BigInt(SEASON_ID),
        status,
        BigInt(outcome.roiBps),
        outcome.confidenceCalibration,
        toBytes32(outcome.metricsHash),
        outcome.evidenceUri
      ],
      account
    });

    await waitForTx(txHash);

    return {
      txHash,
      explorerUrl: `${DEPLOYED.explorerUrl}/tx/${txHash}`
    };
  } catch (err) {
    console.warn("submitOutcomeOnChain failed:", err.message);
    return null;
  }
}

export function getExplorerUrl(txHash) {
  return `${DEPLOYED.explorerUrl}/tx/${txHash}`;
}

export async function submitSeasonScoreOnChain(agentId, agentName, scoreData) {
  if (!hasEnv()) return null;
  try {
    const walletClient = await getWalletClient();
    if (!walletClient) return null;

    const account = await getAccount();
    const finalScore = Math.round(scoreData.credoraScore * 100);

    const txHash = await walletClient.writeContract({
      address: DEPLOYED.reputationEngine,
      abi: REPUTATION_ENGINE_ABI,
      functionName: "submitSeasonScore",
      args: [
        BigInt(SEASON_ID),
        BigInt(agentId),
        BigInt(scoreData.decisions),
        BigInt(Math.round(scoreData.accuracy * scoreData.decisions / 100)),
        BigInt(scoreData.decisions - Math.round(scoreData.accuracy * scoreData.decisions / 100)),
        BigInt(0),
        BigInt(Math.round(scoreData.roiPct * 100)),
        BigInt(Math.round(scoreData.avgRisk)),
        BigInt(finalScore)
      ],
      account
    });

    await waitForTx(txHash);

    const rankTxHash = await walletClient.writeContract({
      address: DEPLOYED.reputationEngine,
      abi: REPUTATION_ENGINE_ABI,
      functionName: "submitSeasonRank",
      args: [BigInt(SEASON_ID), BigInt(agentId), BigInt(scoreData.rank)],
      account
    });

    console.log(`ReputationEngine: score submitted for ${agentName} (${scoreData.credoraScore}), rank #${scoreData.rank}`);
    return { scoreTxHash: txHash, rankTxHash, explorerUrl: `${DEPLOYED.explorerUrl}/tx/${txHash}` };
  } catch (err) {
    console.warn("submitSeasonScoreOnChain failed:", err.message);
    return null;
  }
}
