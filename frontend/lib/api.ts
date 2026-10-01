// The one API client for the whole app: one function per backend route from
// docs/ARCHITECTURE.md section 3. When NEXT_PUBLIC_API_URL isn't set, every
// function resolves with realistic sample data (via lib/store.ts) after a
// short delay instead of calling a real server — see docs/ARCHITECTURE.md
// section 5 ("Test mode") for why.

import {
  BrandKit,
  CostEstimate,
  Frame,
  NewRunInput,
  Pack,
  Run,
  ImageQuote,
} from "./types";
import {
  generateAiCallLogEntry,
  generateDirections,
  generateFacts,
  generateKeyFrame,
  generatePack,
  generateScript,
  generateSources,
  generateStoryboardFrames,
  generateVideoPrompt,
  blankRunFromInput,
  placeholderImageUrl,
  rescoreScript,
} from "./sample-data";
import {
  getBrandKitFromStore,
  getRunFromStore,
  listRunsFromStore,
  saveBrandKitToStore,
  saveRunToStore,
} from "./store";
import { randomId } from "./format";

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const AUTH_MODE = process.env.NEXT_PUBLIC_AUTH_MODE ?? "local";
let accessTokenProvider: (() => Promise<string | null>) | null = null;

export function setAccessTokenProvider(provider: (() => Promise<string | null>) | null) {
  accessTokenProvider = provider;
}

export function isSampleMode(): boolean {
  return !API_URL;
}

const PROMPT_SCORE_THRESHOLD = 75;
const PROMPT_MAX_REWRITE_ATTEMPTS = 3;
const FRAME_SCORE_THRESHOLD = 70;

function delay<T>(value: T, ms: number): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function realFetch<T>(path: string, init?: RequestInit, requiresAuth = true): Promise<T> {
  let res: Response;
  try {
    const token = requiresAuth && AUTH_MODE === "supabase" ? await accessTokenProvider?.() : null;
    if (requiresAuth && AUTH_MODE === "supabase" && !token)
      throw new ApiError("Your session has ended. Sign in again to continue.");
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init?.headers ?? {}) },
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      `Could not reach the backend at ${API_URL}. Check that it's running and reachable.`,
    );
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let message = text;
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed.error === "string") message = parsed.error;
    } catch {}
    throw new ApiError(message || `Request failed with status ${res.status}.`);
  }
  return res.json() as Promise<T>;
}

function notFound(id: string): never {
  throw new ApiError(
    `Run ${id} was not found. It may have been deleted, or the address is wrong.`,
  );
}

// ---------- Runs ----------

export async function listRuns(): Promise<Run[]> {
  if (isSampleMode()) return delay(listRunsFromStore(), 300);
  return realFetch<Run[]>("/api/runs");
}

export async function getRun(id: string): Promise<Run> {
  if (isSampleMode()) {
    const run = getRunFromStore(id);
    if (!run) notFound(id);
    return delay(run, 200);
  }
  return realFetch<Run>(`/api/runs/${id}`);
}

