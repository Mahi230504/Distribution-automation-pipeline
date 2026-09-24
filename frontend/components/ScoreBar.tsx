function toneFor(score: number, threshold: number): string {
  if (score >= threshold) return "bg-success";
  if (score >= threshold - 15) return "bg-warning";
  return "bg-danger";
}

export function ScoreBar({
  label,
  score,
  threshold = 75,
}: {
  label: string;
  score: number;
  threshold?: number;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-32 shrink-0 text-muted">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-raised">
        <div className={`h-full rounded-full ${toneFor(score, threshold)}`} style={{ width: `${score}%` }} />
      </div>
      <span className="w-8 shrink-0 text-right tabular-nums">{score}</span>
    </div>
  );
}

export function OverallScore({ score, threshold = 75 }: { score: number; threshold?: number }) {
  const passed = score >= threshold;
  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium ${
        passed ? "border-success/30 bg-success/10 text-success" : "border-warning/30 bg-warning/10 text-warning"
      }`}
    >
      <span className="tabular-nums">{score}/100</span>
      <span className="text-xs font-normal opacity-80">
        {passed ? "Passed quality check" : "Below threshold"} ({threshold}+)
      </span>
    </div>
  );
}
