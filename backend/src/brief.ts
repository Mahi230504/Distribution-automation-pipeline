import { z } from "zod";
import type {
  Run,
  BrandKit,
  EffectiveBrief,
} from "../../frontend/lib/types.js";
import { settings } from "./settings.js";
export const interpretationSchema = z.object({
  subject: z.string().trim().min(2).max(500),
  objective: z.enum(["promote", "explain", "demonstrate", "tell a story"]),
  productDetails: z.string().max(4000),
  visualPreferences: z.string().max(3000),
  factualConstraints: z.string().max(3000),
  summary: z.string().trim().min(10).max(4000),
  confirmed: z.boolean(),
});
export const emptyBrand: BrandKit = {
  brandName: "",
  palette: [],
  characterDescription: "",
  tone: "",
  constraints: "",
  preferredPlatforms: [],
  origin: "empty",
};
export const mode = () =>
  settings.test ? ("test" as const) : ("live" as const);
export function requireBrief(r: Run) {
  if (!r.effective?.confirmed)
    throw new Error(
      "Confirm “What we’re creating” and choose a Brand kit before generation.",
    );
  if (r.mode !== mode())
    throw new Error(
      `This run contains ${r.mode ?? "unknown"} outputs. Start a new run for ${mode()} generation; changing server mode does not convert saved work.`,
    );
}
export function semanticBrief(r: Run) {
  return {
    subject: r.effective?.subject ?? r.brief.topic,
    objective: r.effective?.objective ?? "explain",
    audience: r.brief.audience,
    notes: r.brief.notes,
    sourceLinks: r.brief.sourceLinks,
    productDetails: r.effective?.productDetails ?? "",
    visualPreferences: r.effective?.visualPreferences ?? "",
    factualConstraints: r.effective?.factualConstraints ?? "",
    summary: r.effective?.summary ?? r.brief.notes,
  };
}
export function assertVersion(
  r: Run,
  version: unknown,
  briefRevision: unknown,
) {
  if (version !== r.script?.version || briefRevision !== r.effective?.revision)
    throw new Error(
      "This version is outdated. Refresh and review the current script and brief.",
    );
}
export function assertIdle(r: Run) {
  if (["queued", "running", "interrupted"].includes(r.jobStatus))
    throw new Error("Finish or Resume the current job before editing.");
}
export function invalidateStory(r: Run) {
  (r.history ??= []).push({
    facts: structuredClone(r.facts),
    sources: structuredClone(r.sources),
    research: structuredClone(r.research),
    feedbackHistory: structuredClone(r.feedbackHistory),
    scriptVersions: structuredClone(r.scriptVersions),
    brandKit: structuredClone(r.brandKit),
    brief: structuredClone(r.brief),
    effective: structuredClone(r.effective),
    script: structuredClone(r.script),
    generation: structuredClone(r.generation),
    directions: structuredClone(r.directions),
    at: new Date().toISOString(),
  });
  delete r.storyApproval;
  if (r.generation) {
    r.generation.revision++;
    r.generation.storyApproved = false;
    r.generation.directionsReady = false;
    delete r.generation.activePromptId;
    delete r.generation.activeKeyId;
    delete r.generation.approvedKeyId;
    delete r.generation.boardApprovedAt;
    if (r.generation.board.length)
      r.generation.archivedBoards.push(r.generation.board);
    r.generation.board = [];
  }
  r.directions = [];
  r.selectedDirectionId = null;
  r.videoPrompt = null;
  r.frames = [];
  r.pack = null;
  r.currentStage = "story";
  r.jobStatus = "needs_review";
}
