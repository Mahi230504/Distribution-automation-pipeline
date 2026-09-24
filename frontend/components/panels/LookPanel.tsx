"use client";

import { useEffect, useRef, useState } from "react";
import { CostEstimate, Run } from "@/lib/types";
import { formatCurrency } from "@/lib/format";
import { OverallScore } from "@/components/ScoreBar";
import ErrorBanner from "@/components/ErrorBanner";

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });
}

export default function LookPanel({
  run,
  busy,
  onLoadCostEstimate,
  onConfirmRender,
  onUpload,
  onRegenerate,
  onApprove,
}: {
  run: Run;
  busy: boolean;
  onLoadCostEstimate: () => Promise<CostEstimate>;
  onConfirmRender: () => void;
  onUpload: (dataUrl: string) => void;
  onRegenerate: (note: string) => void;
  onApprove: () => void;
}) {
  const keyFrame = run.frames.find((f) => f.isKeyFrame) ?? null;
  const direction = run.directions.find((d) => d.id === run.selectedDirectionId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [costEstimate, setCostEstimate] = useState<CostEstimate | null>(null);
  const [costError, setCostError] = useState<string | null>(null);
  // No key frame yet means we're about to fetch its estimate on mount, below.
  const [costLoading, setCostLoading] = useState(!keyFrame);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (keyFrame) return;
    let cancelled = false;
    onLoadCostEstimate()
      .then((estimate) => !cancelled && setCostEstimate(estimate))
      .catch((err) => !cancelled && setCostError(err instanceof Error ? err.message : "Could not estimate cost."))
      .finally(() => !cancelled && setCostLoading(false));
    return () => {
      cancelled = true;
    };
    // Intentionally runs once per mount (this panel is remounted per run via
    // key={run.id}): we only ever need the pre-render estimate once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleFile(file: File) {
    const dataUrl = await readFileAsDataUrl(file);
    onUpload(dataUrl);
  }

  return (
    <div className="flex flex-col gap-5">
      {direction && run.videoPrompt && (
        <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Look</h2>
            <OverallScore score={run.videoPrompt.scores.overall} threshold={run.videoPrompt.threshold} />
          </div>
          <p className="mt-1 text-sm text-muted">
            Direction: <strong className="text-foreground">{direction.name}</strong> — {direction.summary}
          </p>
        </div>
      )}

      {!keyFrame && (
        <div className="rounded-2xl border border-warning/30 bg-warning/10 p-5 sm:p-6">
          <h3 className="text-sm font-semibold text-warning">Confirm cost before rendering the key frame</h3>
          <p className="mt-1 text-xs text-warning/80">
            The key frame sets the character and visual style for every frame that follows.
          </p>
          {costLoading && <p className="mt-3 text-sm text-warning/90">Estimating cost…</p>}
          {costError && <ErrorBanner message={costError} />}
          {costEstimate && !costLoading && (
            <>
              <p className="mt-3 text-sm text-warning/90">
                {costEstimate.label}: <strong>{formatCurrency(costEstimate.amountUsd)}</strong>
              </p>
              <p className="mt-1 text-xs text-warning/70">{costEstimate.detail}</p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  onClick={onConfirmRender}
                  disabled={busy}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-strong disabled:opacity-60"
                >
                  Confirm & render key frame
                </button>
                <span className="text-xs text-warning/70">or</span>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={busy}
                  className="rounded-lg border border-warning/40 px-4 py-2 text-sm font-medium text-warning hover:bg-warning/10 disabled:opacity-60"
                >
                  Upload my own image (free)
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {keyFrame && (
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row">
            {/* Sample placeholder / user-uploaded data URLs, not real remote assets to optimize. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={keyFrame.imageUrl}
              alt="Generated key frame"
              className="w-full max-w-xs self-start rounded-xl border border-border object-cover"
            />
            <div className="flex flex-1 flex-col gap-3">
              <p className="text-sm text-muted">
                {keyFrame.source === "uploaded" ? "Uploaded by you." : `Generated — attempt ${keyFrame.attempt}.`}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={onApprove}
                  disabled={busy}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-strong disabled:opacity-60"
                >
                  Approve look
                </button>
                <button
                  onClick={() => setNoteOpen((v) => !v)}
                  disabled={busy}
                  className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:border-accent/40 disabled:opacity-60"
                >
                  Change it
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={busy}
                  className="rounded-lg border border-border px-4 py-2 text-sm text-muted hover:text-foreground disabled:opacity-60"
                >
                  Upload a different image
                </button>
              </div>
              {noteOpen && (
                <div className="flex flex-col gap-2 rounded-lg border border-border bg-background p-3">
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="What should change?"
                    className="rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
                  />
                  <button
                    onClick={() => {
                      onRegenerate(note);
                      setNoteOpen(false);
                      setNote("");
                    }}
                    disabled={busy}
                    className="self-start rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground hover:bg-accent-strong disabled:opacity-60"
                  >
                    Regenerate key frame
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </div>
  );
}
