import { JobStatus, JOB_STATUS_LABELS } from "@/lib/types";
import Badge from "./Badge";

const TONE_BY_STATUS: Record<JobStatus, "neutral" | "accent" | "success" | "warning" | "danger"> = {
  idle: "neutral",
  queued: "neutral",
  running: "accent",
  waiting_confirmation: "warning",
  needs_review: "warning",
  interrupted: "danger",
  failed: "danger",
  completed: "success",
};

export default function StatusPill({ status }: { status: JobStatus }) {
  return (
    <Badge tone={TONE_BY_STATUS[status]}>
      {status === "running" && (
        <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" aria-hidden />
      )}
      {JOB_STATUS_LABELS[status]}
    </Badge>
  );
}
