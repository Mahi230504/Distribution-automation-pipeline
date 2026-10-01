import { constants, createReadStream } from "node:fs";
import { chmod, copyFile, mkdir, readFile, writeFile, rename, readdir, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Run, BrandKit } from "../../frontend/lib/types.js";
import { emptyBrand } from "./brief.js";
import { settings } from "./settings.js";
import type { AssetMetadata, StorageAdapter, SaveFileAssetInput, StoredAssetRecord } from "./storage-types.js";
import { StorageNotFoundError } from "./storage-types.js";

const root = path.resolve(settings.dataPath);
let writes: Promise<unknown> = Promise.resolve();
function serial<T>(work: () => Promise<T>): Promise<T> {
  const next = writes.then(work); writes = next.catch(() => {}); return next;
}
async function read<T>(name: string): Promise<T | null> {
  try { return JSON.parse(await readFile(path.join(root, name), "utf8")); }
  catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return null; throw e; }
}
async function write(name: string, data: unknown) {
  const tmp = path.join(root, name + ".tmp");
  await writeFile(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
  await rename(tmp, path.join(root, name));
}
function safeId(id: string) { if (!/^[\w-]+$/.test(id)) throw new Error("Invalid ID"); return id; }
const runFile = (id: string) => `run-${safeId(id)}.json`;
const brandFile = (ownerId: string) => ownerId === "local-user" ? "brand.json" : `brand-${safeId(ownerId)}.json`;
function provenance(r: Run) {
  const infer = (ids?: string[]) => {
    const logs = r.aiCallLog.filter((c) => !ids || ids.includes(c.id));
    return logs.length && logs.every((c) => c.testMode === true) ? ("test" as const)
      : logs.length && logs.every((c) => c.testMode === false) ? ("live" as const) : ("unknown" as const);
  };
  r.mode ??= infer();
  if (r.script) r.script.mode ??= infer(r.aiCallLog.filter((c) => c.stage === "story").map((c) => c.id));
  if (r.research) r.research.mode ??= infer(r.aiCallLog.filter((c) => c.callType === "grounding").map((c) => c.id));
  for (const p of r.generation?.prompts ?? []) p.mode ??= infer(p.callIds);
  for (const k of [...(r.generation?.keys ?? []), ...(r.generation?.board ?? []).flatMap((f) => f.attempts), ...(r.generation?.archivedBoards ?? []).flatMap((b) => b.flatMap((f) => f.attempts))]) {
    k.mode ??= infer(k.callIds); if (k.review) k.review.mode ??= infer(k.review.callIds);
  }
  return r;
}
function containsAsset(value: unknown, assetId: string): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((v) => containsAsset(v, assetId));
  const record = value as Record<string, unknown>;
  return record.assetId === assetId || Object.values(record).some((v) => containsAsset(v, assetId));
}

