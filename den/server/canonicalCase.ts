import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  verifyCaseEnvelope,
  CASE_EVIDENCE_MAX_BYTES,
  type CaseEnvelope,
} from "../../src/public/caseEvidence.js";

// Historical A1.2 evidence authority: never replace with the current feed or Den's replay captures.
export const PINNED_CASE_ID = "742ed5c2d361c11d5a4da715e35e6c189a9b61ae4a433a937a96111360d7ab01";
export const PINNED_CASE_DIGEST = "c2f0e7658021bc9587c265a3d172f230d4e203cc15b2ebfd24b049e6ed6ac1a3";
export const PINNED_SOURCE_PATH = "docs/receipts/sprint-a1-2-contract/old-case-envelope.json";
export const PINNED_PUBLICATION = {
  chainId: 4663 as const,
  checkpointBlock: "84298735",
  checkpointBlockHash: "0x9bf40ee12ac5aaa781ac3b6b012542612aed0870ca9acb4c4c6d00d1eb97d577",
  feedDigest: "4f139de3514adf3b73203ede9ff2ab34e7d0e8b99c0020b1f4e27decf5e3cf4c",
  publicationVersion: 666,
  verifiedAtMs: 1791563446502,
};
const evidenceFile = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", PINNED_SOURCE_PATH);

export async function verifyPinnedCanonicalEnvelope(value: unknown): Promise<CaseEnvelope> {
  const envelope = await verifyCaseEnvelope(value, PINNED_CASE_ID, PINNED_PUBLICATION);
  if (envelope.digest !== PINNED_CASE_DIGEST) throw new Error("CANONICAL_CASE_PIN_MISMATCH");
  return envelope;
}

export async function loadPinnedCanonicalCase() {
  const bytes = await readFile(evidenceFile);
  if (bytes.byteLength > CASE_EVIDENCE_MAX_BYTES) throw new Error("CANONICAL_CASE_SIZE_INVALID");
  const envelope = await verifyPinnedCanonicalEnvelope(JSON.parse(bytes.toString("utf8")));
  const m = envelope.material;
  const first = m.records[0];
  return {
    mode: "PINNED_HISTORICAL_CAPTURE" as const,
    liveData: false as const,
    watchAvailable: false as const,
    replayAvailable: false as const,
    caseId: m.caseId,
    chainId: m.chainId,
    source: m.source,
    launchBlock: first.launch.blockNumber,
    token: first.launch.token,
    txHash: first.launch.txHash,
    reportedDeployer: first.launch.creator,
    sourceFactId: first.provenance.factId,
    priorIndexedCount: m.priorLaunchCount,
    previous: m.records.slice(1).map((r) => ({
      id: r.launch.launchId,
      block: r.launch.blockNumber,
      sourceFactId: r.provenance.factId,
    })),
    coverage: m.coverage,
    reconstruction: m.reconstruction,
    archivedPublication: m.archivedPublication,
    pointInTimeReplay: m.pointInTimeReplay,
    checkpoint: m.publication,
    digest: envelope.digest,
    verification: "CANONICAL_VALIDATOR_AND_FIXED_CAPTURE_PIN" as const,
    evidenceFile: PINNED_SOURCE_PATH,
    caveat: "Verified consistency with a recorded source, not independent chain proof, complete history or live freshness.",
  };
}
