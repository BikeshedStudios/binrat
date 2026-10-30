import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalSnapshotDigest, sha256Hex, type SnapshotMaterial } from "./canonical.ts";

const here = dirname(fileURLToPath(import.meta.url));

export const EVIDENCE_ROOT = resolve(here, "..", "evidence");

export type LaunchMetadata = {
  imageUri: string;
  telegram: string;
  twitter: string;
  website: string;
};

export type LaunchRecord = {
  blockNumber: string;
  deployer: string;
  factId: string;
  launchId: string;
  metadata: LaunchMetadata;
  name: string;
  priorLaunchCount: number;
  symbol: string;
  token: string;
  txHash: string;
};

export type CaptureSource = {
  kind: "PUBLIC_GET" | "READ_ONLY_D1";
  origin: string;
  path: string;
  file: string;
  fileSha256: string;
};

export type Capture = {
  id: string;
  checkpoint: string;
  checkpointBlockHash: string;
  feedDigest: string;
  historyCoverage: string;
  recordCount: number;
  state: string;
  readAt: string;
  readAtIso: string;
  status: { state: string | null; verifiedAt: string | null; publicationVersion: number | null; lastSyncError: string | null } | null;
  source: CaptureSource;
  packaged: { file: string; sha256: string; bytes: number };
  digestVerified: boolean;
  note: string;
  launches: LaunchRecord[];
};

export type RecordRow = LaunchRecord & {
  captureId: string;
  captureIndex: number;
  position: number;
  captureReadAt: string;
  captureState: string;
  captureCheckpoint: string;
};

export type EvidenceManifest = {
  schemaVersion: string;
  product: string;
  chainId: number;
  mode: string;
  coverage: string;
  canonicalization: string;
  generatedAt: string;
  sourceWorktree: { path: string; head: string; branch: string; note: string };
  captures: Array<Omit<Capture, "launches">>;
};

export type EvidenceSummary = {
  captureCount: number;
  /** Window entries, duplicates included. */
  recordCount: number;
  /** Distinct launches after de-duplication by launch id. */
  launchCount: number;
  /** Window entries that re-read a launch already seen in an earlier capture. */
  rereadEntries: number;
  uniqueDeployers: number;
  crossWindowDeployers: number;
  blankMetadataRecords: number;
  namedRecords: number;
  firstReadAt: string;
  lastReadAt: string;
  spanHours: number;
  firstCheckpoint: string;
  lastCheckpoint: string;
  checkpointSpan: string;
  allDigestsVerified: boolean;
  coverage: "PARTIAL";
  mode: "RECORDED_REPLAY";
  chainId: 4663;
};

export type EvidenceModel = {
  manifest: EvidenceManifest;
  captures: Capture[];
  /** Every window entry, including the same launch read by more than one capture. */
  records: RecordRow[];
  /** One row per distinct launch: the earliest window that read it. */
  launches: RecordRow[];
  /** All window reads for a launch id, oldest first. */
  observations: Map<string, RecordRow[]>;
  byLaunchId: Map<string, RecordRow>;
  byDeployer: Map<string, RecordRow[]>;
  summary: EvidenceSummary;
};

const ADDRESS = /^0x[0-9a-f]{40}$/;
const HASH = /^0x[0-9a-f]{64}$/;
const ID = /^[0-9a-f]{64}$/;
const DECIMAL = /^(0|[1-9]\d*)$/;

function fail(message: string): never {
  throw new Error(`EVIDENCE_INVALID: ${message}`);
}

