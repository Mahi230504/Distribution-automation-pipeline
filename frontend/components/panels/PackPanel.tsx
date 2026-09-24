"use client";

import { useState } from "react";
import { Pack, PLATFORM_LABELS, Run } from "@/lib/types";
import CopyButton from "@/components/CopyButton";

const inputClass =
  "rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent";

// Rendered with key={run.id} by its caller, so switching runs remounts this
// component and these lazy initial values are always for the right pack.
export default function PackPanel({
  run,
  busy,
  onSave,
  onContinue,
}: {
  run: Run;
  busy: boolean;
  onSave: (patch: Partial<Pack>) => void;
  onContinue: () => void;
}) {
  const pack = run.pack;
  const [title, setTitle] = useState(pack?.title ?? "");
  const [finalPrompt, setFinalPrompt] = useState(pack?.finalPrompt ?? "");
  const [negativePrompt, setNegativePrompt] = useState(pack?.negativePrompt ?? "");
  const [captions, setCaptions] = useState(pack?.captions ?? []);
  const [hashtagsText, setHashtagsText] = useState(pack?.hashtags.join(" ") ?? "");
  const [thumbnailText, setThumbnailText] = useState(pack?.thumbnailText ?? "");
  const [postingNotes, setPostingNotes] = useState(pack?.postingNotes ?? "");

  if (!pack) return null;

  function updateCaption(index: number, value: string) {
    const next = captions.map((c, i) => (i === index ? { ...c, caption: value } : c));
    setCaptions(next);
  }

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <div>
        <h2 className="text-lg font-semibold">Pack</h2>
        <p className="mt-1 text-sm text-muted">Generated automatically. Everything here is editable.</p>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Title</span>
        <input
          className={inputClass}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => onSave({ title })}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Final video prompt</span>
          <CopyButton text={finalPrompt} />
        </div>
        <textarea
          className={`${inputClass} min-h-24 resize-y`}
          value={finalPrompt}
          onChange={(e) => setFinalPrompt(e.target.value)}
          onBlur={() => onSave({ finalPrompt })}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Negative prompt</span>
          <CopyButton text={negativePrompt} />
        </div>
        <textarea
          className={`${inputClass} min-h-16 resize-y`}
          value={negativePrompt}
          onChange={(e) => setNegativePrompt(e.target.value)}
          onBlur={() => onSave({ negativePrompt })}
        />
      </label>

      <div className="flex flex-col gap-3">
        <span className="text-sm font-medium">Captions</span>
        {captions.map((caption, i) => (
          <label key={caption.platform} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">{PLATFORM_LABELS[caption.platform]}</span>
              <CopyButton text={caption.caption} />
            </div>
            <textarea
              className={`${inputClass} min-h-16 resize-y`}
              value={caption.caption}
              onChange={(e) => updateCaption(i, e.target.value)}
              onBlur={() => onSave({ captions })}
            />
          </label>
        ))}
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Hashtags</span>
        <input
          className={inputClass}
          value={hashtagsText}
          onChange={(e) => setHashtagsText(e.target.value)}
          onBlur={() => onSave({ hashtags: hashtagsText.split(/\s+/).filter(Boolean) })}
        />
      </label>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Thumbnail text</span>
          <input
            className={inputClass}
            value={thumbnailText}
            onChange={(e) => setThumbnailText(e.target.value)}
            onBlur={() => onSave({ thumbnailText })}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Posting notes</span>
          <input
            className={inputClass}
            value={postingNotes}
            onChange={(e) => setPostingNotes(e.target.value)}
            onBlur={() => onSave({ postingNotes })}
          />
        </label>
      </div>

      <div className="border-t border-border pt-4">
        <button
          onClick={onContinue}
          disabled={busy}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-strong disabled:opacity-60"
        >
          Continue to Approve
        </button>
      </div>
    </div>
  );
}
