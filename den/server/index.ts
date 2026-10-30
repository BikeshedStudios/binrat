import { createReadStream } from "node:fs";
import { access, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createDefaultApp } from "./app.ts";
import { loadEvidence } from "./evidence.ts";
import { openStore } from "./store.ts";

const here = dirname(fileURLToPath(import.meta.url));
const denRoot = resolve(here, "..");
const distRoot = join(denRoot, "dist");
const port = Number(process.env.PORT ?? 4178);
const host = process.env.HOST ?? "127.0.0.1";
const dbPath = process.env.DEN_DB ?? join(denRoot, "var", "den.sqlite");

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".ico": "image/x-icon",
};

const SECURITY = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "x-frame-options": "DENY",
  "cross-origin-opener-policy": "same-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "content-security-policy":
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
};

const model = await loadEvidence();
const store = openStore(dbPath);
const app = await createDefaultApp({ model, store });

async function exists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function serveStatic(pathname: string) {
  const safe = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const candidate = join(distRoot, safe);
  if (!candidate.startsWith(distRoot)) return null;
  if (await exists(candidate)) {
    const info = await stat(candidate);
    if (info.isFile()) return candidate;
  }
  const index = join(distRoot, "index.html");
  return (await exists(index)) ? index : null;
}

const server = createServer(async (req, res) => {
  const started = Date.now();
  const url = req.url ?? "/";
  const method = (req.method ?? "GET").toUpperCase();

  if (url.startsWith("/api/")) {
    let body = "";
    if (method !== "GET" && method !== "HEAD") {
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of req) {
        const buffer = Buffer.from(chunk);
        size += buffer.length;
        if (size > 32_768) {
          res.writeHead(413, { ...SECURITY, "content-type": "application/json" });
          res.end(JSON.stringify({ error: { code: "BODY_TOO_LARGE", message: "Request body is too large." } }));
          return;
        }
        chunks.push(buffer);
      }
      body = Buffer.concat(chunks).toString("utf8");
    }
    const result = await app.handle({ method, url, headers: req.headers, body });
    res.writeHead(result.status, { ...SECURITY, ...(result.headers ?? {}) });
    res.end(JSON.stringify(result.body));
    store.log({
      at: Date.now(),
      sessionId: null,
      kind: "http",
      ref: url.split("?")[0],
      detail: `${result.status} ${Date.now() - started}ms`,
    });
    return;
  }

  if (method !== "GET" && method !== "HEAD") {
    res.writeHead(405, { ...SECURITY, "content-type": "text/plain" });
    res.end("Method not allowed");
    return;
  }

  const file = await serveStatic(url.split("?")[0]);
  if (!file) {
    res.writeHead(503, { ...SECURITY, "content-type": "text/plain" });
    res.end("The Den has no built frontend. Run: pnpm build");
    return;
  }
  const ext = extname(file);
  const type = TYPES[ext] ?? "application/octet-stream";
  const cache = file.endsWith("index.html")
    ? "no-store"
    : ext === ".woff2" || ext === ".webp" || ext === ".png"
      ? "public, max-age=31536000, immutable"
      : "public, max-age=300";
  res.writeHead(200, {
    ...SECURITY,
    "content-type": type,
    "cache-control": cache,
  });
  createReadStream(file).pipe(res);
});

server.listen(port, host, () => {
  const summary = model.summary;
  console.log(`BINRAT: THE DEN  ·  recorded replay  ·  ${summary.captureCount} captures / ${summary.recordCount} records`);
  console.log(`  evidence digests re-verified: ${summary.allDigestsVerified}`);
  console.log(`  local preview: http://${host}:${port}`);
  console.log(`  store: ${dbPath}`);
  console.log(`  live collector: NOT RUN · network at runtime: 0 calls · $BINRAT: NOT LAUNCHED`);
});

const shutdown = () => {
  server.close(() => {
    store.close();
    process.exit(0);
  });
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
