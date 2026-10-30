/**
 * Canonicalization rules shared by the evidence verifier, the case digests and the receipts.
 *
 * The snapshot rule is copied in spirit from the owner's `web/snapshot-contract.js`: SHA-256 over
 * the canonical JSON of the published fields only. A feed digest is never included in its own
 * material, and display adapters are never hashed.
 */

export function canonicalJson(value: unknown): string {
  const normalize = (item: unknown): unknown =>
    Array.isArray(item)
      ? item.map(normalize)
      : item && typeof item === "object"
        ? Object.fromEntries(
            Object.keys(item as Record<string, unknown>)
              .sort()
              .map((key) => [key, normalize((item as Record<string, unknown>)[key])]),
          )
        : item;
  return JSON.stringify(normalize(value));
}

export async function sha256Hex(input: string | Uint8Array): Promise<string> {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export type SnapshotMaterial = {
  schemaVersion: string;
  chainId: number;
  sourceCheckpoint: string;
  checkpointBlockHash: string;
  historyCoverage: string;
  launches: unknown[];
};

export async function canonicalSnapshotDigest(snapshot: SnapshotMaterial): Promise<string> {
  const { schemaVersion, chainId, sourceCheckpoint, checkpointBlockHash, historyCoverage, launches } =
    snapshot;
  return sha256Hex(
    canonicalJson({
      schemaVersion,
      chainId,
      sourceCheckpoint,
      checkpointBlockHash,
      historyCoverage,
      launches,
    }),
  );
}
