import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { WatchSource } from '../src/autonomous/source.js';
import { buildProvenanceFact } from '../src/intelligence/provenance.js';
import { D1Store } from '../src/cloudflare/d1Store.js';
import { createPonsTripwireWatch, runPonsTripwireCycle } from '../src/cloudflare/ponsTripwire.js';
import {
  capturedProduction, fixtureNow, fixtureSource, createPonsTripwireFixtureDatabase,
  productionLaunch, publishFixture, seedProductionRow
} from './support/ponsTripwireFixture.js';

const first=capturedProduction.launches[0]!,later=capturedProduction.launches[1]!;
const laterNow=fixtureNow+2_000;
const owner={ownerId:'telegram:42',chatId:42,launchId:capturedProduction.openedCaseLaunchId,nowMs:fixtureNow};
const laterSource:WatchSource={...fixtureSource,async head(){return {chainId:4663,
  block:BigInt(later.block_number),hash:later.block_hash,timestampMs:laterNow-1_000};}};
async function prepareMissing(db:Awaited<ReturnType<typeof createPonsTripwireFixtureDatabase>>) {
  await seedProductionRow(db,later);
  await db.prepare('DELETE FROM provenance_facts WHERE launch_id=?').bind(later.launch_id).run();
  await publishFixture(db,BigInt(later.block_number),later.block_hash,laterNow);
}
async function decisions(db:Awaited<ReturnType<typeof createPonsTripwireFixtureDatabase>>) {
  return (await db.prepare('SELECT launch_id,state,reason,attempts,case_receipt_json,case_receipt_digest FROM pons_tripwire_event_decisions ORDER BY block_number,log_index,launch_id').all()).results as any[];
}

test('missing provenance is durable, survives restart, and produces exactly one canonical Case after repair',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'binrat-event-case-')),path=join(dir,'tripwire.sqlite');
  let db=await createPonsTripwireFixtureDatabase(path);
  try {
    const watch=await createPonsTripwireWatch(db,fixtureSource,owner);
    await prepareMissing(db);
    const firstCycle=await runPonsTripwireCycle(db,laterSource,{now:()=>laterNow});
    assert.equal(firstCycle.enqueued,0);
    const before=await decisions(db);
    assert.equal(before.length,1);
    assert.equal(before[0]!.state,'DEFERRED_UNKNOWN');
    assert.equal(before[0]!.reason,'EVIDENCE_UNVERIFIED');
    assert.equal(before[0]!.case_receipt_digest,null);
    const cursor=await db.prepare('SELECT cursor_launch_id FROM pons_tripwire_watches WHERE generation=?')
      .bind(watch.generation).first<{cursor_launch_id:string}>();
    assert.equal(cursor?.cursor_launch_id,later.launch_id);
    db.close();
    db=await createPonsTripwireFixtureDatabase(path);
    assert.equal((await decisions(db))[0]!.state,'DEFERRED_UNKNOWN');
    await new D1Store(db,4663).putProvenanceFact(await buildProvenanceFact(productionLaunch(later)));
    const recovered=await runPonsTripwireCycle(db,laterSource,{now:()=>laterNow});
    assert.equal(recovered.enqueued,1);
    const after=await decisions(db);
    assert.equal(after.length,1);
    assert.equal(after[0]!.state,'MATCH');
    assert.ok(after[0]!.attempts>=2);
    assert.match(after[0]!.case_receipt_digest,/^[0-9a-f]{64}$/);
    const receipt=JSON.parse(after[0]!.case_receipt_json);
    assert.equal(receipt.watchGeneration,watch.generation);
    assert.equal(receipt.caseId,later.launch_id);
    assert.equal(receipt.eventId,later.event_id);
    assert.equal(receipt.publication.checkpointBlock,later.block_number);
    assert.equal(receipt.eventBlockHash,later.block_hash);
    assert.match(receipt.canonicalCaseDigest,/^[0-9a-f]{64}$/);
    assert.equal(receipt.coverage,'EARLIER_RECORDS_IN_RETURNED_WINDOW');
    const outbox=await db.prepare('SELECT launch_id,state FROM pons_tripwire_outbox').all();
    assert.deepEqual(outbox.results,[{launch_id:later.launch_id,state:'PENDING'}]);
    const repeated=await runPonsTripwireCycle(db,laterSource,{now:()=>laterNow});
    assert.equal(repeated.enqueued,0);
    assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM pons_tripwire_outbox').first<{count:number}>())?.count,1);
  }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});

