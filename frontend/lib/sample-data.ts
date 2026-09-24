// Realistic sample data generators, used when no backend is configured
// (see lib/api.ts) and to seed the sample History list.

import {
  AiCallLogEntry,
  BrandKit,
  Direction,
  Fact,
  Frame,
  FrameScores,
  NewRunInput,
  Pack,
  PromptScores,
  Run,
  Script,
  ScriptBeat,
  Source,
  VideoPrompt,
} from "./types";
import { countWords, estimateSecondsFromWordCount, randomId } from "./format";

export const SAMPLE_BRAND_KIT: BrandKit = {
  brandName: "Northwind Coffee Co.",
  palette: ["#2E2A24", "#C48A3E", "#F4EDE1", "#5B7B63"],
  characterDescription:
    "A warm, animated barista character with curly hair, a denim apron, and an easy smile — friendly and a little cheeky.",
  tone: "Warm, upbeat, a little playful. Never salesy or corporate.",
  constraints:
    "Never show competitor logos. Always show the pour-over ritual, not just the finished cup. No stock-photo aesthetics.",
  preferredPlatforms: ["instagram_reels", "youtube_shorts", "linkedin"],
};

const SOURCE_POOL: Omit<Source, "id">[] = [
  { url: "https://www.ncausa.org/Industry-Resources/Market-Research", title: "National Coffee Association — Market Research" },
  { url: "https://www.who.int/news-room/fact-sheets", title: "World Health Organization — Fact Sheets" },
  { url: "https://www.statista.com/topics/1248/coffee-market/", title: "Statista — Coffee Market Overview" },
  { url: "https://hbr.org/topic/subject/marketing", title: "Harvard Business Review — Marketing" },
  { url: "https://www.pewresearch.org/topic/internet-technology/", title: "Pew Research Center — Internet & Technology" },
];

function pick<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  while (out.length < n && copy.length > 0) {
    const i = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(i, 1)[0]);
  }
  return out;
}

export function generateSources(count = 3): Source[] {
  return pick(SOURCE_POOL, count).map((s) => ({ id: randomId("src"), ...s }));
}

export function generateFacts(topic: string, sources: Source[]): Fact[] {
  const templates = [
    `${topic} has seen a measurable rise in search interest over the past two years, according to industry tracking.`,
    `Most audiences researching ${topic} do so on mobile, often in short, repeated sessions rather than one long visit.`,
    `Independent brands in this space that lead with a clear point of view tend to see stronger engagement than those that lead with product specs.`,
    `Short-form video around ${topic} performs best in the first three seconds — viewers decide almost immediately whether to keep watching.`,
    `Surveyed consumers consistently rank authenticity and transparency above polish when choosing who to trust on ${topic}.`,
    `Posting consistency matters more than posting frequency for accounts covering ${topic}.`,
    `Community-driven content (behind-the-scenes, real customers) around ${topic} is shared more often than produced, studio-style content.`,
  ];
  const chosen = pick(templates, Math.min(6, templates.length));
  return chosen.map((text, i) => ({
    id: randomId("fact"),
    text,
    label: i % 3 === 0 ? "implied" : "stated",
    sourceId: sources[i % sources.length]?.id ?? sources[0].id,
    removed: false,
  }));
}

export function generateScript(
  topic: string,
  targetSeconds: number,
  facts: Fact[]
): Script {
  const activeFacts = facts.filter((f) => !f.removed);
  const beatCount = Math.max(3, Math.min(6, Math.round(targetSeconds / 8)));
  const beatLength = targetSeconds / beatCount;
  const beats: ScriptBeat[] = [];

  const voLines = [
    `Ever wonder what actually makes ${topic} worth talking about?`,
    activeFacts[0]?.text ?? `Here's the thing about ${topic} most people miss.`,
    activeFacts[1]?.text ?? `It's not what you'd expect.`,
    `That's why we do things differently.`,
    activeFacts[2]?.text ?? `And it's working.`,
    `So — ready to see for yourself?`,
  ];

  const visualLines = [
    "Close-up hook shot, energetic handheld camera, quick cut in",
    "Character on screen, mid-action, natural light",
    "Cutaway to supporting detail shot, slow push-in",
    "Character reacts, warm smile, direct to camera",
    "Product/result hero shot, clean background",
    "Final logo card with call-to-action text",
  ];

  const onScreenLines = ["", "DID YOU KNOW?", "", "", "TRY IT TODAY", "@yourbrand"];

  for (let i = 0; i < beatCount; i++) {
    const start = Math.round(i * beatLength);
    const end = i === beatCount - 1 ? targetSeconds : Math.round((i + 1) * beatLength);
    beats.push({
      id: randomId("beat"),
      startSeconds: start,
      endSeconds: end,
      visual: visualLines[i % visualLines.length],
      vo: voLines[i % voLines.length],
      onScreen: onScreenLines[i % onScreenLines.length],
    });
  }

  const fullText = beats
    .map(
      (b) =>
        `[0:${String(b.startSeconds).padStart(2, "0")}–0:${String(b.endSeconds).padStart(2, "0")}] VISUAL: ${b.visual} VO: "${b.vo}" ON-SCREEN: ${b.onScreen || "(none)"}`
    )
    .join("\n\n");

  const wordCount = countWords(beats.map((b) => b.vo).join(" "));

  return {
    version: 1,
    beats,
    fullText,
    wordCount,
    estimatedSeconds: estimateSecondsFromWordCount(wordCount),
    targetSeconds,
  };
}

