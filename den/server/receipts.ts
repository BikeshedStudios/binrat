import { canonicalJson, sha256Hex } from "./canonical.ts";
import type { Store } from "./store.ts";

export type Receipt = {
  id: string;
  kind: string;
  issuedAt: string;
  digest: string;
  payload: Record<string, unknown>;
  ref: string | null;
};

export async function issueReceipt(
  store: Store,
  input: { kind: string; sessionId: string | null; ref: string | null; payload: Record<string, unknown>; now: number },
): Promise<Receipt> {
  const payload = input.payload;
  const digest = await sha256Hex(canonicalJson(payload));
  const id = `rcpt_${digest.slice(0, 16)}`;
  const existing = store.getReceipt(id);
  if (!existing) {
    store.insertReceipt({
      id,
      kind: input.kind,
      sessionId: input.sessionId,
      ref: input.ref,
      digest,
      payload: canonicalJson(payload),
      now: input.now,
    });
  }
  return {
    id,
    kind: input.kind,
    issuedAt: new Date(input.now).toISOString(),
    digest,
    payload,
    ref: input.ref,
  };
}

export async function readReceipt(
  store: Store,
  id: string,
): Promise<{ receipt: Receipt; recomputed: string; verified: boolean } | null> {
  const row = store.getReceipt(id);
  if (!row) return null;
  const payload = JSON.parse(row.payload) as Record<string, unknown>;
  const recomputed = await sha256Hex(canonicalJson(payload));
  return {
    receipt: {
      id: row.id,
      kind: row.kind,
      issuedAt: new Date(row.createdAt).toISOString(),
      digest: row.digest,
      payload,
      ref: row.ref,
    },
    recomputed,
    verified: recomputed === row.digest,
  };
}

export const RECEIPT_DIGEST_RULE =
  "Receipt digest: SHA-256 over canonical JSON (recursively sorted keys, no whitespace) of the receipt payload. The browser recomputes the same rule with WebCrypto on the VERIFY button.";
