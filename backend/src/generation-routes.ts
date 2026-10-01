import { mode, requireBrief, assertVersion } from "./brief.js";
import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { storage } from "./storage.js";
import { startGeneration, resumeGeneration, isBusy } from "./jobs.js";
import {
  ensureGeneration,
  quoteImages,
  invalidateLook,
  activity,
  invalidateBoard,
} from "./generation.js";
import { storeImage } from "./images.js";
import { owner } from "./auth.js";
import { calculateReadiness, invalidateRelease } from "./release.js";
export const generationRouter = Router();
const note = z.string().trim().max(2000).default("");
const confirmation = z.object({ quoteId: z.string().uuid() });
const runId = (p: Record<string, unknown>) => String(p.id);
generationRouter.get("/api/images/:assetId", async (req, res) => {
  const data = await storage.readImage(owner(req), String(req.params.assetId));
  res
    .set({
      "Content-Type": "image/png",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    })
    .vary("Authorization")
    .send(data);
});
generationRouter.post("/api/runs/:id/directions", async (req, res) =>
  res
    .status(202)
    .json(
      await startGeneration(
        owner(req),
        runId(req.params),
        "directions",
        z
          .object({ scriptVersion: z.number(), briefRevision: z.number() })
          .parse(req.body),
      ),
    ),
);
generationRouter.post(
  "/api/runs/:id/directions/:directionId/select",
  async (req, res) =>
    res.status(202).json(
      await startGeneration(owner(req), runId(req.params), "prompt", {
        directionId: String(req.params.directionId),
        note: note.parse(req.body?.note),
      }),
    ),
);
generationRouter.post("/api/runs/:id/image-quotes", async (req, res) => {
  const body = z
    .object({
      action: z.enum(["key", "key-regenerate", "board", "frame-regenerate"]),
      frameId: z.string().optional(),
      note,
      resume: z.boolean().optional(),
    })
    .parse(req.body);
  res.json(
    await quoteImages(
      owner(req),
      runId(req.params),
      body.action,
      body.frameId,
      body.note,
      body.resume,
    ),
  );
});
for (const [suffix, kind] of [
  ["key-frame", "key"],
  ["key-frame/regenerate", "key-regenerate"],
  ["storyboard", "board"],
  ["frames/:frameId/regenerate", "frame-regenerate"],
] as const) {
  generationRouter.post(`/api/runs/:id/${suffix}`, async (req, res) => {
    const { quoteId } = confirmation.parse(req.body ?? {});
    const ownerId = owner(req);
    const run = await storage.getRun(ownerId, runId(req.params));
    if (run.generation?.quotes.find((q) => q.id === quoteId)?.resumeJobId) {
      res.status(202).json(await resumeGeneration(ownerId, run.id, quoteId));
      return;
    }
    res.status(202).json(
      await startGeneration(ownerId, runId(req.params), kind, {
        quoteId,
        frameId: (req.params as Record<string, string>).frameId,
      }),
    );
  });
}
generationRouter.post("/api/runs/:id/key-frame/upload", async (req, res) => {
  const { dataUrl } = z
    .object({ dataUrl: z.string().max(30000000) })
    .parse(req.body);
  const match =
    /^data:image\/(?:png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(
      dataUrl,
    );
  if (!match) throw new Error("Upload a PNG, JPEG or WebP image.");
  const id = runId(req.params), ownerId = owner(req),
    initial = await storage.getRun(ownerId, id);
  if (
    isBusy(initial) ||
    initial.jobStatus === "interrupted" ||
    !initial.generation?.activePromptId
  )
    throw new Error("Complete the prompt and any active job before uploading.");
  const stored = await storeImage(ownerId, id, Buffer.from(match[1], "base64"));
  res.json(
    await storage.updateRun(ownerId, id, (r) => {
      if (
        isBusy(r) ||
        r.jobStatus === "interrupted" ||
        r.generation?.activePromptId !== initial.generation?.activePromptId
      )
        throw new Error("The run changed during upload. Please upload again.");
      invalidateLook(r);
      const g = ensureGeneration(r);
      const image = {
        id: randomUUID(),
        ...stored,
        attempt: g.keys.length + 1,
        jobId: "upload",
        note: "User supplied reference",
        origin: "user" as const,
        source: "uploaded" as const,
        mode: mode(),
        callIds: [],
        createdAt: new Date().toISOString(),
      };
      g.keys.push(image);
      g.activeKeyId = image.id;
      r.currentStage = "look";
      r.jobStatus = "needs_review";
      activity(
        r,
        "key-upload",
        "Reference uploaded; no AI image call or cost",
        "completed",
      );
    }),
  );
});
generationRouter.post("/api/runs/:id/key-frame/approve", async (req, res) => {
  const { keyId } = z.object({ keyId: z.string().uuid() }).parse(req.body);
  res.json(
    await storage.updateRun(owner(req), runId(req.params), (r) => {
      if (isBusy(r) || r.jobStatus === "interrupted")
        throw new Error("Wait for the current job.");
      requireBrief(r);
      assertVersion(
        r,
        r.storyApproval?.scriptVersion,
        r.storyApproval?.briefRevision,
      );
      const g = ensureGeneration(r),
        key = g.keys.find((k) => k.id === keyId && k.id === g.activeKeyId);
      if (!key) throw new Error("Approve the current key frame.");
      if (key.source === "generated" && !key.review?.passed)
        throw new Error(
          "Key frame has not passed subject and quality review. Change it or upload a finished reference.",
        );
      key.approval = "approved";
      g.approvedKeyId = key.id;
      r.currentStage = "storyboard";
      r.jobStatus = "waiting_confirmation";
      activity(r, "look-approval", "Key frame approved", "completed");
    }),
  );
});
generationRouter.post("/api/runs/:id/key-frame/reject", async (req, res) => {
  res.json(
    await storage.updateRun(owner(req), runId(req.params), (r) => {
      if (isBusy(r) || r.jobStatus === "interrupted")
        throw new Error("Wait for the current job.");
      const g = ensureGeneration(r),
        key = g.keys.find((k) => k.id === g.activeKeyId);
      if (!key) throw new Error("No key frame to reject.");
      key.approval = "rejected";
      delete g.approvedKeyId;
      invalidateBoard(r);
      r.currentStage = "look";
      activity(
        r,
        "look-rejected",
        "Key frame rejected; dependent Storyboard invalidated",
        "completed",
      );
    }),
  );
});
generationRouter.post(
  "/api/runs/:id/frames/:frameId/restore",
  async (req, res) => {
    const body = z
      .object({
        attemptId: z.string().uuid(),
        expectedSelectedAttemptId: z.string().uuid(),
      })
      .parse(req.body);
    res.json(
      await storage.updateRun(owner(req), runId(req.params), (r) => {
        if (isBusy(r) || r.jobStatus === "interrupted")
          throw new Error("Finish or Resume the current job first.");
        requireBrief(r);
        assertVersion(
          r,
          r.storyApproval?.scriptVersion,
          r.storyApproval?.briefRevision,
        );
        const g = ensureGeneration(r),
          f = g.board.find(
            (f) => f.id === String(req.params.frameId) && !f.isKey,
          );
        if (!f || !f.complete)
          throw new Error("Choose a completed storyboard frame.");
        if (f.selectedAttemptId === body.attemptId) return;
        if (f.selectedAttemptId !== body.expectedSelectedAttemptId)
          throw new Error("Frame changed. Refresh before restoring.");
        const a = f.attempts.find((a) => a.id === body.attemptId);
        if (!a?.review?.passed || a.intentAudit?.passed === false)
          throw new Error("Only a passing saved attempt can be restored.");
        f.restoredFromAttemptId = f.selectedAttemptId;
        f.selectedAttemptId = a.id;
        f.retryLimitReached = false;
        delete g.boardApprovedAt;
        invalidateRelease(r, "Storyboard frame restored");
        r.jobStatus = "needs_review";
        activity(
          r,
          "frame-restore",
          `Restored frame ${f.order + 1} attempt ${a.attempt}; later changes remain in history. No AI call or cost.`,
          "completed",
          "user",
        );
      }),
    );
  },
);
generationRouter.post("/api/runs/:id/storyboard/approve", async (req, res) =>
  res.json(
    await storage.updateRun(owner(req), runId(req.params), (r) => {
      const g = ensureGeneration(r);
      if (
        isBusy(r) ||
        r.jobStatus === "interrupted" ||
        !g.board.length ||
        g.board.some((f) => !f.complete) ||
        !g.approvedKeyId
      )
        throw new Error("Finish the Storyboard before approving it.");
      requireBrief(r);
      assertVersion(
        r,
        r.storyApproval?.scriptVersion,
        r.storyApproval?.briefRevision,
      );
      if (
        g.board.some((f) => {
          const a = f.attempts.find((a) => a.id === f.selectedAttemptId);
          return (
            !a ||
            (!f.isKey && !a.review) ||
            a.intentAudit?.passed === false ||
            a.review?.visibleChecks?.some((c) => !c.observed) ||
            !!a.review?.criticalFailures?.length
          );
        })
      )
        throw new Error(
          "Resolve failed visual requirements or restore a passing frame before approving the Storyboard.",
        );
      g.boardApprovedAt = new Date().toISOString();
      r.currentStage = "storyboard";
      r.jobStatus = "completed";
      calculateReadiness(r);
      activity(
        r,
        "board-approved",
        "Storyboard approved — Session 10.3 complete",
        "completed",
      );
    }),
  ),
);
