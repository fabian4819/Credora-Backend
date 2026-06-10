# Credora Frontend Handoff

This document is for the frontend team consuming the Credora backend API and contract layer.

## 1. Backend Base URL

Local:

```txt
http://127.0.0.1:8787
```

Vercel:

```txt
https://<your-vercel-domain>
```

All backend API endpoints are under:

```txt
/api
```

## 2. Core Product Flow

```txt
1. Show current season
2. Show registered agents and imported strategy accounts
3. Show leaderboard
4. User opens agent profile
5. User opens decision proof or strategy-account proof page
6. Demo action: import existing track record or run demo agent
7. Leaderboard updates
```

## 3. Backend Endpoints

### GET /api/health

Use this to check backend and DB mode.

Response:

```json
{
  "ok": true,
  "service": "credora-backend",
  "season": "season-1",
  "database": "mongodb"
}
```

`database` can be:

```txt
mongodb
memory
```

If MongoDB is unavailable, backend falls back to memory data.

---

### GET /api/season/current

Returns current competition season.

Response:

```json
{
  "id": "season-1",
  "name": "Mantle AI Alpha Challenge",
  "marketScope": "MNT, mETH, USDY",
  "startTime": "2026-06-09T00:00:00.000Z",
  "endTime": "2026-06-16T00:00:00.000Z",
  "status": "active",
  "createdAt": "2026-06-09T..."
}
```

Frontend usage:

- Season detail page.
- Current active season label.
- Countdown / status badge.

---

### GET /api/agents

Returns registered AI agents.

Response:

```json
{
  "agents": [
    {
      "id": "1",
      "name": "MNTScout",
      "source": "momentum",
      "strategyType": "Momentum and volume confirmation",
      "tradingPlatform": "demo",
      "riskProfile": "medium",
      "supportedMarkets": ["MNT/USDT"],
      "createdAt": "2026-06-09T..."
    }
  ]
}
```

Frontend usage:

- Agent cards.
- Agent profile page.
- Register/join season placeholder.

Important fields:

| Field | Meaning |
| --- | --- |
| `id` | Internal demo agent ID |
| `name` | Agent display name |
| `strategyType` | Strategy description |
| `tradingPlatform` | `demo`, future `DEX` or `CEX` |
| `riskProfile` | `low`, `medium`, `high` |
| `supportedMarkets` | Markets the agent supports |

---

### GET /api/leaderboard

Returns season leaderboard, including demo agents and imported strategy accounts.

Response:

```json
{
  "season": {
    "id": "season-1",
    "name": "Mantle AI Alpha Challenge",
    "marketScope": "MNT, mETH, USDY",
    "startTime": "2026-06-09T00:00:00.000Z",
    "endTime": "2026-06-16T00:00:00.000Z",
    "status": "active"
  },
  "leaderboard": [
    {
      "agentId": "3",
      "agentName": "GuardRail",
      "entryType": "demo_agent",
      "source": "demo",
      "verificationLevel": "demo_generated",
      "decisions": 1,
      "accuracy": 100,
      "roiPct": 0,
      "consistency": 100,
      "avgRisk": 4,
      "credoraScore": 86.7,
      "rank": 1
    }
  ]
}
```

Frontend usage:

- Main leaderboard table.
- Hero metric cards.
- Season result page.

Recommended columns:

| Column | Field |
| --- | --- |
| Rank | `rank` |
| Agent | `agentName` |
| Type | `entryType` |
| Source | `source` |
| Verification | `verificationLevel` |
| Decisions | `decisions` |
| Accuracy | `accuracy` |
| ROI | `roiPct` |
| Consistency | `consistency` |
| Avg Risk | `avgRisk` |
| Credora Score | `credoraScore` |

Score display:

```txt
credoraScore / 100
```

Example:

```txt
86.7
```

---

### GET /api/sources

Returns supported source adapters for existing agent/strategy track records.

Response:

```json
{
  "sources": [
    {
      "id": "bybit-copy-trading",
      "name": "Bybit Copy Trading / Leaderboard",
      "sourceType": "cex",
      "verificationMode": "public_leaderboard_or_read_only_api",
      "requiredProof": ["sourceProofUrl", "period", "roiPct", "winRatePct", "tradeCount", "maxDrawdownPct"]
    }
  ]
}
```

Frontend usage:

- Import form source selector.
- Explain which evidence is required for each source.

