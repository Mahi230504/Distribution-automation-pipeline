import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
process.env.STORAGE_LOCAL_PATH = await mkdtemp(os.tmpdir() + "/vpo-gemini-");
process.env.TEST_MODE = "true";
process.env.GEMINI_API_KEY = "";
process.env.TEST_DELAY_MS = "0";
process.env.GEMINI_RETRY_DELAY_MS = "1";
const { storage } = await import("../src/storage.js");
const { callAI, parseReply, sleep } = await import("../src/gemini.js");
const { response } = await import("../src/fixtures.js");
const { research } = await import("../src/story.js");
import type { Run } from "../../frontend/lib/types.js";
const run = {
  id: "test",
  userId: "local-user",
  aiCallLog: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  brief: {
    topic: "Coffee",
    audience: "Beginners",
    sourceLinks: [],
    notes: "",
    durationSeconds: 30,
  },
  facts: [],
  sources: [],
  jobStatus: "running",
  job: {
    id: "j",
    kind: "story",
    checkpoint: "start",
    status: "running",
    startedAt: new Date().toISOString(),
    message: "",
  },
} as unknown as Run;
await storage.init();
await storage.createRun(run);
test("Retries 429 twice, records each attempt; never retries other errors; respects concurrency", async () => {
  let tries = 0;
  await assert.rejects(() =>
    callAI(
      "test",
      "review",
      "",
      () => response({}),
      false,
      async () => {
        tries++;
        throw Object.assign(new Error("Rate limit"), { status: 429 });
      },
    ),
  );
  assert.equal(tries, 3);
  let logs = (await storage.getRun("test")).aiCallLog;
  assert.deepEqual(
    logs.map((c) => c.outcome),
    ["retried", "retried", "failed"],
  );
  tries = 0;
  await assert.rejects(() =>
    callAI(
      "test",
      "review",
      "",
      () => response({}),
      false,
      async () => {
        tries++;
        throw Object.assign(new Error("Invalid request"), { status: 400 });
      },
    ),
  );
  assert.equal(tries, 1);
  let active = 0,
    peak = 0;
  await Promise.all(
    Array.from({ length: 6 }, () =>
      callAI(
        "test",
        "script",
        "",
        () => response({}),
        false,
        async () => {
          active++;
          peak = Math.max(peak, active);
          await sleep(10);
          active--;
          return response({});
        },
      ),
    ),
  );
  assert.ok(peak <= 2);
});
test("Defensive JSON parser accepts fenced JSON and reports malformed reply prefix", () => {
  const r = response({ hello: "world" });
  r.candidates![0].content!.parts![0].text = '```json\n{"hello":"world"}\n```';
  assert.deepEqual(parseReply(r), { hello: "world" });
  r.candidates![0].content!.parts![0].text = "This is not JSON";
  assert.throws(() => parseReply(r), /Reply starts: This is not JSON/);
});
test("Missing citation evidence drops all facts and fails clearly", async () => {
  await storage.updateRun("test", (r) => {
    r.job!.checkpoint = "researched";
    r.research = {
      status: "uncited",
      createdAt: new Date().toISOString(),
      cacheKey: "missing",
      dropped: [],
    };
    r.facts = [
      {
        id: "fact-1",
        text: "Claim without evidence",
        label: "implied",
        sourceId: "",
        sourceIds: [],
        removed: false,
      },
    ];
    r.sources = [];
  });
  await assert.rejects(() => research("test"), /uncited/);
  const result = await storage.getRun("test");
  assert.equal(result.facts.length, 0);
  assert.equal(result.research?.dropped.length, 1);
});

test("Source fetch refuses private addresses and non-HTTPS URLs", async () => {
  const { publicPage } = await import("../src/web.js");
  await assert.rejects(() => publicPage("https://127.0.0.1"), /non-public/);
  await assert.rejects(() => publicPage("http://example.com"), /HTTPS/);
});

test("Live-price arithmetic includes thinking tokens and grounding without a network call", async () => {
  const { settings } = await import("../src/settings.js");
  const previous = settings.test;
  try {
    settings.test = false;
    const reply = response({ facts: [{ text: "Sample claim" }] }, true);
    reply.usageMetadata = {
      promptTokenCount: 1000000,
      candidatesTokenCount: 500000,
      thoughtsTokenCount: 500000,
    };
    await callAI(
      "test",
      "research",
      "",
      () => reply,
      true,
      async () => reply,
    );
    const log = (await storage.getRun("test")).aiCallLog.at(-1)!;
    assert.equal(log.outputTokens, 1000000);
    assert.ok(Math.abs(log.estimatedCostUsd - 4.514) < 0.000001);
    assert.equal(log.searchRequests, 1);
  } finally {
    settings.test = previous;
  }
});

test("Image estimate separates image output from text/thinking; fresh recovery quote consumes once without any network", async () => {
  const { settings } = await import("../src/settings.js");
  const { ensureGeneration, quoteImages, consumeResumeQuote } =
    await import("../src/generation.js");
  const prior = settings.test;
  try {
    settings.test = false;
    const raw = response({});
    raw.candidates![0].content!.parts = [
      { inlineData: { mimeType: "image/png", data: "eA==" } },
    ];
    raw.usageMetadata = {
      promptTokenCount: 1000,
      candidatesTokenCount: 1220,
      thoughtsTokenCount: 50,
    };
    await callAI(
      "test",
      "image",
      "",
      () => raw,
      false,
      async () => raw,
      { stage: "look", image: true },
    );
    const log = (await storage.getRun("test")).aiCallLog.at(-1)!;
    assert.equal(log.imageCount, 1);
    assert.ok(
      Math.abs(
        log.estimatedCostUsd -
          (settings.imagePrice +
            (1000 * settings.imageInput) / 1e6 +
            (150 * settings.imageOutput) / 1e6),
      ) < 1e-9,
    );
    await storage.updateRun("test", (r) => {
      const g = ensureGeneration(r);
      r.jobStatus = "interrupted";
      r.job!.kind = "key";
      g.revision = 4;
    });
    const quote = await quoteImages("test", "key", undefined, "", true);
    assert.ok(quote.amountUsd > 0);
    await storage.updateRun("test", (r) => consumeResumeQuote(r, quote.id));
    await assert.rejects(
      () => storage.updateRun("test", (r) => consumeResumeQuote(r, quote.id)),
      /fresh cost confirmation/,
    );
  } finally {
    settings.test = prior;
  }
});
