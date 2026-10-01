import { cachedHealth } from "./health-cache.js";
import {
  GoogleGenAI,
  type Part,
  type GenerateContentResponse,
} from "@google/genai";
import { createHash, randomUUID } from "node:crypto";
import { settings, safeError } from "./settings.js";
import { storage } from "./storage.js";
export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));
let active = 0;
const waiters: (() => void)[] = [];
async function acquire() {
  if (active >= settings.concurrency)
    await new Promise<void>((r) => waiters.push(r));
  else active++;
}
function release() {
  const next = waiters.shift();
  if (next) next();
  else active--;
}
export function client() {
  if (!settings.key)
    throw new Error(
      "GEMINI_API_KEY is empty. Add it to backend/.env before live use.",
    );
  return new GoogleGenAI({
    apiKey: settings.key,
    httpOptions: { timeout: 60000 },
  });
}
export interface CallOptions {
  responseJsonSchema?: Record<string, unknown>;
  stage?: "story" | "direction" | "look" | "storyboard";
  image?: boolean;
  parts?: Part[];
  aspectRatio?: "9:16" | "16:9";
  task?: string;
  origin?: import("../../frontend/lib/types.js").ChangeOrigin;
}
export async function callAI(
  ownerId: string,
  runId: string,
  purpose: string,
  prompt: string,
  fixture: () => GenerateContentResponse | Promise<GenerateContentResponse>,
  grounding = false,
  transport?: () => Promise<GenerateContentResponse>,
  options: CallOptions = {},
) {
  const model = options.image
    ? settings.image
    : purpose === "review"
      ? settings.scoring
      : settings.main;
  const stage = options.stage ?? "story";
  const parts = [{ text: prompt }, ...(options.parts ?? [])];
  const referenceHashes = (options.parts ?? [])
    .filter((p) => p.inlineData?.data)
    .map((p) =>
      createHash("sha256")
        .update(Buffer.from(p.inlineData!.data!, "base64"))
        .digest("hex"),
    );
  const jobId = (await storage.getRun(ownerId, runId)).job?.id;
  for (let attempt = 0; attempt <= settings.retries; attempt++) {
    await acquire();
    const start = Date.now();
    const callId = randomUUID();
    try {
      await storage.updateRun(ownerId, runId, (r) =>
        r.aiCallLog.push({
          id: callId,
          stage,
          task: options.task ?? purpose,
          jobId,
          origin: attempt ? "provider retry" : options.origin,
          referenceHashes,
          model,
          callType: options.image ? "image" : grounding ? "grounding" : "text",
          estimatedCostUsd: 0,
          outcome: "pending",
          createdAt: new Date().toISOString(),
          testMode: settings.test,
          usageKnown: false,
          attempt: attempt + 1,
        }),
      );
    } catch (e) {
      release();
      throw e;
    }
    let result: GenerateContentResponse | undefined;
    let failure: unknown;
    try {
      if (transport) result = await transport();
      else if (settings.test) {
        await sleep(settings.testDelay);
        result = await fixture();
      } else
        result = await client().models.generateContent({
          model,
          contents: [{ role: "user", parts }],
          config: {
            ...(options.responseJsonSchema
              ? {
                  responseMimeType: "application/json",
                  responseJsonSchema: options.responseJsonSchema,
                }
              : {}),
            tools: grounding ? [{ googleSearch: {} }] : undefined,
            maxOutputTokens: 6000,
            ...(options.image
              ? {
                  responseModalities: ["TEXT", "IMAGE"],
                  imageConfig: {
                    aspectRatio: options.aspectRatio,
                    imageSize: "1K",
                  },
                }
              : {}),
            httpOptions: { retryOptions: { attempts: 1 } },
          },
        });
    } catch (e) {
      failure = e;
    } finally {
      release();
    }
    const status =
      (failure as { status?: number; code?: number })?.status ??
      (failure as { code?: number })?.code;
    const retry = !!failure && status === 429 && attempt < settings.retries;
    const u = result?.usageMetadata;
    const input = u?.promptTokenCount ?? 0,
      output = (u?.candidatesTokenCount ?? 0) + (u?.thoughtsTokenCount ?? 0);
    const searches = grounding
      ? (result?.candidates?.[0]?.groundingMetadata?.webSearchQueries?.length ??
        0)
      : 0;
    const imageCount =
      result?.candidates?.[0]?.content?.parts?.filter(
        (p) => !p.thought && p.inlineData?.mimeType?.startsWith("image/"),
      ).length ?? 0;
    const imageTokens =
      u?.candidatesTokensDetails
        ?.filter((d) => d.modality === "IMAGE")
        .reduce((sum, d) => sum + (d.tokenCount ?? 0), 0) || imageCount * 1120;
    const billedTextOutput = options.image
      ? Math.max(0, output - imageTokens)
      : output;
    const cost = settings.test
      ? 0
      : (input *
          (options.image
            ? settings.imageInput
            : purpose === "review"
              ? settings.scoringInput
              : settings.mainInput) +
          billedTextOutput *
            (options.image
              ? settings.imageOutput
              : purpose === "review"
                ? settings.scoringOutput
                : settings.mainOutput)) /
          1e6 +
        searches * settings.searchPrice +
        imageCount * settings.imagePrice;
    await storage.updateRun(ownerId, runId, (r) => {
      const index = r.aiCallLog.findIndex((c) => c.id === callId);
      r.aiCallLog[index] = {
        id: callId,
        stage,
        task: options.task ?? purpose,
        jobId,
        origin: attempt ? "provider retry" : options.origin,
        referenceHashes,
        model,
        callType: options.image ? "image" : grounding ? "grounding" : "text",
        inputTokens: input,
        outputTokens: output,
        imageCount,
        searchRequests: searches,
        estimatedCostUsd: cost,
        durationMs: Date.now() - start,
        attempt: attempt + 1,
        outcome: retry ? "retried" : failure ? "failed" : "success",
        error: failure ? safeError(failure) : undefined,
        testMode: settings.test,
        usageKnown: !!u,
        createdAt: new Date(start).toISOString(),
      };
      if (retry && r.job) {
        r.job.message = `Rate limited. Waiting before retry ${attempt + 1} of ${settings.retries}.`;
        r.generation?.activities.push({
          id: randomUUID(),
          jobId: r.job.id,
          checkpoint: r.job.checkpoint,
          message: r.job.message,
          at: new Date().toISOString(),
          state: "retrying",
          origin: "provider retry",
        });
      }
    });
    if (retry) {
      await sleep(settings.retryDelay * 2 ** attempt);
      continue;
    }
    if (failure) throw new Error(safeError(failure));
    return result!;
  }
  throw new Error("Retry limit reached");
}
export function parseReply(response: GenerateContentResponse): unknown {
  const text =
    response.text ??
    response.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? "")
      .join("") ??
    "";
  try {
    const start = text.indexOf("{"),
      end = text.lastIndexOf("}");
    if (start < 0 || end < start) throw new Error("No JSON object");
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new Error(
      `Could not parse Gemini JSON. Reply starts: ${safeError(text.slice(0, 400))}`,
    );
  }
}
export const health = cachedHealth(async () => {
  const models: Record<string, { exists: boolean | null; error?: string }> = {};
  for (const model of [settings.main, settings.scoring, settings.image]) {
    if (settings.test) models[model] = { exists: null };
    else
      try {
        await client().models.get({ model });
        models[model] = { exists: true };
      } catch (e) {
        models[model] = { exists: false, error: safeError(e) };
      }
  }
  return {
    mode: settings.test ? "test" : "live",
    testMode: settings.test,
    keyPresent: !!settings.key,
    models,
    healthy: settings.test || Object.values(models).every((m) => m.exists),
    checkedAt: new Date().toISOString(),
  };
});