---

### GET /api/strategy-accounts

Returns imported existing trading agents, bots, smart wallets, or strategy accounts.

Response:

```json
{
  "strategyAccounts": [
    {
      "id": "bybit-copy-trading:bybit-master-alpha-30d-demo",
      "source": "bybit-copy-trading",
      "sourceType": "cex",
      "sourcePlatform": "Bybit",
      "externalAccountId": "bybit-master-alpha-30d-demo",
      "displayName": "AlphaMaster 30D",
      "accountType": "observed_strategy_account",
      "verificationLevel": "public_track_record",
      "markets": ["BTC/USDT", "ETH/USDT", "MNT/USDT"],
      "period": "30d",
      "metrics": {
        "roiPct": 18.4,
        "winRatePct": 64.2,
        "maxDrawdownPct": 7.8,
        "tradeCount": 126,
        "volumeUsd": 820000,
        "consistencyPct": 71
      },
      "credoraScore": 75.62,
      "dataHash": "0x..."
    }
  ]
}
```

Account type values:

```txt
verified_agent
observed_strategy_account
imported_public_account
```

Frontend usage:

- Strategy account directory.
- Agent/account profile page.
- Source proof page.

---

### GET /api/strategy-accounts/:id/proof

Returns proof data for an imported track record.

Example:

```txt
GET /api/strategy-accounts/bybit-copy-trading%3Abybit-master-alpha-30d-demo/proof
```

Response:

```json
{
  "account": {
    "id": "bybit-copy-trading:bybit-master-alpha-30d-demo",
    "displayName": "AlphaMaster 30D",
    "credoraScore": 75.62,
    "dataHash": "0x..."
  },
  "proof": {
    "dataHash": "0x...",
    "sourceProofUrl": "https://www.bybit.com/copyTrading",
    "txHashes": [],
    "proofStatus": "offchain_verified_pending_anchor",
    "explorerUrls": []
  }
}
```

---

### POST /api/strategy-accounts/import

Imports an existing account track record and recalculates Credora Score.

Request:

```json
{
  "source": "bybit-copy-trading",
  "sourcePlatform": "Bybit",
  "externalAccountId": "master-trader-demo",
  "displayName": "Master Trader Demo",
  "accountType": "observed_strategy_account",
  "verificationLevel": "public_track_record",
  "markets": ["BTC/USDT", "ETH/USDT"],
  "period": "30d",
  "metrics": {
    "roiPct": 14.2,
    "winRatePct": 62.5,
    "maxDrawdownPct": 8.1,
    "tradeCount": 94,
    "volumeUsd": 520000,
    "consistencyPct": 70
  },
  "sourceProofUrl": "https://www.bybit.com/copyTrading"
}
```

Response:

```json
{
  "strategyAccount": {
    "id": "bybit-copy-trading:master-trader-demo",
    "credoraScore": 71.3,
    "dataHash": "0x..."
  },
  "proof": {
    "dataHash": "0x...",
    "proofStatus": "offchain_verified_pending_anchor",
    "sourceProofUrl": "https://www.bybit.com/copyTrading"
  }
}
```

After success:

- Refresh `/api/leaderboard`.
- Link to `/strategy-accounts/:id/proof`.

---

### GET /api/decisions

Returns all decisions.

Response:

```json
{
  "decisions": [
    {
      "id": "1-MNT/USDT-1781018002501",
      "agentId": "1",
      "seasonId": "season-1",
      "market": "MNT/USDT",
      "action": "LONG",
      "entryPrice": 1.25,
      "targetWindowHours": 4,
      "confidence": 94,
      "riskScore": 42,
      "rationale": "Positive price momentum is confirmed by elevated volume.",
      "dataHash": "0xde47a154...",
      "rationaleHash": "0x1a7723...",
      "evidenceUri": "memory://evidence/1/MNT/USDT",
      "submittedAt": "2026-06-09T02:00:00.000Z",
      "createdAt": "2026-06-09T..."
    }
  ]
}
```

Frontend usage:

- Decision timeline.
- Agent profile history.
- Recent activity feed.

Decision action values:

```txt
LONG
SHORT
HOLD
ALERT
```

Recommended action colors:

| Action | Color |
| --- | --- |
| `LONG` | Green |
| `SHORT` | Red |
| `HOLD` | Gray |
| `ALERT` | Amber |

---

### GET /api/outcomes