export async function createRun(input: NewRunInput): Promise<Run> {
  if (isSampleMode()) {
    const run = blankRunFromInput(input);
    if (input.pastedScript) {
      // "paste their own script and skip straight to step 3" (Direction stage).
      const sources = generateSources(0);
      run.sources = sources;
      run.facts = [];
      const wordCount = input.pastedScript
        .trim()
        .split(/\s+/)
        .filter(Boolean).length;
      run.script = {
        version: 1,
        beats: [],
        fullText: input.pastedScript,
        wordCount,
        estimatedSeconds: Math.round((wordCount / 150) * 60),
        targetSeconds: input.durationSeconds,
      };
      run.directions = generateDirections();
      run.currentStage = "direction";
      run.jobStatus = "needs_review";
    }
    saveRunToStore(run);
    return delay(run, 400);
  }
  return realFetch<Run>("/api/runs", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// ---------- Story ----------

export async function startStory(runId: string, fresh = false): Promise<Run> {
  if (isSampleMode()) {
    const run = getRunFromStore(runId) ?? notFound(runId);
    const sources = generateSources(3);
    const facts = generateFacts(run.brief.topic, sources);
    run.sources = sources;
    run.facts = facts;
    run.script = generateScript(
      run.brief.topic,
      run.brief.durationSeconds,
      facts,
    );
    run.currentStage = "story";
    run.jobStatus = "needs_review";
    run.aiCallLog.push(generateAiCallLogEntry("story", "grounding", 0));
    run.aiCallLog.push(generateAiCallLogEntry("story", "text", 0.007));
    run.runningCostUsd += 0.007;
    saveRunToStore(run);
    return delay(run, 2600);
  }
  return realFetch<Run>(`/api/runs/${runId}/story`, {
    method: "POST",
    body: JSON.stringify({ fresh }),
  });
}

export async function toggleFact(
  runId: string,
  factId: string,
  removed: boolean,
): Promise<Run> {
  if (isSampleMode()) {
    const run = getRunFromStore(runId) ?? notFound(runId);
    run.facts = run.facts.map((f) => (f.id === factId ? { ...f, removed } : f));
    const activeFacts = run.facts.filter((f) => !f.removed);
    run.script = generateScript(
      run.brief.topic,
      run.brief.durationSeconds,
      activeFacts,
    );
    saveRunToStore(run);
    return delay(run, 900);
  }
  return realFetch<Run>(`/api/runs/${runId}/facts`, {
    method: "PATCH",
    body: JSON.stringify({ factId, removed }),
  });
}

export async function saveScript(
  runId: string,
  fullText: string,
  scriptVersion?: number,
  briefRevision?: number,
): Promise<Run> {
  if (isSampleMode()) {
    const run = getRunFromStore(runId) ?? notFound(runId);
    if (run.script) {
      const wordCount = fullText.trim()
        ? fullText.trim().split(/\s+/).length
        : 0;
      run.script = rescoreScript({ ...run.script, fullText, wordCount });
    }
    saveRunToStore(run);
    return delay(run, 300);
  }
  return realFetch<Run>(`/api/runs/${runId}/script`, {
    method: "PATCH",
    body: JSON.stringify({ fullText, scriptVersion, briefRevision }),
  });
}

export async function approveStory(
  runId: string,
  scriptVersion?: number,
  briefRevision?: number,
): Promise<Run> {
  // Maps to POST /api/runs/:id/directions — generating directions is how the
  // app moves a run from Story into the Direction stage.
  if (isSampleMode()) {
    const run = getRunFromStore(runId) ?? notFound(runId);
    run.directions = generateDirections();
    run.currentStage = "direction";
    run.jobStatus = "needs_review";
    run.aiCallLog.push(generateAiCallLogEntry("direction", "text", 0.004));
    run.runningCostUsd += 0.004;
    saveRunToStore(run);
    return delay(run, 1600);
  }
  return realFetch<Run>(`/api/runs/${runId}/directions`, {
    method: "POST",
    body: JSON.stringify({ scriptVersion, briefRevision }),
  });
}

// ---------- Direction ----------

export async function selectDirection(
  runId: string,
  directionId: string,
  note: string,
): Promise<Run> {
  if (isSampleMode()) {
    const run = getRunFromStore(runId) ?? notFound(runId);
    const direction = run.directions.find((d) => d.id === directionId);
    if (!direction)
      throw new ApiError("That direction could not be found on this run.");
    run.selectedDirectionId = directionId;
    run.directionNote = note;

    let attempt = 1;
    let prompt = generateVideoPrompt(
      direction,
      run.brief.topic,
      attempt,
      PROMPT_SCORE_THRESHOLD,
      getBrandKitFromStore(),
    );
    while (!prompt.passed && attempt < PROMPT_MAX_REWRITE_ATTEMPTS) {
      attempt += 1;
      prompt = generateVideoPrompt(
        direction,
        run.brief.topic,
        attempt,
        PROMPT_SCORE_THRESHOLD,
        getBrandKitFromStore(),
      );
    }
    run.videoPrompt = prompt;
    run.aiCallLog.push(
      generateAiCallLogEntry("direction", "text", 0.003 * attempt),
    );
    run.runningCostUsd += 0.003 * attempt;
    // The score is shown for confidence, not acted on — the run moves straight
    // into Look, pausing for the pre-render cost confirmation (job status
    // "waiting_confirmation", see docs/ARCHITECTURE.md section 2).
    run.currentStage = "look";
    run.jobStatus = "waiting_confirmation";
    saveRunToStore(run);
    return delay(run, 2400);
  }
  return realFetch<Run>(`/api/runs/${runId}/directions/${directionId}/select`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });
}

// ---------- Look & Storyboard ----------

export async function getCostEstimate(
  runId: string,
  kind: "key_frame" | "storyboard",
): Promise<CostEstimate> {
  if (isSampleMode()) {
    const run = getRunFromStore(runId) ?? notFound(runId);
    if (kind === "key_frame") {
      return delay(
        {
          label: "Key frame",
          amountUsd: 0.045,
          detail: "1 image at gemini-3.1-flash-image pricing",
        },
        200,
      );
    }
    const beatCount = run.script?.beats.length ?? 5;
    const remaining = Math.max(0, beatCount - 1);
    return delay(
      {
        label: "Storyboard",
        amountUsd: Math.round(remaining * 0.045 * 100) / 100,
        detail: `${remaining} image${remaining === 1 ? "" : "s"} at gemini-3.1-flash-image pricing, plus automatic quality-check regenerations if needed`,
      },
      200,
    );
  }
  return realFetch<CostEstimate>(
    `/api/runs/${runId}/cost-estimate?kind=${kind}`,
  );
}

export async function renderKeyFrame(runId: string): Promise<Run> {
  if (isSampleMode()) {
    const run = getRunFromStore(runId) ?? notFound(runId);
    const keyFrame = generateKeyFrame(runId, run.brief.aspectRatio);
    run.frames = [keyFrame, ...run.frames.filter((f) => !f.isKeyFrame)];
    run.currentStage = "look";
    run.jobStatus = "needs_review";
    run.aiCallLog.push(generateAiCallLogEntry("look", "image", 0.045));
    run.runningCostUsd += 0.045;
    saveRunToStore(run);
    return delay(run, 3000);
  }
  return realFetch<Run>(`/api/runs/${runId}/key-frame`, { method: "POST" });
}

export async function uploadKeyFrame(
  runId: string,
  dataUrl: string,
): Promise<Run> {
  if (isSampleMode()) {
    const run = getRunFromStore(runId) ?? notFound(runId);
    const keyFrame: Frame = {
      id: randomId("frame"),
      beatIndex: 0,
      isKeyFrame: true,
      imageUrl: dataUrl,
      scores: null,
      attempt: 1,
      status: "generated",
      source: "uploaded",
    };
    run.frames = [keyFrame, ...run.frames.filter((f) => !f.isKeyFrame)];
    run.currentStage = "look";
    run.jobStatus = "needs_review";
    saveRunToStore(run);
    return delay(run, 400);
  }
  return realFetch<Run>(`/api/runs/${runId}/key-frame/upload`, {
    method: "POST",
    body: JSON.stringify({ dataUrl }),
  });
}

export async function regenerateKeyFrame(
  runId: string,
  note: string,
): Promise<Run> {
  if (isSampleMode()) {
    const run = getRunFromStore(runId) ?? notFound(runId);
    const prior = run.frames.find((f) => f.isKeyFrame);
    const keyFrame = generateKeyFrame(runId, run.brief.aspectRatio);
    keyFrame.attempt = (prior?.attempt ?? 1) + 1;
    run.frames = [keyFrame, ...run.frames.filter((f) => !f.isKeyFrame)];
    run.jobStatus = "needs_review";
    run.aiCallLog.push(generateAiCallLogEntry("look", "image", 0.045));
    run.runningCostUsd += 0.045;
    saveRunToStore(run);
    void note; // sample mode doesn't feed the note into generation, a real model call would
    return delay(run, 2600);
  }
  return realFetch<Run>(`/api/runs/${runId}/key-frame/regenerate`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });
}

