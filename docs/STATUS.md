# Credora — Final Status

Date: 2026-06-11
Deployed URL: **`https://credora.fabian.web.id`**

---

## Backend

### Server
`https://credora.fabian.web.id` — VPS (Docker), auto-deploys from `main` via cron + GitHub Actions.

### All FE asks resolved

| # | Item | Status | How |
|---|---|---|---|
| BE-1 | `winRate` per leaderboard row | ✅ | Added to every row |
| BE-2 | Score formula 30/25/20/15/10 | ✅ | `accuracy*0.30 + roi*0.25 + consistency*0.20 + risk*0.15 + verification*0.10` |
| BE-3 | `scoreBreakdown` on agent rows | ✅ | `{accuracy, roi, consistency, riskMgmt, verification}` (0–100) |
| BE-4 | `GET /api/agents/:id` | ✅ | Returns agent + score |
| BE-4 | `GET /api/seasons` | ✅ | Returns season list |
| BE-5 | `?withOutcome=1` on decisions | ✅ | `GET /api/decisions?withOutcome=1` |
| BE-6 | Real `proof.txHash` | ✅ | Real Mantle Sepolia tx hashes |
| BE-7 | On-chain writes on agent run | ✅ | All 4 contract writes synchronous |
| BE-8 | CORS headers | ✅ | `access-control-allow-origin: *` |

### All SC asks resolved

| # | Item | Status | How |
|---|---|---|---|
| SC-1 | Deployed addresses | ✅ | Shared, in FE env |
| SC-2 | Submitter roles | ✅ | Deployer = signer, auto-whitelisted |
| SC-3 | Season id numeric | ✅ | `season-1` → `1` |
| SC-4 | Action enum order | ✅ | `Long=0, Short=1, Hold=2, Alert=3` — final |
| SC-5 | ABI artifacts | ✅ | `docs/abis/` in repo — 5 contract ABIs |

### API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Service health |
| `GET` | `/api/status` | System status with all flags |
| `GET` | `/api/season/current` | Current active season |
| `GET` | `/api/seasons` | **NEW** All seasons |
| `GET` | `/api/agents` | All agents |
| `GET` | `/api/agents/:id` | **NEW** Single agent + score |
| `GET` | `/api/leaderboard` | Full leaderboard (demo + strategy accounts) |
| `GET` | `/api/decisions` | All decisions |
| `GET` | `/api/decisions?withOutcome=1` | **NEW** Decisions with inline outcome |
| `GET` | `/api/outcomes` | All outcomes |
| `GET` | `/api/proof/:decisionId` | Decision proof with real tx hashes |
| `GET` | `/api/sources` | Import source adapters |
| `GET` | `/api/strategy-accounts` | Imported strategy accounts |
| `GET` | `/api/strategy-accounts/:id/proof` | Strategy account proof |
| `GET` | `/api/stream/leaderboard` | SSE real-time leaderboard stream |
| `POST` | `/api/agents/run` | Run demo agent → on-chain write |
| `POST` | `/api/strategy-accounts/import` | Import track record |

---

## Smart Contracts (Mantle Sepolia, Chain ID 5003)

All verified on Sourcify (`exact_match`).

| Contract | Address | Purpose |
|---|---|---|
| AgentPassport | `0x40A9cB62D2a02189be10eC4657ae02B2c235174e` | Agent identity NFT |
| DecisionLogger | `0x2dFf6D5eB709b368df0c11bd80209eB92591658c` | Decision proof on-chain |
| OutcomeRegistry | `0x67479A2F63ecAc78fb52D696df7D7455e2347983` | Outcome tracking |
| ReputationEngine | `0xc84D1e8FECaDa44487242E5D855AEE7F752A12EA` | Season score + rank |
| SeasonManager | `0xC425c96B30BF8a9190E7A273D990a6a8B6F49C3b` | Season lifecycle |

ABIs available at: `docs/abis/*.json`

---

## On-Chain Data Flow

```
POST /api/agents/run
  → 1. Run strategy (live CoinGecko price)
  → 2. Ensure agent registered on AgentPassport (if new)
  → 3. DecisionLogger.submitDecision → txHash
  → 4. OutcomeRegistry.submitOutcome → txHash
  → 5. ReputationEngine.submitSeasonScore + submitSeasonRank → txHash
  → 6. Store all txHashes + explorerUrls
  → 7. Return response (response time ~20s)
```

All writes confirm on Mantle Sepolia. Proof endpoint returns real `decisionTxHash`, `outcomeTxHash`, and `explorerUrl`.

---

## Live Subsystems

| Module | Interval | Source | Status |
|---|---|---|---|
| Oracle | 60s | CoinGecko | ✅ Real MNT/mETH/USDY prices |
| Indexer | 15s | Mantle RPC | ✅ Picking up on-chain events |
| Bridge | 300s | Bybit/Nansen | ✅ Strategy accounts updating |
| SSE | 5s | Leaderboard push | ✅ Real-time stream |

---

## CI/CD

- **Git push → auto-deploy** via VPS cron (every 2 min)
- **GitHub Actions** also configured (needs SSH key)
- Docker containerized (`node:22-alpine`)

---

## Naming Convention

| Thing | FE | Backend | Contract |
|---|---|---|---|
| Action | BUY/SELL/HOLD | LONG/SHORT/HOLD/ALERT | Long/Short/Hold/Alert |
| Season | `s01` | `season-1` | `1` |
| Score | 0–100 | 0–100 | bps × 100 |
| ROI | % | `roiPct` | `roiBps` (÷100) |
