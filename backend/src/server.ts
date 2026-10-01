import express from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Run } from "../../frontend/lib/types.js";
import { settings, safeError } from "./settings.js";
import { storage } from "./storage.js";
import { health } from "./gemini.js";
import { recover, startJob } from "./jobs.js";
import { parseScript } from "./script.js";
import { generationRouter } from "./generation-routes.js";
import { interpretationSchema, emptyBrand, mode } from "./brief.js";
import { repairRouter } from "./repair-routes.js";
import { authenticate, owner } from "./auth.js";
import { releaseRouter } from "./release-routes.js";
import { releaseReadView } from "./release.js";
const platform = z.enum(["instagram_reels", "youtube_shorts", "linkedin"]);
const brief = z.object({
  interpretation: interpretationSchema.optional(),
  brandSelection: z.enum(["none", "saved", "custom"]).default("none"),
  brandKit: z.any().optional(),
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
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-VPO-Filename, X-VPO-Release-Revision, X-VPO-Storyboard-Lineage, X-VPO-Active-Media-Version");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,OPTIONS");
  }
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});
app.use(express.json({ limit: Math.ceil(settings.uploadBytes * 1.4) + 1024 }));
app.get("/api/health", async (_req, res) => {
  const h = await health();
  res.status(h.healthy ? 200 : 503).json({
    ...h,
    authMode: settings.authMode,
    storageMode: settings.storageMode,
  });
});
app.use("/api", authenticate);
app.use(repairRouter);
app.use(generationRouter);
app.use(releaseRouter);
app.get("/api/brand-kit", async (req, res) =>
  res.json(await storage.getBrandKit(owner(req))),
);
app.put("/api/brand-kit", async (req, res) =>
  res.json(await storage.saveBrandKit(owner(req), brand.parse(req.body))),
);
app.get("/api/runs", async (req, res) => res.json(await storage.listRuns(owner(req))));
app.post("/api/runs", async (req, res) => {
  const input = brief.parse(req.body),
    now = new Date().toISOString();
  const r: Run = {
    mode: mode(),
    effective: {
      ...(input.interpretation ?? {
        subject: input.topic,
        objective: "promote" as const,
        productDetails: "",
        visualPreferences: "",
        factualConstraints: "",
        summary: `Create content about ${input.topic}. Please choose the objective and product details.`,
        confirmed: false,
      }),
      revision: 1,
      brandSelection: input.brandSelection,
    },
    id: randomUUID(),
    userId: owner(req),
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
    directions: [],
    selectedDirectionId: null,
    directionNote: "",
    videoPrompt: null,
    frames: [],
    pack: null,
    aiCallLog: [],
    brandKit:
      input.brandSelection === "saved"
        ? await storage.getBrandKit(owner(req))
        : input.brandSelection === "custom"
          ? brand.parse(input.brandKit)
          : structuredClone(emptyBrand),
    sampleStages: true,
  };
  res.status(201).json(await storage.createRun(owner(req), r));
});
app.get("/api/runs/:id", async (req, res) =>
  res.json(releaseReadView(await storage.getRun(owner(req), req.params.id))),
);
app.get("/api/runs/:id/jobs/:jobId", async (req, res) => {
  const r = await storage.getRun(owner(req), req.params.id);
  if (r.job?.id !== req.params.jobId) throw new Error("Job not found");
  res.json(r.job);
});
app.get("/api/runs/:id/ai-calls", async (req, res) =>
  res.json((await storage.getRun(owner(req), req.params.id)).aiCallLog),
);
app.post("/api/runs/:id/story", async (req, res) => {
  const body = z
    .object({ fresh: z.boolean().optional() })
    .parse(req.body ?? {});
  res.status(202).json(await startJob(owner(req), req.params.id, "story", body));
});
app.post("/api/runs/:id/resume", async (req, res) =>
  res.status(202).json(await startJob(owner(req), req.params.id, "story", {}, true)),
);
app.patch("/api/runs/:id/facts", async (req, res) => {
  const body = z
    .object({ factId: z.string(), removed: z.boolean() })
    .parse(req.body);
  const r = await storage.getRun(owner(req), req.params.id);
  if (!r.facts.some((f) => f.id === body.factId))
    throw new Error("Fact not found");
  res.status(202).json(await startJob(owner(req), r.id, "rewrite", body));
});
app.get("/api/runs/:id/cost-estimate", async (req, res) => {
  await storage.getRun(owner(req), req.params.id);
  res.json({
    label: "Sample rendering",
    amountUsd: 0,
    detail: "SAMPLE stage: no AI call or charge in step 3.",
  });
});
app.use((_req, res) => res.status(404).json({ error: "Route not available." }));
app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    const status = error instanceof z.ZodError ? 400 : typeof (error as { status?: unknown })?.status === "number" ? Number((error as { status: number }).status) : 409;
    res
      .status(status)
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
