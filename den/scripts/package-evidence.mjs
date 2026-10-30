#!/usr/bin/env node
/**
 * One-off packaging of owner-recorded Pons 4663 public reads into the DEN evidence set.
 *
 * READ-ONLY over the source worktree. Nothing is fetched from the network. Every capture is
 * re-verified here: the packaged bytes must hash to the packaged SHA-256, and the canonical
 * snapshot digest (the same rule as web/snapshot-contract.js) must equal the recorded feedDigest.
 *
 * Usage:
 *   BINRAT_SOURCE_ROOT=/home/swirky/binrat-frontend-rebirth-01 node scripts/package-evidence.mjs
 */
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalSnapshotDigest } from "../server/canonical.ts";

const here = dirname(fileURLToPath(import.meta.url));
const denRoot = resolve(here, "..");
const sourceRoot = process.env.BINRAT_SOURCE_ROOT;
if (!sourceRoot) {
  console.error("BINRAT_SOURCE_ROOT is required (read-only owner worktree)");
  process.exit(2);
}

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const iso = (ms) => new Date(ms).toISOString();

/** Each entry describes exactly how a recorded body is recovered from an owner receipt file. */
const SOURCES = [
  {
    id: "cap-01",
    file: "docs/receipts/pons-runtime-v1/1440x900-api-launches-latest.json",
    selector: "body",
    kind: "PUBLIC_GET",
    origin: "https://binrat-read-plane-stability-candidate.pettevik.workers.dev",
    path: "/api/launches/latest",
    readAt: "2026-10-08T19:00:55.000Z",
    readAtBasis: "http.response.date",
    state: "STALE_VERIFIED",
    statusFile: "docs/receipts/pons-runtime-v1/1440x900-api-status.json",
    verifiedAtMs: 1791485846404,
    note: "Read-plane status at capture was STALE_VERIFIED with lastSyncError SYNC_UNKNOWN_ERROR.",
  },
  {
    id: "cap-02",
    file: "docs/receipts/sprint-a1/public-feed.json",
    selector: "$",
    kind: "PUBLIC_GET",
    origin: "https://binrat.tech",
    path: "/api/launches/latest",
    readAt: "2026-10-09T14:57:42.768Z",
    readAtBasis: "public-status.verifiedAtMs",
    state: "FRESH_VERIFIED",
    statusFile: "docs/receipts/sprint-a1/public-status.json",
    note: "Public feed captured alongside a FRESH_VERIFIED status for the same checkpoint.",
  },
  {
    id: "cap-03",
    file: "docs/receipts/sprint-a1-1/public-feed.json",
    selector: "$",
    kind: "PUBLIC_GET",
    origin: "https://binrat.tech",
    path: "/api/launches/latest",
    readAt: "2026-10-09T15:49:30.694Z",
    readAtBasis: "public-status.verifiedAtMs",
    state: "FRESH_VERIFIED",
    statusFile: "docs/receipts/sprint-a1-1/public-status.json",
    note: "Public feed captured alongside a FRESH_VERIFIED status for the same checkpoint.",
  },
  {
    id: "cap-04",
    file: "docs/receipts/sprint-a1-1/live-summary.json",
    selector: "requests[0].body",
    kind: "PUBLIC_GET",
    origin: "https://binrat.tech",
    path: "/api/launches/latest",
    readAt: "2026-10-09T15:55:44.919Z",
    readAtBasis: "live-summary.requests[0].checkedAt",
    state: "FRESH_VERIFIED",
    statusFile: null,
    statusSelector: "requests[1].body",
    note: "Second public read seconds after a fresh checkpoint; paired status kept FRESH_VERIFIED.",
  },
  {
    id: "cap-05",
    file: "docs/receipts/sprint-a1-1/live-summary.json",
    selector: "requests[2].body",
    kind: "PUBLIC_GET",
    origin: "https://binrat.tech",
    path: "/api/launches/latest",
    readAt: "2026-10-09T15:55:45.881Z",
    readAtBasis: "live-summary.requests[2].checkedAt",
    state: "FRESH_VERIFIED",
    statusFile: null,
    statusSelector: "requests[3].body",
    note: "Latest public read in the replay set; used as the newest public checkpoint.",
  },
  {
    id: "cap-06",
    file: "docs/receipts/sprint-a1-2-contract/production-records.json",
    selector: "snapshotAfter",
    kind: "READ_ONLY_D1",
    origin: "production D1 canonical record (read-only capture)",
    path: "snapshotAfter.snapshot_json",
    readAt: "2026-10-09T16:32:43.477Z",
    readAtBasis: "production-records.checkedAt",
    state: "NOT_RECORDED",
    statusFile: null,
    note: "Direct read-only production D1 capture, not a deployed public endpoint. State was not stored in the receipt.",
  },
];