export function rescoreScript(script: Script): Script {
  const wordCount = countWords(script.beats.map((b) => b.vo).join(" "));
  return {
    ...script,
    wordCount,
    estimatedSeconds: estimateSecondsFromWordCount(wordCount),
  };
}

const DIRECTION_POOL: Omit<Direction, "id">[] = [
  {
    name: "The Honest Ritual",
    hook: "Skip the polish — show the real, slightly messy process.",
    angle: "Behind-the-scenes authenticity beats a perfect studio shot.",
    look: "Handheld, natural light, warm film grain",
    mood: "Grounded, intimate, a little playful",
    summary: "A day-in-the-life style short that trades gloss for trust.",
  },
  {
    name: "Bold Claim, Fast Proof",
    hook: "Open with a confident, slightly provocative claim, then prove it in seconds.",
    angle: "Pattern-interrupt hook aimed at scroll-stopping in the first second.",
    look: "High contrast, punchy cuts, bold on-screen text",
    mood: "Confident, energetic, cheeky",
    summary: "A fast, hook-first cut built for maximum first-second retention.",
  },
  {
    name: "Character-Led Story",
    hook: "Let the brand character carry the whole story, front and center.",
    angle: "Viewers remember characters, not claims — lean fully into it.",
    look: "Consistent character across every frame, storybook lighting",
    mood: "Warm, charming, memorable",
    summary: "A character-first arc that builds recognition over repeat views.",
  },
];

export function generateDirections(): Direction[] {
  return DIRECTION_POOL.map((d) => ({ id: randomId("dir"), ...d }));
}

function scoreDimension(base: number): number {
  return Math.round(Math.min(100, Math.max(40, base + (Math.random() * 10 - 5))));
}

export function generateVideoPrompt(
  direction: Direction,
  topic: string,
  attempt: number,
  threshold: number,
  brandKit: BrandKit
): VideoPrompt {
  const base = 70 + attempt * 10;
  const scores: PromptScores = {
    clarity: scoreDimension(base),
    visualDetail: scoreDimension(base),
    brandFit: scoreDimension(base),
    feasibility: scoreDimension(base + 5),
    engagement: scoreDimension(base),
    overall: 0,
  };
  scores.overall = Math.min(
    scores.clarity,
    scores.visualDetail,
    scores.brandFit,
    scores.feasibility,
    scores.engagement
  );

  const promptText = `A ${direction.mood.toLowerCase()} ${direction.look.toLowerCase()} short vertical video about ${topic}. Character: ${brandKit.characterDescription} Style: ${direction.look}, consistent character and palette (${brandKit.palette.join(", ")}) across every shot. Tone: ${brandKit.tone} Direction: ${direction.summary} Pacing follows the provided script beats exactly, with the hook landing in the first second.`;

  const negativePrompt =
    "no text artifacts, no distorted hands or faces, no logo of competing brands, no watermarks, no flickering or morphing between shots, no stock-footage look";

  return {
    directionId: direction.id,
    promptText,
    negativePrompt,
    scores,
    attempt,
    passed: scores.overall >= threshold,
    threshold,
  };
}

function frameScore(base: number): FrameScores {
  const s: FrameScores = {
    characterConsistency: scoreDimension(base),
    styleConsistency: scoreDimension(base),
    composition: scoreDimension(base),
    brandFit: scoreDimension(base),
    technicalQuality: scoreDimension(base),
    promptAdherence: scoreDimension(base),
    overall: 0,
  };
  s.overall = Math.min(
    s.characterConsistency,
    s.styleConsistency,
    s.composition,
    s.brandFit,
    s.technicalQuality,
    s.promptAdherence
  );
  return s;
}

