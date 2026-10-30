import assert from "node:assert/strict";
import test from "node:test";
import { issueReceipt, readReceipt } from "../../server/receipts.ts";
import { openStore } from "../../server/store.ts";

test("pinning the same file twice is idempotent", () => {
  const store = openStore(":memory:");
  const first = store.pinTripwire({
    sessionId: "session-aaaa1111",
    caseId: "case-1",
    baselineCaptureId: "cap-01",
    note: "first",
    now: 1_000,
  });
  const second = store.pinTripwire({
    sessionId: "session-aaaa1111",
    caseId: "case-1",
    baselineCaptureId: "cap-01",
    note: "second",
    now: 2_000,
  });
  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(second.tripwire.id, first.tripwire.id);
  assert.equal(store.listTripwires("session-aaaa1111").length, 1);
  store.close();
});

test("dropping keeps the record and pinning again revives it", () => {
  const store = openStore(":memory:");
  const pinned = store.pinTripwire({
    sessionId: "session-bbbb2222",
    caseId: "case-2",
    baselineCaptureId: "cap-02",
    note: "",
    now: 1_000,
  });
  const dropped = store.dropTripwire(pinned.tripwire.id, 2_000);
  assert.equal(dropped?.status, "DROPPED");
  assert.equal(store.listTripwires("session-bbbb2222").length, 1);
  const revived = store.pinTripwire({
    sessionId: "session-bbbb2222",
    caseId: "case-2",
    baselineCaptureId: "cap-03",
    note: "again",
    now: 3_000,
  });
  assert.equal(revived.created, false);
  assert.equal(revived.tripwire.status, "WATCHING");
  assert.equal(revived.tripwire.baselineCaptureId, "cap-03");
  assert.equal(store.countWatching("session-bbbb2222"), 1);
  store.close();
});

test("visit history reports the previous visit without inventing one", () => {
  const store = openStore(":memory:");
  const first = store.recordVisit("session-cccc3333", 1_000);
  assert.equal(first.previousSeen, null);
  const peek = store.peekVisit("session-cccc3333");
  assert.equal(peek?.lastSeen, 1_000);
  const second = store.recordVisit("session-cccc3333", 5_000);
  assert.equal(second.previousSeen, 1_000);
  assert.equal(second.firstSeen, 1_000);
  store.close();
});

test("runs are found per session and case", () => {
  const store = openStore(":memory:");
  const run = store.insertRun({ sessionId: "s1", caseId: "case-a", payload: "{}", now: 1 });
  assert.equal(store.getRun(run.id)?.caseId, "case-a");
  assert.equal(store.findCompletedRun("s1", "case-a")?.id, run.id);
  assert.equal(store.findCompletedRun("s2", "case-a"), null);
  store.close();
});

test("receipts round-trip and verify their own digest", async () => {
  const store = openStore(":memory:");
  const payload = { kind: "TEST", n: 1, nested: { b: 2, a: [3, 2, 1] } };
  const receipt = await issueReceipt(store, {
    kind: "TEST",
    sessionId: "s1",
    ref: "case-a",
    payload,
    now: 1_700_000_000_000,
  });
  assert.match(receipt.digest, /^[0-9a-f]{64}$/);
  const found = await readReceipt(store, receipt.id);
  assert.ok(found);
  assert.equal(found.verified, true);
  assert.equal(found.recomputed, receipt.digest);

  const other = await issueReceipt(store, {
    kind: "TEST",
    sessionId: "s1",
    ref: "case-a",
    payload: { ...payload, n: 2 },
    now: 1_700_000_000_001,
  });
  assert.notEqual(other.digest, receipt.digest);
  assert.equal((await readReceipt(store, "rcpt_missing")) === null, true);
  store.close();
});

test("work orders get sequential local references and never claim payment", () => {
  const store = openStore(":memory:");
  const first = store.insertWorkOrder({ sessionId: "s1", scope: "case-deep-dive", note: "", now: 1 });
  const second = store.insertWorkOrder({ sessionId: "s1", scope: "deployer-trail", note: "x", now: 2 });
  assert.equal(first.reference, "DEN-WO-0001");
  assert.equal(second.reference, "DEN-WO-0002");
  assert.equal(first.status, "INTEREST_RECORDED");
  assert.equal(store.workOrderPosition(), 2);
  assert.equal(store.listWorkOrders("s1").length, 2);
  assert.equal(store.listWorkOrders("someone-else").length, 0);
  store.close();
});
