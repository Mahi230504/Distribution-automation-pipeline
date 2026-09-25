import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import sharp from "sharp";
import type { Run, ImageQuote } from "../../frontend/lib/types.js";
import {
  validateReview,
  promptDimensions,
  frameDimensions,
  reviewFixture,
} from "../src/generation-quality.js";
const dir = await mkdtemp(path.join(os.tmpdir(), "vpo-step4-"));
const port = 4102,
  base = `http://127.0.0.1:${port}`;
let child: ChildProcess;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function start(scenario = "pass", delay = 40) {
  child = spawn(process.execPath, ["dist/backend/src/server.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      TEST_MODE: "true",
      GEMINI_API_KEY: "",
      STORAGE_LOCAL_PATH: dir,
      TEST_DELAY_MS: String(delay),
      TEST_SCENARIO: scenario,
      MANUAL_REGENERATION_LIMIT: "3",
    },
    stdio: "pipe",
  });
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`${base}/api/health`)).ok) return;
    } catch {}
    await sleep(50);
  }
  throw new Error("Step4 test backend failed to start");
}
async function stop() {
  if (child?.exitCode !== null || child?.signalCode !== null) return;
  const done = new Promise((r) => child.once("exit", r));
  child.kill("SIGKILL");
  await done;
}
async function request(
  route: string,
  body?: unknown,
  method = body ? "POST" : "GET",
  status?: number,
) {
  if (route === "/runs" && body) {
    const b = body as any;
    body = {
      ...b,
      brandSelection: "none",
      interpretation: {
        subject: b.topic,
        objective: "explain",
        productDetails: "",
        visualPreferences: "",
        factualConstraints: "No unsupported claims",
        summary: `Explain ${b.topic} clearly to the selected audience.`,
        confirmed: true,
      },
    };
  }
  if (body && (route.endsWith("/directions") || route.endsWith("/script"))) {
    const runRoute = route.replace(/\/(directions|script)$/, "");
    const r = await request(runRoute);
    body = {
      ...(body as object),
      scriptVersion: r.script.version,
      briefRevision: r.effective.revision,
    };
  }
  const res = await fetch(`${base}/api${route}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (status) assert.equal(res.status, status, JSON.stringify(data));
  else assert.ok(res.ok, JSON.stringify(data));
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
async function done(id: string): Promise<Run> {
  for (let i = 0; i < 500; i++) {
    const r = await request(`/runs/${id}`);
    if (!["queued", "running"].includes(r.jobStatus)) return r;
    await sleep(30);
  }
  throw new Error("Job timeout");
}
async function directions(pasted = false, beats = 5) {
  let r: Run = await request("/runs", {
    ...brief,
    pastedScript: pasted
      ? Array.from(
          { length: beats },
          (_, i) =>
            `[0:${String(i * 3).padStart(2, "0")}–0:${String((i + 1) * 3).padStart(2, "0")}] VISUAL: ${i === beats - 1 ? "Final payoff cup reveal" : `Coffee detail ${i + 1}`}\nVO: This is beat ${i + 1}.\nON-SCREEN: Coffee`,
        ).join("\n\n")
      : null,
  });
  if (!pasted) {
    await request(`/runs/${r.id}/story`, {});
    r = await done(r.id);
    assert.equal(r.facts.length, 5);
  }
  await request(`/runs/${r.id}/directions`, {});
  r = await done(r.id);
  assert.equal(r.directions.length, 3);
  assert.equal(r.generation?.directionsReady, true);
  return r;
}
async function prompt(r: Run) {
  await request(`/runs/${r.id}/directions/${r.directions[0].id}/select`, {
    note: "Make it playful while preserving the facts",
  });
  r = await done(r.id);
  assert.equal(r.jobStatus, "needs_review", r.job?.error);
  assert.ok(r.generation!.activePromptId);
  return r;
}
async function quote(
  r: Run,
  action: ImageQuote["action"],
  note = "",
  frameId?: string,
): Promise<ImageQuote> {
  return request(`/runs/${r.id}/image-quotes`, { action, note, frameId });
}
async function confirm(r: Run, q: ImageQuote) {
  const suffix =
    q.action === "key"
      ? "key-frame"
      : q.action === "key-regenerate"
        ? "key-frame/regenerate"
        : q.action === "board"
          ? "storyboard"
          : `frames/${q.frameId}/regenerate`;
  return request(`/runs/${r.id}/${suffix}`, { quoteId: q.id });
}
async function look(r: Run) {
  await confirm(r, await quote(r, "key"));
  r = await done(r.id);
  assert.equal(r.jobStatus, "needs_review", r.job?.error);
  const key = r.generation!.activeKeyId!;
  return request(`/runs/${r.id}/key-frame/approve`, { keyId: key });
}
async function board(r: Run) {
  await confirm(r, await quote(r, "board"));
  r = await done(r.id);
  assert.equal(r.jobStatus, "needs_review", r.job?.error);
  return r;
}
test("Strict score validation rejects missing, nonnumeric, nonfinite/out-of-range scores and empty explanations; overall is minimum", () => {
  const fixture = reviewFixture(promptDimensions, false);
  assert.equal(
    validateReview({ ...fixture, overall: 100 }, promptDimensions, 75, [])
      .overall,
    86,
  );
  for (const score of [-1, 101, "80", null, Infinity]) {
    const copy = structuredClone(fixture);
    (copy.dimensions.clarity as any).score = score;
    assert.throws(() => validateReview(copy, promptDimensions, 75, []));
  }
  assert.throws(() =>
    validateReview({ dimensions: {} }, frameDimensions, 70, []),
  );
});
test("Step4 integration: cost gates, all artifacts, image bytes, retries, invalidation and crash recovery", async (t) => {
  await start();
  try {
    let r = await prompt(await directions());
    await t.test(
      "legacy sample stages keep approved Story; stale quotes are rejected after a direction change",
      async () => {
        let legacy = await directions();
        const savedScript = structuredClone(legacy.script);
        delete legacy.generation;
        legacy.currentStage = "look";
        legacy.jobStatus = "waiting_confirmation";
        await writeFile(
          path.join(dir, `run-${legacy.id}.json`),
          JSON.stringify(legacy),
        );
        await request(`/runs/${legacy.id}/directions`, {});
        legacy = await done(legacy.id);
        assert.equal(legacy.generation!.directionsReady, true);
        assert.deepEqual(legacy.script, savedScript);
        legacy = await prompt(legacy);
        const stale = await quote(legacy, "key");
        await request(
          `/runs/${legacy.id}/directions/${legacy.directions[1].id}/select`,
          { note: "New approach" },
        );
        legacy = await done(legacy.id);
        await request(
          `/runs/${legacy.id}/key-frame`,
          { quoteId: stale.id },
          "POST",
          409,
        );
        assert.equal(
          legacy.aiCallLog.filter((c) => c.callType === "image").length,
          0,
        );
      },
    );

    await t.test(
      "five prompt dimensions belong to saved exact prompt; server minimum",
      () => {
        const p = r.generation!.prompts.at(-1)!;
        assert.equal(Object.keys(p.review!.dimensions).length, 5);
        assert.equal(
          p.review!.overall,
          Math.min(...Object.values(p.review!.dimensions).map((d) => d.score)),
        );
        assert.ok(p.prompt.includes("Make it playful"));
        assert.equal(p.callIds.length, 2);
      },
    );
    await t.test(
      "direct cost-gate bypass blocked and duplicate confirmation makes one call",
      async () => {
        await request(`/runs/${r.id}/key-frame`, {}, "POST", 400);
        await request(
          `/runs/${r.id}/key-frame`,
          { quoteId: "00000000-0000-0000-0000-000000000000" },
          "POST",
          409,
        );
        const q = await quote(r, "key");
        assert.equal(q.amountUsd, 0);
        const a = await Promise.all([confirm(r, q), confirm(r, q)]);
        assert.equal(a[0].job.id, a[1].job.id);
        r = await done(r.id);
        assert.equal(r.generation!.keys.length, 1);
        assert.equal(
          r.aiCallLog.filter((c) => c.callType === "image").length,
          1,
        );
        await confirm(r, q);
        assert.equal((await done(r.id)).generation!.keys.length, 1);
      },
    );
    await t.test(
      "key regeneration, approval and refresh persistence",
      async () => {
        await confirm(r, await quote(r, "key-regenerate", "Tighter crop"));
        r = await done(r.id);
        assert.equal(r.generation!.keys.length, 2);
        assert.equal(r.generation!.keys[0].approval, "replaced");
        r = await request(`/runs/${r.id}/key-frame/approve`, {
          keyId: r.generation!.activeKeyId,
        });
        assert.equal(
          (await request(`/runs/${r.id}`)).generation.approvedKeyId,
          r.generation!.activeKeyId,
        );
      },
    );
    await t.test(
      "actual key bytes sent to every generation; actual frame and key to review",
      async () => {
        r = await board(r);
        const g = r.generation!;
        assert.equal(g.board.length, 5);
        const key = g.keys.find((k) => k.id === g.approvedKeyId)!;
        const hash = createHash("sha256")
          .update(
            Buffer.from(
              await (await fetch(`${base}${key.imageUrl}`)).arrayBuffer(),
            ),
          )
          .digest("hex");
        for (const f of g.board.slice(1)) {
          const a = f.attempts[0],
            calls = r.aiCallLog.filter((c) => a.callIds.includes(c.id));
          assert.deepEqual(
            calls.find((c) => c.callType === "image")!.referenceHashes,
            [hash],
          );
          const frameHash = createHash("sha256")
            .update(
              Buffer.from(
                await (await fetch(`${base}${a.imageUrl}`)).arrayBuffer(),
              ),
            )
            .digest("hex");
          assert.deepEqual(
            calls.find((c) => c.task === "frame-review")!.referenceHashes,
            [frameHash, hash],
          );
          assert.equal(Object.keys(a.review!.dimensions).length, 6);
        }
        const selectedAssetIds = g.board.map((f) =>
          f.isKey
            ? key.assetId
            : f.attempts.find((a) => a.id === f.selectedAttemptId)!.assetId,
        );
        assert.equal(new Set(selectedAssetIds).size, selectedAssetIds.length);
      },
    );
    await t.test(
      "manual regeneration changes only selected frame and backend limit enforced",
      async () => {
        const before = structuredClone(r.generation!.board),
          f = before[2];
        await confirm(
          r,
          await quote(r, "frame-regenerate", "Closer detail", f.id),
        );
        r = await done(r.id);
        assert.deepEqual(
          r.generation!.board.filter((x) => x.id !== f.id),
          before.filter((x) => x.id !== f.id),
        );
        assert.equal(r.generation!.board[2].attempts.length, 2);
        await confirm(
          r,
          await quote(r, "frame-regenerate", "More light", f.id),
        );
        r = await done(r.id);
        await request(
          `/runs/${r.id}/image-quotes`,
          { action: "frame-regenerate", frameId: f.id, note: "Again" },
          "POST",
          409,
        );
        r = await request(`/runs/${r.id}/storyboard/approve`, {});
        assert.ok(r.generation!.boardApprovedAt);
      },
    );
    await t.test(
      "upload validated by image bytes; no AI image call; old Storyboard invalidated",
      async () => {
        const count = r.aiCallLog.length;
        await request(
          `/runs/${r.id}/key-frame/upload`,
          {
            dataUrl:
              "data:image/png;base64," +
              Buffer.from("not a PNG").toString("base64"),
          },
          "POST",
          409,
        );
        const image = await sharp({
          create: {
            width: 90,
            height: 160,
            channels: 3,
            background: "#775533",
          },
        })
          .png()
          .toBuffer();
        r = await request(`/runs/${r.id}/key-frame/upload`, {
          dataUrl: `data:image/png;base64,${image.toString("base64")}`,
        });
        assert.equal(r.aiCallLog.length, count);
        assert.equal(r.generation!.board.length, 0);
        assert.equal(r.generation!.approvedKeyId, undefined);
        assert.ok(r.generation!.archivedBoards.length);
      },
    );
    await t.test(
      "direction changes invalidate active prompt, Look approval and board while retaining attempts",
      async () => {
        const before = r.generation!.prompts.length;
        await request(`/runs/${r.id}/directions/${r.directions[1].id}/select`, {
          note: "Different composition",
        });
        r = await done(r.id);
        assert.equal(r.generation!.activeKeyId, undefined);
        assert.equal(r.generation!.board.length, 0);
        assert.equal(r.generation!.prompts.length, before + 1);
      },
    );
    await t.test(
      "mapping of 9 beats retains every ID and the payoff within six frames",
      async () => {
        let many = await prompt(await directions(true, 9));
        many = await look(many);
        many = await board(many);
        assert.equal(many.generation!.board.length, 6);
        assert.deepEqual(
          many.generation!.board.flatMap((f) => f.beatIds),
          many.script!.beats.map((b) => b.id),
        );
        assert.match(
          many.generation!.board.at(-1)!.instruction,
          /Final payoff/,
        );
      },
    );
    await t.test(
      "weak prompt repairs then passes; persistent weak prompt stops at rewrite limit",
      async () => {
        await stop();
        await start("prompt-improve");
        let weak = await prompt(await directions(true));
        assert.equal(weak.generation!.prompts.length, 2);
        assert.equal(weak.generation!.prompts[0].review!.passed, false);
        assert.equal(weak.generation!.prompts[1].review!.passed, true);
        await stop();
        await start("prompt-fail");
        weak = await prompt(await directions(true));
        assert.equal(weak.generation!.prompts.length, 2); // stops when improvement stalls
        assert.ok(weak.generation!.prompts.every((p) => !p.review!.passed));
      },
    );
    await t.test(
      "weak frame regenerates once; persistent weak frame retains honest score at limit",
      async () => {
        await stop();
        await start("frame-improve");
        let weak = await look(await prompt(await directions(true, 2)));
        weak = await board(weak);
        let f = weak.generation!.board[1];
        assert.equal(f.attempts.length, 2);
        assert.equal(f.attempts[0].review!.passed, false);
        assert.equal(f.attempts[1].review!.passed, true);
        await stop();
        await start("frame-fail");
        weak = await look(await prompt(await directions(true, 2)));
        weak = await board(weak);
        f = weak.generation!.board[1];
        assert.equal(f.attempts.length, 2);
        assert.equal(f.retryLimitReached, true);
        assert.equal(
          f.attempts.find((a) => a.id === f.selectedAttemptId)!.review!.overall,
          48,
        );
      },
    );
    await t.test(
      "a lower-scored relevant replacement wins over a polished wrong-subject frame",
      async () => {
        await stop();
        await start("frame-wrong-improve");
        let corrected = await look(await prompt(await directions(true, 2)));
        corrected = await board(corrected);
        const frame = corrected.generation!.board[1];
        assert.equal(frame.attempts.length, 2);
        assert.equal(frame.attempts[0].review!.overall, 97);
        assert.equal(frame.attempts[0].review!.passed, false);
        assert.equal(frame.attempts[1].review!.passed, true);
        assert.equal(frame.selectedAttemptId, frame.attempts[1].id);
      },
    );
    await t.test(
      "non-rate-limit provider error is persisted and never automatically retried",
      async () => {
        await stop();
        await start("provider-error");
        let e = await request("/runs", {
          ...brief,
          pastedScript: "One cup of coffee.",
        });
        await request(`/runs/${e.id}/directions`, {});
        e = await done(e.id);
        assert.equal(e.jobStatus, "failed");
        assert.equal(
          e.aiCallLog.filter((c) => c.outcome === "failed").length,
          1,
        ); // successful preflight is separate, no provider retry
        assert.match(e.job.error, /TEST provider error/);
      },
    );
    await t.test(
      "kill after first saved frame; restart shows interrupted; Resume reuses saved image and completed frame",
      async () => {
        await stop();
        await start("pass", 300);
        let recovering = await look(await prompt(await directions(true, 4)));
        await confirm(recovering, await quote(recovering, "board"));
        let saved: string | undefined;
        for (let i = 0; i < 300; i++) {
          recovering = await request(`/runs/${recovering.id}`);
          if (
            recovering.generation!.board[1]?.complete &&
            recovering.generation!.board[2]?.attempts.length
          ) {
            saved = recovering.generation!.board[1].attempts[0].assetId;
            break;
          }
          await sleep(20);
        }
        assert.ok(saved);
        const before = structuredClone(recovering.generation!.board[1]);
        const partiallySaved = structuredClone(
          recovering.generation!.board[2].attempts[0],
        );
        await stop();
        await start("pass", 100);
        recovering = await request(`/runs/${recovering.id}`);
        assert.equal(recovering.jobStatus, "interrupted");
        await request(`/runs/${recovering.id}/resume`, {});
        recovering = await done(recovering.id);
        assert.equal(
          recovering.jobStatus,
          "needs_review",
          recovering.job?.error,
        );
        assert.deepEqual(recovering.generation!.board[1], before);
        assert.equal(
          recovering.generation!.board[2].attempts[0].assetId,
          partiallySaved.assetId,
        );
        assert.equal(recovering.generation!.board[2].attempts.length, 1);
        assert.ok(
          recovering.generation!.activities.some((a) => a.state === "resumed"),
        );
        assert.ok(
          recovering.generation!.activities.some(
            (a) => a.state === "interrupted",
          ),
        );
        assert.ok(recovering.aiCallLog.every((c) => c.estimatedCostUsd === 0));
        assert.deepEqual(
          (await request(`/runs/${recovering.id}`)).generation,
          recovering.generation,
        );
      },
    );
  } finally {
    await stop();
    await rm(dir, { recursive: true, force: true });
  }
});
