import assert from "node:assert/strict";
import test from "node:test";
import { createDefaultApp } from "../../server/app.ts";
import { loadEvidence } from "../../server/evidence.ts";
import { openStore } from "../../server/store.ts";
import type { DenResponse } from "../../server/app.ts";

const model = await loadEvidence();
let clock = 1_790_000_000_000;
const app = await createDefaultApp({ model, store: openStore(":memory:"), now: () => (clock += 1000) });
const SESSION = { "x-den-session": "journey-session-01" };

async function call(method: string, url: string, body?: unknown, headers: Record<string, string> = SESSION): Promise<DenResponse> {
  return app.handle({
    method,
    url,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

test("the whole FIND → EMPLOY → LEAVE → RETURN loop works over HTTP-shaped requests", async () => {
  const den = await call("GET", "/api/den");
  assert.equal(den.status, 200);
  const denBody = den.body as any;
  assert.equal(denBody.mode, "RECORDED_REPLAY");
  assert.equal(denBody.lead.handle, "THE RETURNER");
  assert.equal(denBody.lead.priorLaunchCount, 565);
  assert.equal(denBody.lead.movement.delta, 1042);
  assert.match(denBody.lead.dossierHeadline, /came back/i);
  const leadId = denBody.lead.caseId as string;

  const pile = await call("GET", "/api/pile?lens=scent");
  assert.equal(pile.status, 200);
  const pileBody = pile.body as any;
  assert.equal(pileBody.total, 91);
  assert.equal(pileBody.rows[0].caseId, leadId);

  const pileSearch = await call("GET", "/api/pile?lens=fresh&q=83539339");
  const searchBody = pileSearch.body as any;
  assert.equal(searchBody.matched, 1);

  const file = await call("GET", `/api/case/${leadId}`);
  assert.equal(file.status, 200);
  const fileBody = file.body as any;
  assert.equal(fileBody.dossier.findings.length >= 5, true);
  assert.equal(fileBody.capture.digestVerified, true);
  assert.match(fileBody.dossier.digest.digest, /^[0-9a-f]{64}$/);
  assert.equal(fileBody.replay.status, "RECORDED_AGAIN");

  const employ = await call("POST", `/api/case/${leadId}/employ`, {});
  assert.equal(employ.status, 201);
  const employBody = employ.body as any;
  assert.equal(employBody.steps.length, 4);
  assert.equal(employBody.run.status, "COMPLETE");
  assert.equal(employBody.run.pacing, "PRESENTATION_ONLY");
  assert.equal(employBody.run.scan.recordsScanned, 120);
  assert.match(employBody.receipt.digest, /^[0-9a-f]{64}$/);

  const ownRun = await call("GET", `/api/runs/${employBody.run.id}`);
  assert.equal(ownRun.status, 200);
  assert.equal((ownRun.body as any).run.status, "COMPLETE");
  const otherRun = await call("GET", `/api/runs/${employBody.run.id}`, undefined, { "x-den-session": "other-session-99" });
  assert.equal(otherRun.status, 404);
  assert.equal((otherRun.body as any).error.code, "RUN_NOT_FOUND");
  const anonymousRun = await call("GET", `/api/runs/${employBody.run.id}`, undefined, {});
  assert.equal(anonymousRun.status, 400);
  assert.equal((anonymousRun.body as any).error.code, "SESSION_REQUIRED");

  const receipt = await call("GET", `/api/receipts/${employBody.receipt.id}`);
  const receiptBody = receipt.body as any;
  assert.equal(receiptBody.verified, true);
  assert.equal(receiptBody.receipt.payload.networkCalls, 0);

  const reuse = await call("POST", `/api/case/${leadId}/employ`, {});
  assert.equal(reuse.status, 200);
  assert.equal((reuse.body as any).reused, true);

  const fresh = await call("POST", `/api/case/${leadId}/employ`, { fresh: true });
  assert.equal(fresh.status, 201);
  assert.notEqual((fresh.body as any).receipt.id, employBody.receipt.id);

  const pin = await call("POST", `/api/case/${leadId}/watch`, { note: "the address that came back" });
  assert.equal(pin.status, 201);
  const pinBody = pin.body as any;
  assert.equal(pinBody.tripwire.status, "WATCHING");
  assert.equal(pinBody.tripwire.replay.status, "RECORDED_AGAIN");
  assert.equal(pinBody.tripwire.replay.baseline.priorLaunchCount, 565);

  const repin = await call("POST", `/api/case/${leadId}/watch`, { note: "again" });
  assert.equal(repin.status, 200);
  assert.equal((repin.body as any).created, false);

  const list = await call("GET", "/api/tripwires");
  assert.equal((list.body as any).tripwires.length, 1);

  const replay = await call("POST", `/api/tripwires/${pinBody.tripwire.id}/replay`);
  assert.equal(replay.status, 201);
  const replayBody = replay.body as any;
  assert.equal(replayBody.replay.delta.priorLaunchCount, 1042);
  assert.equal(replayBody.replay.honestNote.includes("No collector ran"), true);
  assert.equal(replayBody.receipt.payload.alertDelivered, false);
  const replayReceipt = await call("GET", `/api/receipts/${replayBody.receipt.id}`);
  assert.equal((replayReceipt.body as any).verified, true);

  const order = await call("POST", "/api/work-orders", { scope: "deployer-trail", note: "where did it go" });
  assert.equal(order.status, 201);
  const orderBody = order.body as any;
  assert.equal(orderBody.paymentTaken, false);
  assert.equal(orderBody.receipt.payload.checkoutExists, false);
  assert.equal(orderBody.receipt.payload.paymentTaken, false);
  assert.match(orderBody.order.reference, /^DEN-WO-\d{4}$/);

  const method = await call("GET", "/api/method");
  const methodBody = method.body as any;
  assert.equal(methodBody.captures.length, 6);
  assert.equal(methodBody.capabilities.find((entry: any) => entry.name === "Live collector").state, "NOT RUN");
  assert.equal(methodBody.capabilities.find((entry: any) => entry.name === "$BINRAT").state, "NOT LAUNCHED");
  assert.ok(methodBody.boundaries.length >= 6);
  assert.equal(methodBody.assets.length, 7);
  assert.deepEqual(
    methodBody.assets.map((asset: any) => asset.id).sort(),
    ["den-cam", "favicon", "geist-mono", "geist-sans", "press-start", "silkscreen", "tripwire-rat"],
  );

  const visit = await call("POST", "/api/visit");
  assert.equal(visit.status, 200);
  const second = await call("POST", "/api/visit");
  assert.equal((visit.body as any).firstVisit, true);
  assert.equal((second.body as any).firstVisit, false);
  assert.ok((second.body as any).previousSeenAt);

  const drop = await call("DELETE", `/api/tripwires/${pinBody.tripwire.id}`);
  assert.equal((drop.body as any).tripwire.status, "DROPPED");
  const replayDropped = await call("POST", `/api/tripwires/${pinBody.tripwire.id}/replay`);
  assert.equal(replayDropped.status, 409);
});

test("the api makes no network call while serving a whole journey", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (() => {
    throw new Error("NETWORK_CALL_ATTEMPTED");
  }) as typeof fetch;
  try {
    const local = await createDefaultApp({ model, store: openStore(":memory:") });
    for (const url of ["/api/health", "/api/den", "/api/pile", "/api/method", `/api/case/${model.launches[0].launchId}`]) {
      const response = await local.handle({ method: "GET", url, headers: SESSION });
      assert.equal(response.status, 200, url);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("errors are typed and do not leak internals", async () => {
  const missing = await call("GET", "/api/case/not-a-case");
  assert.equal(missing.status, 404);
  assert.equal((missing.body as any).error.code, "CASE_NOT_FOUND");

  const noSession = await call("POST", "/api/visit", {}, {});
  assert.equal(noSession.status, 400);
  assert.equal((noSession.body as any).error.code, "SESSION_REQUIRED");

  const badSession = await call("GET", "/api/den", undefined, { "x-den-session": "!!" });
  assert.equal(badSession.status, 400);
  assert.equal((badSession.body as any).error.code, "SESSION_INVALID");

  const badScope = await call("POST", "/api/work-orders", { scope: "buy-token" });
  assert.equal(badScope.status, 400);
  assert.equal((badScope.body as any).error.code, "SCOPE_INVALID");

  const badJson = await app.handle({ method: "POST", url: "/api/visit", headers: SESSION, body: "{" });
  assert.equal(badJson.status, 400);

  const unknownRoute = await call("GET", "/api/nope");
  assert.equal(unknownRoute.status, 404);

  const unknownReceipt = await call("GET", "/api/receipts/rcpt_nope");
  assert.equal(unknownReceipt.status, 404);
});

test("a tripwire from another session is invisible and unpinnable", async () => {
  const other = { "x-den-session": "other-session-99" };
  const pin = await call("POST", `/api/case/${model.launches[0].launchId}/watch`, { note: "" }, other);
  assert.equal(pin.status, 201);
  const id = (pin.body as any).tripwire.id;
  const list = await call("GET", "/api/tripwires");
  assert.ok(!(list.body as any).tripwires.some((item: any) => item.id === id));
  const stolen = await call("POST", `/api/tripwires/${id}/replay`);
  assert.equal(stolen.status, 404);
});

test("health reports verified evidence and the replay mode", async () => {
  const health = await call("GET", "/api/health");
  const body = health.body as any;
  assert.equal(body.mode, "RECORDED_REPLAY");
  assert.equal(body.evidence.captures, 6);
  assert.equal(body.evidence.records, 120);
  assert.equal(body.evidence.digestsVerified, true);
});
