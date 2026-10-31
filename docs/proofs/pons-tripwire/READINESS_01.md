# Tripwire Readiness 01 — external authority and freshness gate

**Parent:** Event-to-Case Recovery Proof 01, #219. **Mode:** deterministic, offline, read-only. No deployment or provider authentication.

## Why
- #219's original focused CI passed 30 tests, but its full root CI failed the `test/cloudflareSchemaParity.test.ts` byte-equivalence gate. A one-newline fix in `src/cloudflare/d1Schema.ts` on parent commit `5c264ff` restored the expected parity; new full CI must verify it.
- The only accessible captured production status and provider identity are dated **2026-10-10**. They prove historic freshness, not freshness on **2026-10-31**.
- Public `https://binrat.tech/api/status`, `/api/health` and `/health` could not be retrieved from this chat's web/runtime. Do not infer that the endpoint is down or healthy from this limitation.
- The current Worker release's `deploymentBinding` is always `REQUIRES_DEPLOYMENT_RECEIPT` by contract, even if its sourceBinding becomes `BOUND`. Actual provider identity must be corroborated independently.
- Production Tripwire flags, migration state, source timestamp coverage, authorized owner and delivery cost cap have not been freshly attested.

## Offline evaluator
`node scripts/verify-pons-tripwire-readiness.mjs --status1=<capture1.json> --status2=<capture2.json> --health=<health.json> [--provider=<attestation.json>]`

The inputs are recorded **read-only GET** wrappers containing `capturedAt`, `route`, `httpStatus`, `body`, matching `docs/proofs/pons-tripwire/status-1.json` and `health.json`. Provide two genuinely separate status reads, 1 second or more apart, from the **same verified deployment origin**, and a fresh `GET /health` from that origin.

The optional operator-produced provider attestation has **nonsecret** fields: `authenticatedReadOnly:true`, `capturedAt`, `workerRevisionId`, `releaseSha`, `readOnly:true`, `tripwireEnabled:false`, `deliveryEnabled:false`, `schemaReadOnlyVerified:true`. Its provenance is not verified by this local evaluator; an owner must independently validate provider authority and query receipts. **Never put OAuth tokens, API keys, private owner IDs or Telegram secrets into tracked files.**

An `assessment:PREFLIGHT_EVIDENCE_COMPLETE` is a **reviewable evidence packet**, NOT permission to activate or send anything. The evaluator always returns `productionActivationAuthorized:false`, `telegramDeliveryAuthorized:false`, `collectorAuthorized:false`.

## Fail-closed conditions
- Incorrect/missing status schema, chain ID, snapshot block/hash/digest, publication version
- Stale, missing, future or duplicate status timestamps, status lag, runtime lag, freshness expiration, any sync error
- Rollback or incompatible publication movement between snapshots
- Missing fresh health/release source binding, missing corroborating provider release identity, missing read-only migration receipt
- Tripwire or delivery flags already enabled without separate explicit owner grant

## Actual next owner authorization gate
One independent, fresh provider-backed status/identity capture with safe source-cost ceiling, the exact recovery schema read-only confirmation, a prospective head timestamp/continuity test, a defined single-owner test duration and zero-output replay mode. **No change to production Worker, D1, RPC or Telegram is authorized here.**

The current result is **BLOCKED** on lack of fresh evidence. Historic green CI, historical FRESH_VERIFIED, and successful simulated tests never substitute for a prospective live event.
