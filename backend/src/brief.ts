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
export function brandConflict(subject: string, brand?: BrandKit) {
  return (
    /clothing|apparel|fashion|shoe|sneaker|garment/i.test(subject) &&
    !/coffee|barista|cafe|café/i.test(subject) &&
    /coffee|barista|cafe|café/i.test(
      `${brand?.brandName ?? ""} ${brand?.characterDescription ?? ""}`,
    )
  );
}
export function requireBrief(r: Run) {
  if (!r.effective?.confirmed)
    throw new Error(
      "Confirm “What we’re creating” and choose a Brand kit before generation.",
    );
  if (
    r.effective.objective === "promote" &&
    /^(clothing|shoe|fashion|apparel|footwear)( brand)?$/i.test(
      r.effective.subject.trim(),
    ) &&
    !r.effective.productDetails.trim() &&
    !r.brief.pastedScript
  )
    throw new Error(
      "Specify which clothing or shoe product to show in Product details, then confirm the brief. No generation has started.",
    );
  if (brandConflict(r.effective.subject, r.brandKit))
    throw new Error(
      "The coffee/barista Brand kit conflicts with this clothing or shoe brief. Use no kit or edit a run-specific copy.",
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
export function platformSubject(r: Run) {
  return /instagram|social media|marketing metrics|reels|engagement|analytics/i.test(
    r.effective?.subject ?? r.brief.topic,
  );
}
export function irrelevantFact(r: Run, text: string) {
  return (
    !platformSubject(r) &&
    /instagram|\breels\b|social media|engagement metrics|aspect ratio|1080|1920|shares per day/i.test(
      text,
    )
  );
}
export function criticalText(r: Run, text: string) {
  const failures: { code: string; evidence: string }[] = [];
  if (
    !platformSubject(r) &&
    /analytics dashboard|instagram engagement|gen z use instagram|daily shares|social media interface|share icons|metrics meters/i.test(
      text,
    )
  )
    failures.push({
      code: "wrong_subject",
      evidence:
        "Platform analytics/interface content replaces the approved subject.",
    });
  if (
    /clothing|shoe|fashion|garment|sneaker/i.test(
      r.effective?.subject ?? r.brief.topic,
    ) &&
    /barista|coffee brewing|coffee beans/i.test(text)
  )
    failures.push({
      code: "brand_contamination",
      evidence: "Coffee/barista content is unrelated to this product.",
    });
  return failures;
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
