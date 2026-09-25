import express from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Run } from "../../frontend/lib/types.js";
import { settings, safeError } from "./settings.js";
import { storage } from "./storage.js";
import { health } from "./gemini.js";
import { recover, startJob, isBusy } from "./jobs.js";
import { parseScript } from "./script.js";
import { directions, sampleAction } from "./samples.js";
const platform = z.enum(["instagram_reels", "youtube_shorts", "linkedin"]);
const brief = z.object({
  topic: z.string().trim().min(1).max(500),
  audience: z.string().max(1000).default(""),
  platform,
  aspectRatio: z.enum(["9:16", "16:9"]),
  durationSeconds: z.number().int().min(15).max(60),
  targetVideoModel: z.string().min(1).max(100),
  sourceLinks: z
    .array(z.url().refine((v) => /^https?:\/\//.test(v)))
    .max(10)
    .default([]),
  notes: z.string().max(10000).default(""),
  pastedScript: z.string().max(30000).nullable().default(null),
});
const brand = z.object({
  brandName: z.string().max(300),
  palette: z.array(z.string().max(30)).max(12),
  characterDescription: z.string().max(3000),
  tone: z.string().max(1000),
  constraints: z.string().max(3000),
  preferredPlatforms: z.array(platform),
});
await storage.init();
await recover();
const app = express();
app.disable("x-powered-by");
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && !settings.origins.includes(origin)) {
    res.status(403).json({ error: `Origin ${origin} is not allowed.` });
    return;
  }
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,OPTIONS");
  }
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});
app.use(express.json({ limit: "7mb" }));
app.get("/api/health", async (_req, res) => {
  const h = await health();
  res.status(h.healthy ? 200 : 503).json(h);
});
app.get("/api/brand-kit", async (_req, res) =>
  res.json(await storage.getBrandKit()),
);
app.put("/api/brand-kit", async (req, res) =>
  res.json(await storage.saveBrandKit(brand.parse(req.body))),
);
app.get("/api/runs", async (_req, res) => res.json(await storage.listRuns()));
app.post("/api/runs", async (req, res) => {
  const input = brief.parse(req.body),
    now = new Date().toISOString();
  const r: Run = {
    id: randomUUID(),
    userId: "local-user",
    brief: input,
    currentStage: input.pastedScript ? "direction" : "brief",
    jobStatus: input.pastedScript ? "needs_review" : "idle",
    autopilot: false,
    runningCostUsd: 0,
    createdAt: now,
    updatedAt: now,
    sources: [],
    facts: [],
    script: input.pastedScript
      ? parseScript(input.pastedScript, input.durationSeconds)
      : null,
    directions: input.pastedScript ? directions() : [],
    selectedDirectionId: null,
    directionNote: "",
    videoPrompt: null,
    frames: [],
    pack: null,
    aiCallLog: [],
    brandKit: await storage.getBrandKit(),
    sampleStages: true,
  };
  res.status(201).json(await storage.createRun(r));
});
app.get("/api/runs/:id", async (req, res) =>
  res.json(await storage.getRun(req.params.id)),
);
app.get("/api/runs/:id/jobs/:jobId", async (req, res) => {
  const r = await storage.getRun(req.params.id);
  if (r.job?.id !== req.params.jobId) throw new Error("Job not found");
  res.json(r.job);
});
app.get("/api/runs/:id/ai-calls", async (req, res) =>
  res.json((await storage.getRun(req.params.id)).aiCallLog),
);
app.post("/api/runs/:id/story", async (req, res) => {
  const body = z
    .object({ fresh: z.boolean().optional() })
    .parse(req.body ?? {});
  res.status(202).json(await startJob(req.params.id, "story", body));
});
app.post("/api/runs/:id/resume", async (req, res) =>
  res.status(202).json(await startJob(req.params.id, "story", {}, true)),
);
app.patch("/api/runs/:id/facts", async (req, res) => {
  const body = z
    .object({ factId: z.string(), removed: z.boolean() })
    .parse(req.body);
  const r = await storage.getRun(req.params.id);
  if (!r.facts.some((f) => f.id === body.factId))
    throw new Error("Fact not found");
  res.status(202).json(await startJob(r.id, "rewrite", body));
});
app.patch("/api/runs/:id/script", async (req, res) => {
  const { fullText } = z
    .object({ fullText: z.string().min(1).max(30000) })
    .parse(req.body);
  res.json(
    await storage.updateRun(req.params.id, (r) => {
      if (isBusy(r) || r.currentStage !== "story")
        throw new Error("Wait for Story to finish before editing.");
      const script = parseScript(fullText, r.brief.durationSeconds, r.script);
      if (r.script) (r.scriptVersions ??= []).push(r.script);
      r.script = script;
    }),
  );
});
app.get("/api/runs/:id/cost-estimate", async (req, res) => {
  await storage.getRun(req.params.id);
  res.json({
    label: "Sample rendering",
    amountUsd: 0,
    detail: "SAMPLE stage: no AI call or charge in step 3.",
  });
});
function sample(route: string, action: string) {
  app.post(route, async (req, res) =>
    res.json(
      await storage.updateRun(String(req.params.id), (r) => {
        if (isBusy(r)) throw new Error("Wait for the running job.");
        if (
          action === "directions" &&
          (r.jobStatus !== "needs_review" ||
            !r.script ||
            (!r.facts.length && !r.brief.pastedScript))
        )
          throw new Error("Complete Story first");
        sampleAction(
          r,
          action,
          req.body ?? {},
          String(req.params.directionId ?? req.params.frameId ?? ""),
        );
      }),
    ),
  );
}
sample("/api/runs/:id/directions", "directions");
sample("/api/runs/:id/directions/:directionId/select", "select");
sample("/api/runs/:id/key-frame", "key-frame");
sample("/api/runs/:id/key-frame/upload", "upload");
sample("/api/runs/:id/key-frame/regenerate", "regenerate");
sample("/api/runs/:id/storyboard", "storyboard");
sample("/api/runs/:id/frames/:frameId/regenerate", "frame");
sample("/api/runs/:id/pack", "pack");
sample("/api/runs/:id/approve", "approve");
app.patch("/api/runs/:id/pack", async (req, res) => {
  const patch = z
    .object({
      finalPrompt: z.string(),
      negativePrompt: z.string(),
      title: z.string(),
      captions: z.array(z.object({ platform, caption: z.string() })),
      hashtags: z.array(z.string()),
      thumbnailText: z.string(),
      postingNotes: z.string(),
    })
    .partial()
    .parse(req.body);
  res.json(
    await storage.updateRun(req.params.id, (r) => {
      if (!r.pack) throw new Error("No pack available");
      r.pack = { ...r.pack, ...patch, approved: false };
    }),
  );
});
app.use((_req, res) =>
  res.status(404).json({ error: "Route not available in step 3." }),
);
app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    res
      .status(error instanceof z.ZodError ? 400 : 409)
      .json({ error: safeError(error) });
  },
);
const server = app.listen(settings.port, "127.0.0.1", () =>
  console.log(
    `VPO backend http://localhost:${settings.port} (${settings.test ? "TEST MODE" : "LIVE"})`,
  ),
);
for (const signal of ["SIGTERM", "SIGINT"] as const)
  process.on(signal, () => {
    server.close();
    process.exit(0);
  });
