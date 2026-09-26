import { reviewEvidence } from "../src/evidence.js";
import test from "node:test";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { mapConcurrent } from "../src/concurrent.js";
import { requireBrief, semanticBrief } from "../src/brief.js";
import { assessmentKey } from "../src/brief-assessment.js";
import {
  attachIntentCheck,
  focusedFeedback,
  frameDimensions,
  reviewFixture,
  validateReview,
} from "../src/generation-quality.js";
import type { Run } from "../../frontend/lib/types.js";
const run = (subject: string, objective = "promote") =>
  ({
    mode: "test",
    effective: {
      subject,
      objective,
      productDetails:
        "A specified offering, concept or process with its intended visible details.",
      summary: "An explicit interpretation of the requested content.",
      visualPreferences: "",
      factualConstraints: "",
      confirmed: true,
      revision: 1,
    },
    brief: {
      topic: subject,
      audience: "Beginners",
      notes: "",
      sourceLinks: [],
      pastedScript: null,
    },
    brandKit: {
      brandName: "Coffee sponsor",
      characterDescription: "A barista",
    },
  }) as unknown as Run;
test("No industry or platform keyword blocks legitimate confirmed briefs", () => {
  for (const [subject, objective] of [
    ["Coffee brewing demonstration", "demonstrate"],
    ["Software analytics dashboard", "explain"],
    ["Pottery workshop", "promote"],
    ["Clothing sponsored by a cafe", "promote"],
    ["Bird migration", "explain"],
    ["A fictional robot gardener", "tell a story"],
    ["1080p display comparison", "explain"],
    ["Fishing reels maintenance", "demonstrate"],
  ])
    assert.doesNotThrow(() => requireBrief(run(subject, objective)));
});
test("Short briefs do not require duplicate product details; semantic assessment handles essential ambiguity", () => {
  for (const subject of [
    "Software company",
    "Cleaning service",
    "Coffee brand",
    "Shoe brand",
  ]) {
    const r = run(subject);
    r.effective!.productDetails = "";
    assert.doesNotThrow(() => requireBrief(r));
  }
});
test("Brief assessment reuse is input-bound and does not infer subject from platform", () => {
  const r = run("Bird migration", "explain"),
    key = assessmentKey(r);
  r.brief.platform = "instagram_reels";
  assert.equal(assessmentKey(r), key);
  assert.equal(semanticBrief(r).subject, "Bird migration");
  r.brandKit!.constraints = "Use only the sponsoring logo; no mascot";
  assert.notEqual(assessmentKey(r), key);
});
test("Missing observable action defeats perfect scores and malformed evidence is rejected", () => {
  const f = reviewFixture(frameDimensions, false);
  for (const d of Object.values(f.dimensions)) d.score = 100;
  f.visibleChecks![1].observed = false;
  assert.equal(validateReview(f, frameDimensions, 70, []).passed, false);
  const review = validateReview(f, frameDimensions, 70, []);
  assert.match(focusedFeedback(review), /Specific visible moment/);
  f.visibleChecks![1].evidence = "";
  assert.throws(() => validateReview(f, frameDimensions, 70, []));
  delete f.visibleChecks;
  assert.throws(() => validateReview(f, frameDimensions, 70, []), /observable/);
});
test("Bounded parallel source I/O preserves attribution order and reduces waiting", async () => {
  const delays = [80, 20, 60, 40, 30, 50];
  let active = 0,
    peak = 0;
  const fn = async (n: number) => {
    peak = Math.max(peak, ++active);
    await new Promise((r) => setTimeout(r, n));
    active--;
    return n;
  };
  const start = performance.now();
  const serial = await mapConcurrent(delays, 1, fn);
  const serialMs = performance.now() - start;
  peak = 0;
  const second = performance.now();
  const parallel = await mapConcurrent(delays, 3, fn);
  const parallelMs = performance.now() - second;
  assert.deepEqual(parallel, serial);
  assert.equal(peak, 3);
  assert.ok(parallelMs < serialMs * 0.8, `${parallelMs} vs ${serialMs}`);
  console.log(
    `Controlled source-I/O benchmark: serial ${serialMs.toFixed(0)}ms, parallel ${parallelMs.toFixed(0)}ms. Same output/order.`,
  );
});

test("Duplicate resolved pages share text while all grounding-source edges survive", () => {
  const data = {
    facts: [
      { id: "f1", text: "Claim one", sourceIds: ["s1"] },
      { id: "f2", text: "Claim two", sourceIds: ["s2", "s3"] },
    ],
    sources: [
      {
        id: "s1",
        url: "https://example.com/a",
        evidenceText: "Exact shared source evidence.",
      },
      {
        id: "s2",
        url: "https://example.com/a",
        evidenceText: "Exact shared source evidence.",
      },
      {
        id: "s3",
        url: "https://example.com/b",
        evidenceText: "Different evidence.",
      },
    ],
  } as unknown as Run;
  const e = reviewEvidence(data);
  assert.equal(e.sourcePages.length, 2);
  assert.deepEqual(e.sourcePages[0].ids, ["s1", "s2"]);
  for (const fact of e.facts)
    for (const id of fact.sourceIds!)
      assert.equal(
        e.sourcePages.find((p) => p.ids.includes(id))!.exactPageText,
        data.sources.find((s) => s.id === id)!.evidenceText,
      );
  assert.deepEqual(e.facts[1].sourceIds, ["s2", "s3"]);
});

test("Independent intent contradiction vetoes high numerical scores without altering those scores", () => {
  const r = validateReview(
    reviewFixture(frameDimensions, false),
    frameDimensions,
    70,
    [],
  );
  const overall = r.overall;
  assert.equal(r.passed, true);
  attachIntentCheck(r, {
    passed: false,
    reason: "The described contents contradict the required empty state.",
  });
  assert.equal(r.overall, overall);
  assert.equal(r.passed, false);
  assert.match(focusedFeedback(r), /empty state/);
});