// Kept mid-to-high brightness so placeholders read clearly against the app's near-black background.
const PLACEHOLDER_PALETTE = ["C48A3E", "6B9E7A", "8B7CF6", "A594FF", "E0895A", "4FB0C6"];

export function placeholderImageUrl(seed: string, aspect: "9:16" | "16:9"): string {
  const width = aspect === "9:16" ? 480 : 640;
  const height = aspect === "9:16" ? 854 : 360;
  const color = PLACEHOLDER_PALETTE[Math.abs(hashString(seed)) % PLACEHOLDER_PALETTE.length];
  return `https://placehold.co/${width}x${height}/${color}/f4ede1?text=${encodeURIComponent(seed)}`;
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return h;
}

export function generateKeyFrame(runId: string, aspect: "9:16" | "16:9"): Frame {
  // The key frame is approved by a person, not auto-scored — only storyboard
  // frames get the automatic reviewer score (docs/AGENTS.md, Storyboard stage).
  return {
    id: randomId("frame"),
    beatIndex: 0,
    isKeyFrame: true,
    imageUrl: placeholderImageUrl(`${runId}-key`, aspect),
    scores: null,
    attempt: 1,
    status: "generated",
    source: "generated",
  };
}

export function generateStoryboardFrames(
  runId: string,
  beatCount: number,
  aspect: "9:16" | "16:9",
  threshold: number
): Frame[] {
  const frames: Frame[] = [];
  for (let i = 1; i < beatCount; i++) {
    const base = 72 + Math.random() * 20;
    let scores = frameScore(base);
    let attempt = 1;
    if (scores.overall < threshold) {
      // Simulate the automatic one-time regeneration for below-threshold frames.
      attempt = 2;
      scores = frameScore(base + 15);
    }
    frames.push({
      id: randomId("frame"),
      beatIndex: i,
      isKeyFrame: false,
      imageUrl: placeholderImageUrl(`${runId}-beat-${i}`, aspect),
      scores,
      attempt,
      status: "generated",
      source: "generated",
    });
  }
  return frames;
}

export function generatePack(topic: string, brandKit: BrandKit, videoPrompt: VideoPrompt): Pack {
  return {
    finalPrompt: videoPrompt.promptText,
    negativePrompt: videoPrompt.negativePrompt,
    title: `${topic} — The Real Story`,
    captions: [
      {
        platform: "instagram_reels",
        caption: `The truth about ${topic}, in under a minute ☕️\n\n${brandKit.brandName} does it differently. Watch till the end.`,
      },
      {
        platform: "youtube_shorts",
        caption: `${topic}: what nobody tells you. #shorts`,
      },
      {
        platform: "linkedin",
        caption: `We put ${topic} to the test — here's what we found, and why it changes how ${brandKit.brandName} approaches it.`,
      },
    ],
    hashtags: [`#${topic.replace(/\s+/g, "")}`, "#smallbusiness", "#behindthescenes", `#${brandKit.brandName.replace(/\s+/g, "")}`],
    thumbnailText: `THE REAL ${topic.toUpperCase()}`,
    postingNotes: "Best posted weekday mornings. Pin a comment with the full story within the first hour.",
    approved: false,
  };
}

export function generateAiCallLogEntry(
  stage: Run["currentStage"],
  callType: AiCallLogEntry["callType"],
  costUsd: number
): AiCallLogEntry {
  return {
    id: randomId("call"),
    stage,
    model:
      callType === "image"
        ? "gemini-3.1-flash-image"
        : callType === "grounding"
          ? "gemini-3.8-flash (grounded)"
          : "gemini-3.8-flash",
    callType,
    estimatedCostUsd: costUsd,
    outcome: "success",
    createdAt: new Date().toISOString(),
  };
}

export function blankRunFromInput(input: NewRunInput): Run {
  const now = new Date().toISOString();
  return {
    id: randomId("run"),
    userId: "sample-user",
    brief: {
      topic: input.topic,
      audience: input.audience,
      platform: input.platform,
      aspectRatio: input.aspectRatio,
      durationSeconds: input.durationSeconds,
      targetVideoModel: input.targetVideoModel,
      sourceLinks: input.sourceLinks,
      notes: input.notes,
      pastedScript: input.pastedScript,
    },
    currentStage: "brief",
    jobStatus: "idle",
    autopilot: false,
    runningCostUsd: 0,
    createdAt: now,
    updatedAt: now,
    sources: [],
    facts: [],
    script: null,
    directions: [],
    selectedDirectionId: null,
    directionNote: "",
    videoPrompt: null,
    frames: [],
    pack: null,
    aiCallLog: [],
  };
}

