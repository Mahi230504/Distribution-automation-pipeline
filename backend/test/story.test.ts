import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
const dir = await mkdtemp(path.join(os.tmpdir(), "vpo-integration-"));
const port = 4101;
let child: ChildProcess;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function start() {
  child = spawn(process.execPath, ["dist/backend/src/server.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      TEST_MODE: "true",
      GEMINI_API_KEY: "",
      STORAGE_LOCAL_PATH: dir,
      TEST_DELAY_MS: "250",
    },
    stdio: "pipe",
  });
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/api/health`)).ok) return;
    } catch {}
    await sleep(100);
  }
  throw new Error("Backend did not start");
}
async function stop() {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise((r) => child.once("exit", r));
  child.kill("SIGKILL");
  await exited;
}
async function api(
  route: string,
  body?: unknown,
  method = body ? "POST" : "GET",
) {
  if(route==='/runs'&&body){const b=body as any;body={...b,brandSelection:'none',interpretation:{subject:b.topic,objective:'explain',productDetails:'',visualPreferences:'',factualConstraints:'No unsupported claims',summary:`Explain ${b.topic} clearly to the selected audience.`,confirmed:true}};}
  if(body && (route.endsWith('/directions')||route.endsWith('/script'))){const runRoute=route.replace(/\/(directions|script)$/,'');const r=await api(runRoute);body={...(body as object),scriptVersion:r.script.version,briefRevision:r.effective.revision};}
  const res = await fetch(`http://127.0.0.1:${port}/api${route}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  assert.ok(res.ok, JSON.stringify(data));
  return data;
}
const brief = {
  topic: "Coffee brewing",
  audience: "Beginners",
  platform: "instagram_reels",
  aspectRatio: "9:16",
  durationSeconds: 30,
  targetVideoModel: "Veo 3.1",
  sourceLinks: [],
  notes: "",
  pastedScript: null,
};
async function done(id: string) {
  for (let i = 0; i < 100; i++) {
    const r = await api(`/runs/${id}`);
    if (!["running", "queued"].includes(r.jobStatus)) return r;
    await sleep(100);
  }
  throw new Error("Job timed out");
}
test("Story, selective rewrite, user version, cache, restart/resume, script skip, CORS and errors", async () => {
  await start();
  try {
    let run = await api("/runs", brief);
    await api(`/runs/${run.id}/story`, {});
    run = await done(run.id);
    assert.equal(run.jobStatus, "needs_review");
    assert.equal(run.facts.length, 5);
    assert.equal(run.research.dropped.length, 1);
    assert.equal(run.sources[0].resolution, "resolved");
    assert.equal(run.runningCostUsd, 0);
    assert.equal(run.aiCallLog.length, 4);
    assert.ok(
      run.aiCallLog.every(
        (c: any) => c.estimatedCostUsd === 0 && c.inputTokens > 0,
      ),
    );
    assert.ok(run.facts.every((f: any) => /Coffee brewing/i.test(f.text)));
    const original = structuredClone(run.script.beats);
    await api(
      `/runs/${run.id}/facts`,
      { factId: run.facts[0].id, removed: true },
      "PATCH",
    );
    run = await done(run.id);
    assert.notDeepEqual(run.script.beats[0], original[0]);
    assert.deepEqual(run.script.beats.slice(1), original.slice(1));
    const edited = run.script.fullText.replace(
      "Show Coffee brewing detail 2",
      "My hand-edited camera note",
    );
    await api(`/runs/${run.id}/script`, { fullText: edited }, "PATCH");
    run = await api(`/runs/${run.id}`);
    assert.equal(run.script.fullText, edited);
    assert.equal(run.script.author, "user");
    const cached = await api("/runs", brief);
    await api(`/runs/${cached.id}/story`, {});
    const cacheResult = await done(cached.id);
    assert.equal(cacheResult.research.reused, true);
    assert.equal(cacheResult.aiCallLog.length, 2);
    const interrupted = await api("/runs", {
      ...brief,
      topic: "Interruption test",
    });
    await api(`/runs/${interrupted.id}/story`, {});
    for (let i = 0; i < 50; i++) {
      const r = await api(`/runs/${interrupted.id}`);
      if (r.job.checkpoint === "researched") break;
      await sleep(30);
    }
    await stop();
    await start();
    let resumed = await api(`/runs/${interrupted.id}`);
    assert.equal(resumed.jobStatus, "interrupted");
    const before = resumed.aiCallLog.filter(
      (c: any) => c.callType === "grounding",
    ).length;
    await api(`/runs/${interrupted.id}/resume`, {});
    resumed = await done(interrupted.id);
    assert.equal(resumed.jobStatus, "needs_review");
    assert.equal(
      resumed.aiCallLog.filter((c: any) => c.callType === "grounding").length,
      before,
    );
    assert.equal((await api(`/runs/${run.id}`)).script.fullText, edited);
    const pasted = await api("/runs", {
      ...brief,
      pastedScript:
        "[0:00–0:30] VISUAL: Pour coffee\nVO: One two three four five\nON-SCREEN: Coffee",
    });
    assert.equal(pasted.currentStage, "direction");
    assert.equal(pasted.script.wordCount, 5);
    assert.equal(pasted.aiCallLog.length, 0);
    assert.equal(pasted.directions.length, 0); // Step 4 generates real directions in its own persisted job.

    const shoes = await api("/runs", {
      ...brief,
      topic: "Shoe brand",
      audience: "Urban runners",
    });
    await api(`/runs/${shoes.id}/story`, {});
    const shoeStory = await done(shoes.id);
    const shoeCopy = JSON.stringify([shoeStory.facts, shoeStory.script]);
    assert.match(shoeCopy, /shoe brand/i);
    assert.doesNotMatch(shoeCopy, /coffee|brewing/i);
    const forbidden = await fetch(`http://127.0.0.1:${port}/api/runs`, {
      headers: { Origin: "https://evil.example" },
    });
    assert.equal(forbidden.status, 403);
    await stop();
    await assert.rejects(() => fetch(`http://127.0.0.1:${port}/api/runs`));
  } finally {
    await stop();
  }
});
