import assert from "node:assert/strict";
import test from "node:test";
import {
  LENSES,
  buildDossier,
  buildPile,
  buildReplay,
  caseDigest,
  caseSummary,
  findLead,
  shortAddress,
} from "../../server/casefile.ts";
import { loadEvidence, ratHandle } from "../../server/evidence.ts";

const model = await loadEvidence();
const lead = findLead(model);

test("the lead dossier states the movement without inventing a cause", async () => {
  const dossier = await buildDossier(model, lead);
  const ids = dossier.findings.map((finding) => finding.id);
  assert.ok(ids.includes("recurrence"));
  assert.ok(ids.includes("prior-moved"));
  assert.ok(ids.includes("no-name"));
  assert.ok(ids.includes("window"));
  const moved = dossier.findings.find((finding) => finding.id === "prior-moved");
  assert.ok(moved);
  assert.match(moved.text, /565/);
  assert.match(moved.text, /1607/);
  assert.match(moved.text, /1042/);
  assert.equal(moved.kind, "DERIVED");
  for (const forbidden of ["scam", "rug", "profit", "guarantee", "likely"]) {
    for (const finding of dossier.findings) {
      assert.ok(!finding.text.toLowerCase().includes(forbidden), `finding mentions ${forbidden}`);
    }
  }
  assert.ok(dossier.unknowns.length >= 4);
  assert.equal(dossier.coverage.coverage, "PARTIAL");
});

test("the case digest is recomputable and changes with the material", async () => {
  const first = await caseDigest(model, lead);
  const second = await caseDigest(model, lead);
  assert.equal(first.digest, second.digest);
  assert.match(first.digest, /^[0-9a-f]{64}$/);
  assert.deepEqual((first.material as { captures: unknown[] }).captures.length, 2);
});

test("replay distinguishes a new launch from a re-read scrap", () => {
  const leadReplay = buildReplay(model, lead);
  assert.equal(leadReplay.status, "RECORDED_AGAIN");
  assert.equal(leadReplay.delta?.priorLaunchCount, 1042);
  assert.equal(leadReplay.appearances.length, 1);
  assert.equal(leadReplay.appearances[0].sameScrap, false);
  assert.equal(leadReplay.captures.length, 6);
  assert.equal(leadReplay.laterCaptures.length, 5);

  const sibling = model.records.find(
    (record) => record.launchId !== lead.launchId && record.deployer === lead.deployer,
  );
  assert.ok(sibling);
  const newest = buildReplay(model, sibling);
  assert.equal(newest.status, "NO_LATER_CAPTURES");
  assert.equal(newest.delta, null);

  const reread = model.records.find((record) => (model.observations.get(record.launchId)?.length ?? 0) > 1);
  assert.ok(reread);
  const rereadReplay = buildReplay(model, reread);
  assert.ok(["REREAD_ONLY", "RECORDED_AGAIN"].includes(rereadReplay.status));
});

test("pins on the newest capture are honest about having nothing later", () => {
  const newest = model.launches
    .filter((record) => record.captureId === "cap-06")
    .map((record) => buildReplay(model, record));
  assert.ok(newest.length > 0);
  for (const replay of newest) assert.equal(replay.status, "NO_LATER_CAPTURES");
});

test("every scrap in the pile has no recorded name and says so", () => {
  const pile = buildPile(model, { lens: "scent", query: "", limit: 200, offset: 0 });
  assert.equal(pile.total, 91);
  assert.equal(pile.matched, 91);
  assert.equal(pile.rows.length, 91);
  for (const row of pile.rows) {
    assert.equal(row.metadataFilled, 0);
    assert.equal(row.name, "");
    assert.equal(row.symbol, "");
    assert.ok(row.tags.includes("NO NAME"));
  }
  assert.equal(pile.rows[0].caseId, lead.launchId);
  assert.equal(pile.rows[0].priorDelta, 1042);
});

test("pile search is a literal substring match over recorded fields only", () => {
  const byAddress = buildPile(model, { lens: "fresh", query: "0x0e1651", limit: 200, offset: 0 });
  assert.ok(byAddress.matched >= 1);
  for (const row of byAddress.rows) assert.match(row.deployer, /^0x0e1651/);

  const byBlock = buildPile(model, { lens: "fresh", query: "83539339", limit: 200, offset: 0 });
  assert.equal(byBlock.matched, 1);
  assert.equal(byBlock.rows[0].caseId, lead.launchId);

  const nonsense = buildPile(model, { lens: "fresh", query: "zzzz-no-such-scrap", limit: 200, offset: 0 });
  assert.equal(nonsense.matched, 0);
});

test("lenses are three and every one sorts a full pile", () => {
  assert.equal(LENSES.length, 3);
  for (const lens of LENSES) {
    const pile = buildPile(model, { lens: lens.id, query: "", limit: 200, offset: 0 });
    assert.equal(pile.rows.length, 91);
  }
});

test("rat handles are derived labels, never token names", () => {
  const leadHandle = ratHandle(model, lead);
  assert.equal(leadHandle.handle, "THE RETURNER");
  assert.match(leadHandle.basis, /reported deployer recorded in 2 of 6 captures/);

  const regular = model.records.find((record) => record.deployer === "0xc87f0057da695f20682eea7dee795755d9b850c2");
  assert.ok(regular);
  assert.equal(ratHandle(model, regular).handle, "THE REGULAR");

  const firstTimer = model.records.find((record) => record.priorLaunchCount === 0);
  assert.ok(firstTimer);
  assert.equal(ratHandle(model, firstTimer).handle, "FIRST RECORD");

  assert.equal(shortAddress("0x0e1651aec67b2a049a4fa6aeb6c1c305aabfc35b"), "0x0e1651…c35b");
});

test("capture metadata is exposed for the manual, including the D1 source", () => {
  const d1 = model.captures.find((capture) => capture.id === "cap-06");
  assert.ok(d1);
  assert.equal(d1.source.kind, "READ_ONLY_D1");
  assert.equal(d1.state, "NOT_RECORDED");
  assert.equal(model.captures.filter((capture) => capture.source.kind === "PUBLIC_GET").length, 5);
});

test("summary counters used by the den agree with the pile", () => {
  const summary = caseSummary(model, lead);
  assert.equal(summary.windows, 2);
  assert.equal(summary.priorDelta, 1042);
  assert.equal(summary.scrapReads, 1);
  assert.equal(summary.captureId, "cap-01");
  assert.ok(summary.tags.includes("RECORDED AGAIN"));
  assert.ok(summary.tags.includes("LONG RECORD"));
});
