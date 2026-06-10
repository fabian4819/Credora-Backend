import { dataSources, decisions, leaderboard, outcomes, season, seed, strategyAccounts } from "./runtime/credora.mjs";

seed();

console.log(
  JSON.stringify(
    {
      seasonId: season.id,
      dataSources,
      strategyAccounts,
      decisions,
      outcomes,
      leaderboard: leaderboard()
    },
    null,
    2
  )
);