export class LocalStorageAdapter implements StorageAdapter {
  async init() {
    await mkdir(root, { recursive: true });
    const lock = await read<{ pid: number }>("server.lock");
    if (lock) {
      try { process.kill(lock.pid, 0); throw new Error("Local JSON storage already has a running backend. Use one process in local mode."); }
      catch (e) { if ((e as NodeJS.ErrnoException).code !== "ESRCH") throw e; }
      await unlink(path.join(root, "server.lock"));
    }
    await writeFile(path.join(root, "server.lock"), JSON.stringify({ pid: process.pid }), { flag: "wx", mode: 0o600 });
  }
  async close() { await writes; await unlink(path.join(root, "server.lock")).catch(() => {}); }
  async listRuns(ownerId: string) {
    await writes; const names = await readdir(root);
    const runs = await Promise.all(names.filter((n) => /^run-.*\.json$/.test(n)).map((n) => read<Run>(n)));
    return runs.filter((r): r is Run => !!r && r.userId === ownerId).map(provenance).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  async listRecoverableRuns() {
    await writes; const names = await readdir(root);
    const runs = await Promise.all(names.filter((n) => /^run-.*\.json$/.test(n)).map((n) => read<Run>(n)));
    return runs.filter((r): r is Run => !!r).map(provenance);
  }
  async getRun(ownerId: string, id: string) {
    await writes; const r = await read<Run>(runFile(id));
    if (!r || r.userId !== ownerId) throw new StorageNotFoundError(`Run ${id} was not found.`);
    return provenance(r);
  }
  createRun(ownerId: string, run: Run) { return serial(async () => {
    if (await read(runFile(run.id))) throw new Error("Run already exists");
    const saved = { ...run, userId: ownerId }; await write(runFile(saved.id), saved); return saved;
  }); }
  updateRun(ownerId: string, id: string, update: (run: Run) => void) { return serial(async () => {
    const r = await read<Run>(runFile(id));
    if (!r || r.userId !== ownerId) throw new StorageNotFoundError(`Run ${id} was not found.`);
    provenance(r); update(r); r.userId = ownerId; r.updatedAt = new Date().toISOString();
    r.runningCostUsd = r.aiCallLog.reduce((n, c) => n + c.estimatedCostUsd, 0);
    await write(runFile(id), r); return r;
  }); }
  async getBrandKit(ownerId: string): Promise<BrandKit> {
    await writes; const kit = await read<BrandKit>(brandFile(ownerId));
    return kit ? { ...kit, origin: kit.origin ?? "legacy" } : emptyBrand;
  }
  saveBrandKit(ownerId: string, kit: BrandKit) { return serial(async () => {
    const saved = { ...kit, origin: "saved" as const }; await write(brandFile(ownerId), saved); return saved;
  }); }
  async findResearch(ownerId: string, cacheKey: string) {
    return (await this.listRuns(ownerId)).find((r) => r.research?.cacheKey === cacheKey && r.research.status === "cited" && r.facts.length && Date.now() - Date.parse(r.research.createdAt) < settings.cacheHours * 3600000);
  }
  async saveImage(ownerId: string, runId: string, bytes: Buffer, metadata: AssetMetadata = {}) {
    await this.getRun(ownerId, runId);
    const id = randomUUID(); await mkdir(path.join(root, "images"), { recursive: true });
    const imagePath = path.join(root, "images", `${id}.png`);
    await writeFile(imagePath, bytes, { mode: 0o600, flag: "wx" });
    try { await write(`asset-${id}.json`, { id, ownerId, runId, purpose: metadata.purpose ?? "image", mediaType: metadata.mediaType ?? "image/png" }); }
    catch (error) { await unlink(imagePath).catch(() => {}); throw error; }
    return id;
  }
  async readImage(ownerId: string, id: string) {
    if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Invalid image ID");
    const asset = await read<{ ownerId: string }>(`asset-${id}.json`);
    let allowed = asset?.ownerId === ownerId;
    if (!asset && ownerId === "local-user") allowed = (await this.listRuns(ownerId)).some((r) => containsAsset(r, id));
    if (!allowed) throw new StorageNotFoundError("Image was not found.");
    return readFile(path.join(root, "images", `${id}.png`));
  }
  async saveAssetFromFile(ownerId: string, runId: string, input: SaveFileAssetInput) {
    await this.getRun(ownerId, runId); const id = randomUUID(); const dir = path.join(root, "media"); await mkdir(dir, { recursive: true });
    const target = path.join(dir, `${id}.${input.extension}`); await copyFile(input.filePath, target, constants.COPYFILE_EXCL);
    const record: StoredAssetRecord = { id, ownerId, runId, purpose: input.purpose ?? "final-video", mediaType: input.mediaType ?? "video/mp4", byteSize: input.byteSize, sha256: input.sha256, originalFilename: input.originalFilename, detectedMetadata: input.detectedMetadata, validation: input.validation, mediaVersion: input.mediaVersion };
    try { await chmod(target, 0o600); await write(`asset-${id}.json`, record); } catch (e) { await unlink(target).catch(() => {}); throw e; } return record;
  }
  async openAsset(ownerId: string, id: string) {
    if (!/^[a-f0-9-]{36}$/.test(id)) throw new StorageNotFoundError("Asset was not found.");
    const record = await read<StoredAssetRecord>(`asset-${id}.json`); if (!record || record.ownerId !== ownerId) throw new StorageNotFoundError("Asset was not found.");
    const ext = record.mediaType === "video/mp4" ? "mp4" : "png"; const folder = record.mediaType === "video/mp4" ? "media" : "images";
    return { record, stream: createReadStream(path.join(root, folder, `${id}.${ext}`)) };
  }
  async deleteAsset(ownerId: string, id: string) {
    const record = await read<StoredAssetRecord>(`asset-${id}.json`); if (!record || record.ownerId !== ownerId) throw new StorageNotFoundError("Asset was not found.");
    const ext = record.mediaType === "video/mp4" ? "mp4" : "png", folder = record.mediaType === "video/mp4" ? "media" : "images";
    await unlink(path.join(root, folder, `${id}.${ext}`)).catch(() => {}); await unlink(path.join(root, `asset-${id}.json`)).catch(() => {});
  }
}
