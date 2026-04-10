// Standalone Node entry that wraps the TanStack Start fetch handler.
// Serves built client assets from dist/client/, falls through to the
// fetch handler at dist/server/server.js for everything else.
//
// Pure Node 22 — no external runtime deps. Uses the global Web API
// Request/Response/Headers (Undici) and node:http/node:fs.

import { createServer } from "node:http";
import { createReadStream, statSync } from "node:fs";
import { extname, join, normalize, sep } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

import handler from "./dist/server/server.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const CLIENT_DIR = join(__dirname, "dist", "client") + sep;
const PORT = parseInt(process.env.PORT ?? "3000", 10);
const HOST = process.env.HOSTNAME ?? "0.0.0.0";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/vnd.microsoft.icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".wasm": "application/wasm",
};

/** Serve a built static asset from dist/client/ if one exists. */
function tryServeStatic(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") return false;
  const url = new URL(req.url, "http://_");
  const cleanPath = normalize(url.pathname).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(CLIENT_DIR, cleanPath);
  if (!filePath.startsWith(CLIENT_DIR)) return false;
  let stat;
  try {
    stat = statSync(filePath);
  } catch {
    return false;
  }
  if (!stat.isFile()) return false;

  res.statusCode = 200;
  res.setHeader(
    "Content-Type",
    MIME[extname(filePath).toLowerCase()] ?? "application/octet-stream"
  );
  res.setHeader("Content-Length", String(stat.size));
  // Hashed asset filenames are immutable; long cache for /assets/* paths.
  if (cleanPath.startsWith("/assets/") || cleanPath.startsWith("assets/")) {
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  }

  if (req.method === "HEAD") {
    res.end();
  } else {
    createReadStream(filePath).pipe(res);
  }
  return true;
}

const server = createServer(async (req, res) => {
  try {
    if (tryServeStatic(req, res)) return;

    const url = `http://${req.headers.host ?? "localhost"}${req.url}`;
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (Array.isArray(v)) v.forEach((x) => headers.append(k, x));
      else if (v !== undefined) headers.set(k, String(v));
    }
    const init = { method: req.method, headers };
    if (req.method !== "GET" && req.method !== "HEAD") {
      init.body = Readable.toWeb(req);
      init.duplex = "half";
    }
    const request = new Request(url, init);

    const response = await handler.fetch(request);

    res.statusCode = response.status;
    response.headers.forEach((value, key) => res.setHeader(key, value));
    if (response.body) {
      Readable.fromWeb(response.body).pipe(res);
    } else {
      res.end();
    }
  } catch (err) {
    console.error("[server-node] request error:", err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "text/plain");
      res.end("Internal Server Error");
    } else {
      res.end();
    }
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[server-node] listening on http://${HOST}:${PORT}`);
});
