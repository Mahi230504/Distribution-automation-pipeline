import { z } from "zod";
import type { Run, ScriptBeat } from "../../frontend/lib/types.js";
import { storage } from "./storage.js";
import { callAI, parseReply } from "./gemini.js";
import { response } from "./fixtures.js";
import { makeScript } from "./script.js";
import { semanticBrief, mode } from "./brief.js";
const beat = z.object({
  id: z.string(),
  startSeconds: z.number(),
  endSeconds: z.number(),
  visual: z.string().min(5),
  vo: z.string(),
  onScreen: z.string(),
  factIds: z.array(z.string()),
  claimType: z.enum(["creative", "supported"]),
});
export async function validateNarration(
  ownerId: string,
  id: string,
  r: Run,
  beats: ScriptBeat[],
) {
  if (
    beats.some((b) =>
      b.factIds?.some((f) => !r.facts.some((x) => x.id === f && !x.removed)),
    )
  )
    throw new Error(
      "Script cites unavailable evidence. Fresh research required.",
    );
  const schema = z.object({ valid: z.boolean(), reason: z.string().min(1) });
  const invalid = beats.some((b) =>
    /100% organic|guaranteed|cures|carbon.neutral|waterproof/i.test(b.vo),
  );
  const raw = await callAI(
    ownerId,
    id,
    "review",
    `Check exact script against BOTH original content brief and evidence. Return {valid,reason}. Reject wrong subject/objective, unrelated brand, unsupported material/sustainability/price/performance/availability claims. Explicitly fictional events, metaphors, creative invitations and visual-only beats need no citations, provided they are not presented as real-world claims. Factual narration must follow the cited fact IDs. User product descriptions are not proof of performance. Brief:${JSON.stringify(semanticBrief(r))}. Facts:${JSON.stringify(r.facts.filter((f) => !f.removed))}. Beats:${JSON.stringify(beats)}`,
    () =>
      response({
        valid: !invalid,
        reason: invalid
          ? "Unsupported product claim; fresh research needed."
          : "Creative content and evidence match the brief.",
      }),
    false,
    undefined,
    { task: "script-fidelity", responseJsonSchema: z.toJSONSchema(schema) },
  );
  const result = schema.parse(parseReply(raw));
  if (!result.valid) throw new Error(result.reason);
}
export async function reviseScript(ownerId: string, id: string) {
  const r = await storage.getRun(ownerId, id),
    job = r.job!,
    fb = r.feedbackHistory!.find((f) => f.id === job.feedbackId)!;
  if (fb.status === "completed") return;
  const check = (r: Run) => {
    if (
      r.job?.id !== job.id ||
      r.script?.version !== fb.baseVersion ||
      r.effective?.revision !== fb.briefRevision
    )
      throw new Error("Revision inputs changed; late result rejected.");
  };
  check(r);
  const ids =
    fb.scope === "opening"
      ? [r.script!.beats[0].id]
      : fb.scope === "selected"
        ? fb.beatIds
        : r.script!.beats.map((b) => b.id);
  if (
    !ids.length ||
    ids.some((id) => !r.script!.beats.some((b) => b.id === id))
  )
    throw new Error("Select existing beats.");
  const originals = r.script!.beats.filter((b) => ids.includes(b.id));
  const schema = z.object({
    requiresResearch: z.boolean(),
    reason: z.string(),
    summary: z.string().min(5),
    beats: z.array(beat),
  });
  let parsed = job.revisionDraft ? schema.parse(job.revisionDraft) : undefined;
  if (!parsed) {
    const raw = await callAI(
      ownerId,
      id,
      "script-revision",
      `Revise ONLY selected beats using feedback. Return {requiresResearch,reason,summary,beats}. New unsupported real-world facts or changed subject require requiresResearch=true and beats:[], not fabricated support. Keep selected IDs/timestamps; return exactly selected IDs. Unselected beats stay unchanged. For full revision build a coherent, non-repetitive arc. Fit VO <=2.2 words/second. Creative invitations use factIds:[],claimType:creative. Factual narration uses retained factIds,claimType:supported. Serve the actual objective without imposing a specific industry or visual genre. Brief:${JSON.stringify(semanticBrief(r))}. Current:${JSON.stringify(r.script)}. Selected:${JSON.stringify(originals)}. Facts:${JSON.stringify(r.facts.filter((f) => !f.removed))}. Feedback history:${JSON.stringify(r.feedbackHistory)}. Note:${fb.note}`,
      () =>
        response({
          requiresResearch: /100% organic|new unsupported claim/i.test(fb.note),
          reason: "This controlled fixture requests a new unsupported claim.",
          summary: `Applied ${fb.scope} feedback: ${fb.note}`,
          beats: originals.map((b, i) => ({
            ...b,
            visual:
              fb.scope === "opening"
                ? `Close view of ${r.effective?.subject}: opening product detail revealed in soft natural light.`
                : b.visual,
            vo: /shorten|30 seconds/i.test(fb.note)
              ? b.vo
                  .split(/\s+/)
                  .slice(0, Math.floor((b.endSeconds - b.startSeconds) * 2))
                  .join(" ")
              : i
                ? "Make it your own."
                : "Take a closer look.",
            factIds: [],
            claimType: "creative",
          })),
        }),
      false,
      undefined,
      { task: "script-revision", responseJsonSchema: z.toJSONSchema(schema) },
    );
    parsed = schema.parse(parseReply(raw));
  }
  if (parsed.requiresResearch) {
    await storage.updateRun(ownerId, id, (r) => {
      const f = r.feedbackHistory!.find((f) => f.id === fb.id)!;
      f.status = "needs_research";
      f.error = parsed.reason;
    });
    throw new Error(`Fresh research needed: ${parsed.reason}`);
  }
  if (
    parsed.beats.length !== ids.length ||
    new Set(parsed.beats.map((b) => b.id)).size !== ids.length ||
    parsed.beats.some((b) => {
      const old = originals.find((o) => o.id === b.id);
      return (
        !old ||
        b.startSeconds !== old.startSeconds ||
        b.endSeconds !== old.endSeconds
      );
    })
  )
    throw new Error(
      "Revision changed protected IDs or timings. Last good script retained.",
    );
  await storage.updateRun(ownerId, id, (current) => {
    check(current);
    current.job!.revisionDraft = parsed;
    current.job!.checkpoint = "revision-written";
    current.job!.message =
      "Checking revised script against the brief and evidence";
  });
  const beats = r.script!.beats.map(
    (b) => parsed.beats.find((p) => p.id === b.id) ?? b,
  );
  await validateNarration(ownerId, id, r, beats);
  await storage.updateRun(ownerId, id, (r) => {
    check(r);
    const old = r.script!;
    (r.scriptVersions ??= []).push(old);
    r.script = {
      ...makeScript(beats, r.brief.durationSeconds, old.version + 1),
      mode: mode(),
      changeSummary: parsed.summary,
      changedBeatIds: ids,
    };
    const f = r.feedbackHistory!.find((f) => f.id === fb.id)!;
    f.status = "completed";
    f.resultVersion = r.script.version;
    f.summary = parsed.summary;
    delete r.storyApproval;
    r.job!.checkpoint = "scripted";
  });
}
