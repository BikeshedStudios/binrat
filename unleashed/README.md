# BINRAT — Night Desk 01

An isolated full-stack successor for issue #214. Find a recorded Pons trail, inspect its evidence, employ Moxie, and return to a durable local replay receipt.

```sh
# From the repository root. Node 24 recommended; Node >=22.13 required.
node unleashed/server.mjs
# Open http://127.0.0.1:4194
```

The product needs **no dependency installation, API key, provider, wallet, production configuration, build step, or internet connection**. Keep the repository structure: the server imports the existing snapshot validators and pinned evidence from the baseline. It binds only to `127.0.0.1`. Use the printed loopback URL on this machine.

Optional settings: `BINRAT_LOCAL_PORT` (default `4194`), `BINRAT_LOCAL_DB` (absolute path recommended; default `unleashed/.local/night-desk.sqlite`). No `.env` file is loaded. To try a separate empty desk without disturbing any existing memory:

```sh
BINRAT_LOCAL_PORT=4195 BINRAT_LOCAL_DB=/tmp/binrat-owner-playtest.sqlite node unleashed/server.mjs
```

SQLite and its WAL files are ignored by Git. A browser's HttpOnly session cookie selects its desk. Clear cookies and that browser loses access to the old desk; deleting the database erases saved assignments. This local session mechanism is not a production account system.

## Reproduce verification

```sh
node --test unleashed/test/*.test.mjs

# Optional test tools only; product runtime has zero added dependencies.
npm install --prefix unleashed/.local/browser-tools --no-save --no-package-lock --ignore-scripts playwright@1.56.1 axe-core@4.13.0
node unleashed/.local/browser-tools/node_modules/playwright/cli.js install chromium
node unleashed/checks/journey.cjs
node unleashed/checks/hostile.cjs
```

The browser scripts start their own ephemeral loopback server and disposable SQLite database. They leave the owner's preview database untouched. They default to installed Google Chrome, otherwise the pinned Playwright Chromium; override with `CHROME_PATH`. `PLAYWRIGHT_PATH`, `AXE_PATH`, and `BINRAT_SCREENSHOTS` can point to existing native tools and an alternate output directory. Linux environments without Chrome may need the Playwright system dependencies.

Journey proof covers seven widths, persistence, notes edited during updates, saved interest, source/den failures, keyboard focus and reduced motion. The hostile check attacks failed writes, note injection, late responses, receipt tampering and pending cancellation. Reports and screenshots go to `docs/receipts/unleashed-01/`. The initial hostile failure is preserved separately.

## What actually runs

- Historical public-source validation using the inherited digest/checkpoint/status contracts.
- A Node HTTP API and transactional local SQLite assignments, notes, receipts, sessions, and interest drafts.
- A bounded replay worker: five active assignments per browser desk, twenty recorded candidates per run. An interrupted running assignment resumes when the server restarts. Cancellation stops pending work and retains previous receipts and notes.
- Deterministic receipt IDs binding the source capture and examined/matched IDs. Stored receipts must still match the evidence recipe; a changed self-hash is insufficient.
- Downloadable source, replay receipts and local service-interest drafts.

No live watching, collector, model, messaging, payment, purchased capacity, staking, token launch or deployment runs. The original October 9 publication recorded `FRESH_VERIFIED`; the inherited validator correctly marks it `STALE_VERIFIED` today. Coverage is `PARTIAL`; Rat activity is `REPLAY`.

## Architecture

```text
Browser: Discover → Case → Employ → Den → Receipt
                      │       │        │
                      └── same-origin local HTTP API ──┐
                                                      │
Pinned public GETs → inherited source validators → evidence.mjs
                                                      │
                                  store.mjs → SQLite + replay worker
```

`server.mjs` exposes only four read endpoints and bounded mutation routes. It serves the static `public/` directory with a same-origin CSP, rejects other Host headers, and requires same-origin JSON for mutations. It never forwards external requests or inherits production credentials. `evidence.mjs` owns source pinning and replay semantics; `store.mjs` owns sessions, capacity and persistence. `public/app.js` owns navigation and user actions; `public/styles.css` owns the responsive Night Desk.

Stop with Ctrl-C. Rollback is stopping this separate process and leaving this experimental branch unused. No existing application or production resource needs to be rolled back.