test('failed atomic deferral transaction never advances the cursor or loses undecided evidence',async()=>{
  const db=await createPonsTripwireFixtureDatabase();
  try {
    const watch=await createPonsTripwireWatch(db,fixtureSource,owner);
    await prepareMissing(db);
    await db.exec(`CREATE TRIGGER recovery_test_cursor_block BEFORE UPDATE OF cursor_block ON pons_tripwire_watches
      BEGIN SELECT RAISE(ABORT,'CURSOR_BLOCKED'); END;`);
    await assert.rejects(runPonsTripwireCycle(db,laterSource,{now:()=>laterNow}),/CURSOR_BLOCKED/);
    assert.deepEqual(await decisions(db),[]);
    const before=await db.prepare('SELECT cursor_launch_id FROM pons_tripwire_watches WHERE generation=?')
      .bind(watch.generation).first<{cursor_launch_id:string}>();
    assert.equal(before?.cursor_launch_id,'');
    await db.exec('DROP TRIGGER recovery_test_cursor_block');
    await runPonsTripwireCycle(db,laterSource,{now:()=>laterNow});
    assert.equal((await decisions(db))[0]!.state,'DEFERRED_UNKNOWN');
  }finally{db.close();}
});

test('verified historical pre-consent event remains NO_MATCH, not a future alert',async()=>{
  const db=await createPonsTripwireFixtureDatabase();
  try {
    const watch=await createPonsTripwireWatch(db,fixtureSource,owner);
    await seedProductionRow(db,later);
    await publishFixture(db,BigInt(later.block_number),later.block_hash,laterNow);
    const historic:WatchSource={...laterSource,async point(block) {
      const result=await fixtureSource.point(block);
      return block===BigInt(later.block_number)?{...result,timestampMs:fixtureNow-1}:result;
    }};
    const result=await runPonsTripwireCycle(db,historic,{now:()=>laterNow});
    assert.equal(result.enqueued,0);
    const row=(await decisions(db))[0]!;
    assert.equal(row.state,'NO_MATCH');
    assert.equal(row.reason,'PREDATES_WATCH');
    assert.equal(row.case_receipt_json,null);
    assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM pons_tripwire_outbox').first<{count:number}>())?.count,0);
    assert.equal(watch.state,'ACTIVE');
  }finally{db.close();}
});

test('unrepaired evidence remains explicit on later cycles, not a silent no-match',async()=>{
  const db=await createPonsTripwireFixtureDatabase();
  try {
    await createPonsTripwireWatch(db,fixtureSource,owner);
    await prepareMissing(db);
    await runPonsTripwireCycle(db,laterSource,{now:()=>laterNow});
    await runPonsTripwireCycle(db,laterSource,{now:()=>laterNow+1});
    const row=(await decisions(db))[0]!;
    assert.equal(row.state,'DEFERRED_UNKNOWN');
    assert.equal(row.attempts,2);
    assert.equal(row.case_receipt_digest,null);
  }finally{db.close();}
});

