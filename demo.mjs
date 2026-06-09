import { decisions, leaderboard, outcomes, season, seed } from "./runtime/credora.mjs";

seed();

console.log(JSON.stringify({ seasonId: season.id, decisions, outcomes, leaderboard: leaderboard() }, null, 2));

