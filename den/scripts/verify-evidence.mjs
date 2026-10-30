#!/usr/bin/env node
/**
 * Standalone evidence check. No server, no network, no trust: re-hash every packaged capture and
 * recompute every feed digest with the same canonicalization the product uses.
 *
 *   pnpm verify:evidence
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalSnapshotDigest } from "../server/canonical.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "evidence");
const manifest = JSON.parse(await readFile(join(root, "captures.json"), "utf8"));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

let failures = 0;
let records = 0;
let launches = 0;
const seen = new Set();
const launchesSeen = new Set();

console.log(`BINRAT: THE DEN · evidence verification`);
console.log(`manifest ${manifest.schemaVersion} · ${manifest.captures.length} captures · mode ${manifest.mode}`);
console.log("");

for (const capture of manifest.captures) {
  const bytes = await readFile(join(root, "snapshots", capture.packaged.file));
  const fileSha = sha256(bytes);
  const snapshot = JSON.parse(bytes.toString("utf8"));
  const digest = await canonicalSnapshotDigest(snapshot);
  const fileOk = fileSha === capture.packaged.sha256;
  const digestOk = digest === snapshot.feedDigest && digest === capture.feedDigest;
  const shapeOk =
    snapshot.chainId === 4663 &&
    String(snapshot.sourceCheckpoint) === capture.checkpoint &&
    snapshot.checkpointBlockHash === capture.checkpointBlockHash &&
    snapshot.historyCoverage === "PARTIAL" &&
    Array.isArray(snapshot.launches) &&
    snapshot.launches.length === capture.recordCount;
  const ok = fileOk && digestOk && shapeOk;
  if (!ok) failures += 1;
  for (const launch of snapshot.launches ?? []) {
    records += 1;
    seen.add(launch.launchId);
    launchesSeen.add(launch.launchId);
  }
  launches = launchesSeen.size;
  console.log(
    `${ok ? "PASS" : "FAIL"} ${capture.id} block ${capture.checkpoint} · ${capture.recordCount} records · ${capture.source.kind}`,
  );
  console.log(`     packaged ${fileSha.slice(0, 16)}… ${fileOk ? "= manifest" : "!= manifest"}`);
  console.log(`     feed     ${digest.slice(0, 16)}… ${digestOk ? "= recorded feedDigest" : "!= recorded feedDigest"}`);
  if (!ok) {
    console.log(`     shape    ${shapeOk ? "ok" : "MISMATCH"}`);
  }
}

console.log("");
console.log(`window reads: ${records}`);
console.log(`distinct launches: ${launches}`);
console.log(`sum of per-capture records: ${manifest.captures.reduce((total, capture) => total + capture.recordCount, 0)}`);
console.log(failures === 0 ? "VERDICT: ALL CAPTURES VERIFIED" : `VERDICT: ${failures} CAPTURE(S) FAILED`);

if (failures > 0) process.exit(1);
