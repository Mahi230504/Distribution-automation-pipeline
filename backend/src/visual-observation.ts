import { settings } from "./settings.js";
import { z } from "zod";
import { callAI, parseReply } from "./gemini.js";
import { imagePart } from "./images.js";
import { response } from "./fixtures.js";
import { storage } from "./storage.js";
import { mode, semanticBrief } from "./brief.js";
import type { ImageAttempt } from "../../frontend/lib/types.js";
export const observationSchema = z.object({
  description: z.string().trim().min(30).max(5000),
  uncertainties: z.array(z.string().trim().min(8).max(600)).max(8),
});
// Deliberately no brief, target prompt, reference or desired score: describe pixels first.
export async function observeImage(
  ownerId: string,
  id: string,
  attempt: ImageAttempt,
  stage: "look" | "storyboard",
) {
  if (attempt.observation) return attempt.observation;
  const before = (await storage.getRun(ownerId, id)).aiCallLog.map((c) => c.id);
  const raw = await callAI(
    ownerId,
    id,
    "review",
    `Describe only the supplied image's visible content, independent of any desired outcome. Return description and uncertainties. Identify the actual objects, their material/shape, contents or obstruction of openings where visible, human actions and object relationships. Distinguish what is visible from inference. Inspect small functional details, not just visual polish. Explicitly describe spillage, occlusion, ambiguous contact, impossible geometry or apparent contradictions. Do not assume a container is empty, a tool is functioning or an action is completed when pixels do not establish it. No praise, scores, instructions or imagined narrative.`,
    () =>
      response({
        description:
          "Controlled TEST MODE image contains the subject and a distinct visible moment with the recorded composition. This is simulated observation, not live visual evidence.",
        uncertainties: [],
      }),
    false,
    undefined,
    {
      stage,
      task: stage === "look" ? "key-observation" : "frame-observation",
      parts: [await imagePart(ownerId, attempt.assetId)],
      responseJsonSchema: z.toJSONSchema(observationSchema),
    },
  );
  const value = { ...observationSchema.parse(parseReply(raw)), mode: mode() };
  await storage.updateRun(ownerId, id, (r) => {
    const image =
      stage === "look"
        ? r.generation!.keys.find((a) => a.id === attempt.id)
        : r
            .generation!.board.flatMap((f) => f.attempts)
            .find((a) => a.id === attempt.id);
    if (!image)
      throw new Error(
        "Image changed during observation. Refresh before continuing.",
      );
    image.observation = value;
    image.callIds.push(
      ...r.aiCallLog.filter((c) => !before.includes(c.id)).map((c) => c.id),
    );
  });
  return value;
}

export async function auditVisualIntent(
  ownerId: string,
  id: string,
  attempt: ImageAttempt,
  observation: NonNullable<ImageAttempt["observation"]>,
  stage: "look" | "storyboard",
) {
  if (attempt.intentAudit) return attempt.intentAudit;
  const run = await storage.getRun(ownerId, id),
    before = run.aiCallLog.map((c) => c.id);
  const schema = z.object({
    passed: z.boolean(),
    reason: z.string().trim().min(12).max(2000),
  });
  const raw = await callAI(
    ownerId,
    id,
    "visual-intent",
    `Act as a strict logical consistency checker, not an art critic. Compare the independent description of actual pixels against the requested still moment and original intent. No numerical scores are provided. Return passed=false when an essential requested state, functional detail, object relationship or action is contradicted or not established by the description. A correct-looking object does not compensate for the wrong state. An observation can be uncertain about an irrelevant detail without failing; judge only requirements of this specific still, not all successive video actions. Never assume the target instruction has been fulfilled merely because it appears in the prompt. Explain the concrete mismatch, or what establishes compliance. Explicit latest feedback controls staging; it cannot change the subject or fabricate claims. Brief:${JSON.stringify(semanticBrief(run))}. Requested still:${attempt.stillPrompt}. Independent observation:${JSON.stringify(observation)}.`,
    () =>
      response({
        passed:
          settings.fixtureScenario !== "intent-mismatch" &&
          !(
            settings.fixtureScenario === "frame-intent-mismatch" &&
            stage === "storyboard"
          ),
        reason:
          settings.fixtureScenario === "intent-mismatch"
            ? "The required functional state is contradicted by the independently described pixels."
            : "Controlled TEST MODE observation satisfies the requested moment; simulated evidence only.",
      }),
    false,
    undefined,
    {
      stage,
      task: stage === "look" ? "key-intent-audit" : "frame-intent-audit",
      responseJsonSchema: z.toJSONSchema(schema),
    },
  );
  const value = { ...schema.parse(parseReply(raw)), mode: mode() };
  await storage.updateRun(ownerId, id, (r) => {
    const image =
      stage === "look"
        ? r.generation!.keys.find((a) => a.id === attempt.id)
        : r
            .generation!.board.flatMap((f) => f.attempts)
            .find((a) => a.id === attempt.id);
    if (!image)
      throw new Error(
        "Image changed during intent check. Refresh before continuing.",
      );
    image.intentAudit = value;
    image.callIds.push(
      ...r.aiCallLog.filter((c) => !before.includes(c.id)).map((c) => c.id),
    );
  });
  return value;
}
