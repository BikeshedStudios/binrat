import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { resolve, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEvidence } from "./evidence.mjs";
import { LocalStore } from "./store.mjs";

const here = dirname(fileURLToPath(import.meta.url)),
  publicDir = resolve(here, "public");
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".webp": "image/webp",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};
const errors = {
  CASE_NOT_FOUND: 404,
  ASSIGNMENT_NOT_FOUND: 404,
  CAPACITY_REACHED: 409,
  ASSIGNMENT_CANCELLED: 409,
  HISTORY_LIMIT: 409,
  DRAFT_LIMIT: 409,
  EVIDENCE_UNAVAILABLE: 503,
};

export async function startServer({
  port = Number(process.env.BINRAT_LOCAL_PORT || 4194),
  dbPath = process.env.BINRAT_LOCAL_DB ||
    resolve(here, ".local/night-desk.sqlite"),
  evidenceLoader = loadEvidence,
  now = Date.now,
} = {}) {
  let evidence = null;
  try {
    evidence = await evidenceLoader();
  } catch {
    /* No fixture substitution on corrupt/missing evidence. */
  }
  await mkdir(dirname(dbPath), { recursive: true });
  const store = new LocalStore(dbPath, evidence, now);
  const headers = {
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "content-security-policy":
      "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  };
  const server = createServer(async (req, res) => {
    const send = (status, value, type = "application/json; charset=utf-8") => {
      res.writeHead(status, { ...headers, "content-type": type });
      res.end(
        type.startsWith("application/json") ? JSON.stringify(value) : value,
      );
    };
    try {
      const boundPort = server.address().port;
      const hosts = new Set([
        `127.0.0.1:${boundPort}`,
        `localhost:${boundPort}`,
      ]);
      if (!hosts.has(req.headers.host))
        return send(403, { error: "LOCAL_HOST_REQUIRED" });
      const url = new URL(req.url, "http://" + req.headers.host);
      if (url.pathname.startsWith("/api/")) {
        if (!["GET", "POST"].includes(req.method))
          return send(405, { error: "METHOD_NOT_ALLOWED" });
        if (
          req.method === "POST" &&
          (req.headers.origin !== url.origin ||
            req.headers["content-type"] !== "application/json")
        )
          return send(403, { error: "SAME_ORIGIN_JSON_REQUIRED" });
        const sidMatch = req.headers.cookie?.match(
          /(?:^|;\s*)binrat_desk=([0-9a-f-]{36})(?:;|$)/,
        );
        const session = store.session(sidMatch?.[1]);
        if (session !== sidMatch?.[1])
          res.setHeader(
            "set-cookie",
            `binrat_desk=${session}; HttpOnly; SameSite=Strict; Path=/; Max-Age=31536000`,
          );
        const path = url.pathname;
        if (req.method === "GET") {
          if (path === "/api/evidence")
            return evidence
              ? send(200, {
                  source: evidence.source,
                  cases: evidence.cases,
                  featuredId: evidence.featuredId,
                })
              : send(503, {
                  error: "EVIDENCE_UNAVAILABLE",
                  state: "UNAVAILABLE",
                });
          if (path === "/api/source")
            return evidence
              ? send(200, {
                  source: evidence.source,
                  snapshot: evidence.raw,
                  transport: evidence.transport,
                })
              : send(503, {
                  error: "EVIDENCE_UNAVAILABLE",
                  state: "UNAVAILABLE",
                });
          if (path === "/api/den")
            return send(200, {
              assignments: store.list(session),
              capacity: 5,
              mode: "REPLAY",
              interests: store.interests(session),
            });
          return send(404, { error: "NOT_FOUND" });
        }
        let bytes = 0,
          body = "";
        for await (const chunk of req) {
          bytes += chunk.length;
          if (bytes > 8192) return send(413, { error: "BODY_TOO_LARGE" });
          body += chunk;
        }
        let input;
        try {
          input = JSON.parse(body);
        } catch {
          return send(400, { error: "JSON_INVALID" });
        }
        if (!input || typeof input !== "object" || Array.isArray(input))
          return send(400, { error: "BODY_INVALID" });
        if (path === "/api/assignments") {
          const id = store.create(session, input.caseId, input.note ?? "");
          return send(200, { id, assignments: store.list(session) });
        }
        const match = path.match(
          /^\/api\/assignments\/([0-9a-f-]{36})\/(cancel|replay|note)$/,
        );
        if (match) {
          store.action(session, match[1], match[2], input.note);
          return send(200, { assignments: store.list(session) });
        }
        if (path === "/api/interest")
          return send(
            200,
            store.interest(session, input.service, input.note ?? ""),
          );
        return send(404, { error: "NOT_FOUND" });
      }
      if (req.method !== "GET" && req.method !== "HEAD")
        return send(405, { error: "METHOD_NOT_ALLOWED" });
      const pathname = decodeURIComponent(url.pathname);
      const target =
        pathname === "/"
          ? resolve(publicDir, "index.html")
          : resolve(publicDir, "." + pathname);
      if (!target.startsWith(publicDir + "/") || !types[extname(target)])
        return send(404, { error: "NOT_FOUND" });
      let bytes;
      try {
        bytes = await readFile(target);
      } catch {
        return send(404, { error: "NOT_FOUND" });
      }
      return send(
        200,
        req.method === "HEAD" ? "" : bytes,
        types[extname(target)],
      );
    } catch (error) {
      send(errors[error.message] ?? 400, {
        error:
          errors[error.message] || /INVALID$/.test(error.message)
            ? error.message
            : "LOCAL_REQUEST_FAILED",
      });
    }
  });
  server.requestTimeout = 5000;
  server.headersTimeout = 5000;
  await new Promise((done, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", done);
  });
  store.runDue();
  const timer = setInterval(() => {
    try {
      store.runDue();
    } catch {
      /* Atomic transaction remains recoverable; do not invent completion. */
    }
  }, 250);
  timer.unref();
  const close = async () => {
    clearInterval(timer);
    await new Promise((done) => server.close(done));
    store.close();
  };
  return {
    server,
    store,
    close,
    url: `http://127.0.0.1:${server.address().port}`,
    evidence,
  };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const app = await startServer();
  console.log(
    `BINRAT Night Desk — ${app.url}\nLocal SQLite · recorded Pons evidence · no external service calls\nEvidence: ${app.evidence ? "STALE_VERIFIED / PARTIAL" : "UNAVAILABLE"}`,
  );
  const stop = async () => {
    await app.close();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
