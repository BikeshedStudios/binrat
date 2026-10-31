import assert from "node:assert/strict";
import test from "node:test";
import { captureBoundedPublicReadiness, parseOrigin } from "../scripts/capture-binrat-readiness-public.mjs";

test("public capture requires an explicitly supplied HTTPS origin without credentials or paths",()=>{
  for(const x of ["http://binrat.tech/","https://u:p@binrat.tech/","https://binrat.tech/api/status","https://binrat.tech/?token=x","javascript:alert(1)"]){
    assert.throws(()=>parseOrigin(x));
  }
  assert.equal(parseOrigin("https://binrat.tech/"),"https://binrat.tech");
});

test("manual capture issues exactly three bounded GETs and never a provider, RPC or Telegram call",async()=>{
  const urls=[],options=[],sleeps=[];
  const sample={schemaVersion:"binrat.public-status/0.1",chainId:4663,state:"FRESH_VERIFIED"};
  const fake=async(url,init)=>{
    urls.push(url);options.push(init);
    return new Response(JSON.stringify(sample),{status:200,headers:{"Content-Type":"application/json"}});
  };
  let time=Date.UTC(2026,9,31,1,0,0);
  const r=await captureBoundedPublicReadiness({origin:"https://binrat.tech/",
    fetchImpl:fake,sleep:async ms=>{sleeps.push(ms);time+=ms;},
    clock:()=>{time+=2000;return time;}});
  assert.deepEqual(urls,["https://binrat.tech/api/status","https://binrat.tech/health","https://binrat.tech/api/status"]);
  assert.equal(r.requests,3);
  assert.deepEqual(sleeps,[1250]);
  assert.ok(Date.parse(r.status2.capturedAt)>Date.parse(r.status1.capturedAt));
  assert.ok(options.every(x=>x.method==="GET"&&x.redirect==="error"&&!x.headers.Authorization));
});
test("capture does not silently accept redirects, HTML, invalid JSON or large responses",async()=>{
  for(const fetchImpl of [
    async()=>new Response("oops",{status:503}),
    async()=>new Response("<html>oops</html>",{status:200,headers:{"Content-Type":"text/html"}}),
    async()=>new Response("{",{status:200,headers:{"Content-Type":"application/json"}}),
    async()=>new Response("X".repeat(66000),{status:200,headers:{"Content-Type":"application/json"}})
  ]) {
    await assert.rejects(captureBoundedPublicReadiness({origin:"https://binrat.tech",fetchImpl,sleep:async()=>{},clock:()=>Date.now()}));
  }
});
