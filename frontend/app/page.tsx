"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listRuns } from "@/lib/api";
import { Run, STAGE_LABELS } from "@/lib/types";
import { formatCurrency, formatDateTime } from "@/lib/format";
import StatusPill from "@/components/StatusPill";
import EmptyState from "@/components/EmptyState";
import ErrorBanner from "@/components/ErrorBanner";
import Badge from "@/components/Badge";

export default function HistoryPage() {
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadIndex, setReloadIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    listRuns()
      .then((data) => {
        if (cancelled) return;
        setRuns(data);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Something went wrong loading your runs.");
      });
    return () => {
      cancelled = true;
    };
  }, [reloadIndex]);

  function retry() {
    setReloadIndex((i) => i + 1);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">History</h1>
          <p className="mt-1 text-sm text-muted">Every run you started, and where it stands.</p>
        </div>
        <Link
          href="/new"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-strong"
        >
          New run
        </Link>
      </div>

      {error && <ErrorBanner message={error} onRetry={retry} />}

      {!error && runs === null && (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl border border-border bg-surface" />
          ))}
        </div>
      )}

      {runs !== null && runs.length === 0 && (
        <EmptyState
          title="No runs yet"
          description="Start with a topic and a target platform — VPO Studio will research it, script it, and build a storyboard for you."
          action={
            <Link
              href="/new"
              className="mt-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-strong"
            >
              Start your first run
            </Link>
          }
        />
      )}

      {runs !== null && runs.length > 0 && (
        <ul className="flex flex-col gap-3">
          {runs.map((run) => (
            <li key={run.id}>
              <Link
                href={`/runs/${run.id}`}
                className="flex flex-col gap-2 rounded-xl border border-border bg-surface px-4 py-4 transition-colors hover:border-accent/40 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{run.brief.topic}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {run.brief.audience || "No audience set"} · Updated {formatDateTime(run.updatedAt)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Badge tone="neutral">{STAGE_LABELS[run.currentStage]}</Badge>
                  <StatusPill status={run.jobStatus} />
                  <span className="w-16 text-right text-sm tabular-nums text-muted">
                    {formatCurrency(run.runningCostUsd)}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
