import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/** This evaluator NEVER authorizes a production mutation or delivery.
 * Caller-supplied captures are observations, not cryptographic attestations.
 */
export function assessTripwireReadiness({ statusCaptures, healthCapture, providerAttestation = null, nowMs = Date.now() }) {
  const checks = [];
  const record = (id, ok, detail) => checks.push({ id, pass: !!ok, detail: String(detail) });
  const observedAt = (capture) => Date.parse(capture?.capturedAt ?? "");
  const recent = (ts, max) => Number.isFinite(ts) && ts <= nowMs + 5000 && nowMs - ts >= 0 && nowMs - ts <= max;
  const hashes = (v) => typeof v === "string" && /^[0-9a-f]{64}$/.test(v);
  const blocks = (v) => typeof v === "string" && /^[0-9]+$/.test(v);
  const two = Array.isArray(statusCaptures) && statusCaptures.length === 2;
  record("TWO_STATUS_CAPTURES", two, two ? "Two independent captures supplied." : "Require two separately recorded /api/status GET responses.");
  if (two) {
    statusCaptures.forEach((capture, index) => {
      const s = capture?.body;
      const captured = observedAt(capture);
      const okSchema = capture?.route === "/api/status" && capture?.httpStatus === 200 &&
        s?.schemaVersion === "binrat.public-status/0.1" && s?.chainId === 4663 &&
        blocks(s?.checkpointBlock) && typeof s?.checkpointBlockHash === "string" &&
        /^0x[0-9a-f]{64}$/.test(s.checkpointBlockHash) && hashes(s.feedDigest) &&
        Number.isSafeInteger(s.publicationVersion) && s.publicationVersion > 0;
      record("STATUS_SCHEMA_" + index, okSchema, okSchema ? "Pons status and publication identity parsed." : "Wrong route, response or publication identity.");
      record("CAPTURE_RECENT_" + index, recent(captured, 120000),
        recent(captured, 120000) ? "Captured within two minutes." : "Capture is missing, in the future or older than two minutes.");
      const fresh = s?.state === "FRESH_VERIFIED" && s?.lastSyncError === null &&
        Number.isSafeInteger(s?.verifiedAtMs) && Number.isSafeInteger(s?.runtimeUpdatedAtMs) &&
        Number.isSafeInteger(s?.freshnessValidUntilMs) &&
        s.verifiedAtMs <= captured && captured - s.verifiedAtMs <= 180000 &&
        s.runtimeUpdatedAtMs <= captured && captured - s.runtimeUpdatedAtMs <= 180000 &&
        s.freshnessValidUntilMs > captured && s.freshnessValidUntilMs > nowMs;
      record("PUBLICATION_FRESH_" + index, fresh, fresh ? "Source remains inside declared freshness fence." : "Stale/unknown publication, runtime or error; no freshness inference.");
    });
    const [a, b] = statusCaptures;
    const t1 = observedAt(a), t2 = observedAt(b);
    const v1 = a?.body?.publicationVersion, v2 = b?.body?.publicationVersion;
    const sameId = v1 === v2 &&
      a?.body?.checkpointBlock === b?.body?.checkpointBlock &&
      a?.body?.checkpointBlockHash === b?.body?.checkpointBlockHash &&
      a?.body?.feedDigest === b?.body?.feedDigest;
    const forward = Number.isSafeInteger(v1) && Number.isSafeInteger(v2) && v2 > v1 &&
      blocks(a?.body?.checkpointBlock) && blocks(b?.body?.checkpointBlock) &&
      BigInt(b.body.checkpointBlock) >= BigInt(a.body.checkpointBlock);
    record("PUBLICATION_SEQUENCE", Number.isFinite(t1) && Number.isFinite(t2) &&
      t2 > t1 && t2 - t1 >= 1000 && (sameId || forward),
      "Separate chronological captures must have identical publication identity or monotonically advance; no rollback.");
  }
  const health = healthCapture?.body;
  record("HEALTH_RECENT", healthCapture?.httpStatus === 200 && healthCapture?.route === "/health" &&
    recent(observedAt(healthCapture), 120000) && health?.ok === true,
    "Require a fresh /health response from the deployed Worker.");
  const sourceBound = health?.release?.sourceBinding === "BOUND" && health?.release?.sourceClean === true &&
    typeof health?.release?.sourceSha === "string" && /^[0-9a-f]{40}$/.test(health.release.sourceSha) &&
    health?.releaseSha === health.release.sourceSha;
  record("RELEASE_SOURCE_BOUND", sourceBound,
    sourceBound ? "Runtime source binding and public source SHA agree." : "Release source not bound to runtime manifest.");
  const independent = providerAttestation && providerAttestation.authenticatedReadOnly === true &&
    recent(Date.parse(providerAttestation.capturedAt ?? ""), 120000) &&
    providerAttestation.workerRevisionId === health?.release?.workerRevisionId &&
    providerAttestation.releaseSha === health?.release?.sourceSha &&
    providerAttestation.readOnly === true && providerAttestation.tripwireEnabled === false &&
    providerAttestation.deliveryEnabled === false;
  record("PROVIDER_READ_ONLY_IDENTITY", independent,
    independent ? "Supplied provider capture is recent and matches runtime; independently verify provider provenance." :
    "No matching recent authenticated provider identity and explicitly disabled Tripwire/delivery flags.");
  record("RECOVERY_SCHEMA_PROVEN",
    providerAttestation?.schemaReadOnlyVerified === true && independent,
    "A separate indexed, read-only D1 schema parity receipt is required; do not infer from CI or a migration file.");
  const blocked = checks.filter(c => !c.pass).map(c => c.id);
  return {
    schemaVersion: "binrat.tripwire-readiness/0.1",
    evaluatedAtMs: nowMs,
    assessment: blocked.length ? "BLOCKED" : "PREFLIGHT_EVIDENCE_COMPLETE",
    blockedReasons: blocked,
    checks,
    productionActivationAuthorized: false,
    telegramDeliveryAuthorized: false,
    collectorAuthorized: false,
    note: "Even complete caller-supplied preflight evidence cannot authorize activation. Real source reliability, cost ceiling, prospectively observed events and explicit owner grant remain separate gates."
  };
}

function json(path) { return JSON.parse(readFileSync(path, "utf8")); }
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const pick = (name) => args.find(x => x.startsWith("--" + name + "="))?.split("=").slice(1).join("=") ?? null;
  const status = [pick("status1"), pick("status2")].map(x => x ? json(x) : null);
  const health = pick("health") ? json(pick("health")) : null;
  const provider = pick("provider") ? json(pick("provider")) : null;
  const now = pick("now") ? Date.parse(pick("now")) : Date.now();
  const report = assessTripwireReadiness({ statusCaptures: status, healthCapture: health, providerAttestation: provider, nowMs: now });
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  process.exitCode = report.assessment === "BLOCKED" ? 2 : 0;
}
