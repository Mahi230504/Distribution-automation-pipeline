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
  origin?: "saved" | "empty" | "demo" | "legacy";
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
  originalUrl?: string;
  resolution?: "direct" | "resolved" | "unresolved";
  evidenceText?: string;
}

export interface Fact {
  id: string;
  text: string;
  label: FactLabel;
  sourceId: string;
  sourceIds?: string[];
  supportedText?: string[];
  reviewReason?: string;
  removed: boolean;
}

export interface ScriptBeat {
  claimType?: "creative" | "supported" | "user_unverified";
  factIds?: string[];
  id: string;
  startSeconds: number;
  endSeconds: number;
  visual: string;
  vo: string;
  onScreen: string;
}

export interface Script {
  mode?: "test" | "live" | "unknown";
  changeSummary?: string;
  changedBeatIds?: string[];
  author?: "ai" | "user";
  speakingRate?: number;
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
  task?: string;
  jobId?: string;
  origin?: ChangeOrigin;
  referenceHashes?: string[];
  inputTokens?: number;
  outputTokens?: number;
  imageCount?: number;
  searchRequests?: number;
  durationMs?: number;
  attempt?: number;
  error?: string;
  testMode?: boolean;
  usageKnown?: boolean;
  id: string;
  stage: RunStage;
  model: string;
  callType: "text" | "image" | "grounding";
  estimatedCostUsd: number;
  outcome: "success" | "retried" | "failed" | "pending" | "interrupted";
  createdAt: string;
}