export async function generateStoryboard(runId: string): Promise<Run> {
  if (isSampleMode()) {
    const run = getRunFromStore(runId) ?? notFound(runId);
    const beatCount = run.script?.beats.length ?? 5;
    const storyboard = generateStoryboardFrames(
      runId,
      beatCount,
      run.brief.aspectRatio,
      FRAME_SCORE_THRESHOLD,
    );
    const keyFrame = run.frames.find((f) => f.isKeyFrame);
    run.frames = keyFrame ? [keyFrame, ...storyboard] : storyboard;
    run.currentStage = "storyboard";
    run.jobStatus = "needs_review";
    const cost = storyboard.length * 0.045;
    run.aiCallLog.push(generateAiCallLogEntry("storyboard", "image", cost));
    run.runningCostUsd += cost;
    saveRunToStore(run);
    return delay(run, 3400);
  }
  return realFetch<Run>(`/api/runs/${runId}/storyboard`, { method: "POST" });
}

export async function regenerateFrame(
  runId: string,
  frameId: string,
  note: string,
): Promise<Run> {
  if (isSampleMode()) {
    const run = getRunFromStore(runId) ?? notFound(runId);
    const existing = run.frames.find((f) => f.id === frameId);
    if (!existing)
      throw new ApiError("That frame could not be found on this run.");
    const [replacement] = generateStoryboardFrames(
      runId,
      2,
      run.brief.aspectRatio,
      0,
    );
    replacement.id = existing.id;
    replacement.beatIndex = existing.beatIndex;
    replacement.isKeyFrame = existing.isKeyFrame;
    replacement.attempt = existing.attempt + 1;
    run.frames = run.frames.map((f) => (f.id === frameId ? replacement : f));
    run.aiCallLog.push(generateAiCallLogEntry("storyboard", "image", 0.045));
    run.runningCostUsd += 0.045;
    saveRunToStore(run);
    void note;
    return delay(run, 2200);
  }
  return realFetch<Run>(`/api/runs/${runId}/frames/${frameId}/regenerate`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });
}

// ---------- Pack & Approve ----------

