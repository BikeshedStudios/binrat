import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createDefaultApp } from "../../server/app.ts";
import { loadEvidence } from "../../server/evidence.ts";
import { openStore } from "../../server/store.ts";
import { PINNED_CASE_ID, PINNED_CASE_DIGEST, PINNED_SOURCE_PATH, verifyPinnedCanonicalEnvelope } from "../../server/canonicalCase.ts";

const sourcePath = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", PINNED_SOURCE_PATH);
const source = JSON.parse(await readFile(sourcePath, "utf8")) as any;

test("one canonical source-backed Case is readable with zero network calls or invented Watch", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (() => { throw new Error("NETWORK_DISALLOWED"); }) as typeof fetch;
  try {
    const app = await createDefaultApp({ model: await loadEvidence(), store: openStore(":memory:") });
    const response = await app.handle({ method: "GET", url: "/api/canonical-case", headers: {} });
    assert.equal(response.status, 200, JSON.stringify(response.body).slice(0, 400));
    const data = response.body as any;
    assert.equal(data.caseId, PINNED_CASE_ID);
    assert.equal(data.digest, PINNED_CASE_DIGEST);
    assert.equal(data.priorIndexedCount, 19);
    assert.equal(data.previous.length, 19);
    assert.equal(data.mode, "PINNED_HISTORICAL_CAPTURE");
    assert.equal(data.liveData, false);
    assert.equal(data.watchAvailable, false);
    assert.equal(data.replayAvailable, false);
    assert.equal(data.coverage.history, "PARTIAL");
    assert.match(data.sourceFactId, /^binrat-fact:4663:/);
    const bad = await app.handle({ method: "GET", url: "/api/canonical-case/unrelated", headers: {} });
    assert.equal(bad.status, 404);
    const post = await app.handle({ method: "POST", url: "/api/canonical-case", headers: {}, body: "{}" });
    assert.equal(post.status, 404);
  } finally { globalThis.fetch = original; }
});

test("canonical source verification rejects changed digest, publication, identity and counts", async () => {
  assert.equal((await verifyPinnedCanonicalEnvelope(source)).digest, PINNED_CASE_DIGEST);
  const mutations: Array<(v: any) => void> = [
    (v) => { v.digest = "0".repeat(64); },
    (v) => { v.material.publication.publicationVersion += 1; },
    (v) => { v.material.caseId = "a".repeat(64); },
    (v) => { v.material.records[0].launch.token = "0x" + "0".repeat(40); },
    (v) => { v.material.priorLaunchCount = 999; },
  ];
  for (const mutate of mutations) {
    const fixture = structuredClone(source);
    mutate(fixture);
    await assert.rejects(verifyPinnedCanonicalEnvelope(fixture), /CASE_EVIDENCE|CANONICAL_CASE/);
  }
});