export interface Run {
  briefAssessment?: {
    inputKey: string;
    briefRevision: number;
    mode: "test" | "live";
    at: string;
    rationale: string;
    issues: {
      kind:
        | "unclear_subject"
        | "unclear_objective"
        | "brand_conflict"
        | "conflicting_constraints";
      explanation: string;
      question: string;
    }[];
  };
  mode?: "test" | "live" | "unknown";
  effective?: EffectiveBrief;
  storyApproval?: { scriptVersion: number; briefRevision: number; at: string };
  feedbackHistory?: ScriptFeedback[];
  history?: {
    facts?: Fact[];
    sources?: Source[];
    research?: Run["research"];
    feedbackHistory?: ScriptFeedback[];
    scriptVersions?: Script[];
    brandKit?: BrandKit;
    brief: Brief;
    effective?: EffectiveBrief;
    script: Script | null;
    generation?: GenerationState;
    directions: Direction[];
    at: string;
  }[];
  productReference?: ImageAttempt;
  generation?: GenerationState;
  job?: {
    id: string;
    ownerId?: string;
    kind: "story" | "rewrite" | "script-revision" | GenerationKind;
    revisionDraft?: {
      requiresResearch: boolean;
      reason: string;
      summary: string;
      beats: ScriptBeat[];
    };
    feedbackId?: string;
    baseScriptVersion?: number;
    briefRevision?: number;
    completed?: string[];
    quoteId?: string;
    frameId?: string;
    note?: string;
    finishedAt?: string;
    status: JobStatus;
    checkpoint: string;
    startedAt: string;
    message: string;
    error?: string;
    factId?: string;
    removed?: boolean;
    fresh?: boolean;
  };
  research?: {
    mode?: "test" | "live" | "unknown";
    queries?: string[];
    requestBrief?: string;
    status: "cited" | "uncited";
    createdAt: string;
    cacheKey: string;
    reused?: boolean;
    dropped: { id: string; text: string; reason: string }[];
  };
  scriptVersions?: Script[];
  brandKit?: BrandKit;
  sampleStages?: boolean;
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
  interpretation?: Omit<EffectiveBrief, "revision" | "brandSelection">;
  brandSelection?: "none" | "saved" | "custom";
  brandKit?: BrandKit;
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

// Step 4: saved deliverables. Old score shapes above belong only to standalone samples.
export type GenerationKind =
  | "directions"
  | "prompt"
  | "key"
  | "key-regenerate"
  | "board"
  | "frame-regenerate";
export type ChangeOrigin =
  | "user"
  | "automatic quality improvement"
  | "automatic frame regeneration"
  | "provider retry";
export interface QualityReview {
  visibleChecks?: {
    requirement: string;
    observed: boolean;
    evidence: string;
  }[];
  criticalFailures?: { code: string; evidence: string }[];
  mode?: "test" | "live" | "unknown";
  dimensions: Record<string, { score: number; explanation: string }>;
  overall: number;
  threshold: number;
  passed: boolean;
  callIds: string[];
}
export interface PromptAttempt {
  mode?: "test" | "live" | "unknown";
  inputSnapshot?: string;
  stopReason?: string;
  changeSummary?: string;
  id: string;
  revision: number;
  attempt: number;
  prompt: string;
  negativePrompt: string;
  directionId?: string;
  note?: string;
  createdAt?: string;
  visualBible: string;
  review?: QualityReview;
  callIds: string[];
  origin: ChangeOrigin;
}
export interface ImageAttempt {
  intentAudit?: { passed: boolean; reason: string; mode: "test" | "live" };
  observation?: {
    description: string;
    uncertainties: string[];
    mode: "test" | "live";
  };
  referenceAssetId?: string;
  mode?: "test" | "live" | "unknown";
  stillPrompt?: string;
  id: string;
  assetId: string;
  imageUrl: string;
  attempt: number;
  jobId: string;
  note: string;
  origin: ChangeOrigin;
  source: "generated" | "uploaded";
  review?: QualityReview;
  callIds: string[];
  createdAt: string;
  approval?: "approved" | "rejected" | "replaced";
}
export interface BoardFrame {
  restoredFromAttemptId?: string;
  id: string;
  order: number;
  beatIds: string[];
  instruction: string;
  isKey: boolean;
  attempts: ImageAttempt[];
  selectedAttemptId?: string;
  complete: boolean;
  retryLimitReached: boolean;
}
export interface GenerationActivity {
  id: string;
  jobId: string;
  checkpoint: string;
  message: string;
  at: string;
  state:
    | "pending"
    | "running"
    | "completed"
    | "waiting"
    | "retrying"
    | "interrupted"
    | "resumed"
    | "failed";
  origin: ChangeOrigin;
}
export interface ImageQuote {
  id: string;
  action: "key" | "key-regenerate" | "board" | "frame-regenerate";
  revision: number;
  keyId?: string;
  frameId?: string;
  note: string;
  expiresAt: string;
  maxImages: number;
  amountUsd: number;
  items: { label: string; quantity: number; amountUsd: number }[];
  usedByJobId?: string;
  settingsFingerprint: string;
  resumeJobId?: string;
  imageCallsAtQuote?: number;
}
export interface GenerationState {
  promptFeedback?: string[];
  revision: number;
  storyApproved: boolean;
  directionsReady: boolean;
  prompts: PromptAttempt[];
  activePromptId?: string;
  keys: ImageAttempt[];
  activeKeyId?: string;
  approvedKeyId?: string;
  board: BoardFrame[];
  archivedBoards: BoardFrame[][];
  boardApprovedAt?: string;
  quotes: ImageQuote[];
  activities: GenerationActivity[];
  manualRegenerations: number;
  limits: {
    promptThreshold: number;
    promptRewrites: number;
    frameThreshold: number;
    autoRegenerations: number;
    manualRegenerations: number;
    maxFrames: number;
    uploadBytes: number;
  };
}

export interface EffectiveBrief {
  revision: number;
  subject: string;
  objective: "promote" | "explain" | "demonstrate" | "tell a story";
  productDetails: string;
  visualPreferences: string;
  factualConstraints: string;
  summary: string;
  confirmed: boolean;
  brandSelection: "none" | "saved" | "custom";
}
export interface ScriptFeedback {
  id: string;
  note: string;
  scope: "opening" | "selected" | "full";
  beatIds: string[];
  baseVersion: number;
  briefRevision: number;
  at: string;
  status: "pending" | "completed" | "failed" | "needs_research";
  summary?: string;
  error?: string;
  resultVersion?: number;
}
