-- Isolated Event-to-Case Recovery Proof 01. Not approved for production D1.
-- Keep undecided candidates recoverable before crossing the forward cursor.
CREATE TABLE IF NOT EXISTS pons_tripwire_event_decisions (
  watch_generation TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  launch_id TEXT NOT NULL,
  block_number INTEGER NOT NULL,
  log_index INTEGER NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('DEFERRED_UNKNOWN','MATCH','NO_MATCH')),
  reason TEXT NOT NULL,
  first_seen_at_ms INTEGER NOT NULL,
  last_evaluated_at_ms INTEGER NOT NULL,
  attempts INTEGER NOT NULL CHECK(attempts BETWEEN 1 AND 2147483647),
  case_receipt_json TEXT,
  case_receipt_digest TEXT,
  PRIMARY KEY(watch_generation,launch_id)
);
CREATE INDEX IF NOT EXISTS idx_pons_tripwire_deferred
  ON pons_tripwire_event_decisions(watch_generation,state,block_number,log_index,launch_id);
