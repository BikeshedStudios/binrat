import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, copyFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadEvidence, replayEvidence, sha256 } from "../evidence.mjs";
import { LocalStore } from "../store.mjs";
import { startServer } from "../server.mjs";

const evidence = await loadEvidence(),
  featured = evidence.featuredId;
const temp = () => mkdtemp(join(tmpdir(), "binrat-unleashed-test-"));
async function withStore(fn) {
  const dir = await temp(),
    dbPath = join(dir, "test.sqlite");
  let tick = 1793390400000;
  const store = new LocalStore(dbPath, evidence, () => tick);
  try {
    await fn(
      store,
      () => (tick += 2000),
      dbPath,
      () => tick,
    );
  } finally {
    try {
      store.close();
    } catch {}
    await rm(dir, { recursive: true });
  }
}

test("real pinned publication validates and expires to stale, never fresh-by-age", () => {
  assert.equal(evidence.source.state, "STALE_VERIFIED");
  assert.equal(evidence.source.originalState, "FRESH_VERIFIED");
  assert.equal(evidence.source.coverage, "PARTIAL");
  assert.equal(evidence.source.chainId, 4663);
  assert.equal(evidence.cases.length, 20);
  assert.ok(evidence.cases.every((item) => !item.name && !item.symbol));
  assert.equal(
    evidence.source.feedDigest,
    "7d922050fab3da48fb8a0ee4067f616de91f6441497b506058d07eb294904fe9",
  );
});
test("a changed recorded source fails closed before it can display as evidence", async () => {
  const dir = await temp();
  try {
    for (const name of ["public-feed", "public-status", "transport"])
      await copyFile(
        new URL(
          `../../docs/receipts/sprint-a1-1/${name}.json`,
          import.meta.url,
        ),
        join(dir, name + ".json"),
      );
    await writeFile(join(dir, "public-feed.json"), "{}");
    await assert.rejects(
      loadEvidence({ directory: new URL("file://" + dir + "/") }),
      /PINNED_SOURCE_HASH_MISMATCH/,
    );
  } finally {
    await rm(dir, { recursive: true });
  }
});
test("replay finds only a later recorded launch with the same reported creator", () => {
  const result = replayEvidence(evidence, featured),
    from = evidence.cases.find((item) => item.id === featured);
  assert.equal(result.mode, "REPLAY");
  assert.equal(result.outcome, "MATCH_IN_RECORDING");
  assert.equal(result.matchIds.length, 1);
  const match = evidence.cases.find((item) => item.id === result.matchIds[0]);
  assert.equal(match.creator, from.creator);
  assert.ok(BigInt(match.block) > BigInt(from.block));
  assert.equal(result.notificationState, "LOCAL_RECEIPT_ONLY");
  assert.ok(result.examinedIds.length <= 20);
  const { receiptId, ...material } = result;
  assert.equal(receiptId, "replay:" + sha256(material));
  assert.deepEqual(result, replayEvidence(evidence, featured));
});
test("newest Case is quiet within recording without inventing future events", () => {
  const result = replayEvidence(evidence, evidence.cases[0].id);
  assert.equal(result.outcome, "QUIET_IN_RECORDING");
  assert.deepEqual(result.matchIds, []);
  assert.deepEqual(result.examinedIds, []);
  assert.throws(() => replayEvidence(evidence, "not-a-case"), /CASE_NOT_FOUND/);
});
test("employ is idempotent and enforces five active slots independently per session", async () =>
  withStore((store) => {
    const a = store.session(),
      b = store.session();
    const first = store.create(a, featured, "remember this");
    assert.equal(store.create(a, featured), first);
    for (const item of evidence.cases
      .filter((c) => c.id !== featured)
      .slice(0, 4))
      store.create(a, item.id);
    assert.equal(store.list(a).length, 5);
    assert.throws(
      () => store.create(a, evidence.cases[8].id),
      /CAPACITY_REACHED/,
    );
    assert.ok(store.create(b, featured));
    assert.throws(
      () => store.action(b, first, "cancel"),
      /ASSIGNMENT_NOT_FOUND/,
    );
    store.action(a, first, "cancel");
    assert.ok(store.create(a, evidence.cases[8].id));
  }));
test("session ids supplied by clients never create a chosen identity", async () =>
  withStore((store) => {
    const a = store.session("00000000-0000-4000-8000-000000000000");
    assert.notEqual(a, "00000000-0000-4000-8000-000000000000");
    assert.equal(store.session(a), a);
  }));
