function send(res, status, body) {
  res.status(status).json(body);
}

export default async function handler(req, res) {
  const route = Array.isArray(req.query.route) ? req.query.route : [];
  const path = `/${route.join("/")}`;

  if (req.method === "GET" && path === "/health") {
    return send(res, 200, { ok: true, service: "credora-backend", season: "season-1", deployed: Date.now(), git: "0764df5" });
  }

  if (req.method === "GET" && path === "/status") {
    return send(res, 200, { ok: true, deployed: Date.now() });
  }

  return send(res, 404, { error: "Route not found" });
}
