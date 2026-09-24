import { RunStage, STAGE_LABELS, STEPPER_STAGES } from "@/lib/types";

export default function Stepper({ currentStage }: { currentStage: RunStage }) {
  const currentIndex =
    currentStage === "done" ? STEPPER_STAGES.length : STEPPER_STAGES.indexOf(currentStage);

  return (
    <ol className="flex flex-wrap gap-x-1 gap-y-2 overflow-x-auto">
      {STEPPER_STAGES.map((stage, i) => {
        const state = i < currentIndex ? "done" : i === currentIndex ? "current" : "locked";
        return (
          <li key={stage} className="flex items-center">
            <div
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap ${
                state === "done"
                  ? "border-success/30 bg-success/10 text-success"
                  : state === "current"
                    ? "border-accent/40 bg-accent/15 text-accent-strong"
                    : "border-border text-muted"
              }`}
            >
              <span
                className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
                  state === "done"
                    ? "bg-success text-background"
                    : state === "current"
                      ? "bg-accent text-accent-foreground"
                      : "bg-surface-raised"
                }`}
              >
                {state === "done" ? "✓" : i + 1}
              </span>
              {STAGE_LABELS[stage]}
            </div>
            {i < STEPPER_STAGES.length - 1 && <span className="mx-1 h-px w-3 bg-border sm:w-5" />}
          </li>
        );
      })}
    </ol>
  );
}
