import type { Run } from "../../frontend/lib/types.js";
export function directions() {
  return ["The daily ritual", "One small experiment", "Meet your guide"].map(
    (name, i) => ({
      id: `direction-${i + 1}`,
      name,
      hook: "Make your next brew more intentional",
      angle: "A simple learning moment",
      look: "Warm natural light",
      mood: "Calm and curious",
      summary: "A short, character-led explanation.",
    }),
  );
}
const picture =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="854"><rect width="480" height="854" fill="#36584d"/><circle cx="240" cy="360" r="110" fill="#c48a3e"/><text x="240" y="530" text-anchor="middle" fill="white" font-size="26">Sample storyboard</text></svg>',
  );
export function sampleAction(
  r: Run,
  action: string,
  body: Record<string, unknown>,
  item?: string,
) {
  r.sampleStages = true;
  r.jobStatus = "needs_review";
  if (action === "directions") {
    r.directions = directions();
    r.currentStage = "direction";
  } else if (action === "select") {
    if (!r.directions.some((d) => d.id === item))
      throw new Error("Direction not found");
    r.selectedDirectionId = item!;
    r.directionNote = String(body.note ?? "");
    r.videoPrompt = {
      directionId: item!,
      promptText: `Sample ${r.brief.targetVideoModel} prompt: ${r.brief.topic}. ${r.brandKit?.tone}. Follow the script beats. ${r.directionNote}`,
      negativePrompt:
        "No distorted hands, illegible text or unsupported claims.",
      scores: {
        clarity: 85,
        visualDetail: 82,
        brandFit: 88,
        feasibility: 80,
        engagement: 86,
        overall: 80,
      },
      attempt: 1,
      passed: true,
      threshold: 75,
    };
    r.currentStage = "look";
    r.jobStatus = "waiting_confirmation";
  } else if (["key-frame", "upload", "regenerate"].includes(action)) {
    const prior = r.frames.find((f) => f.isKeyFrame);
    const imageUrl = action === "upload" ? String(body.dataUrl) : picture;
    if (!imageUrl.startsWith("data:image/"))
      throw new Error("Invalid image upload");
    r.frames = [
      {
        id: "frame-0",
        beatIndex: 0,
        isKeyFrame: true,
        imageUrl,
        scores: null,
        attempt: (prior?.attempt ?? 0) + 1,
        status: "generated",
        source: action === "upload" ? "uploaded" : "generated",
      },
    ];
    r.currentStage = "look";
  } else if (action === "storyboard") {
    if (!r.frames.length) throw new Error("Approve a key frame first");
    r.frames = [
      r.frames[0],
      ...(r.script?.beats.slice(1, 6) ?? []).map((_, i) => ({
        id: `frame-${i + 1}`,
        beatIndex: i + 1,
        isKeyFrame: false,
        imageUrl: picture,
        scores: {
          characterConsistency: 85,
          styleConsistency: 85,
          composition: 85,
          brandFit: 85,
          technicalQuality: 85,
          promptAdherence: 85,
          overall: 85,
        },
        attempt: 1,
        status: "generated" as const,
        source: "generated" as const,
      })),
    ];
    r.currentStage = "storyboard";
  } else if (action === "frame") {
    const f = r.frames.find((f) => f.id === item);
    if (!f) throw new Error("Frame not found");
    f.attempt++;
  } else if (action === "pack") {
    if (!r.videoPrompt) throw new Error("No prompt available");
    r.pack = {
      finalPrompt: r.videoPrompt.promptText,
      negativePrompt: r.videoPrompt.negativePrompt,
      title: r.brief.topic,
      captions: ["instagram_reels", "youtube_shorts", "linkedin"].map(
        (platform) => ({
          platform: platform as "linkedin",
          caption: `${r.brief.topic}: one small change to try today.`,
        }),
      ),
      hashtags: ["#Coffee", "#DailyRitual"],
      thumbnailText: "One small change",
      postingNotes: "Sample publishing notes. Review before use.",
      approved: false,
    };
    r.currentStage = "pack";
  } else if (action === "approve") {
    if (!r.pack) throw new Error("No pack available");
    r.pack.approved = true;
    r.currentStage = "done";
    r.jobStatus = "completed";
  }
}
