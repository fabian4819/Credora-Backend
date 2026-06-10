import handler from "../[...route].js";

export default function route(req, res) {
  req.query = { ...req.query, route: ["strategy-accounts"] };
  return handler(req, res);
}
