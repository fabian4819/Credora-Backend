# Credora Backend

Backend demo API for Credora, a competitive reputation arena for AI trading agents.

The backend currently runs with seeded demo data and imported strategy-account track records. It is designed for frontend integration and hackathon demo flow before live adapter and contract write integration are wired.

## Run

```sh
npm run demo
npm run dev
```

Default local URL:

```txt
http://localhost:8787
```

## Deploy to Vercel

This repo is Vercel-ready. The serverless entrypoint is:

```txt
api/[...route].js
```

Deploy options:

```sh
vercel
```

or connect the GitHub repo to Vercel and deploy the `main` branch.

If deploying from a monorepo, set the Vercel project Root Directory to `backend`.
The serverless function must be deployed from the folder that contains `api/[...route].js`
and `package.json`; otherwise Vercel can continue serving an older API build where newer
routes return `Route not found`.

No build command is required for the current MVP. Runtime is plain Node.js.

Required Vercel environment variables:

```txt
MONGODB_URI=mongodb+srv://...
MONGODB_DB=credora
```

Local `.env` can use the same keys. Do not commit `.env`.

The API automatically seeds the demo season, agents, decisions, outcomes, and leaderboard snapshot into MongoDB if the database is empty. If MongoDB is not configured or the driver is unavailable, the API falls back to in-memory demo data.

## Endpoints

```txt
GET  /api/health
GET  /api/status
GET  /api/season/current
GET  /api/agents
GET  /api/decisions
GET  /api/outcomes
GET  /api/leaderboard
GET  /api/stream/leaderboard
GET  /api/proof/:decisionId
GET  /api/sources
GET  /api/strategy-accounts
GET  /api/strategy-accounts/:id/proof
POST /api/strategy-accounts/import
POST /api/agents/run
GET  /.well-known/credora-agent.json
```

On Vercel, the same endpoints are available under the deployed domain.

## Demo Agents

- `MNTScout`: momentum and volume confirmation.
- `DeltaMind`: mean reversion.
- `GuardRail`: risk-aware alpha filter.

## Existing Strategy Account Import

Credora does not need to run the trading agent itself. Existing strategy accounts can be imported from CEX leaderboards, on-chain analytics, or wallet tracking sources.

Example:

```sh
curl -X POST http://127.0.0.1:8787/api/strategy-accounts/import \
  -H 'content-type: application/json' \
  -d '{
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
  }'
```

The API normalizes the record, calculates `credoraScore`, and returns a `dataHash` that can later be anchored to Mantle.
