import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { loadPonsPreview } from "../web-v2/src/pons-readonly-preview.mjs";
import { canonicalJson } from "../web/snapshot-contract.js";

export const SOURCE_SHA = "30564864f5d406414f0c09c4d2ba2be5d1e79ab8";
export const sha256 = (value) =>
  createHash("sha256")
    .update(typeof value === "string" ? value : canonicalJson(value))
    .digest("hex");
const files = {
  "public-feed":
    "3382e3937feb55c63b80c8266a301d6e273331e1450b3bd1bdd51a3257f786c9",
  "public-status":
    "152673792b5870c1936bf9adbb9b16a8f1d27e7ac54c619e53f0e9d2926b143b",
  transport: "0f78b6d1668895b22dc93e1d19326a7d925015ca7fb332096f2690d2bf140c08",
};

export async function loadEvidence({
  now = Date.now,
  directory = new URL("../docs/receipts/sprint-a1-1/", import.meta.url),
} = {}) {
  const raw = {};
  for (const [name, expected] of Object.entries(files)) {
    const bytes = await readFile(new URL(name + ".json", directory));
    if (createHash("sha256").update(bytes).digest("hex") !== expected)
      throw Error("PINNED_SOURCE_HASH_MISMATCH");
    raw[name] = JSON.parse(bytes);
  }
  // Run the existing source, digest, status, checkpoint and freshness contracts.
  const snapshot = await loadPonsPreview({
    now,
    fetchImpl: async (path) =>
      Response.json(
        raw[path === "/api/status" ? "public-status" : "public-feed"],
      ),
  });
  const cases = snapshot.cases.map((item) => ({
    id: item.id,
    token: item.token,
    name: item.name,
    symbol: item.symbol,
    creator: item.reportedCreatorAddress,
    block: item.block,
    txHash: item.txHash,
    priorLaunches: item.priorLaunches,
    factId: `binrat-fact:4663:${item.id}`,
  }));
  const group = (item) =>
    cases
      .filter((other) => other.creator === item.creator)
      .sort((a, b) => Number(BigInt(a.block) - BigInt(b.block)));
  const featured = cases.find(
    (item) => group(item).length > 1 && group(item)[0].id === item.id,
  );
  return {
    cases,
    featuredId: featured?.id ?? cases[0]?.id ?? null,
    source: {
      mode: "HISTORICAL",
      state: snapshot.freshness,
      coverage: "PARTIAL",
      chainId: 4663,
      checkpoint: snapshot.status.checkpointBlock,
      checkpointHash: snapshot.status.checkpointBlockHash,
      feedDigest: snapshot.status.feedDigest,
      verifiedAt: new Date(snapshot.status.verifiedAtMs).toISOString(),
      capturedAt: raw.transport.requests[0].checkedAt,
      sourceSha: SOURCE_SHA,
      originalState: raw["public-status"].state,
      fileHashes: files,
      limitations: [
        "Twenty recorded launches; older and later launches may be omitted.",
        "Names and symbols are absent in this capture.",
        "A shared reported creator address does not establish a shared person, intent or safety.",
        "No prices, returns, wallet ownership or complete chain history verified.",
      ],
    },
    raw: raw["public-feed"],
    transport: raw.transport,
  };
}

/** Exhaustive over this bounded capture only. Never a live/future-event claim. */
export function replayEvidence(evidence, sourceCaseId) {
  const sourceCase = evidence.cases.find((item) => item.id === sourceCaseId);
  if (!sourceCase) throw Error("CASE_NOT_FOUND");
  const examined = evidence.cases.filter(
    (item) => BigInt(item.block) > BigInt(sourceCase.block),
  );
  const matches = examined
    .filter((item) => item.creator === sourceCase.creator)
    .sort((a, b) => Number(BigInt(a.block) - BigInt(b.block)));
  const material = {
    schemaVersion: "binrat.local-replay/1",
    mode: "REPLAY",
    authority: "PINNED_PUBLIC_SNAPSHOT",
    sourceCaseId,
    startBlock: sourceCase.block,
    endBlock: evidence.source.checkpoint,
    feedDigest: evidence.source.feedDigest,
    checkpointHash: evidence.source.checkpointHash,
    sourceSha: SOURCE_SHA,
    recordedAt: evidence.source.capturedAt,
    candidateLimit: 20,
    examinedIds: examined.map((item) => item.id),
    matchIds: matches.map((item) => item.id),
    outcome: matches.length ? "MATCH_IN_RECORDING" : "QUIET_IN_RECORDING",
    notificationState: "LOCAL_RECEIPT_ONLY",
  };
  return { ...material, receiptId: "replay:" + sha256(material) };
}
