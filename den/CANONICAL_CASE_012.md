# DEN 01.2 — One canonical historical Case, without rebuilding the source backend

Baseline: `17131a862bd6ed14323f84aa956101091257f694` (DEN 01.1, PR #217). Isolated successor branch only.

- Source: existing `docs/receipts/sprint-a1-2-contract/old-case-envelope.json`, recorded Oct 9, 2026, documented in `docs/BINRAT_SPRINT_A1_2_CASE_CONTRACT.md`.
- Uses **existing** `src/public/caseEvidence.ts` verifier. Case ID, checkpoint/hash, feed digest, version, verified-at and envelope digest are separately pinned; a changed record/source fails closed. No new evidence verification algorithm.
- The Case includes 20 records/19 earlier indexed launches, partial history. Not the Den replay six windows, no extrapolated lifetime count. No LIVE, no autonomous watch, no token capability.
- New additive read-only endpoint `GET /api/canonical-case` and a dedicated `/canonical-case` visual proof. The Den home links to it; all old Pile/Case/Tripwire behavior remains unchanged.
- Run `pnpm check && pnpm test:e2e && pnpm shots` from `den/`; exact-head CI is the acceptance source. Tests include independent source mutation, no-network and desktop/phone journeys.
- No production migration, collector, RPC, real payments, token or signing. The pinned historical proof is **not** a deployed canonical Case API connection.
