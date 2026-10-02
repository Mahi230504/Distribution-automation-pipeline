import test from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import net from "node:net";
import { beginDraining, rejectsDuringDrain, requireProviderWrite, resetLifecycleForTest } from "../src/lifecycle.js";
import { createReadinessProbe } from "../src/readiness.js";
import { publicationProvenanceMatches } from "../src/publication-runner.js";

const production = {
  NODE_ENV:"production", HOST:"0.0.0.0", PORT:"4000", TEST_MODE:"true", PUBLISH_MODE:"test",
  AUTH_MODE:"supabase", STORAGE_MODE:"supabase",
  PUBLIC_OAUTH_CALLBACK_BASE_URL:"https://backend.example.com", PUBLIC_FRONTEND_BASE_URL:"https://app.example.com",
  FRONTEND_ORIGINS:"https://app.example.com,http://localhost:3000,http://127.0.0.1:3000",
  SUPABASE_URL:"https://project.supabase.co", SUPABASE_PUBLISHABLE_KEY:"publishable-test-key-value",
  SUPABASE_SECRET_KEY:"server-test-secret-value", DOTENV_CONFIG_PATH:"/tmp/vpo-do-not-load-env",
};
function settingsResult(overrides:Record<string,string|undefined>={}){
  const env:Record<string,string>={PATH:process.env.PATH??"",...production};
  for(const [key,value] of Object.entries(overrides))if(value===undefined)delete env[key];else env[key]=value;
  return spawnSync(process.execPath,["--import","tsx","--eval","import('./src/settings.ts')"],{cwd:process.cwd(),env,encoding:"utf8"});
}
async function freePort(){const server=net.createServer();await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));const address=server.address() as net.AddressInfo;await new Promise<void>(resolve=>server.close(()=>resolve()));return address.port;}

test("production configuration supports staged TEST AI and TEST publishing without optional providers",()=>{
  assert.equal(settingsResult().status,0);
  assert.notEqual(settingsResult({TEST_MODE:undefined}).status,0);
  assert.notEqual(settingsResult({PUBLISH_MODE:undefined}).status,0);
  assert.notEqual(settingsResult({AUTH_MODE:"local",STORAGE_MODE:"local_json"}).status,0);
  assert.notEqual(settingsResult({TEST_MODE:"false",GEMINI_API_KEY:undefined}).status,0);
  assert.equal(settingsResult({TEST_MODE:"false",GEMINI_API_KEY:"fixture-key"}).status,0);
  assert.equal(settingsResult({GOOGLE_CLIENT_ID:"half",GOOGLE_CLIENT_SECRET:undefined}).status,0);
  assert.notEqual(settingsResult({PUBLISH_MODE:"live",GOOGLE_CLIENT_ID:"half",GOOGLE_CLIENT_SECRET:undefined}).status,0);
  assert.notEqual(settingsResult({PUBLIC_FRONTEND_BASE_URL:"https://user:pass@app.example.com/path?x=1"}).status,0);
  assert.notEqual(settingsResult({PUBLIC_OAUTH_CALLBACK_BASE_URL:"http://backend.example.com"}).status,0);
});

test("readiness is read-only, cached, bounded and secret-free",async()=>{
  resetLifecycleForTest();let calls=0,time=0;const secret="READINESS_SECRET";
  const urls:string[]=[];const probe=createReadinessProbe(async(url,init)=>{calls++;urls.push(String(url));assert.equal(new Headers(init?.headers).get("apikey"),secret);return new Response("[]",{status:200});},()=>time,{storageMode:"supabase",supabaseUrl:"https://project.supabase.co",supabaseSecretKey:secret},50);
  assert.deepEqual(await probe(),{ready:true});assert.equal(calls,2);assert.deepEqual(await probe(),{ready:true});assert.equal(calls,2);time=10_001;assert.deepEqual(await probe(),{ready:true});assert.equal(calls,4);
  assert.deepEqual(urls.slice(0,2),["https://project.supabase.co/rest/v1/runs?select=id&limit=1","https://project.supabase.co/rest/v1/publication_runs?select=run_id&limit=1"]);
  const hanging=createReadinessProbe((_url,init)=>new Promise((_resolve,reject)=>init?.signal?.addEventListener("abort",()=>reject(new DOMException("aborted","AbortError")))),Date.now,{storageMode:"supabase",supabaseUrl:"https://project.supabase.co",supabaseSecretKey:secret},10);
  assert.deepEqual(await hanging(),{ready:false,category:"storage_timeout"});
  beginDraining();const drained=await probe();assert.deepEqual(drained,{ready:false,category:"draining"});assert.doesNotMatch(JSON.stringify(drained),/READINESS_SECRET|supabase\.co/);resetLifecycleForTest();
});

