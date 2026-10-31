# Event-to-Case Recovery Proof 01

**Source authority:** Pons Tripwire candidate PR #178, commit `216647d214a7df05d1eb48e99d8af27dc4262392`.
**Status:** ISOLATED / DRAFT / NOT ACTIVE. Never a live owner pilot.

## Problem reproduced
In `runPonsTripwireCycle()`, a failed `validatePonsTripwireEvidence()` previously advanced the watch cursor. If provenance later became available, the event was skipped forever. A source point/hash inconsistency was also treated as a definitive no-match.

## Narrow changes
- A new bounded `pons_tripwire_event_decisions` journal records per-watch candidate decisions. Unverified source or Case is `DEFERRED_UNKNOWN`, not `NO_MATCH`.
- Deferral and forward cursor advancement are in one atomic D1 batch, with the existing SQLite invariant guard pattern. If journal capacity is full, fail closed before cursor changes.
- Every healthy cycle reexamines a bounded number of deferred candidates before new forward candidates. No new collector, RPC consumer or scheduler.
- Admitted matches include a read of the existing canonical Case verifier, pinned to the current publication. A compact SHA-256 Case-at-alert receipt binds Watch generation, exact event, source publication, original Case digest and provenance. This hash is **not a digital signature or external attestation**.
- The existing Pons Tripwire outbox and delivery admission remain unchanged. A notification cannot be selected for delivery without the matching durable `MATCH` decision and Case receipt.
- Explicit NO_MATCH for verified historical/pre-consent events. Deferred cases retain original event timestamps when resolved; no fake new event time.
- Hard bounds: max 128 decision records and max 20 unresolved records, max 3 deferred rechecks per Watch per cycle, existing 20 candidates/cycle. On saturation, forward processing halts without skipping work; owner intervention/retention policy is needed later.

## Tests
- Missing provenance -> deferred journal -> SQLite restart -> repair -> exact Case receipt and one outbox event.
- Failed cursor transaction must roll back both cursor and journal.
- Verified pre-consent event must never alert.
- Unrepaired event remains DEFERRED_UNKNOWN on repeat cycles.
- Existing #178 tests must continue passing, including reorgs, cancellation, uncertain transport and queue replay.

## Unproven / excluded
- Production event timing and Pons source coverage are not proven by retrospective fixture.
- Public Case reconstruction is tied to a publication and remains `pointInTimeReplay:false`. The compact alert receipt pins what was admitted, not the entire historical Case envelope.
- No full audit ledger for every coverage interval, no paid SLA, no public multi-user Watch, no new Telegram sends.
- The candidate schema/migration is **not applied** to production. No deployment, flag activation, provider/RPC/model calls, onchain activity, or production writes.
- GitHub CI is the actual build/typecheck/test authority for this remote edit; do not claim passed tests before its exact-head run.
