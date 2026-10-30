# BINRAT UNLEASHED 01 — Night Desk

**Issue #214 · EXPERIMENT / NO MERGE / NO DEPLOY · local product review candidate.**

## PLAN

Build one understandable loop: discover a recorded Pons trail → inspect the Case and its limits → employ Moxie → leave → return to a saved note and exact replay receipt. The acceptance target is a functioning local product on desktop and phone, not a production workforce claim.

Selected code baseline: `30564864f5d406414f0c09c4d2ba2be5d1e79ab8`. Isolated clone: `/home/swirky/DevHub/experiments/binrat-unleashed-01-20261030`; branch `experiment/binrat-unleashed-01-20261030`. Existing worktrees and the approved uncommitted REBIRTH 01.1 candidate were preserved. The remote integration head `160ab9c4fbb2f9cebd4a45cc20f5e75d85f57302` adds documentation only; its updated authority documents were read and reconciled before delivery.

The detailed [source map](SOURCE_MAP.md), [stack decision](unleashed/ADR-001.md), before/after source inventories, asset hashes and workflow review are included. Code and evidence hashes are recorded in `docs/receipts/unleashed-01/`; delivery commit identity is recorded after committing, with runtime hashes bound back to the tested files.

## CHANGESET

| Files | Result |
|---|---|
| `unleashed/public/index.html`, `app.js`, `styles.css` | Responsive Night Desk; one first action; paper Case; exact identifiers and unknowns; native employ dialog; durable den; editable notes; replay receipt; capacity-interest drafts; designed empty/failure states |
| `unleashed/evidence.mjs` | Pins three recorded inputs by file SHA-256, executes inherited digest/status/checkpoint/freshness validators, projects Cases and derives deterministic historical replay receipts |
| `unleashed/store.mjs` | Local SQLite WAL, browser sessions, idempotent admission, five active slots, bounded history/drafts, notes, generation/rerun, atomic completion, restart recovery, cancellation, persisted-receipt integrity checks |
| `unleashed/server.mjs` | Loopback-only HTTP/static server, same-origin CSP and mutation guard, opaque HttpOnly sessions, bounded JSON bodies, explicit unavailable source, recoverable local replay worker; no external forwarding |
| `unleashed/public/assets/` | Byte copies of approved REBIRTH Rat/alley derivatives, self-hosted fonts and retained license texts |
| `unleashed/test/product.test.mjs` | Sixteen substantive evidence/persistence/API/restart/adverse tests |
| `unleashed/checks/journey.cjs`, `hostile.cjs` | Native pinned Playwright journeys, screenshots, accessibility checks, controlled failures, injection/timing/tampering/cancellation attacks |
| `.github/workflows/binrat-unleashed-offline.yml` | Experiment-only offline proof on standard public-repository CI; read-only permissions and no deployment/provider secrets |
| `.gitattributes` | Exempts the byte-preserved upstream Silkscreen license's existing trailing space from whitespace checks; license text remains unchanged |
| `OWNER_PLAYTEST.md`, `unleashed/README.md`, receipts | Exact run commands, owner journey, source provenance, recorded walkthrough, screenshots, hostile review and rollback |

No inherited frontend/backend implementation, configuration, token, vault, launch economics, lockfile or existing workflow was changed. The new runtime requires Node >=22.13 (Node 24 recommended), uses built-in SQLite and needs no added runtime dependency or build step.

## VERIFY

```sh
node unleashed/server.mjs
# http://127.0.0.1:4194 — owner preview restarted on final runtime code

node --test unleashed/test/*.test.mjs
# PASS — 16/16

node unleashed/checks/journey.cjs
# PASS — 7 complete journeys at 1440, 1024, 768, 430, 390, 360, 320 px
# 11 WCAG A/AA page/dialog checks: 0 violations
# No horizontal overflow, broken images, page errors or external product requests

node unleashed/checks/hostile.cjs
# PASS — 5 targeted browser attacks after one High repair

pnpm check
# PASS — build, 586/586 inherited tests, existing web checks

pnpm --dir web-v2 check
# PASS — inherited evidence/visual/build/cutover checks

git diff --check
# PASS
```

Test tools: Playwright **1.56.1**, axe-core **4.13.0**, installed Chrome **156.0.8078.47**, Node **24.20.0**. Browser tests use their own ephemeral server/database and leave the owner's preview database untouched. The product has no runtime package installation. Automated checks prove the tested local scope; human comprehension, preference, retention and willingness to pay remain unmeasured.

The automated walkthrough executes real local actions and records Case/assignment/receipt identifiers in [browser-results.json](docs/receipts/unleashed-01/browser-results.json), with the exact [returned receipt](docs/receipts/unleashed-01/walkthrough-receipt.json). The [owner playtest](OWNER_PLAYTEST.md) follows the same sequence. No video was fabricated; this delivery uses actual screenshots and a machine-recorded action trace.

### Visual evidence

- First view: [1440×900](docs/receipts/unleashed-01/desktop-home.png), [390×844](docs/receipts/unleashed-01/mobile-home.png).
- Evidence file: [desktop](docs/receipts/unleashed-01/desktop-case.png), [phone](docs/receipts/unleashed-01/mobile-case.png), [employ dialog](docs/receipts/unleashed-01/mobile-employ.png).
- Return: [desktop memory](docs/receipts/unleashed-01/desktop-memory.png), [phone memory](docs/receipts/unleashed-01/mobile-memory.png), [expanded receipt](docs/receipts/unleashed-01/mobile-receipt.png).
- Honest edges: [empty den](docs/receipts/unleashed-01/mobile-empty-den.png), [no search result](docs/receipts/unleashed-01/mobile-empty-search.png), [source unavailable](docs/receipts/unleashed-01/mobile-source-unavailable.png), [den unreadable](docs/receipts/unleashed-01/mobile-den-unavailable.png), [invalid receipt](docs/receipts/unleashed-01/mobile-invalid-receipt.png), [capacity interest](docs/receipts/unleashed-01/mobile-capacity.png).

