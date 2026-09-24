// Shared types for VPO Studio, matching the data model in docs/ARCHITECTURE.md.

export type Platform = "instagram_reels" | "youtube_shorts" | "linkedin";

export const PLATFORM_LABELS: Record<Platform, string> = {
  instagram_reels: "Instagram Reels",
  youtube_shorts: "YouTube Shorts",
  linkedin: "LinkedIn",
};

export type AspectRatio = "9:16" | "16:9";

export type FactLabel = "stated" | "implied";

// runs.current_stage — see docs/ARCHITECTURE.md section 2.
export type RunStage =
  | "brief"
  | "story"
  | "direction"
  | "look"
  | "storyboard"
  | "pack"
  | "approve"
  | "done";

export const RUN_STAGES: RunStage[] = [
  "brief",
  "story",
  "direction",
  "look",
  "storyboard",
  "pack",
  "approve",
  "done",
];

export const STAGE_LABELS: Record<RunStage, string> = {
  brief: "Brief",
  story: "Story",
  direction: "Direction",
  look: "Look",
  storyboard: "Storyboard",
  pack: "Pack",
  approve: "Approve",
  done: "Done",
};

// The stepper only shows these 7 — "done" is a terminal state, shown as "Approve" complete.
export const STEPPER_STAGES: RunStage[] = [
  "brief",
  "story",
  "direction",
  "look",
  "storyboard",
  "pack",
  "approve",
];

// runs.job_status — see docs/ARCHITECTURE.md section 2.
export type JobStatus =
  | "idle"
  | "queued"
  | "running"
  | "waiting_confirmation"
  | "needs_review"
  | "interrupted"
  | "failed"
  | "completed";

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  idle: "Idle",
  queued: "Queued",
  running: "Working…",
  waiting_confirmation: "Waiting for confirmation",
  needs_review: "Needs your review",
  interrupted: "Interrupted",
  failed: "Failed",
  completed: "Completed",
};

export interface BrandKit {
  brandName: string;
  palette: string[];
  characterDescription: string;
  tone: string;
  constraints: string;
  preferredPlatforms: Platform[];
}

export interface Source {
  id: string;
  url: string;
  title: string;
}

export interface Fact {
  id: string;
  text: string;
  label: FactLabel;
  sourceId: string;
  removed: boolean;
}

export interface ScriptBeat {
  id: string;
  startSeconds: number;
  endSeconds: number;
  visual: string;
  vo: string;
  onScreen: string;
}

export interface Script {
  version: number;
  beats: ScriptBeat[];
  fullText: string;
  wordCount: number;
  estimatedSeconds: number;
  targetSeconds: number;
}

export interface Direction {
  id: string;
  name: string;
  hook: string;
  angle: string;
  look: string;
  mood: string;
  summary: string;
}

export interface PromptScores {
  clarity: number;
  visualDetail: number;
  brandFit: number;
  feasibility: number;
  engagement: number;
  overall: number;
}

export interface VideoPrompt {
  directionId: string;
  promptText: string;
  negativePrompt: string;
  scores: PromptScores;
  attempt: number;
  passed: boolean;
  threshold: number;
}

export interface FrameScores {
  characterConsistency: number;
  styleConsistency: number;
  composition: number;
  brandFit: number;
  technicalQuality: number;
  promptAdherence: number;
  overall: number;
}

export interface Frame {
  id: string;
  beatIndex: number;
  isKeyFrame: boolean;
  imageUrl: string;
  scores: FrameScores | null;
  attempt: number;
  status: "pending" | "generated" | "approved";
  source: "generated" | "uploaded";
}

export interface PlatformCaption {
  platform: Platform;
  caption: string;
}

export interface Pack {
  finalPrompt: string;
  negativePrompt: string;
  title: string;
  captions: PlatformCaption[];
  hashtags: string[];
  thumbnailText: string;
  postingNotes: string;
  approved: boolean;
}

export interface Brief {
  topic: string;
  audience: string;
  platform: Platform;
  aspectRatio: AspectRatio;
  durationSeconds: number;
  targetVideoModel: string;
  sourceLinks: string[];
  notes: string;
  pastedScript: string | null;
}

export interface CostEstimate {
  label: string;
  amountUsd: number;
  detail: string;
}

export interface AiCallLogEntry {
  id: string;
  stage: RunStage;
  model: string;
  callType: "text" | "image" | "grounding";
  estimatedCostUsd: number;
  outcome: "success" | "retried" | "failed";
  createdAt: string;
}

export interface Run {
  id: string;
  userId: string;
  brief: Brief;
  currentStage: RunStage;
  jobStatus: JobStatus;
  autopilot: boolean;
  runningCostUsd: number;
  createdAt: string;
  updatedAt: string;
  sources: Source[];
  facts: Fact[];
  script: Script | null;
  directions: Direction[];
  selectedDirectionId: string | null;
  directionNote: string;
  videoPrompt: VideoPrompt | null;
  frames: Frame[];
  pack: Pack | null;
  aiCallLog: AiCallLogEntry[];
}

export interface NewRunInput {
  topic: string;
  audience: string;
  platform: Platform;
  aspectRatio: AspectRatio;
  durationSeconds: number;
  targetVideoModel: string;
  sourceLinks: string[];
  notes: string;
  pastedScript: string | null;
}
