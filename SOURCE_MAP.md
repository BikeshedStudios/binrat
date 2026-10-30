# UNLEASHED 01 — source and mission lock

PRODUCT_MVP · Issue #214 · $0 additional spend · local experiment only.

User job: inspect a recorded Pons launch, understand an address recurrence without an identity accusation, employ a Rat, leave, and reopen its durable, cancelable replay result.

Hypothesis: one understandable evidence trail with a persistent Rat is a stronger first-use and return experience than five disconnected instruments. Pass: desktop and 390px discovery → evidence → assignment → replay → reopen, exact digest/provenance, restart/cancel tests, screenshots, no unresolved Critical/High review findings. Kill: no source-backed input, original WIP changes, or a required external privileged effect. Budget: zero RPC/model/payment/notification/production calls; bounded public GitHub reads for source/CI review and at most one authorized experiment push/draft PR. Local jobs: five assignments, twenty recorded candidates per run. No live collector.

## Selected baseline

- Separate clone: `/home/swirky/DevHub/experiments/binrat-unleashed-01-20261030`.
- Branch: `experiment/binrat-unleashed-01-20261030`.
- Code baseline: `30564864f5d406414f0c09c4d2ba2be5d1e79ab8`, `integration/binrat-a1-3-visual-gate`. Not GitHub main.
- Approved visual reference: dirty `/home/swirky/binrat-frontend-rebirth-01`, same HEAD. `REBIRTH_011_REPORT.md` read in full; actual desktop/mobile renders inspected. Selected artwork/font copies only. Original SHA/status/file hashes captured **before copying** in `docs/receipts/unleashed-01/source-before.json`.
- Dirty canonical backend: `/home/swirky/DevHub/repos/binrat`, detached `2d507045327bd4269a5c0dd4f2050805488f60ee`; status inventoried, no code/config copied.
- Authority index first read from frozen Genome receipt `.../binrat-rat-genome-001b1a-receipts-20261024T221039Z/sources/local/CANONICAL_AUTHORITY.md`. Founder/Engineering North Star files are absent from selected baseline and frozen input. During draft preparation, remote integration head was verified at `160ab9c4fbb2f9cebd4a45cc20f5e75d85f57302`; all intervening changes are documentation only. Its updated AGENTS, Founder North Star and Engineering Stack North Star were then read and reconciled. No code, evidence, workflow or dependency drift from the selected baseline. Issue #214 explicitly authorizes this isolated successor's stack/UI changes; the scoped decision is recorded in `unleashed/ADR-001.md`. The replay does not satisfy the founder's **live workforce** or genuine specialist-handoff gates. No original instruction/config files changed.

## Reuse and limits

| Module / feature | State for this experiment | Decision |
|---|---|---|
| `web-v2/src/pons-readonly-preview.mjs` | LIMITED, executed locally | Reuse `loadPonsPreview`; recompute canonical feed digest, bind status/checkpoint, downgrade expired freshness |
| `web/snapshot-contract.js`, `web/data-source.js`, `web/read-plane.js` | LIMITED, executed locally | Reuse existing validation rather than invent another evidence schema |
| `docs/receipts/sprint-a1-1/{public-feed,public-status,transport}.json` | STALE_VERIFIED / PARTIAL | Pinned real public GETs captured 2026-10-09, chain 4663; 20 launches; no price, safety, full-history or identity claim |
| Approved dumpster artwork / self-hosted fonts | Existing owner-supplied presentation | Byte copies into new experiment; license texts retained; hashes in asset receipt |
| Owner Tripwire `ponsTripwire.ts` (#178 worktree) | UNKNOWN live, not activated | Inspected bounded five-watch/twenty-candidate, generation/cancel/fail-closed design. Cloudflare/Telegram coupling and stronger chain facts unavailable in pinned feed; **do not** pretend to run that engine. New local SQLite replay adapter implements those bounded semantics at snapshot authority only |
| Local Rat assignments / saved notes / receipts | DEMO/REPLAY, real local persistence | New isolated SQLite service; no remote storage, delivery, collectors or inherited environment/config |
| Public runtime / old reported deployed SHA | UNKNOWN now | Historical source locator only; current production is not exercised or claimed verified |
| Background live alerts / staking / token / checkout | PLANNED or unavailable | Absent from successor execution; proposed service interest saved locally only |

Snapshot truth: source verification and freshness are separate from coverage and activity. `FRESH_VERIFIED`, `STALE_VERIFIED`, `PARTIAL`, `UNAVAILABLE`, and `REPLAY` remain distinct. A replay receipt proves deterministic examination of these recorded rows, never a future/live event or delivered message.

Implementation: `unleashed/server.mjs` + `unleashed/{evidence,store}.mjs`; buildless `unleashed/public/{index.html,app.js,styles.css}`. Keep baseline app/backend untouched. Local API serves verified evidence and stores session-owned jobs, notes and interest drafts. One cohesive Night Desk with Discover, Case, Den, and capacity-interest views.