test("cancel stops a pending replay; no receipt is manufactured afterward", async () =>
  withStore((store, advance) => {
    const session = store.session(),
      id = store.create(session, featured);
    store.action(session, id, "replay");
    store.action(session, id, "cancel");
    advance();
    store.runDue();
    const job = store.list(session)[0];
    assert.equal(job.status, "CANCELLED");
    assert.equal(job.receipt, null);
    assert.throws(
      () => store.action(session, id, "replay"),
      /ASSIGNMENT_CANCELLED/,
    );
  }));
test("process restart resumes due replay exactly once; rerun preserves deterministic evidence", async () => {
  const dir = await temp(),
    path = join(dir, "restart.sqlite");
  let now = 1000,
    store = new LocalStore(path, evidence, () => now);
  try {
    const session = store.session(),
      id = store.create(session, featured, "restart proof");
    store.action(session, id, "replay");
    store.action(session, id, "replay");
    assert.equal(store.list(session)[0].run, 1);
    store.close();
    now = 4000;
    store = new LocalStore(path, evidence, () => now);
    store.runDue();
    store.runDue();
    let job = store.list(session)[0];
    assert.equal(job.status, "COMPLETE");
    assert.equal(job.note, "restart proof");
    assert.equal(job.run, 1);
    const receiptId = job.receipt.receiptId;
    store.action(session, id, "replay");
    now = 7000;
    store.runDue();
    job = store.list(session)[0];
    assert.equal(job.run, 2);
    assert.equal(job.receipt.receiptId, receiptId);
    store.action(session, id, "cancel");
    assert.equal(store.list(session)[0].receipt.receiptId, receiptId);
  } finally {
    store.close();
    await rm(dir, { recursive: true });
  }
});
test("prepared memory and safe notes persist across database reopen", async () => {
  const dir = await temp(),
    path = join(dir, "notes.sqlite");
  let store = new LocalStore(path, evidence);
  try {
    const session = store.session(),
      id = store.create(session, featured);
    store.action(session, id, "note", "<script>literal note</script>");
    store.close();
    store = new LocalStore(path, evidence);
    const job = store.list(session)[0];
    assert.equal(job.status, "PREPARED");
    assert.equal(job.note, "<script>literal note</script>");
    assert.throws(
      () => store.action(session, id, "note", "x".repeat(501)),
      /NOTE_INVALID/,
    );
  } finally {
    store.close();
    await rm(dir, { recursive: true });
  }
});
test("source loss never prevents cancellation or reading previously saved memory", async () => {
  const dir = await temp(),
    path = join(dir, "missing.sqlite");
  let store = new LocalStore(path, evidence);
  try {
    const session = store.session(),
      id = store.create(session, featured);
    store.action(session, id, "replay");
    store.close();
    store = new LocalStore(path, null);
    store.runDue();
    assert.throws(
      () => store.action(session, id, "replay"),
      /EVIDENCE_UNAVAILABLE/,
    );
    store.action(session, id, "cancel");
    assert.equal(store.list(session)[0].status, "CANCELLED");
  } finally {
    store.close();
    await rm(dir, { recursive: true });
  }
});
test("tampered stored replay cannot become a displayed match, while the Case remains cancelable", async () =>
  withStore((store, advance) => {
    const session = store.session(),
      id = store.create(session, featured);
    store.action(session, id, "replay");
    advance();
    store.runDue();
    const payload = replayEvidence(evidence, featured);
    payload.matchIds = ["f".repeat(64)];
    const { receiptId, ...material } = payload;
    payload.receiptId = "replay:" + sha256(material);
    store.db
      .prepare("UPDATE receipts SET payload=? WHERE assignment_id=?")
      .run(JSON.stringify(payload), id);
    const job = store.list(session)[0];
    assert.equal(job.receipt, null);
    assert.equal(job.receiptError, "RECEIPT_INVALID");
    store.action(session, id, "cancel");
    assert.equal(store.list(session)[0].status, "CANCELLED");
  }));