test("draining rejects mutations, callbacks and provider writes but permits safe reads",()=>{
  resetLifecycleForTest();assert.equal(rejectsDuringDrain("POST","/api/runs"),false);beginDraining();
  assert.equal(rejectsDuringDrain("POST","/api/runs"),true);assert.equal(rejectsDuringDrain("GET","/oauth/youtube/callback"),true);assert.equal(rejectsDuringDrain("GET","/api/runs"),false);assert.throws(()=>requireProviderWrite(),/restarting/);resetLifecycleForTest();
});

test("persisted publication provenance never falls through to the other runtime adapter",()=>{
  assert.equal(publicationProvenanceMatches("test","test"),true);
  assert.equal(publicationProvenanceMatches("live","live"),true);
  assert.equal(publicationProvenanceMatches("live","test"),false);
  assert.equal(publicationProvenanceMatches("test","live"),false);
});

test("live, ready and health are safe; CORS is exact; SIGTERM exits inside the application deadline",async()=>{
  const dir=await mkdtemp(`${tmpdir()}/vpo-deployment-contract-`),port=await freePort(),base=`http://127.0.0.1:${port}`,secret="DO_NOT_LEAK_THIS_SECRET";
  const child=spawn(process.execPath,["dist/backend/src/server.js"],{cwd:process.cwd(),env:{...process.env,NODE_ENV:"test",PORT:String(port),HOST:"127.0.0.1",TEST_MODE:"true",PUBLISH_MODE:"test",AUTH_MODE:"local",STORAGE_MODE:"local_json",STORAGE_LOCAL_PATH:dir,FRONTEND_ORIGINS:"https://app.example.com,http://localhost:3000",GEMINI_API_KEY:secret},stdio:"pipe"});
  try{
    for(let i=0;i<100;i++){try{if((await fetch(`${base}/api/live`)).ok)break;}catch{}await new Promise(resolve=>setTimeout(resolve,25));}
    const live=await fetch(`${base}/api/live`),ready=await fetch(`${base}/api/ready`),health=await fetch(`${base}/api/health`);assert.equal(live.status,200);assert.equal(ready.status,200);assert.equal(health.status,200);
    for(const response of [live,ready,health]){const body=await response.text();assert.doesNotMatch(body,new RegExp(secret));assert.doesNotMatch(body,/SUPABASE|GEMINI|https:\/\/project/);}
    const allowed=await fetch(`${base}/api/live`,{headers:{Origin:"https://app.example.com"}});assert.equal(allowed.headers.get("access-control-allow-origin"),"https://app.example.com");
    assert.equal((await fetch(`${base}/api/live`,{headers:{Origin:"https://evil.example.com"}})).status,403);
    const preflight=await fetch(`${base}/api/runs`,{method:"OPTIONS",headers:{Origin:"http://localhost:3000"}});assert.equal(preflight.status,204);
    const started=Date.now(),exited=new Promise<number|null>(resolve=>child.once("exit",code=>resolve(code)));child.kill("SIGTERM");assert.equal(await exited,0);assert.ok(Date.now()-started<5_000);
  }finally{if(child.exitCode===null)child.kill("SIGKILL");await rm(dir,{recursive:true,force:true});}
});
