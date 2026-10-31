import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ROUTES = ["/api/status", "/health", "/api/status"];
export function parseOrigin(raw) {
  if (!raw) throw new Error("EXPLICIT_ORIGIN_REQUIRED");
  const u = new URL(raw);
  if (u.protocol !== "https:" || u.username || u.password || u.pathname !== "/" || u.search || u.hash) {
    throw new Error("HTTPS_ORIGIN_ONLY");
  }
  return u.origin;
}

export async function captureBoundedPublicReadiness({
  origin, fetchImpl = fetch, sleep = (ms) => new Promise(r => setTimeout(r, ms)),
  clock = () => Date.now(),
} = {}) {
  const host = parseOrigin(origin);
  const results = [];
  for (let i = 0; i < ROUTES.length; i++) {
    if (i === 2) await sleep(1250);
    const route = ROUTES[i];
    const response = await fetchImpl(host + route, {
      method: "GET", redirect: "error",
      headers: { "Accept": "application/json", "Cache-Control": "no-cache" },
      signal: AbortSignal.timeout(7000)
    });
    if (!response.ok || response.status !== 200) throw new Error("PUBLIC_READ_HTTP_" + response.status);
    const type = response.headers.get("content-type") ?? "";
    if (!type.includes("application/json")) throw new Error("PUBLIC_READ_NOT_JSON");
    const lengthHeader = Number(response.headers.get("content-length") || "0");
    if (lengthHeader > 65536) throw new Error("PUBLIC_READ_TOO_LARGE");
    const reader = response.body?.getReader();
    if (!reader) throw new Error("PUBLIC_READ_EMPTY");
    const chunks = []; let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 65536) throw new Error("PUBLIC_READ_TOO_LARGE");
        chunks.push(value);
      }
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const body = JSON.parse(new TextDecoder().decode(bytes));
    results.push({ capturedAt: new Date(clock()).toISOString(), route, httpStatus: response.status, body });
  }
  // The origin is tracked locally, but not trusted as an independently attested deployment.
  return { origin: host, status1: results[0], health: results[1], status2: results[2], requests: 3 };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const origin = args.find(x => x.startsWith("--origin="))?.slice(9);
  const out = args.find(x => x.startsWith("--out="))?.slice(6);
  if (!origin || !out) throw new Error("USAGE: --origin=https://verified-worker-host --out=/private/local/directory");
  const result = await captureBoundedPublicReadiness({ origin });
  const folder = resolve(out);
  await mkdir(folder, { recursive: true });
  for (const key of ["status1", "status2", "health"]) {
    await writeFile(resolve(folder, key + ".json"), JSON.stringify(result[key], null, 2) + "\n", { flag: "wx" });
  }
  process.stdout.write(JSON.stringify({ origin: result.origin, requests: result.requests, directory: folder, next: "Run verify-pons-tripwire-readiness.mjs with these three saved capture files; this is NOT activation authority." }) + "\n");
}
