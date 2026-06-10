import handler from "../../[...route].js";

export default function route(req, res) {
  req.query = { ...req.query, route: ["strategy-accounts", req.query.id, "proof"] };
  return handler(req, res);
}