function validateLaunch(launch: unknown, checkpoint: string): LaunchRecord {
  if (!launch || typeof launch !== "object") fail("launch is not an object");
  const item = launch as Record<string, unknown>;
  if (typeof item.launchId !== "string" || !ID.test(item.launchId)) fail("launchId");
  if (typeof item.factId !== "string" || item.factId !== `binrat-fact:4663:${item.launchId}`) fail("factId");
  if (typeof item.deployer !== "string" || !ADDRESS.test(item.deployer)) fail("deployer");
  if (typeof item.token !== "string" || !ADDRESS.test(item.token)) fail("token");
  if (typeof item.txHash !== "string" || !HASH.test(item.txHash)) fail("txHash");
  if (typeof item.blockNumber !== "string" || !DECIMAL.test(item.blockNumber)) fail("blockNumber");
  if (BigInt(item.blockNumber) > BigInt(checkpoint)) fail("launch block after checkpoint");
  if (typeof item.name !== "string" || typeof item.symbol !== "string") fail("name/symbol");
  if (!Number.isSafeInteger(item.priorLaunchCount) || (item.priorLaunchCount as number) < 0) fail("priorLaunchCount");
  const metadata = item.metadata as Record<string, unknown> | undefined;
  if (!metadata || typeof metadata !== "object") fail("metadata");
  for (const key of ["imageUri", "website", "twitter", "telegram"] as const) {
    if (typeof metadata[key] !== "string") fail(`metadata.${key}`);
  }
  return {
    blockNumber: item.blockNumber,
    deployer: item.deployer,
    factId: item.factId,
    launchId: item.launchId,
    metadata: {
      imageUri: metadata.imageUri as string,
      telegram: metadata.telegram as string,
      twitter: metadata.twitter as string,
      website: metadata.website as string,
    },
    name: item.name,
    priorLaunchCount: item.priorLaunchCount as number,
    symbol: item.symbol,
    token: item.token,
    txHash: item.txHash,
  };
}

export function metadataFilled(record: LaunchRecord): number {
  return [record.name, record.symbol, record.metadata.website, record.metadata.twitter, record.metadata.telegram, record.metadata.imageUri]
    .filter((value) => typeof value === "string" && value.trim().length > 0).length;
}

/**
 * Loads the packaged captures and re-verifies every one of them against its recorded feedDigest.
 * A single failure makes the whole evidence set unusable: the product then reports UNAVAILABLE
 * rather than showing a partially trusted pile.
 */
