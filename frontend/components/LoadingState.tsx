"use client";

import { useEffect, useState } from "react";

// Rendered with key={label} by its caller, so a new label remounts this
// component and the elapsed counter naturally restarts from 0.
export default function LoadingState({
  label,
  startedAt,
}: {
  label: string;
  startedAt?: string;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(
      () =>
        setElapsed((s) =>
          startedAt
            ? Math.max(
                0,
                Math.floor((Date.now() - Date.parse(startedAt)) / 1000),
              )
            : s + 1,
        ),
      1000,
    );
    return () => clearInterval(interval);
  }, [startedAt]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3.5 text-sm text-foreground"
    >
      <span
        className="h-4 w-4 shrink-0 rounded-full border-2 border-accent/30 border-t-accent animate-spin-slow"
        aria-hidden
      />
      <span>
        {label}… <span className="text-muted tabular-nums">{elapsed}s</span>
      </span>
    </div>
  );
}