test('Case source failure defers matching until earlier provenance is repaired',async()=>{
  const db=await createPonsTripwireFixtureDatabase();
  try {
    const watch=await createPonsTripwireWatch(db,fixtureSource,owner);
    await seedProductionRow(db,later);
    await publishFixture(db,BigInt(later.block_number),later.block_hash,laterNow);
    await db.prepare('DELETE FROM provenance_facts WHERE launch_id=?').bind(first.launch_id).run();
    const before=await runPonsTripwireCycle(db,laterSource,{now:()=>laterNow});
    assert.equal(before.enqueued,0);
    assert.equal((await decisions(db))[0]!.reason,'CASE_SOURCE_UNAVAILABLE');
    await new D1Store(db,4663).putProvenanceFact(await buildProvenanceFact(productionLaunch(first)));
    const recovered=await runPonsTripwireCycle(db,laterSource,{now:()=>laterNow});
    assert.equal(recovered.enqueued,1);
    const row=(await decisions(db))[0]!;
    assert.equal(row.state,'MATCH');
    assert.equal(JSON.parse(row.case_receipt_json).watchGeneration,watch.generation);
  }finally{db.close();}
});
test('bounded unresolved journal refuses cursor advance when capacity is exhausted',async()=>{
  const db=await createPonsTripwireFixtureDatabase();
  try {
    const watch=await createPonsTripwireWatch(db,fixtureSource,owner);
    await prepareMissing(db);
    for(let i=0;i<20;i++) {
      const id=i.toString(16).padStart(64,'0');
      await db.prepare('INSERT INTO pons_tripwire_event_decisions (watch_generation,owner_id,launch_id,block_number,log_index,state,reason,first_seen_at_ms,last_evaluated_at_ms,attempts) VALUES (?,?,?,?,?,?,?,?,?,1)')
        .bind(watch.generation,owner.ownerId,id,Number(first.block_number),i,'DEFERRED_UNKNOWN','SOURCE_UNVERIFIED',fixtureNow,fixtureNow).run();
    }
    await assert.rejects(runPonsTripwireCycle(db,laterSource,{now:()=>laterNow}));
    const cursor=await db.prepare('SELECT cursor_launch_id FROM pons_tripwire_watches WHERE generation=?')
      .bind(watch.generation).first<{cursor_launch_id:string}>();
    assert.equal(cursor?.cursor_launch_id,'');
    assert.equal((await decisions(db)).length,20);
    await db.prepare('DELETE FROM pons_tripwire_event_decisions WHERE launch_id=?').bind('0'.repeat(64)).run();
    const after=await runPonsTripwireCycle(db,laterSource,{now:()=>laterNow});
    assert.equal(after.enqueued,0);
    const row=await db.prepare('SELECT state FROM pons_tripwire_event_decisions WHERE launch_id=?')
      .bind(later.launch_id).first<{state:string}>();
    assert.equal(row?.state,'DEFERRED_UNKNOWN');
  }finally{db.close();}
});

test('first admitted Case receipt remains immutable across a newer publication and cursor replay',async()=>{
  const db=await createPonsTripwireFixtureDatabase();
  try {
    const watch=await createPonsTripwireWatch(db,fixtureSource,owner);
    await seedProductionRow(db,later);
    await publishFixture(db,BigInt(later.block_number),later.block_hash,laterNow);
    assert.equal((await runPonsTripwireCycle(db,laterSource,{now:()=>laterNow})).enqueued,1);
    const prior=(await decisions(db))[0]!;
    assert.equal(prior.state,'MATCH');
    const original=JSON.parse(prior.case_receipt_json);
    await publishFixture(db,BigInt(later.block_number),later.block_hash,laterNow+1);
    await db.prepare('UPDATE pons_tripwire_watches SET cursor_block=?,cursor_log_index=-1,cursor_launch_id=? WHERE generation=?')
      .bind(Number(first.block_number),'',watch.generation).run();
    const replay=await runPonsTripwireCycle(db,laterSource,{now:()=>laterNow+1});
    assert.equal(replay.enqueued,0);
    const after=(await decisions(db))[0]!;
    assert.equal(after.state,'MATCH');
    assert.equal(after.case_receipt_digest,prior.case_receipt_digest);
    assert.equal(after.case_receipt_json,prior.case_receipt_json);
    assert.equal(JSON.parse(after.case_receipt_json).publication.publicationVersion,original.publication.publicationVersion);
    assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM pons_tripwire_outbox').first<{count:number}>())?.count,1);
  }finally{db.close();}
});
