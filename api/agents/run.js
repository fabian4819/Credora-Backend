import handler from "../[...route].js";

export default function route(req, res) {
  req.query = { ...req.query, route: ["agents", "run"] };
  return handler(req, res);
}
