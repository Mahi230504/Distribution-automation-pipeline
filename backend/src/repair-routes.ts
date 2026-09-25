import { Router } from "express";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { storage } from "./storage.js";
import {
  interpretationSchema,
  assertIdle,
  assertVersion,
  invalidateStory,
  brandConflict,
  requireBrief,
  mode,
} from "./brief.js";
import { schedule, startGeneration } from "./jobs.js";
import { parseScript } from "./script.js";
import { storeImage } from "./images.js";
export const repairRouter = Router();
const version = z.object({
  scriptVersion: z.number().int(),
  briefRevision: z.number().int(),
});
const brand = z.object({
  brandName: z.string().max(300),
  palette: z.array(z.string().max(30)).max(12),
  characterDescription: z.string().max(3000),
  tone: z.string().max(1000),
  constraints: z.string().max(3000),
  preferredPlatforms: z.array(
    z.enum(["instagram_reels", "youtube_shorts", "linkedin"]),
  ),
});
repairRouter.patch("/api/runs/:id/brief", async (req, res) => {
  const b = z
    .object({
      interpretation: interpretationSchema,
      expectedRevision: z.number(),
      brandKit: brand.optional(),
    })
    .parse(req.body);
  res.json(
    await storage.updateRun(String(req.params.id), (r) => {
      assertIdle(r);
      if (b.expectedRevision !== (r.effective?.revision ?? 0))
        throw new Error("Brief changed. Refresh first.");
      if (r.storyApproval) throw new Error("Reopen Story first.");
      if (brandConflict(b.interpretation.subject, b.brandKit ?? r.brandKit))
        throw new Error(
          "Conflicting coffee Brand kit: clear or edit the run-specific copy.",
        );
      invalidateStory(r);
      r.brief.topic = b.interpretation.subject;
      r.effective = {
        ...b.interpretation,
        revision: (r.effective?.revision ?? 0) + 1,
        brandSelection: b.brandKit
          ? "custom"
          : (r.effective?.brandSelection ?? "none"),
      };
      if (b.brandKit) r.brandKit = b.brandKit;
      r.facts = [];
      r.sources = [];
      r.research = undefined;
      r.script = null;
      r.scriptVersions = [];
      r.feedbackHistory = [];
      r.job = undefined;
      r.currentStage = "brief";
      r.mode ??= mode();
    }),
  );
});
repairRouter.post("/api/runs/:id/story/reopen", async (req, res) => {
  z.object({ confirmInvalidation: z.literal(true) }).parse(req.body);
  res.json(
    await storage.updateRun(String(req.params.id), (r) => {
      assertIdle(r);
      invalidateStory(r);
      r.job = undefined;
    }),
  );
});
repairRouter.post("/api/runs/:id/script/revise", async (req, res) => {
  const b = version
      .extend({
        note: z.string().trim().min(3).max(2000),
        scope: z.enum(["opening", "selected", "full"]),
        beatIds: z.array(z.string()).default([]),
      })
      .parse(req.body),
    id = String(req.params.id);
  const r = await storage.updateRun(id, (r) => {
    assertIdle(r);
    requireBrief(r);
    assertVersion(r, b.scriptVersion, b.briefRevision);
    if (r.currentStage !== "story" || r.storyApproval)
      throw new Error("Reopen Story first.");
    const f = {
      id: randomUUID(),
      note: b.note,
      scope:
        /(?:only|just) (?:the )?opening|opening.*(?:keep|preserve).*(?:remaining|other) beats/i.test(
          b.note,
        )
          ? ("opening" as const)
          : b.scope,
      beatIds: b.beatIds,
      baseVersion: b.scriptVersion,
      briefRevision: b.briefRevision,
      at: new Date().toISOString(),
      status: "pending" as const,
    };
    (r.feedbackHistory ??= []).push(f);
    r.job = {
      id: randomUUID(),
      kind: "script-revision",
      status: "queued",
      checkpoint: "revision",
      startedAt: new Date().toISOString(),
      message: "Revising saved script",
      feedbackId: f.id,
      baseScriptVersion: b.scriptVersion,
      briefRevision: b.briefRevision,
    };
    r.jobStatus = "queued";
  });
  schedule(id);
  res.status(202).json(r);
});
repairRouter.post("/api/runs/:id/script/restore", async (req, res) => {
  const b = version
    .extend({ restoreVersion: z.number().int() })
    .parse(req.body);
  res.json(
    await storage.updateRun(String(req.params.id), (r) => {
      assertIdle(r);
      assertVersion(r, b.scriptVersion, b.briefRevision);
      if (r.storyApproval || r.currentStage !== "story")
        throw new Error("Reopen Story first.");
      const prior = r.scriptVersions?.find(
        (s) => s.version === b.restoreVersion,
      );
      if (!prior) throw new Error("Version not found");
      const old = r.script!;
      (r.scriptVersions ??= []).push(old);
      r.script = {
        ...structuredClone(prior),
        version: old.version + 1,
        changeSummary: `Restored version ${prior.version}`,
      };
    }),
  );
});
repairRouter.patch("/api/runs/:id/script", async (req, res) => {
  const b = version
    .extend({ fullText: z.string().min(1).max(30000) })
    .parse(req.body);
  res.json(
    await storage.updateRun(String(req.params.id), (r) => {
      assertIdle(r);
      assertVersion(r, b.scriptVersion, b.briefRevision);
      if (r.storyApproval || r.currentStage !== "story")
        throw new Error("Reopen Story first.");
      const old = r.script!,
        next = parseScript(b.fullText, r.brief.durationSeconds, old);
      next.beats = next.beats.map((b) => {
        const prior = old.beats.find((p) => p.id === b.id);
        return prior?.vo === b.vo
          ? { ...b, claimType: prior.claimType }
          : { ...b, factIds: [], claimType: "user_unverified" };
      });
      (r.scriptVersions ??= []).push(old);
      r.script = {
        ...next,
        mode: mode(),
        changeSummary: "Direct edit; fidelity checked before Direction.",
      };
    }),
  );
});
repairRouter.post("/api/runs/:id/prompt/revise", async (req, res) => {
  const b = z
      .object({
        promptId: z.string(),
        note: z.string().trim().min(3).max(2000),
      })
      .parse(req.body),
    id = String(req.params.id);
  const r = await storage.getRun(id);
  assertIdle(r);
  if (r.generation?.activePromptId !== b.promptId)
    throw new Error("Prompt changed. Refresh first.");
  res.status(202).json(
    await startGeneration(id, "prompt", {
      directionId: r.selectedDirectionId!,
      note: b.note,
      force: true,
      expectedPromptId: b.promptId,
    }),
  );
});
repairRouter.post("/api/runs/:id/product-reference", async (req, res) => {
  const { dataUrl } = z
    .object({ dataUrl: z.string().max(30000000) })
    .parse(req.body);
  const m = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(
    dataUrl,
  );
  if (!m) throw new Error("Use PNG, JPEG or WebP.");
  const id = String(req.params.id),
    old = await storage.getRun(id);
  assertIdle(old);
  const image = await storeImage(Buffer.from(m[2], "base64"));
  res.json(
    await storage.updateRun(id, (r) => {
      assertIdle(r);
      if (r.updatedAt !== old.updatedAt)
        throw new Error("Run changed during upload. Retry.");
      if (r.generation?.activeKeyId)
        throw new Error(
          "Look already exists. Reopen Story to change product identity.",
        );
      r.productReference = {
        ...image,
        id: randomUUID(),
        jobId: "upload",
        attempt: 1,
        source: "uploaded",
        origin: "user",
        note: "Product identity reference, not finished Look",
        callIds: [],
        createdAt: new Date().toISOString(),
        mode: mode(),
      };
      if (r.generation) r.generation.revision++;
    }),
  );
});