Actual desktop, mobile, Case and returned-memory renders were opened and inspected. The initial phone headline wrapped into six lines and the Case action was too far below the evidence. Both were repaired before acceptance captures. The native editor nodes now survive status updates, preserving drafts and keyboard focus. Earlier `first-*`, `*-first-*` and `mobile-refined.png` captures are development evidence, not the final review images above.

### Comparison with approved REBIRTH 01.1

| Owner criterion | Baseline → successor |
|---|---|
| Comprehension | Five instrument destinations → one first action and a plain memory promise; owner ten-second test pending |
| Task success | Source-backed read-only Case → Case, exact source, note, admitted assignment and result |
| Return hook | Watch marked building → real local save/reopen/cancel and replay worker; still no live watch |
| Truth | Held October 11 snapshot → pinned October 9 capture for reproducible offline use; this is **older evidence**, not a freshness improvement |
| Identity | Approved pixel Rat/city retained → quieter night desk, paper file, named companion and memory pile; owner aesthetic judgment pending |
| Engineering | Existing 586-test foundation retained → zero-install local runtime, transactional memory, source-bound result, additional adverse/browser proof |

The [baseline desktop](docs/receipts/unleashed-01/baseline-desktop.png) and [baseline phone](docs/receipts/unleashed-01/baseline-mobile.png) were copied for review without altering their originals.

### Evidence and activity truth

Source: recorded production public GETs on **2026-10-09**, Pons / Robinhood chain **4663**, checkpoint **84274428**, twenty launches, missing names/symbols, `PARTIAL` coverage. Feed digest:

```text
7d922050fab3da48fb8a0ee4067f616de91f6441497b506058d07eb294904fe9
```

The original status says `FRESH_VERIFIED` at capture time; its window has expired. This runtime computes **STALE_VERIFIED**. Missing, changed or unbound source becomes **UNAVAILABLE**, with no substitute Cases. Recorded address recurrence supports a research lead, not shared identity, intent, scam, safety, price or profit claims.

**Real:** evidence verification, local persistence, bounded replay computation, exact receipt, notes, downloads, cancellation and restart recovery. **Demonstration:** the replay reconstructs already recorded later launches; the short running interval is local UX timing. **Unavailable:** live collecting/watching, future-event detection, Telegram/external delivery, checkout, purchased capacity, staking entitlement and token launch. Proposed $9 capacity is an interest concept, never an order or activation. Current public runtime is **UNKNOWN** and was not contacted by this build.

### CI and external effects

Workflow triggers, job conditions and hashes were inspected before commit/push. Public repository, standard hosted runner, no custom runner, no secret references in the new workflow, no automatic secret/deployment jobs matching this branch. No `pull_request_target` or `workflow_run` exists in the inspected default/candidate set. Existing privileged workflows require other exact branches or manual dispatch. One inherited, inactive Rat Radar workflow has a pre-existing YAML body error; its event header was separately inspected, and this experiment does not repair it. Details: [workflow-safety.json](docs/receipts/unleashed-01/workflow-safety.json).

The only authorized remote writes are the dedicated experiment branch and one draft PR. No merge, production deployment, provider/RPC/model call, collector activation, signing, transaction, payment, purchase, token launch or real message occurred. Standard public GitHub CI/free npm development tools only; **$0 additional spend**.

## HOSTILE REVIEW

One bounded self-review and one targeted rereview. Initial evidence is preserved in [hostile-initial-results.json](docs/receipts/unleashed-01/hostile-initial-results.json); [hostile-results.json](docs/receipts/unleashed-01/hostile-results.json) records the repair result.

- **Critical: 0. High: 1, fixed.** A delayed background GET could redraw an assignment as active after a successful cancellation. Mutation generations and ordered reads now discard obsolete responses. The hostile test forces this response ordering and passes.
- Failed saves keep the dialog open with an error and create no memory. User note markup renders as literal text. A persisted receipt with edited match IDs **and a recomputed self-hash** cannot become a displayed match. Canceling pending work then waiting past its deadline yields no receipt, including after reload.
- Source tampering, identity/capacity scope, body/method limits, unavailable evidence, durable notes, rerun idempotency and service restart are covered by the backend tests. Freshness/coverage/replay labels, phone first-use flow, keyboard behavior, reduced motion and failure states are covered by browser evidence and render inspection.
- Accepted limitation: no newly collected information or real background delivery. This is visible throughout the product. The replay demonstrates the return mechanism; it does not validate real retention or fulfill the founder's live workforce/handoff gates.

Unresolved Critical/High findings: **none**.

## VERDICT

**OWNER_VISUAL_AND_PRODUCT_REVIEW_READY** for this local experiment. The largest remaining product blocker is a qualified fresh source plus separately authorized live watch/delivery. It is not enabled by this candidate.

One next action: complete [OWNER_PLAYTEST.md](OWNER_PLAYTEST.md) on desktop and phone and accept or reject the direction. No merge or deployment follows automatically.
