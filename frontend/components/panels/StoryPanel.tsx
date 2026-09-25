"use client";

import { useState } from "react";
import { Fact, Run, Source } from "@/lib/types";
import { countWords } from "@/lib/format";
import Badge from "@/components/Badge";

function SourceChip({ source }: { source: Source | undefined }) {
  if (!source) return null;
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className="max-w-[10rem] truncate rounded-full border border-border bg-background px-2 py-0.5 text-[11px] text-muted hover:text-accent-strong"
      title={source.url}
    >
      {source.title}
      {source.resolution === "unresolved" ? " (unresolved link)" : ""}
    </a>
  );
}

function FactRow({
  fact,
  sources,
  busy,
  onToggle,
}: {
  fact: Fact;
  sources: Source[];
  busy: boolean;
  onToggle: (removed: boolean) => void;
}) {
  return (
    <div
      className={`flex flex-col gap-2 rounded-lg border border-border bg-background px-3 py-2.5 ${
        fact.removed ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm">{fact.text}</p>
        <input
          type="checkbox"
          checked={!fact.removed}
          disabled={busy}
          onChange={(e) => onToggle(!e.target.checked)}
          title={fact.removed ? "Add this fact back" : "Remove this fact"}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
        />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge
          tone={fact.label === "stated" ? "success" : "neutral"}
          className="py-0.5"
        >
          {fact.label}
        </Badge>
        {sources.map((source) => (
          <SourceChip key={source.id} source={source} />
        ))}
      </div>
    </div>
  );
}

export default function StoryPanel({
  run,
  busy,
  onToggleFact,
  onSaveScript,
  onApprove,
}: {
  run: Run;
  busy: boolean;
  onToggleFact: (factId: string, removed: boolean) => void;
  onSaveScript: (fullText: string) => void;
  onApprove: () => void;
}) {
  const [scriptText, setScriptText] = useState(run.script?.fullText ?? "");
  const [syncedFullText, setSyncedFullText] = useState(
    run.script?.fullText ?? "",
  );

  // Removing a fact rewrites the script server-side, and that rewrite should
  // replace whatever's in the box — resync when the saved script changes,
  // adjusted during render rather than in an effect (see React's guidance on
  // adjusting state when a prop changes).
  const currentFullText = run.script?.fullText ?? "";
  if (currentFullText !== syncedFullText) {
    setSyncedFullText(currentFullText);
    setScriptText(currentFullText);
  }

  const targetSeconds = run.script?.targetSeconds ?? run.brief.durationSeconds;
  const voiceovers = [
    ...scriptText.matchAll(
      /(?:^|\n|\s)VO:\s*([\s\S]*?)(?=ON-SCREEN:|\[\d+:\d+|$)/g,
    ),
  ].map((m) => m[1]);
  const liveWordCount = countWords(
    voiceovers.length
      ? voiceovers.join(" ")
      : /VISUAL:|ON-SCREEN:/.test(scriptText)
        ? ""
        : scriptText,
  );
  const seconds = Math.round(liveWordCount / (run.script?.speakingRate ?? 2.5));
  const lengthCheck = {
    label: `${liveWordCount} words ≈ ${seconds}s, target ${targetSeconds}s`,
    withinTolerance: Math.abs(seconds - targetSeconds) <= 5,
  };
  const dirty = scriptText !== (run.script?.fullText ?? "");

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <div>
          <h2 className="text-lg font-semibold">Facts</h2>
          <p className="mt-1 text-sm text-muted">
            Citations come from Google Search grounding. Uncheck a fact to
            rewrite only the beats that use it.
          </p>
        </div>
        {run.research?.status === "uncited" && (
          <p role="alert" className="text-warning">
            Uncited research: no usable grounding metadata was returned.
            Unsupported facts are not used.
          </p>
        )}
        {run.research?.reused && (
          <p className="text-xs text-muted">
            Research reused from the last 24 hours; the script is written for
            this run.
          </p>
        )}
        {!!run.research?.dropped.length && (
          <details>
            <summary>Dropped facts ({run.research.dropped.length})</summary>
            {run.research.dropped.map((f) => (
              <p className="text-sm mt-2" key={f.id}>
                {f.text} — {f.reason}
              </p>
            ))}
          </details>
        )}
        {dirty && (
          <p className="text-warning text-xs">
            Save your script edits before changing facts or approving.
          </p>
        )}
        <div className="flex flex-col gap-2">
          {run.facts.map((fact) => (
            <FactRow
              key={fact.id}
              fact={fact}
              sources={run.sources.filter((s) =>
                (fact.sourceIds ?? [fact.sourceId]).includes(s.id),
              )}
              busy={busy || dirty}
              onToggle={(removed) => onToggleFact(fact.id, removed)}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <div>
          <h2 className="text-lg font-semibold">Script</h2>
          <p className="mt-1 text-sm text-muted">
            Editable. Beats are timestamped for the video model.
          </p>
        </div>
        <textarea
          value={scriptText}
          onChange={(e) => setScriptText(e.target.value)}
          aria-label="Story script"
          disabled={busy}
          className="min-h-64 flex-1 resize-y rounded-lg border border-border bg-background px-3 py-2.5 font-mono text-xs leading-relaxed outline-none focus:border-accent"
        />
        <div
          className={`rounded-lg border px-3 py-2 text-xs ${
            lengthCheck.withinTolerance
              ? "border-success/30 bg-success/10 text-success"
              : "border-warning/30 bg-warning/10 text-warning"
          }`}
        >
          {lengthCheck.label}
          {!lengthCheck.withinTolerance &&
            " — consider trimming or expanding the script"}
        </div>
        <div className="flex gap-3">
          <button
            disabled={busy || !dirty}
            onClick={() => onSaveScript(scriptText)}
            className="rounded-lg border border-border px-4 py-2 disabled:opacity-50"
          >
            Save script
          </button>
          <button
            onClick={onApprove}
            disabled={
              busy ||
              dirty ||
              (run.jobStatus !== "needs_review" &&
                !(
                  run.jobStatus === "failed" &&
                  run.job?.kind === "script-revision"
                )) ||
              !run.script
            }
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-strong disabled:opacity-60"
          >
            Approve story
          </button>
        </div>
      </div>
    </div>
  );
}
