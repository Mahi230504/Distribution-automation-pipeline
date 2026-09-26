import { assessBrief } from "./brief-assessment.js";
import { randomUUID } from "node:crypto";
import type { Run, GenerationKind } from "../../frontend/lib/types.js";
import { storage } from "./storage.js";
import { safeError } from "./settings.js";
import { requireBrief, assertVersion } from "./brief.js";
import { reviseScript } from "./script-feedback.js";
import { research, rewrite } from "./story.js";
import {
  runGeneration,
  ensureGeneration,
  consumeQuote,
  consumeResumeQuote,
  invalidateLook,
  activity,
  limits,
} from "./generation.js";
import { settings } from "./settings.js";
export const isBusy = (r: Run) => ["queued", "running"].includes(r.jobStatus);
export async function recover() {
  for (const run of await storage.listRuns())
    if (isBusy(run))
      await storage.updateRun(run.id, (r) => {
        r.jobStatus = "interrupted";
        for (const call of r.aiCallLog)
          if (call.outcome === "pending") {
            call.outcome = "interrupted";
            call.error =
              "Interrupted before usage was returned; live cost is unknown.";
          }
        if (r.generation)
          activity(
            r,
            r.job?.checkpoint ?? "interrupted",
            "Backend interrupted; saved outputs will be reused on Resume.",
            "interrupted",
          );
        if (r.job) {
          r.job.status = "interrupted";
          r.job.message =
            "Backend stopped during this job. Resume to continue from the saved checkpoint.";
        }
      });
}
async function execute(id: string) {
  try {
    await storage.updateRun(id, (r) => {
      r.jobStatus = "running";
      r.job!.status = "running";
    });
    await assessBrief(id);
    const r = await storage.getRun(id);
    if (!["story", "rewrite", "script-revision"].includes(r.job!.kind)) {
      await runGeneration(id);
      return;
    }
    if (r.job!.checkpoint !== "scripted") {
      if (r.job!.kind === "script-revision") await reviseScript(id);
      else if (r.job!.kind === "story") await research(id);
      else await rewrite(id);
    }
    await storage.updateRun(id, (r) => {
      r.jobStatus = "needs_review";
      r.job!.status = "completed";
      r.job!.message = "Story ready";
      r.job!.finishedAt = new Date().toISOString();
    });
  } catch (e) {
    await storage.updateRun(id, (r) => {
      r.jobStatus = "failed";
      r.job!.status = "failed";
      r.job!.error = safeError(e);
      r.job!.message = "Job failed";
      const f = r.feedbackHistory?.find((f) => f.id === r.job?.feedbackId);
      if (f && f.status !== "needs_research") {
        f.status = "failed";
        f.error = safeError(e);
      }
      if (r.generation) activity(r, r.job!.checkpoint, safeError(e), "failed");
    });
  }
}
export async function startJob(
  id: string,
  kind: "story" | "rewrite",
  options: { fresh?: boolean; factId?: string; removed?: boolean } = {},
  resume = false,
) {
  const current = await storage.getRun(id);
  if (
    resume &&
    current.job &&
    !["story", "rewrite", "script-revision"].includes(current.job.kind)
  )
    return resumeGeneration(id);
  const run = await storage.updateRun(id, (r) => {
    requireBrief(r);
    if (isBusy(r)) throw new Error("A job is already running for this run.");
    if (resume) {
      if (!r.job || r.jobStatus !== "interrupted")
        throw new Error("Only interrupted jobs can resume");
      delete r.job.error;
    } else {
      if (!["brief", "story"].includes(r.currentStage))
        throw new Error("Story changes are locked after approving Story.");
      r.job = {
        id: randomUUID(),
        kind,
        status: "queued",
        checkpoint: kind === "story" ? "start" : "rewrite",
        startedAt: new Date().toISOString(),
        message: kind === "story" ? "Researching" : "Rewriting affected beats",
        ...options,
      };
    }
    r.job!.status = "queued";
    r.jobStatus = "queued";
    r.currentStage = "story";
  });
  setImmediate(() => {
    execute(id).catch((e) => console.error(safeError(e)));
  });
  return run;
}

