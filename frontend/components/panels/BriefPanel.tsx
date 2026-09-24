import { Run, PLATFORM_LABELS } from "@/lib/types";

export default function BriefPanel({
  run,
  busy,
  onStartStory,
}: {
  run: Run;
  busy: boolean;
  onStartStory: () => void;
}) {
  const rows: [string, string][] = [
    ["Audience", run.brief.audience || "—"],
    ["Platform", PLATFORM_LABELS[run.brief.platform]],
    ["Aspect ratio", run.brief.aspectRatio],
    ["Duration", `${run.brief.durationSeconds}s`],
    ["Target video model", run.brief.targetVideoModel],
  ];

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <div>
        <h2 className="text-lg font-semibold">Brief</h2>
        <p className="mt-1 text-sm text-muted">
          Research starts from these details, which lock once research begins.
        </p>
      </div>
      <dl className="grid gap-3 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-border bg-background px-3 py-2">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="mt-0.5 text-sm">{value}</dd>
          </div>
        ))}
      </dl>
      {run.brief.notes && (
        <div className="rounded-lg border border-border bg-background px-3 py-2">
          <p className="text-xs text-muted">Notes</p>
          <p className="mt-0.5 text-sm">{run.brief.notes}</p>
        </div>
      )}
      <div>
        <button
          onClick={onStartStory}
          disabled={busy}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-strong disabled:opacity-60"
        >
          Start research
        </button>
      </div>
    </div>
  );
}
