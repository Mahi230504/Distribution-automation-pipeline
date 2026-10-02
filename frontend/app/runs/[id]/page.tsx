"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  isSampleMode,
  resumeRun,
  approvePack,
  approveStory,
  generatePackForRun,
  requestPackQuote,
  enterReleaseReview,
  reopenApproval,
  returnToPackEditing,
  restorePackVersion,
  generateStoryboard,
  getCostEstimate,
  getRun,
  regenerateFrame,
  regenerateKeyFrame,
  renderKeyFrame,
  saveScript,
  selectDirection,
  startStory,
  toggleFact,
  updatePack,
  uploadKeyFrame,
} from "@/lib/api";
import { ReleasePackContent, Run } from "@/lib/types";
import { formatCurrency } from "@/lib/format";
import BriefIdentity from "@/components/BriefIdentity";
import ScriptFeedbackPanel from "@/components/ScriptFeedbackPanel";
import GenerationWorkspace from "@/components/GenerationWorkspace";
import Stepper from "@/components/Stepper";
import StatusPill from "@/components/StatusPill";
import LoadingState from "@/components/LoadingState";
import ErrorBanner from "@/components/ErrorBanner";
import BriefPanel from "@/components/panels/BriefPanel";
import StoryPanel from "@/components/panels/StoryPanel";
import DirectionPanel from "@/components/panels/DirectionPanel";
import LookPanel from "@/components/panels/LookPanel";
import StoryboardPanel from "@/components/panels/StoryboardPanel";
import PackPanel from "@/components/panels/PackPanel";
import ApprovePanel from "@/components/panels/ApprovePanel";