export function schedule(id: string) {
  setImmediate(() => {
    execute(id).catch((e) => console.error(safeError(e)));
  });
}
export async function startGeneration(
  id: string,
  kind: GenerationKind,
  input: {
    force?: boolean;
    expectedPromptId?: string;
    scriptVersion?: number;
    briefRevision?: number;
    directionId?: string;
    note?: string;
    quoteId?: string;
    frameId?: string;
  } = {},
) {
  let started = false;
  const run = await storage.updateRun(id, (r) => {
    requireBrief(r);
    const g = ensureGeneration(r);
    // Replays return the saved job/output, even after completion. No second schedule.
    if (
      input.quoteId &&
      g.quotes.find((q) => q.id === input.quoteId)?.usedByJobId
    )
      return;
    if (["queued", "running", "interrupted"].includes(r.jobStatus))
      throw new Error("A job is already active. Wait or Resume it first.");
    const jobId = randomUUID();
    let note = input.note ?? "";
    if (kind === "directions") {
      const legacyApprovedStory =
        !r.generation?.directionsReady &&
        r.sampleStages &&
        ["direction", "look", "storyboard"].includes(r.currentStage);
      if (
        !r.script ||
        !r.script.beats.length ||
        (!r.brief.pastedScript &&
          !legacyApprovedStory &&
          (r.currentStage !== "story" ||
            (r.jobStatus !== "needs_review" &&
              !(
                r.jobStatus === "failed" && r.job?.kind === "script-revision"
              ))))
      )
        throw new Error("Complete and approve Story first.");
      if (g.directionsReady) return;
      assertVersion(r, input.scriptVersion, input.briefRevision);
      // Approval is saved only after the fidelity checkpoint succeeds.
      g.storyApproved = false;
      r.currentStage = "direction";
    } else if (kind === "prompt") {
      assertVersion(
        r,
        r.storyApproval?.scriptVersion,
        r.storyApproval?.briefRevision,
      );
      if (input.expectedPromptId && g.activePromptId !== input.expectedPromptId)
        throw new Error("Prompt changed. Refresh first.");
      if (input.force) (g.promptFeedback ??= []).push(input.note ?? "");
      if (
        !g.storyApproved ||
        !g.directionsReady ||
        !r.directions.some((d) => d.id === input.directionId)
      )
        throw new Error("Choose one of the generated directions first.");
      if (
        r.selectedDirectionId === input.directionId &&
        r.directionNote === note &&
        g.activePromptId &&
        !input.force
      )
        return;
      g.revision++;
      delete g.activePromptId;
      invalidateLook(r);
      r.selectedDirectionId = input.directionId!;
      if (!input.force) r.directionNote = note;
      r.videoPrompt = null;
      r.currentStage = "direction";
    } else {
      const q = consumeQuote(r, input.quoteId, kind, jobId, input.frameId);
      note = q.note;
      if (kind === "frame-regenerate") {
        const f = g.board.find((f) => f.id === input.frameId)!;
        f.complete = false;
        delete f.restoredFromAttemptId;
        delete g.boardApprovedAt;
      }
      r.currentStage =
        kind === "board" || kind === "frame-regenerate" ? "storyboard" : "look";
    }
    g.limits = limits();
    r.job = {
      id: jobId,
      kind,
      status: "queued",
      checkpoint: "start",
      completed: [],
      startedAt: new Date().toISOString(),
      message: "Waiting to start",
      quoteId: input.quoteId,
      frameId: input.frameId,
      note,
    };
    r.jobStatus = "queued";
    activity(r, "start", "Job queued", "waiting");
    const planned =
      kind === "directions"
        ? ["Generate three directions"]
        : kind === "prompt"
          ? [
              "Generate full prompt",
              "Review five dimensions",
              "Repair and rescore only if needed",
            ]
          : kind.startsWith("key")
            ? [
                "Generate key frame",
                "Review actual pixels against the brief",
                "Repair only within confirmed allowance",
                "Save reviewed image for Look approval",
              ]
            : kind === "board"
              ? ["Map all beats", "Generate and review each remaining frame"]
              : ["Regenerate selected frame", "Review replacement"];
    for (const message of planned) activity(r, "planned", message, "pending");
    started = true;
  });
  if (started) schedule(id);
  return run;
}
export async function resumeGeneration(id: string, quoteId?: string) {
  const existing = await storage.getRun(id);
  if (
    quoteId &&
    existing.generation?.quotes.find((q) => q.id === quoteId)?.usedByJobId
  )
    return existing;
  const run = await storage.updateRun(id, (r) => {
    requireBrief(r);
    if (!r.job || !["interrupted", "failed"].includes(r.jobStatus))
      throw new Error(
        "Only interrupted or failed generation jobs can be resumed.",
      );
    if (quoteId) consumeResumeQuote(r, quoteId);
    if (
      !quoteId &&
      !settings.test &&
      ["key", "key-regenerate", "board", "frame-regenerate"].includes(
        r.job.kind,
      )
    )
      throw new Error(
        "A fresh cost confirmation is required to resume this live image job. Any previous unknown charge remains marked unknown; saved images will be reused.",
      );
    if (!r.generation) throw new Error("No generation state to resume");
    r.job.status = "queued";
    r.jobStatus = "queued";
    delete r.job.error;
    activity(
      r,
      r.job.checkpoint,
      "Resumed; reusing saved deliverables and completed checkpoints",
      "resumed",
    );
  });
  schedule(id);
  return run;
}
