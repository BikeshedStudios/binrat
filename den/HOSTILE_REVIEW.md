# HOSTILE REVIEW — BINRAT: THE DEN

One bounded hostile pass, focused on misleading claims, data integrity, first-use comprehension,
state persistence, mobile usability, accessibility and cost/permission boundaries. Critical and High
findings were fixed before the final capture; the table records the defect, the fix and where it is
proven.

## Findings found during the build and fixed

| # | Severity | Finding | Fix | Evidence |
|---|---|---|---|---|
| 1 | **Critical** | The `EMPLOY` run reported a `completedAt` one second after `startedAt` while the computation actually finished in milliseconds. That is a fabricated timestamp. | `completedAt = now`; the animation is disclosed as `PRESENTATION_ONLY` with a paragraph saying the run is computed before the response is sent. | `server/run.ts`, modal text, `pnpm test` step assertions |
| 2 | **Critical** | The lead was chosen by "most windows", so the Den led with a 4-window address whose count moved by 3 — burying the genuinely striking movement (565 → 1,607). | Lead ranking is now recorded-count movement first, windows second, pinned at the address's **first** appearance so it can be replayed forward. | `findLead` + `tests/unit/evidence.test.ts` |
| 3 | **Critical** | 120 window entries were being presented as 120 discoveries; 29 are re-reads of the same launch across overlapping captures. | Deduplicated to **91 distinct scraps / 120 window reads / 29 re-reads**, surfaced in the hero, pile and manual. Replay gained a `REREAD_ONLY` status so a re-sweep is never shown as a new launch. | `evidence.ts`, `buildReplay`, unit tests |
| 4 | **High** | Receipts were readable by any session id (`GET /api/receipts/:id` had no ownership check). | Reads are scoped to the owning session. | `server/app.ts`, journey test |
| 5 | **High** | A reused `EMPLOY` run returned no `steps`, so opening a previously-run file a second time would crash the terminal overlay. | Reuse now returns the stored steps; covered by a test that runs employ twice. | `server/app.ts`, journey test |
| 6 | **High** | The case "movement" was computed from the scrap's own reads, which is empty for the lead (read once), so the 565 → 1,607 block could disappear. | Movement now comes from the reported deployer's recorded appearances, and the UI states the two capture read times. | `CaseFile.tsx`, dossier tests |
| 7 | **High** | 233 px horizontal overflow at 390 px on `/manual` (grid items refusing to shrink around a long unbroken schema token) and on `/` (nowrap footer marquee). | `min-width: 0` on grid children, `overflow-wrap`, marquee mask; the screenshot script and the e2e test both assert `scrollWidth === clientWidth` on every route. | `summary.json` (0 overflow), e2e `noOverflow` |
| 8 | **High** | Ghost buttons placed on the bone-paper dossier inherited light text and were effectively invisible (contrast ≈ 1.2:1). | Paper-scoped ink variants (`.paper .btn--ghost`), verified on the front desk ticket and receipt blocks. | screenshots `flow-work-order-1440x900`, `case-1440x900-full` |
| 9 | **Medium** | The replay-tape legend overlapped the stop labels; block labels collided at narrow widths. | Tape rebuilt as a fixed-height axis with a separate legend; verified at 1440 and 390. | `flow-replay-1440x900` |
| 10 | **Medium** | Stamps on dark backgrounds were invisible because the stamp uses `mix-blend-mode: multiply`. | `stamp--dark` used on dark surfaces (`NO PAYMENT EXISTS`). | `front-desk-390x844` |
| 11 | **Medium** | Five interactive targets were under 24 px high (loop links and footer links). | Minimum target height raised; screenshot audit reports 0. | `summary.json` a11y block |
| 12 | **Medium** | The API test claimed "zero network calls" without proving it. | The test replaces `globalThis.fetch` with a throwing stub and serves five routes. | `tests/api/journey.test.ts` |
| 13 | **Low** | Copy said "1 later record in 1 capture carry…" (grammar). | Fixed with count-aware singular/plural. | dossier tests |
| 14 | **Low** | `cap-06` is a direct read-only D1 capture, not a public HTTP read. Presenting it identically to the five public reads would blur provenance. | Every surface that shows a capture shows `READ_ONLY_D1`; the manual explains it; the case rail shows `SOURCE`; the field manual states the state was not stored. | `/manual`, case rail, manifest |
| 15 | **Low** | The lead card overlapped the camera caption and the composition left a dead column at 1440. | Hero rebuilt as a two-row grid (copy + file, camera spanning), caption moved to a top rail. | `home-1440x900` |

