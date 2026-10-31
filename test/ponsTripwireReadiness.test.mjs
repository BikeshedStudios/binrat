import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { assessTripwireReadiness } from "../scripts/verify-pons-tripwire-readiness.mjs";

const old = (name) => JSON.parse(readFileSync(new URL("../docs/proofs/pons-tripwire/" + name, import.meta.url)));
const historic1 = old("status-1.json"), historic2 = old("status-2.json"), historicHealth = old("health.json");
const evaluationTime = Date.UTC(2026,9,31,2,0,0);

test("historical October 10 captures cannot certify October 31 freshness or activation", () => {
  const result = assessTripwireReadiness({statusCaptures:[historic1,historic2],healthCapture:historicHealth,nowMs:evaluationTime});
  assert.equal(result.assessment,"BLOCKED");
  assert.equal(result.productionActivationAuthorized,false);
  assert.ok(result.blockedReasons.includes("CAPTURE_RECENT_0"));
  assert.ok(result.blockedReasons.includes("CAPTURE_RECENT_1"));
  assert.ok(result.blockedReasons.includes("HEALTH_RECENT"));
  assert.ok(result.blockedReasons.includes("RELEASE_SOURCE_BOUND"));
  assert.ok(result.blockedReasons.includes("PROVIDER_READ_ONLY_IDENTITY"));
  assert.ok(result.blockedReasons.includes("RECOVERY_SCHEMA_PROVEN"));
});

function mock(now=evaluationTime) {
  const sha = "a".repeat(40), version = "v-test";
  const status=(i) => ({
    route:"/api/status",httpStatus:200,capturedAt:new Date(now-90000+i*3000).toISOString(),
    body:{schemaVersion:"binrat.public-status/0.1",chainId:4663,state:"FRESH_VERIFIED",
      checkpointBlock:"888",checkpointBlockHash:"0x"+"b".repeat(64),feedDigest:"c".repeat(64),
      publicationVersion:5,verifiedAtMs:now-90000,runtimeUpdatedAtMs:now-90000,
      freshnessValidUntilMs:now+90000,lastSyncError:null}
  });
  const health={route:"/health",httpStatus:200,capturedAt:new Date(now-70000).toISOString(),
    body:{ok:true,releaseSha:sha,release:{sourceBinding:"BOUND",sourceClean:true,sourceSha:sha,
      deploymentBinding:"REQUIRES_DEPLOYMENT_RECEIPT",workerRevisionId:version}}};
  const provider={authenticatedReadOnly:true,capturedAt:new Date(now-50000).toISOString(),
    workerRevisionId:version,releaseSha:sha,readOnly:true,tripwireEnabled:false,deliveryEnabled:false,
    schemaReadOnlyVerified:true};
  return {statusCaptures:[status(0),status(1)],healthCapture:health,providerAttestation:provider,nowMs:now};
}

test("synthetic recent source without provider evidence stays BLOCKED",()=>{
  const v=mock();delete v.providerAttestation;
  const r=assessTripwireReadiness(v);
  assert.ok(r.blockedReasons.includes("PROVIDER_READ_ONLY_IDENTITY"));
  assert.equal(r.productionActivationAuthorized,false);
});
test("fresh synthetic proof is preflight only, NEVER production or delivery authorization",()=>{
  const r=assessTripwireReadiness(mock());
  assert.equal(r.assessment,"PREFLIGHT_EVIDENCE_COMPLETE");
  assert.deepEqual(r.blockedReasons,[]);
  assert.equal(r.productionActivationAuthorized,false);
  assert.equal(r.telegramDeliveryAuthorized,false);
  assert.equal(r.collectorAuthorized,false);
});
test("stale index, changed publication, future timestamp, missing chain and enabled flags all fail closed",()=>{
  for(const mutate of [
    (v)=>{v.statusCaptures[1].body.state="STALE_VERIFIED";},
    (v)=>{v.statusCaptures[1].body.publicationVersion=4;},
    (v)=>{v.statusCaptures[1].body.checkpointBlock="887";},
    (v)=>{v.statusCaptures[0].body.verifiedAtMs=v.nowMs+10000;},
    (v)=>{v.statusCaptures[0].body.chainId=5042;},
    (v)=>{v.providerAttestation.deliveryEnabled=true;},
    (v)=>{v.providerAttestation.tripwireEnabled=true;},
    (v)=>{v.healthCapture.body.release.sourceBinding="UNVERIFIED";}
  ]) {
    const v=mock();mutate(v);
    const r=assessTripwireReadiness(v);
    assert.equal(r.assessment,"BLOCKED",JSON.stringify(r.checks));
  }
});
test("identical payload duplicates are not independent temporal status samples",()=>{
  const v=mock();v.statusCaptures[1].capturedAt=v.statusCaptures[0].capturedAt;
  assert.ok(assessTripwireReadiness(v).blockedReasons.includes("PUBLICATION_SEQUENCE"));
});