test("economic wedge stores only bounded local interest, without changing capacity", async () =>
  withStore((store) => {
    const session = store.session();
    for (let i = 0; i < 10; i++) {
      const draft = store.interest(session, "memory", "local draft");
      assert.equal(draft.sent, false);
      assert.equal(draft.state, "LOCAL_DRAFT_ONLY");
    }
    assert.throws(() => store.interest(session, "memory"), /DRAFT_LIMIT/);
    assert.throws(() => store.interest(session, "billing"), /SERVICE_INVALID/);
    assert.equal(store.list(session).length, 0);
  }));

async function withServer(fn, options = {}) {
  const dir = await temp(),
    app = await startServer({
      port: 0,
      dbPath: join(dir, "api.sqlite"),
      ...options,
    });
  try {
    await fn(app);
  } finally {
    await app.close();
    await rm(dir, { recursive: true });
  }
}
test("API requires same-origin JSON and isolates assignments by opaque HttpOnly session", async () =>
  withServer(async (app) => {
    const get = await fetch(app.url + "/api/den"),
      cookie = get.headers.get("set-cookie").split(";")[0];
    assert.match(get.headers.get("set-cookie"), /HttpOnly; SameSite=Strict/);
    const send = (path, body, headers = {}) =>
      fetch(app.url + "/api/" + path, {
        method: "POST",
        headers: {
          origin: app.url,
          "content-type": "application/json",
          cookie,
          ...headers,
        },
        body: JSON.stringify(body),
      });
    assert.equal(
      (
        await send(
          "assignments",
          { caseId: featured },
          { origin: "https://evil.invalid" },
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await send(
          "assignments",
          { caseId: featured },
          { "content-type": "text/plain" },
        )
      ).status,
      403,
    );
    const created = await (
      await send("assignments", { caseId: featured })
    ).json();
    assert.ok(created.id);
    const foreign = await fetch(
      app.url + `/api/assignments/${created.id}/cancel`,
      {
        method: "POST",
        headers: { origin: app.url, "content-type": "application/json" },
        body: "{}",
      },
    );
    assert.equal(foreign.status, 404);
    assert.equal(
      (await fetch(app.url + "/api/source", { method: "DELETE" })).status,
      405,
    );
    const source = await fetch(app.url + "/api/evidence");
    assert.equal((await source.json()).source.state, "STALE_VERIFIED");
    assert.match(
      source.headers.get("content-security-policy"),
      /connect-src 'self'/,
    );
  }));
test("malformed, oversized and unknown requests fail without creating an assignment", async () =>
  withServer(async (app) => {
    const post = (body) =>
      fetch(app.url + "/api/assignments", {
        method: "POST",
        headers: { origin: app.url, "content-type": "application/json" },
        body,
      });
    assert.equal((await post("{")).status, 400);
    assert.equal((await post("null")).status, 400);
    assert.equal(
      (await post(JSON.stringify({ note: "x".repeat(9000) }))).status,
      413,
    );
    assert.equal((await fetch(app.url + "/api/unknown")).status, 404);
    assert.equal((await fetch(app.url + "/.env")).status, 404);
    assert.equal((await fetch(app.url + "/server.mjs")).status, 404);
  }));
test("corrupt or missing source serves explicit UNAVAILABLE and a functioning empty den", async () =>
  withServer(
    async (app) => {
      const response = await fetch(app.url + "/api/evidence");
      assert.equal(response.status, 503);
      assert.equal((await response.json()).state, "UNAVAILABLE");
      assert.equal(
        (await (await fetch(app.url + "/api/den")).json()).assignments.length,
        0,
      );
    },
    {
      evidenceLoader: async () => {
        throw Error("BAD_CAPTURE");
      },
    },
  ));
test("HTTP service restart retains the desk and finishes a due assignment on startup", async () => {
  const dir = await temp(),
    dbPath = join(dir, "service-restart.sqlite");
  let now = 1000,
    app = await startServer({ port: 0, dbPath, now: () => now });
  try {
    const port = app.server.address().port;
    const session = app.store.session(),
      id = app.store.create(session, featured);
    app.store.action(session, id, "replay");
    await app.close();
    now = 4000;
    app = await startServer({ port, dbPath, now: () => now });
    const response = await fetch(app.url + "/api/den", {
      headers: { cookie: "binrat_desk=" + session },
    });
    const job = (await response.json()).assignments[0];
    assert.equal(job.id, id);
    assert.equal(job.status, "COMPLETE");
    assert.equal(job.receipt.notificationState, "LOCAL_RECEIPT_ONLY");
  } finally {
    await app.close();
    await rm(dir, { recursive: true });
  }
});
