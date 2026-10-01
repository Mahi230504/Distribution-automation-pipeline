import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import sharp from "sharp";

const dir = await mkdtemp(join(tmpdir(), "vpo-ownership-"));
const port = 4105, base = `http://127.0.0.1:${port}/api`;
const userA = "11111111-1111-4111-8111-111111111111";
const userB = "22222222-2222-4222-8222-222222222222";
let child: ChildProcess;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const headers = (user: string) => ({ "Content-Type": "application/json", Authorization: `Bearer test-user:${user}` });
async function request(user: string, route: string, body?: unknown, method = body ? "POST" : "GET") {
  return fetch(base + route, { method, headers: headers(user), body: body ? JSON.stringify(body) : undefined });
}
async function json(user: string, route: string, body?: unknown, method?: string) {
  const response = await request(user, route, body, method); const data = await response.json();
  assert.ok(response.ok, JSON.stringify(data)); return data;
}
const brief = (claimedUser?: string) => ({
  userId: claimedUser, topic: "Ownership test", audience: "", platform: "instagram_reels", aspectRatio: "9:16", durationSeconds: 30, targetVideoModel: "Veo 3.1", sourceLinks: [], notes: "", pastedScript: null, brandSelection: "none",
  interpretation: { subject: "Ownership test", objective: "explain", productDetails: "", visualPreferences: "", factualConstraints: "No unsupported claims", summary: "Explain ownership clearly.", confirmed: true },
});

test("protected routes, jobs, Brand kits and assets remain owner scoped", async () => {
  child = spawn(process.execPath, ["dist/backend/src/server.js"], { cwd: process.cwd(), env: { ...process.env, NODE_ENV: "test", PORT: String(port), TEST_MODE: "true", AUTH_MODE: "local", STORAGE_MODE: "local_json", STORAGE_LOCAL_PATH: dir, TEST_DELAY_MS: "50" }, stdio: "pipe" });
  try {
    for (let i = 0; i < 100; i++) { try { if ((await fetch(base + "/health")).ok) break; } catch {} await sleep(50); }
    const a = await json(userA, "/runs", brief(userB));
    const b = await json(userB, "/runs", brief(userA));
    assert.equal(a.userId, userA); assert.equal(b.userId, userB);
    assert.deepEqual((await json(userA, "/runs")).map((r: { id: string }) => r.id), [a.id]);
    assert.equal((await request(userA, `/runs/${b.id}`)).status, 404);
    assert.equal((await request(userA, `/runs/${b.id}/ai-calls`)).status, 404);
    assert.equal((await request(userA, `/runs/${b.id}/resume`, {})).status, 404);
    await json(userA, "/brand-kit", { brandName: "A", palette: [], characterDescription: "", tone: "", constraints: "", preferredPlatforms: [] }, "PUT");
    await json(userB, "/brand-kit", { brandName: "B", palette: [], characterDescription: "", tone: "", constraints: "", preferredPlatforms: [] }, "PUT");
    assert.equal((await json(userA, "/brand-kit")).brandName, "A");
    assert.equal((await json(userB, "/brand-kit")).brandName, "B");

    await json(userA, `/runs/${a.id}/story`, {});
    let finished = a;
    for (let i = 0; i < 100; i++) { finished = await json(userA, `/runs/${a.id}`); if (!["queued", "running"].includes(finished.jobStatus)) break; await sleep(40); }
    assert.equal(finished.job.ownerId, userA);
    assert.equal((await request(userB, `/runs/${a.id}/jobs/${finished.job.id}`)).status, 404);

    const assetId = randomUUID();
    await mkdir(join(dir, "images"), { recursive: true });
    await writeFile(join(dir, "images", `${assetId}.png`), await sharp({ create: { width: 2, height: 2, channels: 4, background: "red" } }).png().toBuffer());
    await writeFile(join(dir, `asset-${assetId}.json`), JSON.stringify({ id: assetId, ownerId: userA, runId: a.id, purpose: "image", mediaType: "image/png" }));
    const ownedImage = await request(userA, `/images/${assetId}`);
    assert.equal(ownedImage.status, 200);
    assert.equal(ownedImage.headers.get("cache-control"), "private, no-store");
    assert.equal(ownedImage.headers.get("vary"), "Authorization");
    assert.equal((await request(userB, `/images/${assetId}`)).status, 404);
  } finally {
    if (child && child.exitCode === null) { const stopped = new Promise((r) => child.once("exit", r)); child.kill("SIGKILL"); await stopped; }
  }
});