Returns decision outcomes.

Response:

```json
{
  "outcomes": [
    {
      "decisionId": "1-MNT/USDT-1781018002501",
      "agentId": "1",
      "seasonId": "season-1",
      "status": "neutral",
      "priceBefore": 1.25,
      "priceAfter": 1.25,
      "roiBps": 0,
      "confidenceCalibration": 56,
      "metricsHash": "0x...",
      "evidenceUri": "memory://outcomes/1-MNT/USDT-1781018002501",
      "createdAt": "2026-06-09T..."
    }
  ]
}
```

Outcome status values:

```txt
success
failed
neutral
inconclusive
```

`roiBps` conversion:

```txt
roiPct = roiBps / 100
```

Example:

```txt
480 bps = 4.8%
```

---

### GET /api/proof/:decisionId

Returns proof detail for a decision.

Example:

```txt
GET /api/proof/1-MNT%2FUSDT-1781018002501
```

Response:

```json
{
  "agent": {
    "id": "1",
    "name": "MNTScout",
    "strategyType": "Momentum and volume confirmation"
  },
  "decision": {
    "id": "1-MNT/USDT-1781018002501",
    "agentId": "1",
    "seasonId": "season-1",
    "market": "MNT/USDT",
    "action": "LONG",
    "confidence": 94,
    "riskScore": 42,
    "dataHash": "0xde47a154...",
    "rationaleHash": "0x1a7723..."
  },
  "outcome": {
    "decisionId": "1-MNT/USDT-1781018002501",
    "status": "neutral",
    "roiBps": 0,
    "metricsHash": "0x..."
  },
  "proof": {
    "dataHash": "0xde47a154...",
    "rationaleHash": "0x1a7723...",
    "metricsHash": "0x...",
    "txHash": "0xabf8c2bf714512d201c5b19927017806e0213079ab2ed0c045239d0fecec27df",
    "explorerUrl": "https://explorer.sepolia.mantle.xyz/tx/0xabf8c2bf714512d201c5b19927017806e0213079ab2ed0c045239d0fecec27df"
  }
}
```

Frontend proof page should show:

- Agent name.
- Market.
- Action.
- Confidence.
- Risk score.
- Rationale.
- Outcome status.
- ROI.
- Data hash.
- Rationale hash.
- Metrics hash.
- Tx hash.
- Explorer link.

Current backend demo data may still return local proof hashes, but the deployed contract layer already has one seeded decision/outcome transaction for the public demo.

---

### POST /api/agents/run

Runs a demo agent and creates one new decision/outcome.

Request:

```json
{
  "agentId": "1",
  "market": "MNT/USDT"
}
```

Response:

```json
{
  "decision": {
    "id": "1-MNT/USDT-1781018002501",
    "agentId": "1",
    "action": "LONG",
    "market": "MNT/USDT"
  },
  "outcome": {
    "decisionId": "1-MNT/USDT-1781018002501",
    "status": "neutral"
  },
  "leaderboard": []
}
```

Frontend usage:

- Demo button: `Run Agent`.
- After success:
  - Refresh leaderboard.
  - Add decision to activity feed.
  - Link to proof page.

Supported demo payloads:

```json
{ "agentId": "1", "market": "MNT/USDT" }
{ "agentId": "2", "market": "mETH/USDT" }
{ "agentId": "3", "market": "USDY/USDT" }
```

---

### GET /.well-known/credora-agent.json

Discovery metadata.

Response:

```json
{
  "schema": "credora.discovery.v1",
  "name": "Credora",
  "description": "Competitive reputation arena for AI trading agents.",
  "services": [
    {
      "type": "leaderboard",
      "endpoint": "/api/leaderboard"
    }
  ]
}
```

## 4. Frontend Page Mapping

### Dashboard

Use:

```txt
GET /api/season/current
GET /api/leaderboard
GET /api/strategy-accounts
GET /api/decisions
```

Show:

- Active season.
- Top 3 agents.
- Recent decisions.
- Credora score summary.

### Leaderboard Page

Use:

```txt
GET /api/leaderboard
GET /api/sources
```

Filters to prepare:

- Current season.
- Past season.
- Risk profile.
- Market.
- DEX/CEX/demo.

Current backend returns one active season.

### Agent Profile Page

Use:

```txt
GET /api/agents
GET /api/strategy-accounts
GET /api/decisions
GET /api/outcomes
GET /api/leaderboard
```

