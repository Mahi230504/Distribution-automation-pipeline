// Builds the downloadable zip for an approved pack, entirely in the browser.
// This works without a backend because everything a run needs to export is
// already in the Run object — the real backend export route (GET
// /api/runs/:id/export, from step 5) can produce the same shape server-side.

import JSZip from "jszip";
import { PLATFORM_LABELS, Run } from "./types";

export interface StoryboardExportFrame {
  filename: string;
  frameId: string;
  attemptId: string;
  assetId?: string;
  imageUrl: string;
  order: number;
  isKey: boolean;
  instruction?: string;
  beatIds?: string[];
  source: "generated" | "uploaded";
}

export function storyboardExportFrames(run: Run): StoryboardExportFrame[] {
  if (run.generation?.board.length) {
    return [...run.generation.board].sort((a,b)=>a.order-b.order).map((frame) => {
      const selected=frame.attempts.find((attempt)=>attempt.id===frame.selectedAttemptId);
      if(!frame.complete||!selected)throw new Error(`Frame ${frame.order+1} is not ready to export.`);
      return {filename:`${String(frame.order+1).padStart(2,"0")}-${frame.isKey?"key-frame":"storyboard-frame"}.png`,frameId:frame.id,attemptId:selected.id,assetId:selected.assetId,imageUrl:selected.imageUrl,order:frame.order,isKey:frame.isKey,instruction:frame.instruction,beatIds:[...frame.beatIds],source:selected.source};
    });
  }
  return [...run.frames].sort((a,b)=>Number(b.isKeyFrame)-Number(a.isKeyFrame)||a.beatIndex-b.beatIndex).map((frame,index)=>({filename:`${String(index+1).padStart(2,"0")}-${frame.isKeyFrame?"key-frame":"storyboard-frame"}.png`,frameId:frame.id,attemptId:frame.id,imageUrl:frame.imageUrl,order:index,isKey:frame.isKeyFrame,source:frame.source}));
}

export function canExportStoryboard(run: Run): boolean {
  if(run.generation?.board.length)return run.generation.board.every((frame)=>frame.complete&&!!frame.selectedAttemptId&&frame.attempts.some((attempt)=>attempt.id===frame.selectedAttemptId));
  return run.frames.length>0&&run.frames.every((frame)=>frame.status!=="pending");
}

export async function buildStoryboardZip(run:Run,fetcher:(path:string)=>Promise<Blob>):Promise<Blob>{
  const frames=storyboardExportFrames(run);if(!frames.length)throw new Error("Generate the Storyboard frames before exporting them.");const zip=new JSZip(),folder=zip.folder("frames");
  await Promise.all(frames.map(async(frame)=>{if(frame.imageUrl.startsWith("data:")){const [header,payload]=frame.imageUrl.split(",",2);if(!header||!payload)throw new Error(`Frame ${frame.order+1} has invalid image data.`);folder?.file(frame.filename,payload,{base64:header.includes(";base64")});return;}const blob=await fetcher(frame.imageUrl);folder?.file(frame.filename,await blob.arrayBuffer());}));
  zip.file("storyboard-manifest.json",JSON.stringify({runId:run.id,topic:run.brief.topic,aspectRatio:run.brief.aspectRatio,storyboardApprovedAt:run.generation?.boardApprovedAt??null,exportedAt:new Date().toISOString(),frames:frames.map((frame)=>({filename:frame.filename,frameId:frame.frameId,attemptId:frame.attemptId,assetId:frame.assetId,order:frame.order,isKey:frame.isKey,instruction:frame.instruction,beatIds:frame.beatIds,source:frame.source}))},null,2));
  return zip.generateAsync({type:"blob"});
}

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
