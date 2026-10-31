# BINRAT: THE DEN

**THE RAT REMEMBERS.** An isolated, local-first BINRAT successor experiment built for issue
[#214](https://github.com/CipherCuttle/binrat/issues/214). Six packaged Pons 4663 windows, 91
distinct scraps, 120 window reads, zero recorded names — and one address that came back with
1,042 more launches on its record.

**Recorded replay only.** No collector is started, no provider or RPC is called at runtime, nothing
is deployed, nothing is sold, and `$BINRAT` does not exist. Every status on screen is either a
recorded value with a digest, an explicit derivation, or the word UNKNOWN.

---

## Run it

```bash
cd den
pnpm install --ignore-workspace     # den/ is its own workspace root
pnpm dev                            # API :4178 + Vite :5178  → http://127.0.0.1:5178
# or the single-port production-style preview:
pnpm build && pnpm start           # → http://127.0.0.1:4178
```

Requirements: Node ≥ 24 (`node:sqlite`), Chrome/Chromium `playwright-core` for the browser tests.
`pnpm install --ignore-workspace` is required because the parent repository is a pnpm workspace with
its own lockfile; the experiment deliberately does not join it.

Reset local state (pins, runs, receipts, work orders) — stop the preview first, then restart it:

```bash
# Ctrl-C the running preview
pnpm reset
pnpm start
```

## The loop

| Room | Route | What it does |
|---|---|---|
| **THE DEN** | `/` | The lead file the Rat pulled: 565 → 1,607 recorded prior launches on one address. |
| **THE PILE** | `/pile` | 91 scraps, three lenses (SMELLS FAMILIAR / LATEST / LONGEST RECORD), literal search over recorded fields. |
| **A FILE** | `/case/:launchId` | Findings, explicit unknowns, exact receipts, a recomputable case digest, EMPLOY and LEAVE. |
| **THE TRIPWIRE** | `/tripwire` | Pins survive restarts; replay later recorded windows with both digests. |
| **THE FRONT DESK** | `/front-desk` | An interest record for a bounded run. No checkout, no charge, no entitlement. |
| **FIELD MANUAL** | `/manual` | What is live, what is recorded, licences, commands, the receipt rule. |

**FIND → EMPLOY → LEAVE → RETURN**

1. Open a file from the Den or the Pile.
2. *Employ the Rat*: a deterministic local cross-check over all 120 packaged records, four recorded
   steps, one receipt the **browser** re-hashes.
3. *Leave a tripwire*: pins the file's baseline capture in local SQLite.
4. *Return*: replay what later packaged captures recorded. The replay is labelled `RECORDED REPLAY`;
   no alert is claimed, because none is sent.

## What is real, exactly

- Evidence: six owner-recorded captures from `docs/receipts/...` in the BINRAT worktree, packaged
  byte-for-byte with source path, source sha256, capture checkpoint, provenance class
  (`PUBLIC_GET` ×5, `READ_ONLY_D1` ×1) and re-verified feed digests on every boot.
- Cases, findings, digests, replays: deterministic functions of those records (`server/casefile.ts`).
- Pins, runs, receipts, work orders, visits: durable local SQLite (`node:sqlite`) in `den/var/`.
- Product actions: every primary button executes a real local action. No placeholder routes.

Not real, and not claimed: a live feed, alert delivery, Telegram, payments, staking, entitlement,
token, price, identity, intent, safety, profitability, future outcome.

## Evidence integrity

```bash
pnpm verify:evidence
```

This re-hashes each packaged snapshot and recomputes the canonical feed digest (same rule as the
owner's `web/snapshot-contract.js`): SHA-256 over sorted-key JSON of the published fields. A single
mismatch is fatal — the app refuses to boot rather than showing a partially trusted pile.

Receipts are verified twice: the server recomputes them on read, and the browser recomputes them with
WebCrypto behind the **VERIFY IN THIS BROWSER** button. A forged receipt shows `MISMATCH`.

## Tests

```bash
pnpm verify:evidence   # 6 captures, 120 records, digests
pnpm typecheck         # strict TS across server + client
pnpm test              # 27 node:test checks: evidence, cases, store, receipts, full API journey
pnpm test:e2e          # Playwright (system Chrome): desktop + phone journey, restart persistence
pnpm shots             # 37 reproducible screenshots + summary.json in docs/receipts/den-01
```

`pnpm check` runs evidence + typecheck + unit/API tests + build.

## Layout

```
den/
  server/        evidence loader + verifier, case/replay derivation, receipts, SQLite store, API, static server
  src/           React 19 client: Den, Pile, Case, Tripwire, Front Desk, Manual
  evidence/      packaged captures + captures.json manifest (sources, hashes, provenance)
  public/        owner pixel art (documented licences) + four OFL typefaces
  tests/         unit, API and Playwright journey
  scripts/       package/verify evidence, dev runner, screenshots, reset
  docs/receipts/den-01/  committed screenshots + summary.json
  BUILD_REPORT.md, OWNER_PLAYTEST.md, SOURCE_MAP.md, HOSTILE_REVIEW.md
```

Nothing outside `den/` is written by this experiment. No merge, deploy, token, signing, collector or
spend is part of it.

## One historical canonical Case (isolated proof)

Visit `/canonical-case` to inspect the pinned 2026-10-09 production-captured Case. The Den server imports the existing `src/public/caseEvidence.ts` validator. It checks exact Case identity, canonical authority/provenance, fixed publication and material digest, then returns a bounded view. A failure is 503 (no fallback). No runtime network calls, no simulated source and no changes to the six recorded replay captures.

This Case is not watchable, not a live query, and not a claim of complete history. See `den/CANONICAL_CASE_012.md`.