export async function generatePackForRun(runId: string): Promise<Run> {
  if (isSampleMode()) {
    const run = getRunFromStore(runId) ?? notFound(runId);
    if (!run.videoPrompt)
      throw new ApiError("This run doesn't have a scored video prompt yet.");
    run.pack = generatePack(
      run.brief.topic,
      getBrandKitFromStore(),
      run.videoPrompt,
    );
    run.currentStage = "pack";
    run.jobStatus = "needs_review";
    run.aiCallLog.push(generateAiCallLogEntry("pack", "text", 0.005));
    run.runningCostUsd += 0.005;
    saveRunToStore(run);
    return delay(run, 1500);
  }
  return realFetch<Run>(`/api/runs/${runId}/pack`, { method: "POST" });
}

export async function updatePack(
  runId: string,
  patch: Partial<Pack>,
): Promise<Run> {
  if (isSampleMode()) {
    const run = getRunFromStore(runId) ?? notFound(runId);
    if (!run.pack) throw new ApiError("This run doesn't have a pack yet.");
    run.pack = { ...run.pack, ...patch };
    saveRunToStore(run);
    return delay(run, 300);
  }
  return realFetch<Run>(`/api/runs/${runId}/pack`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function approvePack(runId: string): Promise<Run> {
  if (isSampleMode()) {
    const run = getRunFromStore(runId) ?? notFound(runId);
    if (!run.pack) throw new ApiError("This run doesn't have a pack yet.");
    run.pack.approved = true;
    run.currentStage = "done";
    run.jobStatus = "completed";
    saveRunToStore(run);
    return delay(run, 400);
  }
  return realFetch<Run>(`/api/runs/${runId}/approve`, { method: "POST" });
}

// ---------- Brand kit ----------

export async function getBrandKit(): Promise<BrandKit> {
  if (isSampleMode()) return delay(getBrandKitFromStore(), 250);
  return realFetch<BrandKit>("/api/brand-kit");
}

export async function saveBrandKit(brandKit: BrandKit): Promise<BrandKit> {
  if (isSampleMode()) return delay(saveBrandKitToStore(brandKit), 400);
  return realFetch<BrandKit>("/api/brand-kit", {
    method: "PUT",
    body: JSON.stringify(brandKit),
  });
}

export { placeholderImageUrl };

export async function getHealth(): Promise<{
  mode: string;
  testMode: boolean;
  keyPresent: boolean;
  authMode: string;
  storageMode: string;
}> {
  return realFetch("/api/health", undefined, false);
}
export async function resumeRun(id: string): Promise<Run> {
  return realFetch(`/api/runs/${id}/resume`, { method: "POST" });
}

export function assetUrl(url: string) {
  return url.startsWith("/api/") ? `${API_URL}${url}` : url;
}
export async function fetchAsset(path: string): Promise<Blob> {
  if (!API_URL) throw new ApiError("No backend is configured.");
  const token = AUTH_MODE === "supabase" ? await accessTokenProvider?.() : null;
  if (AUTH_MODE === "supabase" && !token) throw new ApiError("Sign in to view this image.");
  const response = await fetch(`${API_URL}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!response.ok) throw new ApiError(response.status === 401 ? "Your session has ended. Sign in again." : "This image is unavailable.");
  return response.blob();
}
export async function requestImageQuote(
  id: string,
  action: ImageQuote["action"],
  note = "",
  frameId?: string,
  resume = false,
): Promise<ImageQuote> {
  return realFetch(`/api/runs/${id}/image-quotes`, {
    method: "POST",
    body: JSON.stringify({ action, note, frameId, resume }),
  });
}
export async function confirmImageQuote(
  id: string,
  quote: ImageQuote,
): Promise<Run> {
  const route =
    quote.action === "key"
      ? "key-frame"
      : quote.action === "key-regenerate"
        ? "key-frame/regenerate"
        : quote.action === "board"
          ? "storyboard"
          : `frames/${quote.frameId}/regenerate`;
  return realFetch(`/api/runs/${id}/${route}`, {
    method: "POST",
    body: JSON.stringify({ quoteId: quote.id }),
  });
}
export async function approveKey(id: string, keyId: string): Promise<Run> {
  return realFetch(`/api/runs/${id}/key-frame/approve`, {
    method: "POST",
    body: JSON.stringify({ keyId }),
  });
}
export async function rejectKey(id: string): Promise<Run> {
  return realFetch(`/api/runs/${id}/key-frame/reject`, { method: "POST" });
}
export async function approveStoryboard(id: string): Promise<Run> {
  return realFetch(`/api/runs/${id}/storyboard/approve`, { method: "POST" });
}

export async function repairAction(
  id: string,
  route: string,
  body: unknown,
  method = "POST",
): Promise<Run> {
  return realFetch(`/api/runs/${id}/${route}`, {
    method,
    body: JSON.stringify(body),
  });
}