## Claims audit

- No fabricated metrics: `1,042`, `565`, `1,607`, `91`, `120`, `84`, `20` are all computed from the
  packaged records; only a placeholder example string mentions `565`.
- No live/alert/delivery claims: every use of "live" is a negation or an `aria-live` attribute.
- No scam/rug/profit/safety language in findings; the only occurrences are explicit boundary copy
  ("Not a scam verdict…").
- Recurrence is never upgraded to identity, intent or outcome. The dossier prints four unknowns on
  every file, including "Recurrence is not a verdict."
- Absence from the six windows is described as "not absence from the chain", not as innocence.
- `$BINRAT` is `NOT LAUNCHED` in the footer, the Den limits strip and the manual capability table.
- Payments: no checkout, no billing dependency, `paymentTaken: false` in the receipt payload, and the
  desk copy says the price is not set.

## Contrast and accessibility spot checks

Automated contrast tooling misread gradient paper as the page background, so key pairs were checked
by hand instead:

| Pair | Ratio | Verdict |
|---|---|---|
| ink `#241a10` on cream `#f1e3c4` | 13.9:1 | pass |
| muted ink `#6b5a41` on cream | 5.1:1 | pass |
| body `#bdab90` on `#0b0805` | 8.5:1 | pass |
| amber `#ffb04a` on `#0b0805` | 9.3:1 | pass |
| acid `#c4f75f` on `#08120c` | 13.4:1 | pass |
| blood `#ff5347` on `#0b0805` | 5.6:1 | pass (large text/labels only) |

Also verified: one `h1` per page, one `main#main`, every image has `alt`, every button has an
accessible name, Escape closes dialogs, Tab is trapped inside dialogs, focus returns to the trigger,
`aria-live` announces run progress and toasts, `prefers-reduced-motion` removes the reveal animation
and the scanline pulse, and the skip link is the first focusable element.

## Permission and cost boundaries

- No network call at runtime: the browser loads only same-origin files; the server test stubs `fetch`
  and proves the API never reaches for it.
- No collector, no cron, no queue, no RPC, no AI model call, no spend.
- No deployment, DNS, Cloudflare, D1, Telegram or wallet code exists in `den/`.
- No signing, broadcasting, trading or token contract code exists.
- Local SQLite only, under `den/var/`, ignored by git.

## Residual risks (accepted, disclosed)

1. **Recorded replay is not a live feed.** All evidence is 08–09 OCT 2026. A stranger who returns a
   month later gets the same windows. The app says so on every surface; a live experience needs an
   owner-authorized collector.
2. **Playwright depends on a system Chrome** (`/usr/bin/google-chrome` or `PW_CHROME`). No browser is
   downloaded; if Chrome is absent the browser tests fail loudly rather than silently skipping.
3. **`node:sqlite` requires Node ≥ 24.** This is declared in `package.json` engines and in the README;
   older CI images cannot run the server.
4. **The evidence is a bounded sample.** 91 scraps out of a chain of millions. Nothing here can
   describe the chain; it describes six windows, and the manual repeats that.
5. **`priorLaunchCount` is provider-reported.** The product re-verifies the feed digest, not the
   provider's indexing. The dossier states that sentence verbatim.