Frontend can filter by `agentId`.

Show:

- Agent info.
- Score.
- Accuracy.
- ROI.
- Risk.
- Decision timeline.
- Proof links.

### Decision Proof Page

Use:

```txt
GET /api/proof/:decisionId
GET /api/strategy-accounts/:id/proof
```

Show:

- Decision details.
- Outcome details.
- Hashes.
- Explorer link.

### Demo Control

Use:

```txt
POST /api/strategy-accounts/import
POST /api/agents/run
```

Show button:

```txt
Run Agent
```

After success, navigate to:

```txt
/proof/:decisionId
```

## 5. Contract API for Frontend

Contract repo:

```txt
https://github.com/fabian4819/Credora-Contract
```

Network:

```txt
Mantle Sepolia
Chain ID: 5003
RPC: https://rpc.sepolia.mantle.xyz
Explorer: https://explorer.sepolia.mantle.xyz
```

Verified deployment:

```txt
AgentPassport: 0x40A9cB62D2a02189be10eC4657ae02B2c235174e
SeasonManager: 0xC425c96B30BF8a9190E7A273D990a6a8B6F49C3b
DecisionLogger: 0x2dFf6D5eB709b368df0c11bd80209eB92591658c
OutcomeRegistry: 0x67479A2F63ecAc78fb52D696df7D7455e2347983
ReputationEngine: 0xc84D1e8FECaDa44487242E5D855AEE7F752A12EA
```

All contracts are verified on Sourcify with `exact_match`.

Seeded proof transactions:

```txt
DecisionSubmitted: https://explorer.sepolia.mantle.xyz/tx/0xabf8c2bf714512d201c5b19927017806e0213079ab2ed0c045239d0fecec27df
OutcomeSubmitted: https://explorer.sepolia.mantle.xyz/tx/0x20275306eeaa6b41f20026febbdd62492f982b54dd0425af2721ec337ba0c0fc
SeasonScoreSubmitted: https://explorer.sepolia.mantle.xyz/tx/0x2d1f884d7dfa156880f2ea7d0831037d327add49417080203af35b3833fa4ba7
SeasonRankSubmitted: https://explorer.sepolia.mantle.xyz/tx/0x1a0ddfccc6f6cb33f39b18bc4ecf92be746f998ed0f12814429493115ed6a9ef
```

Current contracts:

```txt
AgentPassport.sol
SeasonManager.sol
DecisionLogger.sol
OutcomeRegistry.sol
ReputationEngine.sol
```

ABIs are generated after:

```sh
forge build
```

ABI paths:

```txt
out/AgentPassport.sol/AgentPassport.json
out/SeasonManager.sol/SeasonManager.json
out/DecisionLogger.sol/DecisionLogger.json
out/OutcomeRegistry.sol/OutcomeRegistry.json
out/ReputationEngine.sol/ReputationEngine.json
```

### AgentPassport

Purpose:

```txt
Register AI agent identity.
```

Main write:

```solidity
registerAgent(
  string agentName,
  string strategyType,
  string metadataURI,
  address operator,
  bytes32 strategyHash
) returns (uint256 agentId)
```

Main reads:

```solidity
ownerOf(uint256 agentId)
tokenURI(uint256 agentId)
isAuthorizedOperator(uint256 agentId, address caller)
agentConfigs(uint256 agentId)
```

Important event:

```solidity
AgentRegistered(
  uint256 indexed agentId,
  address indexed owner,
  address indexed operator,
  string name,
  string strategyType,
  string metadataURI,
  bytes32 strategyHash
)
```

Frontend usage:

- Register agent form.
- Agent profile identity.
- Proof page identity check.

---

### SeasonManager

Purpose:

```txt
Create and manage competition seasons.
```

Main writes:

```solidity
createSeason(string seasonName, uint64 startTime, uint64 endTime, string marketScope)
joinSeason(uint256 seasonId, uint256 agentId)
closeSeason(uint256 seasonId)
```

Main reads:

```solidity
seasons(uint256 seasonId)
getSeasonAgents(uint256 seasonId)
```

Important events:

```solidity
SeasonCreated(uint256 indexed seasonId, string name, uint64 startTime, uint64 endTime, string marketScope)
AgentJoinedSeason(uint256 indexed seasonId, uint256 indexed agentId)
SeasonClosed(uint256 indexed seasonId)
```

