import { assessBrief } from "./brief-assessment.js";
import { randomUUID } from "node:crypto";
import type { Run, GenerationKind, PackIntent } from "../../frontend/lib/types.js";
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
import { runPack } from "./pack.js";
import { applySupersession, calculateReadiness, ensureRelease, fingerprint, invalidateRelease, prepareSupersession, RELEASE_POLICY_FINGERPRINT, storyboardLineage } from "./release.js";
import { packContext, packProvenance, packSettingsFingerprint } from "./pack.js";
export const isBusy = (r: Run) => ["queued", "running"].includes(r.jobStatus);
export async function recover() {
  for (const run of await storage.listRecoverableRuns())
    if (isBusy(run))
      await storage.updateRun(run.userId, run.id, (r) => {
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
          if (r.job.kind === "pack" && r.aiCallLog.some(c => c.jobId === r.job?.id && ["pending", "interrupted", "success"].includes(c.outcome)) && !r.job.packDraft) {
            r.job.ambiguousProviderResult = true;
            r.job.message = "The Pack provider result is unknown. This confirmed intent will not be repeated; request a new Pack estimate.";
            const intent = ensureRelease(r).packIntents.find((item) => item.id === r.job?.packIntentId);
            if (intent) intent.status = "ambiguous";
          }
        }
      });
}
async function execute(ownerId: string, id: string) {
  try {
    await storage.updateRun(ownerId, id, (r) => {
      r.jobStatus = "running";
      r.job!.status = "running";
    });
    let r = await storage.getRun(ownerId, id);
    if (r.job!.kind === "pack") { await runPack(ownerId, id); return; }
    await assessBrief(ownerId, id);
    r = await storage.getRun(ownerId, id);
    if (!["story", "rewrite", "script-revision"].includes(r.job!.kind)) {
      await runGeneration(ownerId, id);
      return;
    }
    if (r.job!.checkpoint !== "scripted") {
      if (r.job!.kind === "script-revision") await reviseScript(ownerId, id);
      else if (r.job!.kind === "story") await research(ownerId, id);
      else await rewrite(ownerId, id);
    }
    await storage.updateRun(ownerId, id, (r) => {
      r.jobStatus = "needs_review";
      r.job!.status = "completed";
      r.job!.message = "Story ready";
      r.job!.finishedAt = new Date().toISOString();
    });
  } catch (e) {
    await storage.updateRun(ownerId, id, (r) => {
      r.jobStatus = "failed";
      r.job!.status = "failed";
      r.job!.error = safeError(e);
      r.job!.message = "Job failed";
      if (r.job?.kind === "pack" && !r.job.packDraft && r.aiCallLog.some((call) => call.jobId === r.job?.id && ["pending", "interrupted", "success"].includes(call.outcome))) {
        r.job.ambiguousProviderResult = true;
        r.job.message = "The Pack provider result is unknown. This confirmed intent will not be repeated; confirm a new Pack intent.";
        const intent = ensureRelease(r).packIntents.find((item) => item.id === r.job?.packIntentId);
        if (intent) intent.status = "ambiguous";
      }
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
  ownerId: string,
  id: string,
  kind: "story" | "rewrite",
  options: { fresh?: boolean; factId?: string; removed?: boolean } = {},
  resume = false,
) {
  const current = await storage.getRun(ownerId, id);
  if (
    resume &&
    current.job &&
    !["story", "rewrite", "script-revision"].includes(current.job.kind)
  )
    return resumeGeneration(ownerId, id);
  const run = await storage.updateRun(ownerId, id, (r) => {
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
        ownerId,
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
    execute(ownerId, id).catch((e) => console.error(safeError(e)));
  });
  return run;
}

function stalePackQuote(run:Run,quote:ReturnType<typeof ensureRelease>["packQuotes"][number],confirmedAt:string){return Date.parse(quote.expiresAt)<Date.parse(confirmedAt)||quote.settingsFingerprint!==packSettingsFingerprint()||quote.validationPolicyFingerprint!==RELEASE_POLICY_FINGERPRINT||quote.provenance!==packProvenance(run)||quote.inputHash!==fingerprint(packContext(run));}
export function preparePackIntent(run:Run,quoteId:string,confirmedAt=new Date().toISOString()):PackIntent{const release=ensureRelease(run),quote=release.packQuotes.find((item)=>item.id===quoteId);if(!quote)throw new Error("Pack estimate not found.");if(stalePackQuote(run,quote,confirmedAt))throw new Error("This Pack estimate is stale. Request a new estimate.");const jobId=randomUUID();return{id:randomUUID(),quoteId,jobId,packVersionId:randomUUID(),storyboardLineage:quote.storyboardLineage,releaseRevision:quote.releaseRevision,settingsFingerprint:quote.settingsFingerprint,validationPolicyFingerprint:quote.validationPolicyFingerprint!,provenance:quote.provenance!,createdAt:confirmedAt,status:"confirmed"};}
export function applyPackIntent(run:Run,intent:PackIntent,input:{expectedStoryboardLineage:string;expectedReleaseRevision:number},supersession=prepareSupersession(run,"Pack generation started",intent.createdAt)){const release=ensureRelease(run),quote=release.packQuotes.find((item)=>item.id===intent.quoteId),existing=release.packIntents.find((item)=>item.quoteId===intent.quoteId);if(existing)return existing;if(isBusy(run))throw new Error("A Pack job is already active. Wait for it or Resume it.");const lineage=storyboardLineage(run);if(!lineage||lineage!==input.expectedStoryboardLineage||intent.storyboardLineage!==lineage)throw new Error("The approved Storyboard changed. Refresh and request a new estimate.");if(!quote||quote.usedByJobId||stalePackQuote(run,quote,intent.createdAt)||quote.releaseRevision!==input.expectedReleaseRevision||release.revision!==input.expectedReleaseRevision||intent.settingsFingerprint!==quote.settingsFingerprint||intent.validationPolicyFingerprint!==quote.validationPolicyFingerprint||intent.provenance!==quote.provenance)throw new Error("This Pack estimate is stale or already consumed. Request a new estimate.");quote.usedByJobId=intent.jobId;applySupersession(run,supersession);release.revision++;release.packIntents.push(structuredClone(intent));run.job={id:intent.jobId,ownerId:run.userId,kind:"pack",packIntentId:intent.id,status:"queued",checkpoint:"start",startedAt:intent.createdAt,message:"Generating platform Pack",quoteId:quote.id};run.jobStatus="queued";run.currentStage="pack";calculateReadiness(run,intent.createdAt);return intent;}
export function applyPackResume(run:Run,intentId:string){const intent=ensureRelease(run).packIntents.find((item)=>item.id===intentId);if(!intent||intent.status==="ambiguous"||run.job?.ambiguousProviderResult)throw new Error("This Pack result is unknown and will not be repeated. Confirm a new Pack intent.");if(!run.job||run.job.kind!=="pack"||run.job.id!==intent.jobId||run.job.packIntentId!==intent.id||run.jobStatus!=="interrupted")throw new Error("Only the same interrupted Pack intent can resume.");run.jobStatus="queued";run.job.status="queued";delete run.job.error;return intent;}
export async function startPackJob(ownerId: string, id: string, input: { quoteId: string; expectedStoryboardLineage: string; expectedReleaseRevision: number }) {
  const before=await storage.getRun(ownerId,id),existing=ensureRelease(before).packIntents.find((item)=>item.quoteId===input.quoteId);if(existing)return before;
  const intent=preparePackIntent(before,input.quoteId),supersession=prepareSupersession(before,"Pack generation started",intent.createdAt);
  const run = await storage.updateRun(ownerId, id, r => { const found=ensureRelease(r).packIntents.find((item)=>item.quoteId===input.quoteId);if(found)return;applyPackIntent(r,intent,input,supersession); });
  if (run.job?.id===intent.jobId) schedule(ownerId, id); return run;
}

export function schedule(ownerId: string, id: string) {
  setImmediate(() => {
    execute(ownerId, id).catch((e) => console.error(safeError(e)));
  });
}
export async function startGeneration(
  ownerId: string,
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
  const run = await storage.updateRun(ownerId, id, (r) => {
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
        invalidateRelease(r, "Storyboard frame regeneration started");
      }
      r.currentStage =
        kind === "board" || kind === "frame-regenerate" ? "storyboard" : "look";
    }
    g.limits = limits();
    r.job = {
      id: jobId,
      ownerId,
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
  if (started) schedule(ownerId, id);
  return run;
}
export async function resumeGeneration(ownerId: string, id: string, quoteId?: string) {
  const existing = await storage.getRun(ownerId, id);
  if (existing.job?.kind === "pack") {
    const intent=ensureRelease(existing).packIntents.find((item)=>item.id===existing.job?.packIntentId);if(!intent||intent.status==="ambiguous"||existing.job.ambiguousProviderResult) throw new Error("This Pack result is unknown and will not be repeated. Confirm a new Pack intent.");
    const resumed = await storage.updateRun(ownerId, id, r => { applyPackResume(r,intent.id); }); schedule(ownerId, id); return resumed;
  }
  if (
    quoteId &&
    existing.generation?.quotes.find((q) => q.id === quoteId)?.usedByJobId
  )
    return existing;
  const run = await storage.updateRun(ownerId, id, (r) => {
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
  schedule(ownerId, id);
  return run;
}
