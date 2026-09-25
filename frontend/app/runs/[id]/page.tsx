"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  resumeRun,
  approvePack,
  approveStory,
  generatePackForRun,
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
import { Pack, Run, RunStage } from "@/lib/types";
import { formatCurrency } from "@/lib/format";
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
  const [reachedApprove, setReachedApprove] = useState(false);
  const [approveTrackedStage, setApproveTrackedStage] =
    useState<RunStage | null>(null);
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
    const timer = setInterval(() => {
      getRun(id)
        .then((data) => {
          if (!cancelled) {
            setRun(data);
            setLoadError(null);
          }
        })
        .catch((e) => {
          if (!cancelled) setLoadError(e.message);
        });
    }, 1000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [id, jobActive]);
  const busy = loadingLabel !== null || jobActive;

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

  // Reset the local "reached Approve" override when the run moves to a
  // different stage entirely (e.g. reloading a run, or an action moving it
  // on) — adjusted during render rather than in an effect, per React's
  // guidance for resetting state when a prop changes.
  if (approveTrackedStage !== run.currentStage) {
    setApproveTrackedStage(run.currentStage);
    if (run.currentStage !== "pack") setReachedApprove(false);
  }

  const effectiveStage =
    run.currentStage === "pack" && reachedApprove
      ? "approve"
      : run.currentStage;

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

      {run.sampleStages && !["brief", "story"].includes(run.currentStage) && (
        <span className="text-xs text-warning">
          SAMPLE — this stage uses sample output with no AI charge until a later
          build step.
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
            runAction("Saving script", () => saveScript(id, fullText))
          }
          onApprove={() =>
            runAction("Coming up with directions", () => approveStory(id))
          }
        />
      )}

      {run.currentStage === "direction" && (
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

      {run.currentStage === "look" && (
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

      {run.currentStage === "storyboard" && (
        <StoryboardPanel
          run={run}
          busy={busy}
          busyFrameId={busyFrameId}
          onRegenerateFrame={handleRegenerateFrame}
          onContinueToPack={() =>
            runAction("Assembling pack", () => generatePackForRun(id))
          }
        />
      )}

      {run.currentStage === "pack" && !reachedApprove && (
        <PackPanel
          key={run.id}
          run={run}
          busy={busy}
          onSave={(patch: Partial<Pack>) =>
            runAction("Saving", () => updatePack(id, patch))
          }
          onContinue={() => setReachedApprove(true)}
        />
      )}

      {((run.currentStage === "pack" && reachedApprove) ||
        run.currentStage === "done") && (
        <ApprovePanel
          run={run}
          busy={busy}
          onApprove={() => runAction("Approving", () => approvePack(id))}
        />
      )}
    </div>
  );
}