// A handful of pre-populated runs so the History page never looks empty on first load,
// and so every stage's UI can be exercised by opening an existing run.
export function seedSampleRuns(): Run[] {
  const runs: Run[] = [];

  // 1. A run sitting at the Story checkpoint, waiting for review.
  {
    const input: NewRunInput = {
      topic: "cold brew vs. iced coffee",
      audience: "coffee-curious millennials who default to iced lattes",
      platform: "instagram_reels",
      aspectRatio: "9:16",
      durationSeconds: 30,
      targetVideoModel: "Veo 3.1",
      sourceLinks: [],
      notes: "",
      pastedScript: null,
    };
    const run = blankRunFromInput(input);
    const sources = generateSources(3);
    const facts = generateFacts(input.topic, sources);
    run.sources = sources;
    run.facts = facts;
    run.script = generateScript(input.topic, input.durationSeconds, facts);
    run.currentStage = "story";
    run.jobStatus = "needs_review";
    run.runningCostUsd = 0.007;
    run.aiCallLog = [generateAiCallLogEntry("story", "grounding", 0.0), generateAiCallLogEntry("story", "text", 0.007)];
    runs.push(run);
  }

  // 2. A run mid-storyboard.
  {
    const input: NewRunInput = {
      topic: "our new oat milk latte",
      audience: "plant-based regulars deciding what to order next",
      platform: "youtube_shorts",
      aspectRatio: "9:16",
      durationSeconds: 30,
      targetVideoModel: "Veo 3.1",
      sourceLinks: [],
      notes: "Keep it upbeat, no sad-vegan jokes.",
      pastedScript: null,
    };
    const run = blankRunFromInput(input);
    const sources = generateSources(3);
    const facts = generateFacts(input.topic, sources);
    run.sources = sources;
    run.facts = facts;
    run.script = generateScript(input.topic, input.durationSeconds, facts);
    run.directions = generateDirections();
    run.selectedDirectionId = run.directions[0].id;
    run.videoPrompt = generateVideoPrompt(run.directions[0], input.topic, 1, 75, SAMPLE_BRAND_KIT);
    const keyFrame = generateKeyFrame(run.id, input.aspectRatio);
    const rest = generateStoryboardFrames(run.id, run.script.beats.length, input.aspectRatio, 70);
    run.frames = [keyFrame, ...rest];
    run.currentStage = "storyboard";
    run.jobStatus = "needs_review";
    run.runningCostUsd = 0.21;
    runs.push(run);
  }

  // 3. A fully approved, done run.
  {
    const input: NewRunInput = {
      topic: "why we roast in small batches",
      audience: "existing customers deciding whether to subscribe",
      platform: "linkedin",
      aspectRatio: "16:9",
      durationSeconds: 45,
      targetVideoModel: "Veo 3.1",
      sourceLinks: [],
      notes: "",
      pastedScript: null,
    };
    const run = blankRunFromInput(input);
    const sources = generateSources(3);
    const facts = generateFacts(input.topic, sources);
    run.sources = sources;
    run.facts = facts;
    run.script = generateScript(input.topic, input.durationSeconds, facts);
    run.directions = generateDirections();
    run.selectedDirectionId = run.directions[2].id;
    run.videoPrompt = generateVideoPrompt(run.directions[2], input.topic, 1, 75, SAMPLE_BRAND_KIT);
    const keyFrame = generateKeyFrame(run.id, input.aspectRatio);
    const rest = generateStoryboardFrames(run.id, run.script.beats.length, input.aspectRatio, 70);
    run.frames = [keyFrame, ...rest];
    run.pack = generatePack(input.topic, SAMPLE_BRAND_KIT, run.videoPrompt);
    run.pack.approved = true;
    run.currentStage = "done";
    run.jobStatus = "completed";
    run.runningCostUsd = 0.41;
    run.createdAt = new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString();
    run.updatedAt = new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString();
    runs.push(run);
  }

  // 4. A freshly created run that hasn't started research yet.
  {
    const input: NewRunInput = {
      topic: "what makes a great pour-over",
      audience: "home-brewing enthusiasts upgrading their setup",
      platform: "instagram_reels",
      aspectRatio: "9:16",
      durationSeconds: 20,
      targetVideoModel: "Veo 3.1",
      sourceLinks: [],
      notes: "",
      pastedScript: null,
    };
    const run = blankRunFromInput(input);
    run.currentStage = "brief";
    run.jobStatus = "idle";
    runs.push(run);
  }

  return runs;
}
