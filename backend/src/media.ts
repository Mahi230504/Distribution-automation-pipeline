import { createHash } from "node:crypto";
import { mkdtemp, open, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import type { IncomingMessage } from "node:http";
import type { MediaProbeResult, ValidationResult, ValidationIssue } from "../../frontend/lib/types.js";
import { RELEASE_POLICY_VERSION } from "./release.js";
import { settings } from "./settings.js";

export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const issue = (code: string, message: string, nextAction?: string): ValidationIssue => ({ code, message, nextAction });
export async function receiveUpload(req: IncomingMessage) {
  const dir = await mkdtemp(path.join(tmpdir(), "vpo-video-")), filePath = path.join(dir, "upload.bin"), handle = await open(filePath, "wx", 0o600);
  let byteSize = 0; const digest = createHash("sha256");
  try {
    for await (const value of req) { const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value); byteSize += chunk.length;
      if (byteSize > MAX_VIDEO_BYTES) throw Object.assign(new Error("The video is larger than the 100 MB classroom limit. Export a smaller MP4 and try again."), { status: 413 });
      digest.update(chunk); await handle.write(chunk); }
    if (!byteSize) throw Object.assign(new Error("The uploaded video was empty."), { status: 422 });
    await handle.close(); return { dir, filePath, byteSize, sha256: digest.digest("hex") };
  } catch (e) { await handle.close().catch(() => {}); await rm(dir, { recursive: true, force: true }); throw e; }
}
export async function cleanupUpload(dir: string) { await rm(dir, { recursive: true, force: true }); }
async function runProbe(filePath: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const child = spawn(settings.ffprobePath, ["-v", "error", "-show_format", "-show_streams", "-of", "json", filePath], { shell: false, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = ""; const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error("Video inspection timed out. Export a standard MP4 and try again.")); }, settings.mediaProbeTimeoutMs);
    child.stdout.on("data", b => { stdout += b; if (stdout.length > 2_000_000) child.kill("SIGKILL"); }); child.stderr.on("data", b => { stderr += b; });
    child.on("error", e => { clearTimeout(timer); reject(new Error(`Video inspection is unavailable: ${e.message}`)); });
    child.on("close", code => { clearTimeout(timer); if (code !== 0) reject(Object.assign(new Error(`The file is corrupt or incomplete. Export a fresh MP4 and try again.${stderr ? ` (${stderr.trim().slice(0, 160)})` : ""}`), { status: 422 })); else try { resolve(JSON.parse(stdout)); } catch { reject(Object.assign(new Error("The video inspector returned unreadable metadata."), { status: 422 })); } });
  });
}
export function validateProbe(raw: any, byteSize: number, header?: Buffer): { probe: MediaProbeResult; validation: ValidationResult } {
  const blockers: ValidationIssue[] = [], warnings: ValidationIssue[] = [], streams = Array.isArray(raw?.streams) ? raw.streams : [];
  const video = streams.find((s: any) => s.codec_type === "video"), audios = streams.filter((s: any) => s.codec_type === "audio");
  const formatNames = String(raw?.format?.format_name ?? "").split(",");
  if (!header || header.length < 12 || header.subarray(4, 8).toString("ascii") !== "ftyp" || !formatNames.includes("mp4")) blockers.push(issue("container", "The file is not a detected MP4 container.", "Export an MP4 file."));
  if (!video) blockers.push(issue("video_stream", "The MP4 has no video track."));
  if (video && video.codec_name !== "h264") blockers.push(issue("video_codec", `Video codec ${video.codec_name ?? "unknown"} is not H.264.`, "Export using H.264."));
  const audioCodecs = audios.map((s: any) => String(s.codec_name ?? "unknown"));
  if (audioCodecs.some((c: string) => c !== "aac")) blockers.push(issue("audio_codec", `Audio must be AAC when present; detected ${audioCodecs.join(", ")}.`, "Export audio as AAC."));
  const rotation = Number(video?.tags?.rotate ?? video?.side_data_list?.find((x: any) => Number.isFinite(Number(x.rotation)))?.rotation ?? 0);
  const codedWidth = Number(video?.width ?? 0), codedHeight = Number(video?.height ?? 0), sideways = Math.abs(rotation) % 180 === 90;
  const displayWidth = sideways ? codedHeight : codedWidth, displayHeight = sideways ? codedWidth : codedHeight;
  if (![[1080,1920],[720,1280]].some(([w,h]) => displayWidth === w && displayHeight === h)) blockers.push(issue("dimensions", `Displayed dimensions ${displayWidth}×${displayHeight} are outside the course profile.`, "Export at 1080×1920 or 720×1280."));
  const durationSeconds = Number(raw?.format?.duration ?? video?.duration ?? 0);
  if (!Number.isFinite(durationSeconds) || durationSeconds < 15 || durationSeconds > 60) blockers.push(issue("duration", `Duration ${Number.isFinite(durationSeconds) ? durationSeconds.toFixed(2) : "unknown"} seconds is outside 15–60 seconds.`, "Export a 15–60 second video."));
  if (byteSize > MAX_VIDEO_BYTES) blockers.push(issue("size", "The video is larger than 100 MB."));
  const probe: MediaProbeResult = { container: formatNames.includes("mp4") ? "mp4" : (formatNames[0] || "unknown"), videoCodec: String(video?.codec_name ?? "unknown"), audioCodecs, durationSeconds, codedWidth, codedHeight, displayWidth, displayHeight, rotation };
  return { probe, validation: { valid: blockers.length === 0, policyVersion: RELEASE_POLICY_VERSION, blockers, warnings, checkedAt: new Date().toISOString() } };
}
export async function probeVideo(filePath: string, byteSize: number) {
  const header = Buffer.alloc(32), handle = await open(filePath, "r");
  try {
    const [raw, read] = await Promise.all([runProbe(filePath), handle.read(header, 0, 32, 0)]);
    return validateProbe(raw, byteSize, header.subarray(0, read.bytesRead));
  } finally {
    await handle.close().catch(() => {});
  }
}
export function safeFilename(value: string) { const decoded = (() => { try { return decodeURIComponent(value); } catch { return value; } })(); return path.basename(decoded).replace(/[\x00-\x1f\x7f]/g, "").slice(0, 180) || "finished-video.mp4"; }
