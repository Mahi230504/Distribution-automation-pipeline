import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { irrelevantFact, criticalText } from "../src/brief.js";
const dir = await mkdtemp(join(tmpdir(), "vpo-repair-")),
  base = "http://127.0.0.1:4103/api";
let child: ChildProcess;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function start(scenario = "pass", live = false, delay = 90) {
  child = spawn(process.execPath, ["dist/backend/src/server.js"], {
    env: {
      ...process.env,
      PORT: "4103",
      TEST_MODE: live ? "false" : "true",
      GEMINI_API_KEY: "",
      STORAGE_LOCAL_PATH: dir,
      TEST_DELAY_MS: String(delay),
      TEST_SCENARIO: scenario,
    },
    stdio: "pipe",
  });
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(base + "/runs")).ok) return;
    } catch {}
    await sleep(50);
  }
  throw Error("Backend did not start");
}
async function stop() {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exit = new Promise((r) => child.once("exit", r));
  child.kill("SIGKILL");
  await exit;
}
async function api(
  route: string,
  body?: any,
  method = body ? "POST" : "GET",
  ok = true,
) {
  const res = await fetch(base + route, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  assert.equal(res.ok, ok, JSON.stringify(data));
  return data;
}
async function done(id: string) {
  for (let i = 0; i < 300; i++) {
    const r = await api("/runs/" + id);
    if (!["queued", "running"].includes(r.jobStatus)) return r;
    await sleep(30);
  }
  throw Error("Timeout");
}
const input = (subject = "clothing brand", objective = "promote") => ({
  topic: subject,
  audience: "Young adults",
  platform: "instagram_reels",
  aspectRatio: "9:16",
  durationSeconds: 30,
  targetVideoModel: "Veo 3.1",
  sourceLinks: [],
  notes: "",
  pastedScript: null,
  brandSelection: "none",
  interpretation: {
    subject,
    objective,
    productDetails: /shoe/i.test(subject)
      ? "A plain unbranded shoe; no performance claims."
      : "A plain T-shirt; no material or performance claims.",
    visualPreferences: "Neutral studio, product detail and styling.",
    factualConstraints: "No invented product claims.",
    summary: `A product-led ${subject} campaign showing styling and details.`,
    confirmed: true,
  },
});
const version = (r: any) => ({
  scriptVersion: r.script.version,
  briefRevision: r.effective.revision,
});
async function story(subject = "clothing brand") {
  let r = await api("/runs", input(subject));
  await api(`/runs/${r.id}/story`, {});
  r = await done(r.id);
  assert.equal(r.jobStatus, "needs_review", r.job?.error);
  return r;
}
async function prompt(r: any) {
  await api(`/runs/${r.id}/directions`, version(r));
  r = await done(r.id);
  assert.equal(r.directions.length, 3, r.job?.error);
  await api(`/runs/${r.id}/directions/${r.directions[0].id}/select`, {
    note: "Focus on the product",
  });
  r = await done(r.id);
  assert.ok(r.generation.activePromptId, r.job?.error);
  return r;
}
async function image(r: any, action: string, frameId?: string) {
  const q = await api(`/runs/${r.id}/image-quotes`, {
    action,
    note: frameId ? "Closer product detail" : "",
    frameId,
  });
  const route =
    action === "key"
      ? "key-frame"
      : action === "board"
        ? "storyboard"
        : `frames/${frameId}/regenerate`;
  await api(`/runs/${r.id}/${route}`, { quoteId: q.id });
  return done(r.id);
}
test("Brief fidelity, revision history, safety gates, pixel inputs and provenance", async (t) => {
  await start();
  try {
    await t.test(
      "ambiguous unconfirmed brief blocks generation; conflicting saved coffee kit never silently applied",
      async () => {
        const b = input();
        delete (b as any).interpretation;
        const r = await api("/runs", b);
        await api(`/runs/${r.id}/story`, {}, "POST", false);
        assert.equal(r.aiCallLog.length, 0);
        await api(
          "/brand-kit",
          {
            brandName: "Northwind Coffee Co.",
            palette: ["#554433"],
            characterDescription: "A barista",
            tone: "Friendly",
            constraints: "",
            preferredPlatforms: ["instagram_reels"],
          },
          "PUT",
        );
        const conflict = await api("/runs", {
          ...input(),
          brandSelection: "saved",
        });
        await api(`/runs/${conflict.id}/story`, {}, "POST", false);
        const clean = await api("/runs", input());
        assert.equal(clean.brandKit.brandName, "");
        assert.equal(
          (await api("/brand-kit")).brandName,
          "Northwind Coffee Co.",
        );
      },
    );
    let r = await story();
    await t.test(
      "clothing and shoe campaigns retain product-led scripts; explicit Instagram explainer permits relevant platform facts",
      async () => {
        assert.doesNotMatch(
          r.script.fullText,
          /coffee|barista|daily shares|analytics dashboard/i,
        );
        assert.equal(irrelevantFact(r, "Instagram adoption grew"), true);
        const explainer = {
          ...r,
          effective: {
            ...r.effective,
            subject: "Instagram marketing metrics explainer",
            objective: "explain",
          },
        };
        assert.equal(
          irrelevantFact(explainer, "Instagram adoption grew"),
          false,
        );
        assert.equal(criticalText(r, "analytics dashboard").length, 1);
        assert.equal(criticalText(explainer, "analytics dashboard").length, 0);
        const shoe = await story("shoe brand");
        assert.match(shoe.script.fullText, /shoe/i);
        assert.doesNotMatch(shoe.script.fullText, /coffee|barista/i);
      },
    );
    await t.test(
      "creative product script can remove every fact without inventing replacement claims",
      async () => {
        let creative = await story("clothing launch");
        const before = structuredClone(creative.script.beats);
        for (const fact of creative.facts) {
          await api(
            `/runs/${creative.id}/facts`,
            { factId: fact.id, removed: true },
            "PATCH",
          );
          creative = await done(creative.id);
          assert.equal(creative.jobStatus, "needs_review", creative.job?.error);
        }
        assert.ok(creative.facts.every((f: any) => f.removed));
        assert.deepEqual(creative.script.beats, before);
        await api(`/runs/${creative.id}/directions`, version(creative));
        creative = await done(creative.id);
        assert.equal(creative.directions.length, 3, creative.job?.error);
      },
    );
    await t.test(
      "targeted feedback preserves unaffected beats; concurrent and stale writes rejected; full rewrite and restore persist",
      async () => {
        const before = structuredClone(r.script);
        await api(`/runs/${r.id}/script/revise`, {
          ...version(r),
          note: "Change only the opening to show product detail",
          scope: "opening",
        });
        await api(
          `/runs/${r.id}/script/revise`,
          { ...version(r), note: "Another revision", scope: "full" },
          "POST",
          false,
        );
        r = await done(r.id);
        assert.equal(r.script.version, before.version + 1, r.job?.error);
        assert.deepEqual(r.script.beats.slice(1), before.beats.slice(1));
        assert.notDeepEqual(r.script.beats[0], before.beats[0]);
        await api(
          `/runs/${r.id}/directions`,
          { ...version(r), scriptVersion: before.version },
          "POST",
          false,
        );
        await api(`/runs/${r.id}/script/revise`, {
          ...version(r),
          note: "Shorten to 30 seconds and focus on the product experience",
          scope: "full",
        });
        r = await done(r.id);
        assert.equal(r.feedbackHistory.at(-1).status, "completed");
        r = await api(`/runs/${r.id}/script/restore`, {
          ...version(r),
          restoreVersion: before.version,
        });
        assert.deepEqual(r.script.beats, before.beats);
        assert.ok(r.script.version > before.version);
        await stop();
        await start();
        assert.deepEqual((await api("/runs/" + r.id)).script, r.script);
      },
    );
    await t.test(
      "interrupted script revision reuses its saved draft and preserves protected beats",
      async () => {
        await stop();
        await start("pass", false, 350);
        const before = structuredClone(r.script);
        await api(`/runs/${r.id}/script/revise`, {
          ...version(r),
          note: "Change the opening with conversational tone",
          scope: "opening",
        });
        for (let i = 0; i < 100; i++) {
          r = await api("/runs/" + r.id);
          if (r.job.revisionDraft) break;
          await sleep(10);
        }
        assert.ok(r.job.revisionDraft);
        assert.equal(r.jobStatus, "running");
        const job = r.job.id;
        await stop();
        await start();
        r = await api("/runs/" + r.id);
        assert.equal(r.jobStatus, "interrupted");
        await api(`/runs/${r.id}/resume`, {});
        r = await done(r.id);
        assert.equal(r.script.version, before.version + 1, r.job?.error);
        assert.deepEqual(r.script.beats.slice(1), before.beats.slice(1));
        assert.equal(
          r.aiCallLog.filter(
            (c: any) => c.jobId === job && c.task === "script-revision",
          ).length,
          1,
        );
      },
    );
    await t.test(
      "unsupported claims require fresh research and preserve last good script and feedback",
      async () => {
        const before = r.script;
        await api(`/runs/${r.id}/script/revise`, {
          ...version(r),
          note: "Say this is 100% organic cotton",
          scope: "full",
        });
        r = await done(r.id);
        assert.equal(r.jobStatus, "failed");
        assert.equal(r.feedbackHistory.at(-1).status, "needs_research");
        assert.deepEqual(r.script, before);
      },
    );
    r = await prompt(r);
    await t.test(
      "prompt feedback rescores retained version and invalidates an earlier image quote",
      async () => {
        const old = r.generation.activePromptId;
        const q = await api(`/runs/${r.id}/image-quotes`, { action: "key" });
        await api(`/runs/${r.id}/prompt/revise`, {
          promptId: old,
          note: "Use a tighter product-led opening composition",
        });
        r = await done(r.id);
        assert.notEqual(r.generation.activePromptId, old);
        assert.match(
          r.generation.prompts.at(-1).inputSnapshot,
          /tighter product-led/,
        );
        assert.ok(r.generation.prompts.at(-1).review.passed);
        await api(`/runs/${r.id}/key-frame`, { quoteId: q.id }, "POST", false);
      },
    );

    await t.test(
      "product reference bytes reach key generation and actual pixels reach key review",
      async () => {
        const bytes = await sharp({
          create: { width: 32, height: 32, channels: 3, background: "#918773" },
        })
          .png()
          .toBuffer();
        r = await api(`/runs/${r.id}/product-reference`, {
          dataUrl: "data:image/png;base64," + bytes.toString("base64"),
        });
        const refBytes = Buffer.from(
          await (
            await fetch("http://127.0.0.1:4103" + r.productReference.imageUrl)
          ).arrayBuffer(),
        );
        const hash = createHash("sha256").update(refBytes).digest("hex");
        r = await image(r, "key");
        const key = r.generation.keys.at(-1);
        assert.ok(key.review.passed, r.job?.error);
        assert.ok(
          r.aiCallLog
            .find((c: any) => c.callType === "image")
            .referenceHashes.includes(hash),
        );
        const pixel = Buffer.from(
          await (
            await fetch("http://127.0.0.1:4103" + key.imageUrl)
          ).arrayBuffer(),
        );
        const pixelHash = createHash("sha256").update(pixel).digest("hex");
        assert.deepEqual(
          r.aiCallLog.find((c: any) => c.task === "key-review").referenceHashes,
          [pixelHash, hash],
        );
        assert.doesNotMatch(
          key.stillPrompt,
          /VO:|ON-SCREEN:|Instagram adoption/,
        );
        r = await api(`/runs/${r.id}/key-frame/approve`, { keyId: key.id });
      },
    );
    r = await image(r, "board");
    await t.test(
      "storyboard pixel content is distinct; selected frame feedback preserves other pixels",
      async () => {
        const g = r.generation;
        const hashes = await Promise.all(
          g.board.map(async (f: any) => {
            const a = f.isKey
              ? g.keys.find((k: any) => k.id === g.approvedKeyId)
              : f.attempts.find((a: any) => a.id === f.selectedAttemptId);
            return createHash("sha256")
              .update(
                Buffer.from(
                  await (
                    await fetch("http://127.0.0.1:4103" + a.imageUrl)
                  ).arrayBuffer(),
                ),
              )
              .digest("hex");
          }),
        );
        assert.equal(new Set(hashes).size, hashes.length);
        const before = structuredClone(g.board);
        r = await image(r, "frame-regenerate", g.board[1].id);
        assert.deepEqual(
          r.generation.board.filter((f: any) => f.id !== g.board[1].id),
          before.filter((f: any) => f.id !== g.board[1].id),
        );
        r = await api(`/runs/${r.id}/storyboard/approve`, {});
        assert.ok(r.generation.boardApprovedAt);
      },
    );
    await t.test(
      "Reopen invalidates approvals/quotes while preserving paid asset history; brief changes clear obsolete research",
      async () => {
        const old = structuredClone(r);
        const quote = await api(`/runs/${r.id}/image-quotes`, {
          action: "key-regenerate",
          note: "New angle",
        });
        r = await api(`/runs/${r.id}/story/reopen`, {
          confirmInvalidation: true,
        });
        assert.equal(r.storyApproval, undefined);
        assert.equal(r.generation.activePromptId, undefined);
        assert.equal(r.generation.board.length, 0);
        assert.ok(r.history.at(-1).generation.keys.length);
        assert.deepEqual(r.aiCallLog, old.aiCallLog);
        await api(
          `/runs/${r.id}/key-frame/regenerate`,
          { quoteId: quote.id },
          "POST",
          false,
        );
        r = await api(
          `/runs/${r.id}/brief`,
          {
            expectedRevision: r.effective.revision,
            interpretation: {
              ...r.effective,
              subject: "shoe brand",
              summary: "A shoe launch showing styling and product details.",
            },
          },
          "PATCH",
        );
        assert.equal(r.script, null);
        assert.equal(r.facts.length, 0);
        assert.equal(r.research, undefined);
      },
    );
    await t.test(
      "wrong-subject pixels with high style scores fail and cannot seed Storyboard",
      async () => {
        await stop();
        await start("wrong-subject");
        let wrong = await prompt(await story());
        wrong = await image(wrong, "key");
        const key = wrong.generation.keys.find(
          (k: any) => k.id === wrong.generation.activeKeyId,
        );
        assert.equal(key.review.passed, false);
        assert.ok(key.review.criticalFailures.length);
        assert.equal(wrong.generation.keys.length, 2);
        await api(
          `/runs/${wrong.id}/key-frame/approve`,
          { keyId: key.id },
          "POST",
          false,
        );
      },
    );
    await t.test(
      "old simulated artifacts remain test-labelled when server switches LIVE; no network needed",
      async () => {
        await stop();
        await start("pass", true);
        const saved = await api("/runs/" + r.id);
        assert.equal(saved.mode, "test");
        assert.equal(saved.history[0].script.mode, "test");
        await api(`/runs/${r.id}/story`, {}, "POST", false);
      },
    );
  } finally {
    await stop();
    await rm(dir, { recursive: true, force: true });
  }
});