function pick(value, selector) {
  if (selector === "$") return value;
  return selector
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter(Boolean)
    .reduce((acc, key) => (acc == null ? acc : acc[key]), value);
}

function asBody(value) {
  if (typeof value === "string") return JSON.parse(value);
  if (value && typeof value === "object" && "snapshot_json" in value) {
    return JSON.parse(value.snapshot_json);
  }
  return value;
}

const captures = [];
for (const source of SOURCES) {
  const abs = join(sourceRoot, source.file);
  let raw;
  try {
    raw = await readFile(abs);
  } catch (error) {
    console.error(`MISSING ${source.id} ${abs}: ${error.message}`);
    process.exitCode = 1;
    continue;
  }
  const fileSha = sha256(raw);
  const parsed = JSON.parse(raw.toString("utf8"));
  const picked = asBody(pick(parsed, source.selector));
  const snapshot = {
    chainId: picked.chainId,
    checkpointBlockHash: picked.checkpointBlockHash,
    feedDigest: picked.feedDigest,
    historyCoverage: picked.historyCoverage,
    launches: picked.launches,
    schemaVersion: picked.schemaVersion,
    sourceCheckpoint: picked.sourceCheckpoint,
  };
  const digest = await canonicalSnapshotDigest(snapshot);
  const digestVerified = digest === snapshot.feedDigest;
  let status = null;
  if (source.statusFile) {
    status = JSON.parse(await readFile(join(sourceRoot, source.statusFile), "utf8"));
  } else if (source.statusSelector) {
    status = pick(parsed, source.statusSelector);
  }
  const packaged = `${snapshot.sourceCheckpoint}.json`;
  const packagedBytes = Buffer.from(`${JSON.stringify(snapshot, null, 2)}\n`);
  await mkdir(join(denRoot, "evidence", "snapshots"), { recursive: true });
  await writeFile(join(denRoot, "evidence", "snapshots", packaged), packagedBytes);
  captures.push({
    id: source.id,
    checkpoint: String(snapshot.sourceCheckpoint),
    checkpointBlockHash: snapshot.checkpointBlockHash,
    feedDigest: snapshot.feedDigest,
    historyCoverage: snapshot.historyCoverage,
    recordCount: snapshot.launches.length,
    state: source.state,
    status: status
      ? {
          state: status.state ?? null,
          verifiedAt: typeof status.verifiedAtMs === "number" ? iso(status.verifiedAtMs) : null,
          publicationVersion: status.publicationVersion ?? null,
          lastSyncError: status.lastSyncError ?? null,
        }
      : null,
    readAt: source.readAt,
    readAtBasis: source.readAtBasis,
    source: {
      kind: source.kind,
      origin: source.origin,
      path: source.path,
      selector: source.selector,
      file: source.file,
      fileSha256: fileSha,
    },
    packaged: { file: packaged, sha256: sha256(packagedBytes), bytes: packagedBytes.length },
    digestVerified,
    note: source.note,
  });
  if (!digestVerified) {
    console.error(`DIGEST MISMATCH ${source.id}: recorded ${snapshot.feedDigest} recomputed ${digest}`);
    process.exitCode = 1;
  }
}

captures.sort((a, b) => (BigInt(a.checkpoint) < BigInt(b.checkpoint) ? -1 : 1));
const manifest = {
  schemaVersion: "binrat.den.captures/1",
  product: "BINRAT: THE DEN",
  chainId: 4663,
  mode: "RECORDED_REPLAY",
  coverage: "PARTIAL",
  liveFeed: false,
  networkAtRuntime: false,
  generatedAt: new Date().toISOString(),
  canonicalization:
    "SHA-256 over JSON.stringify of {schemaVersion,chainId,sourceCheckpoint,checkpointBlockHash,historyCoverage,launches} with recursively sorted object keys and no whitespace; array order preserved. Identical to web/snapshot-contract.js in the owner worktree.",
  sourceWorktree: {
    path: sourceRoot,
    head: "30564864f5d406414f0c09c4d2ba2be5d1e79ab8",
    branch: "feat/binrat-frontend-rebirth-011",
    note: "Owner worktree read only; nothing outside den/ was written.",
  },
  captures,
};
await writeFile(
  join(denRoot, "evidence", "captures.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
console.log(
  `packaged ${captures.length} captures, ${captures.reduce((n, c) => n + c.recordCount, 0)} records, all digests verified=${captures.every((c) => c.digestVerified)}`,
);
