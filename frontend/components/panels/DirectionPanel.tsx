"use client";

import { useState } from "react";
import { Run } from "@/lib/types";

export default function DirectionPanel({
  run,
  busy,
  onSelectDirection,
}: {
  run: Run;
  busy: boolean;
  onSelectDirection: (directionId: string, note: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(run.selectedDirectionId);
  const [note, setNote] = useState(run.directionNote ?? "");

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <h2 className="text-lg font-semibold">Creative direction</h2>
      <p className="mt-1 text-sm text-muted">
        Pick the direction that fits, with an optional note. The app will write and score the full video
        prompt for it.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {run.directions.map((direction) => {
          const active = selectedId === direction.id;
          return (
            <button
              key={direction.id}
              onClick={() => setSelectedId(direction.id)}
              disabled={busy}
              className={`flex flex-col gap-1.5 rounded-xl border p-4 text-left transition-colors disabled:cursor-default ${
                active ? "border-accent/50 bg-accent/10" : "border-border bg-background hover:border-accent/30"
              }`}
            >
              <span className="font-medium">{direction.name}</span>
              <span className="text-xs text-muted">{direction.summary}</span>
              <dl className="mt-2 space-y-1 text-xs">
                <div>
                  <dt className="inline text-muted">Hook: </dt>
                  <dd className="inline">{direction.hook}</dd>
                </div>
                <div>
                  <dt className="inline text-muted">Angle: </dt>
                  <dd className="inline">{direction.angle}</dd>
                </div>
                <div>
                  <dt className="inline text-muted">Look: </dt>
                  <dd className="inline">{direction.look}</dd>
                </div>
                <div>
                  <dt className="inline text-muted">Mood: </dt>
                  <dd className="inline">{direction.mood}</dd>
                </div>
              </dl>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-sm font-medium">Note (optional)</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. make it more playful"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </label>
        <button
          onClick={() => selectedId && onSelectDirection(selectedId, note)}
          disabled={busy || !selectedId}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-strong disabled:opacity-60"
        >
          Use this direction
        </button>
      </div>
    </div>
  );
}
