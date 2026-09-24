// Builds the downloadable zip for an approved pack, entirely in the browser.
// This works without a backend because everything a run needs to export is
// already in the Run object — the real backend export route (GET
// /api/runs/:id/export, from step 5) can produce the same shape server-side.

import JSZip from "jszip";
import { PLATFORM_LABELS, Run } from "./types";

export async function buildPackZip(run: Run): Promise<Blob> {
  const zip = new JSZip();
  const pack = run.pack;
  if (!pack) throw new Error("This run doesn't have a pack yet.");

  zip.file(
    "prompt.txt",
    `FINAL VIDEO PROMPT\n\n${pack.finalPrompt}\n\nNEGATIVE PROMPT\n\n${pack.negativePrompt}\n`
  );

  if (run.script) {
    zip.file("script.txt", run.script.fullText);
  }

  const captionsText = pack.captions
    .map((c) => `${PLATFORM_LABELS[c.platform]}\n${"-".repeat(PLATFORM_LABELS[c.platform].length)}\n${c.caption}`)
    .join("\n\n");
  zip.file(
    "captions.txt",
    `${pack.title}\n\n${captionsText}\n\nHashtags: ${pack.hashtags.join(" ")}\n\nThumbnail text: ${pack.thumbnailText}\n\nPosting notes: ${pack.postingNotes}\n`
  );

  zip.file(
    "pack.json",
    JSON.stringify(
      {
        runId: run.id,
        topic: run.brief.topic,
        platform: run.brief.platform,
        aspectRatio: run.brief.aspectRatio,
        durationSeconds: run.brief.durationSeconds,
        targetVideoModel: run.brief.targetVideoModel,
        pack,
      },
      null,
      2
    )
  );

  const framesFolder = zip.folder("frames");
  run.frames.forEach((frame, i) => {
    if (framesFolder && frame.imageUrl.startsWith("data:")) {
      const base64 = frame.imageUrl.split(",")[1];
      const ext = frame.imageUrl.includes("image/png") ? "png" : "jpg";
      framesFolder.file(`${frame.isKeyFrame ? "key-frame" : `frame-${i}`}.${ext}`, base64, { base64: true });
    }
  });

  return zip.generateAsync({ type: "blob" });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