export async function loadEvidence(root = EVIDENCE_ROOT): Promise<EvidenceModel> {
  const manifestRaw = await readFile(join(root, "captures.json"), "utf8");
  const manifest = JSON.parse(manifestRaw) as EvidenceManifest;
  if (manifest.chainId !== 4663) fail("chainId must be 4663");
  if (manifest.mode !== "RECORDED_REPLAY") fail("mode must be RECORDED_REPLAY");
  if (!Array.isArray(manifest.captures) || manifest.captures.length === 0) fail("captures missing");

  const captures: Capture[] = [];
  for (const entry of manifest.captures) {
    const packaged = await readFile(join(root, "snapshots", entry.packaged.file));
    const packagedSha = await sha256Hex(packaged);
    if (packagedSha !== entry.packaged.sha256) fail(`${entry.id} packaged hash mismatch`);
    const snapshot = JSON.parse(packaged.toString("utf8")) as SnapshotMaterial & { feedDigest?: string };
    if (typeof snapshot.feedDigest !== "string") fail(`${entry.id} feedDigest missing`);
    if (snapshot.chainId !== 4663) fail(`${entry.id} chainId`);
    if (String(snapshot.sourceCheckpoint) !== entry.checkpoint) fail(`${entry.id} checkpoint`);
    if (snapshot.checkpointBlockHash !== entry.checkpointBlockHash) fail(`${entry.id} checkpoint hash`);
    if (snapshot.historyCoverage !== "PARTIAL") fail(`${entry.id} coverage`);
    if (!Array.isArray(snapshot.launches) || snapshot.launches.length > 20) fail(`${entry.id} launches`);
    const digest = await canonicalSnapshotDigest(snapshot);
    if (digest !== snapshot.feedDigest || digest !== entry.feedDigest) fail(`${entry.id} feed digest`);
    captures.push({
      ...entry,
      launches: snapshot.launches.map((launch) => validateLaunch(launch, entry.checkpoint)),
      readAtIso: new Date(entry.readAt).toISOString(),
      digestVerified: true,
    });
  }

  captures.sort((a, b) => (BigInt(a.checkpoint) < BigInt(b.checkpoint) ? -1 : 1));
  const records: RecordRow[] = [];
  captures.forEach((capture, captureIndex) => {
    capture.launches.forEach((launch, position) => {
      records.push({
        ...launch,
        captureId: capture.id,
        captureIndex,
        position,
        captureReadAt: capture.readAtIso,
        captureState: capture.state,
        captureCheckpoint: capture.checkpoint,
      });
    });
  });

  const observations = new Map<string, RecordRow[]>();
  for (const record of records) {
    const list = observations.get(record.launchId) ?? [];
    list.push(record);
    observations.set(record.launchId, list);
  }
  for (const list of observations.values()) {
    list.sort((a, b) => (BigInt(a.captureCheckpoint) < BigInt(b.captureCheckpoint) ? -1 : 1));
  }
  const launches = [...observations.values()].map((list) => list[0] as RecordRow);
  const byLaunchId = new Map(launches.map((record) => [record.launchId, record]));
  const byDeployer = new Map<string, RecordRow[]>();
  for (const record of records) {
    const list = byDeployer.get(record.deployer) ?? [];
    list.push(record);
    byDeployer.set(record.deployer, list);
  }

  const crossWindow = [...byDeployer.values()].filter(
    (list) => new Set(list.map((item) => item.captureId)).size >= 2,
  ).length;
  const firstCapture = captures[0];
  const lastCapture = captures[captures.length - 1];
  const spanMs = new Date(lastCapture.readAtIso).getTime() - new Date(firstCapture.readAtIso).getTime();
  const named = records.filter((record) => record.name.trim() || record.symbol.trim()).length;

  return {
    manifest,
    captures,
    records,
    launches,
    observations,
    byLaunchId,
    byDeployer,
    summary: {
      captureCount: captures.length,
      recordCount: records.length,
      launchCount: launches.length,
      rereadEntries: records.length - launches.length,
      uniqueDeployers: byDeployer.size,
      crossWindowDeployers: crossWindow,
      blankMetadataRecords: records.length - named,
      namedRecords: named,
      firstReadAt: firstCapture.readAtIso,
      lastReadAt: lastCapture.readAtIso,
      spanHours: Math.round(spanMs / 3_600_000),
      firstCheckpoint: firstCapture.checkpoint,
      lastCheckpoint: lastCapture.checkpoint,
      checkpointSpan: (BigInt(lastCapture.checkpoint) - BigInt(firstCapture.checkpoint)).toString(),
      allDigestsVerified: captures.every((capture) => capture.digestVerified),
      coverage: "PARTIAL",
      mode: "RECORDED_REPLAY",
      chainId: 4663,
    },
  };
}

/** Capture-unique appearances of a reported deployer, oldest first. */
export function appearancesOf(model: EvidenceModel, deployer: string): RecordRow[] {
  return [...(model.byDeployer.get(deployer) ?? [])].sort(
    (a, b) => (BigInt(a.captureCheckpoint) < BigInt(b.captureCheckpoint) ? -1 : 1) ||
      (a.captureId === b.captureId ? a.position - b.position : 0),
  );
}

export type RatHandle = {
  handle: string;
  basis: string;
};

/**
 * A memory aid, not an identity. Handles are deterministic functions of recorded fields and are
 * always shown next to the literal record so nobody mistakes them for a token name.
 */
export function ratHandle(model: EvidenceModel, record: RecordRow): RatHandle {
  const appearances = appearancesOf(model, record.deployer);
  const windows = new Set(appearances.map((item) => item.captureId)).size;
  if (windows >= 4) {
    return { handle: "THE REGULAR", basis: `reported deployer recorded in ${windows} of ${model.captures.length} captures` };
  }
  if (windows >= 2) {
    return { handle: "THE RETURNER", basis: `reported deployer recorded in ${windows} of ${model.captures.length} captures` };
  }
  if (record.priorLaunchCount >= 500) {
    return { handle: "THE LONG RECORD", basis: `recorded prior-launch count ${record.priorLaunchCount}` };
  }
  if (record.priorLaunchCount >= 10) {
    return { handle: "THE HABIT", basis: `recorded prior-launch count ${record.priorLaunchCount}` };
  }
  if (record.priorLaunchCount === 0) {
    return { handle: "FIRST RECORD", basis: "recorded prior-launch count 0" };
  }
  return { handle: "UNNAMED SCRAP", basis: "no name recorded and no repeat window" };
}
