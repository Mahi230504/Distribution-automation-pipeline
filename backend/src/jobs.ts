import { randomUUID } from "node:crypto";
import type { Run } from "../../frontend/lib/types.js";
import { storage } from "./storage.js";
import { safeError } from "./settings.js";
import { research, rewrite } from "./story.js";
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
    const r = await storage.getRun(id);
    if (r.job!.checkpoint !== "scripted") {
      if (r.job!.kind === "story") await research(id);
      else await rewrite(id);
    }
    await storage.updateRun(id, (r) => {
      r.jobStatus = "needs_review";
      r.job!.status = "completed";
      r.job!.message = "Story ready";
    });
  } catch (e) {
    await storage.updateRun(id, (r) => {
      r.jobStatus = "failed";
      r.job!.status = "failed";
      r.job!.error = safeError(e);
      r.job!.message = "Job failed";
    });
  }
}
export async function startJob(
  id: string,
  kind: "story" | "rewrite",
  options: { fresh?: boolean; factId?: string; removed?: boolean } = {},
  resume = false,
) {
  const run = await storage.updateRun(id, (r) => {
    if (isBusy(r)) throw new Error("A job is already running for this run.");
    if (resume) {
      if (!r.job || r.jobStatus !== "interrupted")
        throw new Error("Only interrupted jobs can resume");
      delete r.job.error;
    } else {
      if (!["brief", "story"].includes(r.currentStage))
        throw new Error("Story changes are locked after approving Story.");
      if (kind === "story" && r.script) {
        (r.scriptVersions ??= []).push(r.script);
        r.script = null;
      }
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