Frontend usage:

- Season detail.
- Join season action.
- Season participant list.

---

### DecisionLogger

Purpose:

```txt
Record agent decision proof before outcome happens.
```

Action enum:

```txt
0 = Long
1 = Short
2 = Hold
3 = Alert
```

Main write:

```solidity
submitDecision(
  uint256 agentId,
  uint256 seasonId,
  bytes32 marketHash,
  Action action,
  uint16 confidence,
  uint16 riskScore,
  uint64 targetWindowSeconds,
  bytes32 dataHash,
  bytes32 rationaleHash,
  string evidenceURI
) returns (uint256 decisionId)
```

Main reads:

```solidity
decisions(uint256 decisionId)
getAgentDecisions(uint256 agentId)
getSeasonDecisions(uint256 seasonId)
```

Important event:

```solidity
DecisionSubmitted(
  uint256 indexed decisionId,
  uint256 indexed agentId,
  uint256 indexed seasonId,
  bytes32 marketHash,
  Action action,
  uint16 confidence,
  uint16 riskScore,
  uint64 targetWindowSeconds,
  bytes32 dataHash,
  bytes32 rationaleHash,
  string evidenceURI
)
```

Frontend usage:

- Decision history.
- Proof page.
- Recent activity feed.

---

### OutcomeRegistry

Purpose:

```txt
Record tracked outcome after decision window.
```

Outcome enum:

```txt
0 = Pending
1 = Success
2 = Failed
3 = Neutral
4 = Inconclusive
```

Main write:

```solidity
submitOutcome(
  uint256 decisionId,
  uint256 agentId,
  uint256 seasonId,
  OutcomeStatus status,
  int256 roiBps,
  uint16 confidenceCalibration,
  bytes32 metricsHash,
  string evidenceURI
) returns (uint256 outcomeId)
```

Main reads:

```solidity
getDecisionOutcome(uint256 decisionId)
getAgentOutcomes(uint256 agentId)
getSeasonOutcomes(uint256 seasonId)
```

Important event:

```solidity
OutcomeSubmitted(
  uint256 indexed outcomeId,
  uint256 indexed decisionId,
  uint256 indexed agentId,
  uint256 seasonId,
  OutcomeStatus status,
  int256 roiBps,
  uint16 confidenceCalibration,
  bytes32 metricsHash,
  string evidenceURI
)
```

Frontend usage:

- Outcome status chip.
- ROI display.
- Score breakdown.
- Proof page metrics.

---

### ReputationEngine

Purpose:

```txt
Store final season score and rank.
```

Main writes:

```solidity
submitSeasonScore(
  uint256 seasonId,
  uint256 agentId,
  uint256 decisions,
  uint256 successes,
  uint256 failures,
  uint256 neutrals,
  int256 totalRoiBps,
  uint256 totalRiskScore,
  uint256 finalScore
)

submitSeasonRank(uint256 seasonId, uint256 agentId, uint256 rank)
```

Main read:

```solidity
getSeasonScore(uint256 seasonId, uint256 agentId)
```

Important events:

```solidity
SeasonScoreSubmitted(...)
SeasonRankSubmitted(uint256 indexed seasonId, uint256 indexed agentId, uint256 rank)
```

Frontend usage:

- Season final result.
- Rank history.
- Agent achievements.

## 6. Hash Fields

Backend returns:

```txt
dataHash
rationaleHash
metricsHash
```

Current hashing algorithm in backend:

```txt
sha256(canonicalJson)
```

Contract fields are `bytes32`, so frontend should treat these as hex strings.

## 7. Current Limitations

Current MVP:

- Backend writes to MongoDB for the app API.
- Contract layer is deployed, verified, and seeded on Mantle Sepolia.
- Backend contract write integration is not wired into `POST /api/agents/run` yet.
- Demo API proof hashes and deployed seed proof are currently separate demo flows.
- One active season only.
- Demo agents only.

Recommended frontend integration for the hackathon:

```txt
Use backend API as the main data source.
Use contract/explorer links for proof visibility.
Only add direct wallet/contract calls later for register, join season, or claim flows.
```

Next integration step:

```txt
Backend POST /api/agents/run
  -> submitDecision to DecisionLogger on Mantle
  -> store txHash in MongoDB
  -> submitOutcome to OutcomeRegistry
  -> update proof page with real explorer link
```
