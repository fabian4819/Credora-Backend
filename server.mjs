import { createServer } from "node:http";
import handler from "./api/[...route].js";

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? "127.0.0.1";

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  if (!chunks.length) return undefined;
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : undefined;
}

const server = createServer(async (nodeReq, nodeRes) => {
  if (!nodeReq.url) {
    nodeRes.writeHead(400, { "content-type": "application/json" });
    nodeRes.end(JSON.stringify({ error: "Missing URL" }));
    return;
  }

  const url = new URL(nodeReq.url, `http://${nodeReq.headers.host ?? `${host}:${port}`}`);
  const routePath =
    url.pathname === "/.well-known/credora-agent.json"
      ? "/discovery"
      : url.pathname.startsWith("/api/")
        ? url.pathname.slice("/api".length)
        : url.pathname;

  const req = {
    method: nodeReq.method,
    query: {
      route: routePath.split("/").filter(Boolean)
    },
    body: await readJsonBody(nodeReq)
  };

  const res = {
    statusCode: 200,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      nodeRes.writeHead(this.statusCode, {
        "content-type": "application/json",
        "access-control-allow-origin": "*"
      });
      nodeRes.end(JSON.stringify(body, null, 2));
    }
  };

  await handler(req, res);
});

server.listen(port, host, () => console.log(`Credora backend listening on http://${host}:${port}`));

