import handler from "./[...route].js";

export default function route(req, res) {
  req.query = { ...req.query, route: ["decisions"] };
  return handler(req, res);
}
