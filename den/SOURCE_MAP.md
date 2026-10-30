# SOURCE MAP — BINRAT: THE DEN

Read-only archaeology performed before any code was written. Nothing outside `den/` was modified.

## Baseline

| Fact | Value |
|---|---|
| Repository | `CipherCuttle/binrat` (local canonical repo `/home/swirky/binrat`) |
| Product baseline branch | `integration/binrat-a1-3-visual-gate` |
| Baseline commit (`git rev-parse HEAD`) | `30564864f5d406414f0c09c4d2ba2be5d1e79ab8` |
| Baseline relation to remote | `origin/integration/binrat-a1-3-visual-gate` contains it |
| Approved-but-uncommitted candidate | `/home/swirky/binrat-frontend-rebirth-01` on `feat/binrat-frontend-rebirth-011`, HEAD `3056486`, **uncommitted** |
| Experiment clone | `/home/swirky/Documents/deepseek-harness/default-workspace/binrat-den-01` |
| Experiment branch | `experiment/binrat-den-01` (branched from `3056486`) |
| Writes outside `den/` | none |

The owner's dirty worktree was inspected, hashed and left untouched. GitHub `main` was **not** used as
product source: it is the obsolete ArcPad/backend snapshot.

## Dirty inventory at inspection time (owner worktree, preserved)

Modified:

```
M web-v2/checks/check-frontdoor-package.mjs
M web-v2/frontdoor-candidate.html
M web-v2/package.json
M web-v2/src/FrontdoorCandidateApp.tsx
M web-v2/src/PonsCasePreview.tsx
```

Untracked (sha256 prefix shown where hashed):

```
6e1e022aa21ae29c  DESIGN_SPEC.md
67f6a5febb809094  REBIRTH_011_REPORT.md
998eeda9234fd5c7  REBIRTH_01_REPORT.md
15b48756fa683b18  web-v2/checks/serve-rebirth-preview.mjs
705960c3281a5765  web/assets/fonts/PRESSSTART2P-OFL.txt
86c5e9c9382cdcc5  web/assets/fonts/SILKSCREEN-OFL.txt
afec86997fdaf54a  web/assets/fonts/pressstart2p-400.woff2
5741b7f01a127f40  web/assets/fonts/silkscreen-700.woff2
                  docs/receipts/rebirth-01/
                  docs/receipts/rebirth-011/
                  web-v2/src/dumpster/
                  web/assets/dumpster/
```

## Capability read before the build

| Claim in the brief | What the source showed | Label used here |
|---|---|---|
| Pons 4663 launches with blank names | 6 recorded captures, 120 window entries, 91 distinct launches, **0 with a name or symbol** | RECORDED |
| Stale production feed | cap-01 status `STALE_VERIFIED` + `SYNC_UNKNOWN_ERROR`, read 08 OCT 2026 19:00 UTC | STALE AT CAPTURE |
| Cases / receipts / evidence | Contracts exist (`web/snapshot-contract.js`, `src/public/caseEvidence.ts`) but the local `/api/bag/:id/evidence` route needs the full worker + D1; not portable to a zero-spend local run | NOT REUSED |
| Watch / Tripwire delivery | No deployed owner-watch action; Telegram delivery requires tokens and a live service | NOT CONNECTED |
| Replay Lab | Chronology exists in the old Case UI | REPLACED by recorded-window replay |
| Den / Working Rat | `UNAVAILABLE`, `productionEntitlementActive=false`, no staking | NOT INCLUDED |
| `$BINRAT` | `NOT_LAUNCHED` | NOT LAUNCHED |
| Rebirth 01.1 | Visually approved local candidate, uncommitted, undeployed | PRESERVED, not copied into the build |

**Reuse decision.** Reuse *what is data and canon* (recorded public reads, digest rule, rat voice,
product language, evidence vocabulary), not the worker/D1 runtime. Rebuild the runtime as a
zero-dependency local server so the product runs on this machine with no spend and no deployment.

## Copied inputs (byte-exact or documented re-encode)

### Recorded evidence — 6 captures, 120 entries, 91 distinct launches

Every file below is a packaged subset of an owner receipt. The manifest
`den/evidence/captures.json` records source path, source sha256, selector, read timestamp and
`PUBLIC_GET` vs `READ_ONLY_D1` provenance.

| Capture | Checkpoint | Read (UTC) | Source file in owner worktree | Packaged sha256 |
|---|---|---|---|---|
| cap-01 | 83,541,188 | 2026-10-08 19:00 | `docs/receipts/pons-runtime-v1/1440x900-api-launches-latest.json` (`body`) | `0cd9a9d15eae…` |
| cap-02 | 84,243,956 | 2026-10-09 14:57 | `docs/receipts/sprint-a1/public-feed.json` | `1f5989d9c826…` |
| cap-03 | 84,274,428 | 2026-10-09 15:49 | `docs/receipts/sprint-a1-1/public-feed.json` | `3382e3937feb…` |
| cap-04 | 84,277,514 | 2026-10-09 15:55 | `docs/receipts/sprint-a1-1/live-summary.json` (`requests[0].body`) | `ce757613e2f8…` |
| cap-05 | 84,278,107 | 2026-10-09 15:55 | `docs/receipts/sprint-a1-1/live-summary.json` (`requests[2].body`) | `beaf641b15db…` |
| cap-06 | 84,298,735 | 2026-10-09 16:32 | `docs/receipts/sprint-a1-2-contract/production-records.json` (`snapshotAfter`) | `c1e2e0ae240c…` |

`cap-06` is a **direct read-only production D1 record capture**, not a public HTTP read. It is labelled
`READ_ONLY_D1` everywhere it appears and its state is `NOT_RECORDED` because the receipt did not store
one. It is the source of the 1,607 figure at the centre of the lead file; that provenance difference
is exposed in the UI rather than hidden.

All six canonical feed digests were recomputed with the owner's rule
(`web/snapshot-contract.js`: SHA-256 over sorted-key JSON of the published fields) and equal both the
recorded `feedDigest` and the packaged manifest. See `den/scripts/verify-evidence.mjs`.

### Assets

| Asset | Origin | Change | sha256 |
|---|---|---|---|
| `public/assets/art/den-cam.webp` | `web/assets/crew/rat-zero.jpg` | 5:4 crop, WebP q84, 1000×800 | `0ab644089567…` |
| `public/assets/art/tripwire-rat.webp` | `web/assets/crew/tripwire.png` | 900², WebP q82 | `0f3d52fbbefb…` |
| `public/favicon.png` | `web/assets/favicon.png` | none | `cce2f404d991…` |
| Press Start 2P / Silkscreen / Geist Sans / Geist Mono | `web/assets/fonts/*.woff2` | none | see `assets.json` |

Licences: SIL OFL 1.1 for the four typefaces (licence texts shipped in `public/assets/fonts/`), owner
repository art for the pixel illustrations. Nothing was generated by an image model, and no external
stock imagery is used.

## What was deliberately not reused

- The Cloudflare Worker, D1 schema, queue and cron paths — out of scope for a zero-spend local run.
- The signed case envelope endpoint — it needs the production store; a local digest + receipt model is
  used instead and is explicitly *not* claimed to be the production envelope.
- The five-card "instruments" home — replaced with a single lead file, three doors and an explicit
  return mechanism.
- The Telegram rat — voice canon is reused, delivery is not.
