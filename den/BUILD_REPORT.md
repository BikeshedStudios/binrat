# BUILD REPORT — BINRAT: THE DEN

**Isolated successor for issue [#214](https://github.com/CipherCuttle/binrat/issues/214)**
Branch `experiment/binrat-den-01` · base `30564864f5d406414f0c09c4d2ba2be5d1e79ab8`
(`integration/binrat-a1-3-visual-gate`) · built and verified locally · **not merged, not deployed**.

**Verdict: `OWNER_VISUAL_AND_PRODUCT_REVIEW_READY`**

---

## PLAN

1. Bound the archaeology: one baseline (`3056486`), one dirty owner worktree, one approved-but-
   uncommitted Rebirth 01.1 candidate. Nothing was copied out of the candidate; it is preserved.
2. Choose the honest spine before the design: six owner-recorded Pons 4663 captures (120 window
   entries, 91 distinct launches, 0 recorded names, 08–09 OCT 2026) with the digests re-verified.
3. Build one product, not a redesign portfolio: **THE DEN** — a rat noir evidence room with paper
   dossiers, a den camera, a tripwire corkboard and a front desk.
4. Make the magic honest: the Rat's "investigation" is a deterministic local cross-check with a
   receipt the *browser* re-hashes; the return hook is a replay of recorded windows, never an alert.
5. Keep the economic wedge but remove the payment: an interest-only work order, `$0.00`, no checkout.
6. Prove it: evidence verifier, 27 unit/API tests, a Playwright desktop + phone journey that survives
   a server restart, 30 screenshots with overflow/console/a11y receipts, one hostile review.

## CHANGESET

Everything is new, inside one directory, on one branch. No existing file was modified.

```
den/                                     (new)
  package.json, tsconfig.json, vite.config.ts, index.html, assets.json, .gitignore
  server/                                 Node 24 + node:sqlite, no runtime dependencies
    evidence.ts        manifest loader + fail-closed re-verification of all 6 captures
    canonical.ts       SHA-256 over sorted-key JSON (same rule as web/snapshot-contract.js)
    casefile.ts        case summaries, hashes-as-handles, findings, digests, replay, pile lenses
    run.ts             the EMPLOY cross-check (deterministic, zero network)
    receipts.ts        receipt issue / read / re-verify
    store.ts           SQLite: runs, tripwires, replays, receipts, work orders, visits, events
    app.ts             the entire HTTP API, session-scoped, typed errors
    index.ts           static server, SPA fallback, CSP/security headers, local-only binding
  src/                                     React 19 + Vite 7
    pages/Den.tsx      the lead file, den cam, return strip, three doors, the loop, limits
    pages/Pile.tsx     91 scraps, 3 lenses, literal search
    pages/CaseFile.tsx dossier, unknowns, receipts, EMPLOY terminal, tripwire, digest verify
    pages/Tripwire.tsx corkboard pins, recorded replay tape, receipts, drop/restore
    pages/FrontDesk.tsx interest-only work order with a real local ticket and receipt
    pages/Manual.tsx   capabilities, capture provenance table, rules, licences, commands
    ui/                chrome, terminal, receipt verifier, modal/focus trap, toasts, glyphs
    styles/            bone paper + tobacco CRT design system, responsive + reduced motion
  evidence/            captures.json manifest + 6 packaged snapshots (source hashes inside)
  public/assets/       owner pixel art, favicon, four OFL typefaces + licences
  tests/               3 unit files, 1 API journey, 1 Playwright journey
  scripts/             package-evidence, verify-evidence, dev, screenshots, optimize, reset
  docs/receipts/den-01/ 30 screenshots + summary.json (overflow, console, a11y, flows)
  README, SOURCE_MAP, HOSTILE_REVIEW, OWNER_PLAYTEST, BUILD_REPORT
```

Stats: 44 source/evidence files, ~9,400 lines including CSS and tests. Client bundle 270 KB JS
(81 KB gzip) + 47 KB CSS (10 KB gzip); no external runtime requests, no web fonts over the network,
no analytics, no third-party scripts.

### Product decisions that break from the baseline

- **One finding, not a dashboard.** The home page leads with a single recorded movement
  (565 → 1,607 prior launches on one reported address) and two actions. The five-instrument home is
  gone.
- **The file is the navigation unit.** `/case/:launchId` is a paper dossier with findings, explicit
  unknowns and receipts, not a glass card over a wallpaper.
- **Memory is a pin.** The tripwire is a corkboard with a baseline capture and a replay tape that
  distinguishes *new launch*, *same scrap re-read*, and *no later record*.
- **The Rat works for the record, not for the vibe.** Four steps, each naming exactly what it read;
  the run is `PRESENTATION_ONLY` animated and says so.
- **The desk has no till.** "Price: not set" and `paymentTaken: false` in the receipt payload.

### Explicitly not changed

`web/`, `web-v2/`, `src/`, `docs/`, `REBIRTH_01_REPORT.md`, `REBIRTH_011_REPORT.md`,
`DESIGN_SPEC.md`, the dirty owner worktree, all other worktrees, root `package.json` / lockfile,
`.github/workflows/`. No secrets, env files or tokens were read or copied.

## VERIFY

All commands were run in `den/` on this machine, Node v24.20.0.

| Command | Result |
|---|---|
| `pnpm verify:evidence` | `PASS` ×6 · 120 window reads · 91 distinct launches · **ALL CAPTURES VERIFIED** |
| `pnpm typecheck` | clean (strict, server + client) |
| `pnpm test` | **27 pass / 0 fail** (evidence, tamper rejection, case derivation, replay states, store, receipts, full API journey, zero-network proof, error taxonomy, session isolation) |
| `pnpm test:e2e` | **1 pass / 0 fail** — desktop + phone journey: open file → employ → verify receipt in browser → pin → **server restart** → pin survives → replay → verify replay receipt → drop → front desk ticket; 390 px overflow asserted on six routes |
| `pnpm check` | evidence + typecheck + tests + build, clean |
| `pnpm shots` | 30 screenshots; `summary.json`: **0 overflow**, **0 console errors**, **0 a11y issues**, flows `employ:PASS, replay:PASS, work-order:PASS` |
| restart / cancel semantics | server killed and restarted inside the e2e test; pin persists; drop is recorded as `DROPPED` and replay returns `409` |
| no-spend / no-network | API test replaces `globalThis.fetch` with a throwing stub and serves five routes; the CSP allows `connect-src 'self'` only |

Build output: `dist/assets/index-*.js` 270,011 B (81,201 B gzip) · CSS 47,228 B (10,351 B gzip).

### Evidence integrity receipts

| Capture | Checkpoint | Read (UTC) | Provenance | Packaged sha256 |
|---|---|---|---|---|
| cap-01 | 83,541,188 | 08 OCT 19:00 | PUBLIC GET (STALE_VERIFIED) | `0cd9a9d15eae…` |
| cap-02 | 84,243,956 | 09 OCT 14:57 | PUBLIC GET (FRESH_VERIFIED) | `1f5989d9c826…` |
| cap-03 | 84,274,428 | 09 OCT 15:49 | PUBLIC GET (FRESH_VERIFIED) | `3382e3937feb…` |
| cap-04 | 84,277,514 | 09 OCT 15:55 | PUBLIC GET (FRESH_VERIFIED) | `ce757613e2f8…` |
| cap-05 | 84,278,107 | 09 OCT 15:55 | PUBLIC GET (FRESH_VERIFIED) | `beaf641b15db…` |
| cap-06 | 84,298,735 | 09 OCT 16:32 | **READ-ONLY D1 CAPTURE** | `c1e2e0ae240c…` |

Every canonical `feedDigest` was recomputed with the owner's rule and equals the recorded digest and
the manifest. A single mismatch makes the server refuse to boot.

## VISUAL EVIDENCE

Delivered in `docs/receipts/den-01/` (all actual browser captures, no mockups):

- `home-1440x900.png`, `home-1440x900-full.jpg`, `home-1024x768.png`, `home-768x1024.png`,
  `home-430x932.png`, `home-390x844.png`, `home-390x844-full.jpg`, `home-320x800.png`
- `pile-1440x900.png`, `case-1440x900.png` + full, `tripwire-empty-1440x900.png`,
  `front-desk-1440x900.png`, `manual-1440x900.png`
- Mobile equivalents for all six rooms at 390×844
- Journey receipts: `flow-employ-complete-1440x900.png`, `flow-employ-verified-1440x900.png`,
  `flow-tripwire-pinned-1440x900.png`, `flow-replay-1440x900.png`, `flow-work-order-1440x900.png`,
  `flow-den-return-1440x900.png`, `flow-employ-complete-390x844.png`
- e2e outputs: `e2e-home-*`, `e2e-employ-verified-1440x900.png`, `e2e-replay-1440x900.png`,
  `e2e-work-order-1440x900.png`, `e2e-pile-390x844.png`

## WHAT WORKS vs WHAT IS SIMULATED

| Surface | Works today | Simulated / recorded only |
|---|---|---|
| Discovery | 91 real scraps, literal search, three sorts | Coverage is six windows, not the chain |
| File | Real recorded fields, derived findings, recomputable case digest | No independent on-chain re-read |
| Employ the Rat | Deterministic local cross-check + browser-verifiable receipt | Step pacing is presentation; disclosed |
| Tripwire | Durable pins, replay of later recorded windows, receipts, cancel/restore | No delivery, no live watching, no alerts |
| Return | Reopening shows pins, replayability, last replay digest | "While you were away" is a recorded diff |
| Front desk | Local interest record, ticket reference, receipt, queue position | No checkout, price, entitlement or capacity |
| `$BINRAT` | Fail-closed "not launched" everywhere | Token does not exist |

## HOSTILE REVIEW

Full detail in [`HOSTILE_REVIEW.md`](HOSTILE_REVIEW.md). 15 findings fixed, including three that
materially protected truth: the synthetic run `completedAt`, the misleading lead ranking, and the
120-vs-91 re-read inflation. The claims audit found no fabricated metrics, no live/alert claim, no
scam/identity/profit inference, and no payment surface. Residual risks are disclosed (replay-only
evidence, system Chrome for tests, Node ≥ 24, provider-reported counts, bounded sample).

## CI / EXTERNAL-EFFECT SAFETY

- The new branch matches **no** `push` trigger in `.github/workflows/` (deploy jobs are scoped to
  `ops/*`, `feat/binrat-*` branches). Enumerated and checked before pushing.
- A draft PR will run only `ci.yml` (no paths filter) and path-filtered checks that do not match
  `den/**`; none of them deploy, and `ci.yml` does not reference secrets or deployment steps.
- `den/` is not a member of the root pnpm workspace, so root installs and root CI are unaffected.
- No deploy, DNS, Cloudflare, D1, queue, cron, Telegram, wallet, signing, spend or token action was
  performed. One draft PR, marked `EXPERIMENT / NO MERGE / NO DEPLOY`: **#216**.

### Observed workflow behaviour after push (2026-10-30)

| Event | Workflow | Result | Jobs executed |
|---|---|---|---|
| push `experiment/binrat-den-01` | `rat-radar-candidate-deploy.yml` | `failure` in 0 s ("workflow file issue") | **0** — no runner, no steps, no secrets |
| pull_request #216 | `ci.yml` → `check` | **pass** (2m22s) | 1 (build/test only) |
| pull_request #216 | `ci.yml` deploy/browser jobs (`rat-radar-candidate-deploy`, `rat-radar-public-smoke`, `pons-preflight-live-readonly`, `pons-case-runtime-proof`, frontdoor/frontend smoke) | **skipped** | 0 |

The push produced a zero-job phantom run of the branch-scoped deploy workflow; the GitHub API reports
`total_count: 0` jobs for it. Nothing was checked out, no environment was created, and
`CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` were never resolved. On the PR itself every
deployment job is explicitly skipped. No privileged deployment or secret-consuming job can run from
this branch.

## LARGEST REMAINING BLOCKER

**The return hook can never produce new evidence without an owner-authorized collector.** The product
is honest about it, and the replay of later packaged windows is a genuine substitute for a demo — but
a stranger who returns in a month sees the same six windows. Closing that gap needs a reviewed,
budgeted collector and a fresh capture pipeline; it is deliberately out of scope here.

---

**VERDICT: `OWNER_VISUAL_AND_PRODUCT_REVIEW_READY`**