export default function RunPage({ params }: PageProps<"/runs/[id]">) {
  const { id } = use(params);

  const [run, setRun] = useState<Run | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loadingLabel, setLoadingLabel] = useState<string | null>(null);
  const [busyFrameId, setBusyFrameId] = useState<string | null>(null);
  const [reloadIndex, setReloadIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getRun(id)
      .then((data) => {
        if (cancelled) return;
        setRun(data);
        setLoadError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(
          err instanceof Error ? err.message : "Could not load this run.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [id, reloadIndex]);

  function retryLoad() {
    setReloadIndex((i) => i + 1);
  }

  const jobActive = run?.jobStatus === "running" || run?.jobStatus === "queued";
  useEffect(() => {
    if (!jobActive) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const data = await getRun(id);
        if (!cancelled) {
          setRun(data);
          setLoadError(null);
        }
      } catch (e) {
        if (!cancelled)
          setLoadError(
            e instanceof Error ? e.message : "Could not load progress.",
          );
      } finally {
        if (!cancelled)
          timer = setTimeout(poll, document.hidden ? 10000 : 1500);
      }
    }
    timer = setTimeout(poll, 1500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [id, jobActive]);
  const busy = loadingLabel !== null || jobActive;
  const realGeneration =
    !isSampleMode() &&
    !!run &&
    ["direction", "look", "storyboard"].includes(run.currentStage);

  async function runAction(label: string, action: () => Promise<Run>) {
    setActionError(null);
    setLoadingLabel(label);
    try {
      setRun(await action());
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setLoadingLabel(null);
    }
  }

  async function handleRegenerateFrame(frameId: string, note: string) {
    setActionError(null);
    setLoadingLabel("Regenerating frame");
    setBusyFrameId(frameId);
    try {
      setRun(await regenerateFrame(id, frameId, note));
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Could not regenerate that frame.",
      );
    } finally {
      setLoadingLabel(null);
      setBusyFrameId(null);
    }
  }

  if (loadError) {
    return (
      <div className="flex flex-col gap-4">
        <ErrorBanner message={loadError} onRetry={retryLoad} />
        <Link href="/" className="text-sm text-accent-strong hover:underline">
          ← Back to History
        </Link>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="h-96 animate-pulse rounded-2xl border border-border bg-surface" />
    );
  }

  const effectiveStage = run.currentStage;

  async function handleGeneratePack(currentRun: Run) {
    if (isSampleMode()) {
      await runAction("Assembling sample Pack", () => generatePackForRun(id));
      return;
    }
    const lineage = currentRun.release?.readiness.storyboardLineage;
    if (!lineage) { setActionError("Refresh after approving the Storyboard, then try again."); return; }
    setLoadingLabel("Preparing Pack estimate"); setActionError(null);
    try { const quote = await requestPackQuote(id, lineage); const accepted = window.confirm(`${quote.amountUsd === 0 ? "TEST MODE — no provider charge." : `Maximum estimated Pack allowance: $${quote.amountUsd.toFixed(4)}.`}\n\nGenerate the Pack from this approved Storyboard?`); if (accepted) setRun(await generatePackForRun(id, quote)); }
    catch (e) { setActionError(e instanceof Error ? e.message : "Could not start Pack generation."); } finally { setLoadingLabel(null); }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href="/" className="text-xs text-muted hover:text-foreground">
              ← History
            </Link>
            <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight">
              {run.brief.topic}
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <StatusPill status={run.jobStatus} />
            <span className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm tabular-nums">
              {formatCurrency(run.runningCostUsd)}
            </span>
          </div>
        </div>
        <Stepper currentStage={effectiveStage} />
      </div>

      {run.sampleStages &&
        !run.release &&
        !realGeneration &&
        !["brief", "story"].includes(run.currentStage) && (
          <span className="text-xs text-warning">
            SAMPLE — this stage uses sample output with no AI charge until a
            later build step.
          </span>
        )}
      {run.brief.pastedScript && run.script && (
        <p className="text-sm text-muted">
          Your script: {run.script.wordCount} words ≈{" "}
          {run.script.estimatedSeconds}s, target {run.script.targetSeconds}s
        </p>
      )}
      {run.jobStatus === "interrupted" && (
        <div role="alert">
          <p>{run.job?.message}</p>
          <button
            className="rounded-lg bg-accent p-3"
            onClick={() => runAction("Resuming", () => resumeRun(id))}
          >
            Resume
          </button>
        </div>
      )}
      {run.aiCallLog.some(
        (c) => c.outcome === "interrupted" && !c.testMode,
      ) && (
        <p className="text-warning text-sm">
          The cost total may be incomplete: a call was interrupted before usage
          was returned.
        </p>
      )}
      {run.job?.error && <ErrorBanner message={run.job.error} />}
      {jobActive && (
        <LoadingState
          key={run.job?.id}
          label={run.job?.message ?? "Working"}
          startedAt={run.job?.startedAt}
        />
      )}
      {run.currentStage === "story" && !busy && (
        <button
          className="text-sm text-accent-strong self-start"
          onClick={() => runAction("Researching", () => startStory(id, true))}
        >
          Fresh research
        </button>
      )}
      {actionError && <ErrorBanner message={actionError} />}
      {loadingLabel && <LoadingState key={loadingLabel} label={loadingLabel} />}

      {!isSampleMode() && (
        <BriefIdentity run={run} busy={busy} onAction={runAction} />
      )}
      {run.currentStage === "brief" && (
        <BriefPanel
          run={run}
          busy={busy}
          onStartStory={() => runAction("Researching", () => startStory(id))}
        />
      )}

      {run.currentStage === "story" && (
        <StoryPanel
          key={run.id}
          run={run}
          busy={busy}
          onToggleFact={(factId, removed) =>
            runAction("Rewriting script", () => toggleFact(id, factId, removed))
          }
          onSaveScript={(fullText) =>
            runAction("Saving script", () =>
              saveScript(
                id,
                fullText,
                run.script?.version,
                run.effective?.revision,
              ),
            )
          }
          onApprove={() =>
            runAction("Coming up with directions", () =>
              approveStory(id, run.script?.version, run.effective?.revision),
            )
          }
        />
      )}

      {run.currentStage === "story" && !isSampleMode() && (
        <ScriptFeedbackPanel run={run} busy={busy} onAction={runAction} />
      )}

      {realGeneration && (
        <GenerationWorkspace run={run} busy={busy} onAction={runAction} />
      )}
      {run.currentStage === "storyboard" && run.generation?.boardApprovedAt && (
        <button className="self-start rounded-lg bg-accent px-4 py-3 font-medium" disabled={busy} onClick={()=>void handleGeneratePack(run)}>Generate release Pack</button>
      )}
      {!realGeneration && run.currentStage === "direction" && (
        <DirectionPanel
          key={run.id}
          run={run}
          busy={busy}
          onSelectDirection={(directionId, note) =>
            runAction("Writing and scoring your prompt", () =>
              selectDirection(id, directionId, note),
            )
          }
        />
      )}

      {!realGeneration && run.currentStage === "look" && (
        <LookPanel
          key={run.id}
          run={run}
          busy={busy}
          onLoadCostEstimate={() => getCostEstimate(id, "key_frame")}
          onConfirmRender={() =>
            runAction("Rendering key frame", () => renderKeyFrame(id))
          }
          onUpload={(dataUrl) =>
            runAction("Uploading image", () => uploadKeyFrame(id, dataUrl))
          }
          onRegenerate={(note) =>
            runAction("Regenerating key frame", () =>
              regenerateKeyFrame(id, note),
            )
          }
          onApprove={() =>
            runAction("Rendering storyboard", () => generateStoryboard(id))
          }
        />
      )}

      {!realGeneration && run.currentStage === "storyboard" && (
        <StoryboardPanel
          run={run}
          busy={busy}
          busyFrameId={busyFrameId}
          onRegenerateFrame={handleRegenerateFrame}
          onContinueToPack={() => handleGeneratePack(run)}
        />
      )}

      {run.currentStage === "pack" && (
        <PackPanel
          key={`${run.id}-${run.release?.activePackVersionId ?? "none"}`}
          run={run}
          busy={busy}
          onGenerate={() => handleGeneratePack(run)}
          onSave={(content: ReleasePackContent) => runAction("Saving new Pack version", () => updatePack(id, content, run.release?.revision, run.release?.activePackVersionId))}
          onRestore={(sourcePackVersionId) => runAction("Restoring Pack version", () => restorePackVersion(id, sourcePackVersionId, run.release!.revision, run.release!.activePackVersionId!))}
          onContinue={() => runAction("Opening final review", () => enterReleaseReview(id, run.release!.revision))}
          onUpdate={setRun}
        />
      )}

      {(run.currentStage === "approve" || run.currentStage === "done") && (
        <ApprovePanel
          run={run}
          busy={busy}
          onApprove={() => runAction("Approving exact release", () => approvePack(run))}
          onReopen={() => runAction("Reopening release", () => reopenApproval(run))}
          onEdit={() => runAction("Returning to Pack editing", () => returnToPackEditing(id, run.release!.revision))}
          onUpdate={setRun}
        />
      )}
    </div>
  );
}
