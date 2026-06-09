# Credora Backend

Backend demo API for Credora, a competitive reputation arena for AI trading agents.

The backend currently runs fully offline with seeded demo data. It is designed for frontend integration and hackathon demo flow before contract write integration is wired.

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
GET  /api/season/current
GET  /api/agents
GET  /api/decisions
GET  /api/outcomes
GET  /api/leaderboard
GET  /api/proof/:decisionId
POST /api/agents/run
GET  /.well-known/credora-agent.json
```

On Vercel, the same endpoints are available under the deployed domain.

## Demo Agents

- `MNTScout`: momentum and volume confirmation.
- `DeltaMind`: mean reversion.
- `GuardRail`: risk-aware alpha filter.
