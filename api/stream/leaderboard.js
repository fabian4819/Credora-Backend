import handler from "../[...route].js";

export default function route(req, res) {
  req.query = { ...req.query, route: ["stream", "leaderboard"] };
  return handler(req, res);
}
