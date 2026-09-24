"use client";

import { useState } from "react";
import { Run } from "@/lib/types";
import { formatCurrency } from "@/lib/format";
import { buildPackZip, downloadBlob } from "@/lib/export";
import ErrorBanner from "@/components/ErrorBanner";

export default function ApprovePanel({
  run,
  busy,
  onApprove,
}: {
  run: Run;
  busy: boolean;
  onApprove: () => void;
}) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const approved = run.pack?.approved ?? false;

  async function handleDownload() {
    setDownloading(true);
    setDownloadError(null);
    try {
      const blob = await buildPackZip(run);
      downloadBlob(blob, `${run.brief.topic.replace(/\s+/g, "-").toLowerCase()}-pack.zip`);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Could not build the download.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <div>
        <h2 className="text-lg font-semibold">Approve</h2>
        <p className="mt-1 text-sm text-muted">
          Final check before this pack leaves the app. Total cost for this run so far:{" "}
          <strong className="text-foreground">{formatCurrency(run.runningCostUsd)}</strong>.
        </p>
      </div>

      {!approved && (
        <button
          onClick={onApprove}
          disabled={busy}
          className="self-start rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-strong disabled:opacity-60"
        >
          Approve pack
        </button>
      )}

      {approved && (
        <>
          <div className="w-fit rounded-lg border border-success/30 bg-success/10 px-3 py-1.5 text-sm text-success">
            Approved
          </div>
          {downloadError && <ErrorBanner message={downloadError} onRetry={handleDownload} />}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-strong disabled:opacity-60"
            >
              {downloading ? "Building zip…" : "Download pack"}
            </button>
            <button
              disabled
              title="Coming in step 5"
              className="cursor-not-allowed rounded-lg border border-border px-4 py-2 text-sm text-muted opacity-60"
            >
              Send to Telegram — Coming in step 5
            </button>
          </div>
        </>
      )}
    </div>
  );
}
