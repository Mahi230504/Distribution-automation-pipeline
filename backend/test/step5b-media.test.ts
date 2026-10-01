import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough, Readable } from "node:stream";
import type { IncomingMessage } from "node:http";
import { readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { assertUploadLength, createProbeRunner, MAX_VIDEO_BYTES, receiveUpload } from "../src/media.js";

function fakeChild(start:(child:EventEmitter&{stdout:PassThrough;stderr:PassThrough;kill:()=>boolean})=>void){
  const child=Object.assign(new EventEmitter(),{stdout:new PassThrough(),stderr:new PassThrough(),kill(){return true;}});
  queueMicrotask(()=>start(child));return child;
}

test("media upload rejects oversized Content-Length before streaming",()=>{
  assert.doesNotThrow(()=>assertUploadLength(String(MAX_VIDEO_BYTES)));
  assert.throws(()=>assertUploadLength(String(MAX_VIDEO_BYTES+1)),(error:any)=>error.status===413);
  assert.throws(()=>assertUploadLength("not-a-number"),(error:any)=>error.status===400);
});

test("aborted streaming uploads remove exclusive temporary files",async()=>{
  const before=new Set((await readdir(tmpdir())).filter(name=>name.startsWith("vpo-video-")));
  const stream=new Readable({read(){this.push(Buffer.from("partial"));this.destroy(new Error("client aborted"));}}) as IncomingMessage;
  Object.assign(stream,{headers:{}});
  await assert.rejects(receiveUpload(stream),/client aborted/);
  const after=(await readdir(tmpdir())).filter(name=>name.startsWith("vpo-video-")&&!before.has(name));
  assert.deepEqual(after,[]);
});

test("ffprobe output bounds, timeout and unavailable errors settle once with clear status",async()=>{
  const tooMuch=createProbeRunner({stdoutLimit:8,timeoutMs:100,spawnProcess:(()=>fakeChild(child=>{child.stdout.write("x".repeat(20));child.emit("close",0);})) as any});
  await assert.rejects(tooMuch("file"),(error:any)=>error.status===422&&/too much metadata/i.test(error.message));
  const unavailable=createProbeRunner({timeoutMs:100,spawnProcess:(()=>fakeChild(child=>{child.emit("error",new Error("ENOENT"));child.emit("close",1);})) as any});
  await assert.rejects(unavailable("file"),(error:any)=>error.status===503&&/unavailable/i.test(error.message));
  const timeout=createProbeRunner({timeoutMs:5,spawnProcess:(()=>fakeChild(()=>{})) as any});
  await assert.rejects(timeout("file"),(error:any)=>error.status===503&&/timed out/i.test(error.message));
});

test("ffprobe concurrency is bounded",async()=>{
  let active=0,maxActive=0;
  const runner=createProbeRunner({concurrency:1,timeoutMs:200,spawnProcess:(()=>fakeChild(child=>{active++;maxActive=Math.max(maxActive,active);setTimeout(()=>{child.stdout.end(JSON.stringify({format:{},streams:[]}));active--;child.emit("close",0);},15);})) as any});
  await Promise.all([runner("one"),runner("two"),runner("three")]);
  assert.equal(maxActive,1);
});
