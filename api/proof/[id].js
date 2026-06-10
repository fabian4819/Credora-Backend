import handler from "../[...route].js";

export default function route(req, res) {
  req.query = { ...req.query, route: ["proof", req.query.id] };
  return handler(req, res);
}
