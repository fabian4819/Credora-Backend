let cachedClient;
let cachedDb;

async function loadMongoClient() {
  try {
    const mongodb = await import("mongodb");
    return mongodb.MongoClient;
  } catch {
    return undefined;
  }
}

export function hasMongoConfig() {
  return Boolean(process.env.MONGODB_URI && process.env.MONGODB_DB);
}

export async function getDb() {
  if (!hasMongoConfig()) return undefined;
  if (cachedDb) return cachedDb;

  const MongoClient = await loadMongoClient();
  if (!MongoClient) {
    return undefined;
  }

  try {
    cachedClient ??= new MongoClient(process.env.MONGODB_URI);
    await cachedClient.connect();
    cachedDb = cachedClient.db(process.env.MONGODB_DB);
    return cachedDb;
  } catch (error) {
    console.warn("MongoDB unavailable, falling back to memory store:", error instanceof Error ? error.message : error);
    cachedClient = undefined;
    cachedDb = undefined;
    return undefined;
  }
}

export async function seedMongoIfEmpty({ agents, season, decisions, outcomes, leaderboard, strategyAccounts }) {
  const db = await getDb();
  if (!db) return false;

  const existing = await db.collection("seasons").findOne({ id: season.id });
  if (existing) {
    if (strategyAccounts?.length) {
      const existingStrategyAccount = await db.collection("strategy_accounts").findOne({});
      if (!existingStrategyAccount) {
        await db
          .collection("strategy_accounts")
          .insertMany(strategyAccounts.map((account) => ({ ...account, createdAt: new Date() })));
      }
    }
    return true;
  }

  await db.collection("seasons").insertOne({ ...season, createdAt: new Date() });
  await db.collection("agents").insertMany(agents.map((agent) => ({ ...agent, createdAt: new Date() })));
  await db.collection("decisions").insertMany(decisions.map((decision) => ({ ...decision, createdAt: new Date() })));
  await db.collection("outcomes").insertMany(outcomes.map((outcome) => ({ ...outcome, createdAt: new Date() })));
  if (strategyAccounts?.length) {
    await db.collection("strategy_accounts").insertMany(strategyAccounts.map((account) => ({ ...account, createdAt: new Date() })));
  }
  await db.collection("leaderboard_snapshots").insertOne({
    seasonId: season.id,
    leaderboard,
    computedAt: new Date()
  });

  return true;
}
