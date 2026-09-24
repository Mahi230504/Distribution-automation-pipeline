"use client";

import { useState } from "react";
import { Frame, Run } from "@/lib/types";
import { formatTimestamp } from "@/lib/format";
import { OverallScore, ScoreBar } from "@/components/ScoreBar";
import Badge from "@/components/Badge";

function FrameCard({
  frame,
  beatLabel,
  busy,
  isBusy,
  onRegenerate,
}: {
  frame: Frame;
  beatLabel: string;
  busy: boolean;
  isBusy: boolean;
  onRegenerate: (note: string) => void;
}) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");

  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-border bg-background p-3">
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element -- sample/placeholder images, not real remote assets to optimize */}
        <img src={frame.imageUrl} alt={beatLabel} className="w-full rounded-lg border border-border object-cover" />
        {isBusy && (
          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/80">
            <span className="h-5 w-5 rounded-full border-2 border-accent/30 border-t-accent animate-spin-slow" />
          </div>
        )}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted">{beatLabel}</span>
        {frame.attempt > 1 && <Badge tone="neutral">attempt {frame.attempt}</Badge>}
      </div>
      {frame.scores && <OverallScore score={frame.scores.overall} threshold={70} />}
      {frame.scores && (
        <div className="flex flex-col gap-1">
          <ScoreBar label="Character" score={frame.scores.characterConsistency} threshold={70} />
          <ScoreBar label="Style" score={frame.scores.styleConsistency} threshold={70} />
          <ScoreBar label="Composition" score={frame.scores.composition} threshold={70} />
        </div>
      )}
      <button
        onClick={() => setNoteOpen((v) => !v)}
        disabled={busy}
        className="self-start rounded-lg border border-border px-2.5 py-1 text-xs text-muted hover:text-foreground disabled:opacity-60"
      >
        Regenerate this frame
      </button>
      {noteOpen && (
        <div className="flex flex-col gap-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What should change? (optional)"
            className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs outline-none focus:border-accent"
          />
          <button
            onClick={() => {
              onRegenerate(note);
              setNoteOpen(false);
              setNote("");
            }}
            disabled={busy}
            className="self-start rounded-lg bg-accent px-3 py-1 text-xs font-medium text-accent-foreground hover:bg-accent-strong disabled:opacity-60"
          >
            Confirm regenerate
          </button>
        </div>
      )}
    </div>
  );
}

export default function StoryboardPanel({
  run,
  busy,
  busyFrameId,
  onRegenerateFrame,
  onContinueToPack,
}: {
  run: Run;
  busy: boolean;
  busyFrameId: string | null;
  onRegenerateFrame: (frameId: string, note: string) => void;
  onContinueToPack: () => void;
}) {
  const keyFrame = run.frames.find((f) => f.isKeyFrame);
  const storyboardFrames = run.frames.filter((f) => !f.isKeyFrame).sort((a, b) => a.beatIndex - b.beatIndex);

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <div>
        <h2 className="text-lg font-semibold">Storyboard</h2>
        <p className="mt-1 text-sm text-muted">
          One frame per beat, generated from the key frame. Frames below the quality threshold were
          automatically regenerated once.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {keyFrame && (
          <div className="flex flex-col gap-2.5 rounded-xl border border-accent/30 bg-accent/5 p-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- sample/placeholder images, not real remote assets to optimize */}
            <img
              src={keyFrame.imageUrl}
              alt="Key frame"
              className="w-full rounded-lg border border-border object-cover"
            />
            <Badge tone="accent">Key frame</Badge>
          </div>
        )}
        {storyboardFrames.map((frame, i) => {
          const beat = run.script?.beats[frame.beatIndex];
          const beatLabel = beat ? `${formatTimestamp(beat.startSeconds)}–${formatTimestamp(beat.endSeconds)}` : `Beat ${i + 1}`;
          return (
            <FrameCard
              key={frame.id}
              frame={frame}
              beatLabel={beatLabel}
              busy={busy}
              isBusy={busyFrameId === frame.id}
              onRegenerate={(note) => onRegenerateFrame(frame.id, note)}
            />
          );
        })}
      </div>
      <div className="border-t border-border pt-4">
        <button
          onClick={onContinueToPack}
          disabled={busy}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-strong disabled:opacity-60"
        >
          Continue to Pack
        </button>
      </div>
    </div>
  );
}
