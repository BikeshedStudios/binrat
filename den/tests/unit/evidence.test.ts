import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalSnapshotDigest } from "../../server/canonical.ts";
import { EVIDENCE_ROOT, loadEvidence } from "../../server/evidence.ts";

test("loads six packaged captures and re-verifies every digest", async () => {
  const model = await loadEvidence();
  assert.equal(model.captures.length, 6);
  assert.equal(model.records.length, 120);
  assert.equal(model.launches.length, 91);
  assert.equal(model.summary.recordCount, 120);
  assert.equal(model.summary.launchCount, 91);
  assert.equal(model.summary.rereadEntries, 29);
  assert.equal(model.summary.uniqueDeployers, 84);
  assert.equal(model.summary.crossWindowDeployers, 20);
  assert.equal(model.summary.namedRecords, 0);
  assert.equal(model.summary.allDigestsVerified, true);
  assert.equal(model.summary.coverage, "PARTIAL");
  assert.equal(model.summary.mode, "RECORDED_REPLAY");
  assert.equal(model.manifest.chainId, 4663);
  for (const capture of model.captures) {
    assert.equal(capture.digestVerified, true);
    assert.equal(capture.launches.length, capture.recordCount);
    assert.equal(capture.historyCoverage, "PARTIAL");
  }
});

test("canonical snapshot digest equals the recorded feed digest for every capture", async () => {
  const model = await loadEvidence();
  for (const capture of model.captures) {
    const bytes = await readFile(join(EVIDENCE_ROOT, "snapshots", capture.packaged.file), "utf8");
    const snapshot = JSON.parse(bytes);
    const digest = await canonicalSnapshotDigest(snapshot);
    assert.equal(digest, capture.feedDigest, `${capture.id} digest`);
    assert.equal(digest, snapshot.feedDigest, `${capture.id} recorded digest`);
  }
});

test("rejects a packaged capture whose bytes were tampered with", async () => {
  const temp = await mkdtemp(join(tmpdir(), "den-evidence-"));
  try {
    await cp(EVIDENCE_ROOT, temp, { recursive: true });
    const manifestPath = join(temp, "captures.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    const target = join(temp, "snapshots", manifest.captures[0].packaged.file);
    const snapshot = JSON.parse(await readFile(target, "utf8"));
    snapshot.launches[0].name = "INJECTED NAME";
    await writeFile(target, JSON.stringify(snapshot, null, 2));
    await assert.rejects(() => loadEvidence(temp), /EVIDENCE_INVALID/);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("rejects a capture whose canonical digest no longer matches its feed digest", async () => {
  const temp = await mkdtemp(join(tmpdir(), "den-evidence-"));
  try {
    await cp(EVIDENCE_ROOT, temp, { recursive: true });
    const manifestPath = join(temp, "captures.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    const entry = manifest.captures[0];
    const target = join(temp, "snapshots", entry.packaged.file);
    const snapshot = JSON.parse(await readFile(target, "utf8"));
    snapshot.launches[0].name = "INJECTED NAME";
    const bytes = Buffer.from(`${JSON.stringify(snapshot, null, 2)}\n`);
    await writeFile(target, bytes);
    // Keep the packaged hash honest so the *digest* check is the one that has to catch it.
    const { createHash } = await import("node:crypto");
    entry.packaged.sha256 = createHash("sha256").update(bytes).digest("hex");
    entry.packaged.bytes = bytes.length;
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    await assert.rejects(() => loadEvidence(temp), /EVIDENCE_INVALID/);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("every recorded launch keeps its fact id bound to its launch id", async () => {
  const model = await loadEvidence();
  for (const record of model.records) {
    assert.equal(record.factId, `binrat-fact:4663:${record.launchId}`);
    assert.match(record.deployer, /^0x[0-9a-f]{40}$/);
    assert.match(record.token, /^0x[0-9a-f]{40}$/);
    assert.match(record.txHash, /^0x[0-9a-f]{64}$/);
    assert.ok(BigInt(record.blockNumber) <= BigInt(record.captureCheckpoint));
  }
});

test("the lead record is the first appearance of the address whose count moved most", async () => {
  const { findLead } = await import("../../server/casefile.ts");
  const model = await loadEvidence();
  const lead = findLead(model);
  assert.equal(lead.deployer, "0x0e1651aec67b2a049a4fa6aeb6c1c305aabfc35b");
  assert.equal(lead.captureId, "cap-01");
  assert.equal(lead.blockNumber, "83539339");
  assert.equal(lead.priorLaunchCount, 565);
});
