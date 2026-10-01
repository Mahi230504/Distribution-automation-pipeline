import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash, randomUUID } from "node:crypto";
import type { BrandKit, Run } from "../../frontend/lib/types.js";
import { emptyBrand } from "./brief.js";
import { settings } from "./settings.js";
import type { AssetMetadata, StorageAdapter } from "./storage-types.js";
import { StorageConflictError, StorageNotFoundError } from "./storage-types.js";

const BUCKET = "vpo-private";
function failure(message: string, error: { message: string } | null) {
  if (error) throw new Error(`${message}: ${error.message}`);
}

type VersionedRun = { run: Run; revision: number };
export async function optimisticRunUpdate(
  load: () => Promise<VersionedRun>,
  commit: (run: Run, revision: number) => Promise<boolean>,
  update: (run: Run) => void,
  attempts = 4,
) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const current = await load();
    const run = structuredClone(current.run);
    update(run);
    if (await commit(run, current.revision)) return run;
  }
  throw new StorageConflictError("The run changed while it was being saved. Refresh and try again.");
}

export class SupabaseStorageAdapter implements StorageAdapter {
  private client: SupabaseClient;
  constructor(client?: SupabaseClient) {
    this.client = client ?? createClient(settings.supabaseUrl, settings.supabaseSecretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  async init() {
    const { error } = await this.client.from("runs").select("id").limit(1);
    failure("Supabase storage is unavailable", error);
  }
  async close() {}
  async listRuns(ownerId: string) {
    const { data, error } = await this.client.from("runs").select("snapshot").eq("user_id", ownerId).order("updated_at", { ascending: false });
    failure("Could not list runs", error); return (data ?? []).map((r) => r.snapshot as Run);
  }
  async listRecoverableRuns() {
    const { data, error } = await this.client.from("runs").select("snapshot").in("job_status", ["queued", "running"]);
    failure("Could not list recoverable jobs", error); return (data ?? []).map((r) => r.snapshot as Run);
  }
  async getRun(ownerId: string, id: string) {
    const { data, error } = await this.client.from("runs").select("snapshot").eq("id", id).eq("user_id", ownerId).maybeSingle();
    failure("Could not read run", error);
    if (!data) throw new StorageNotFoundError(`Run ${id} was not found.`);
    return data.snapshot as Run;
  }
  async createRun(ownerId: string, run: Run) {
    const saved = { ...run, userId: ownerId };
    const { error } = await this.client.from("runs").insert({ id: saved.id, user_id: ownerId, current_stage: saved.currentStage, job_status: saved.jobStatus, snapshot: saved, created_at: saved.createdAt, updated_at: saved.updatedAt });
    failure("Could not create run", error); return saved;
  }
  async updateRun(ownerId: string, id: string, update: (run: Run) => void) {
    return optimisticRunUpdate(
      async () => {
        const read = await this.client.from("runs").select("snapshot,revision").eq("id", id).eq("user_id", ownerId).maybeSingle();
        failure("Could not read run", read.error);
        if (!read.data) throw new StorageNotFoundError(`Run ${id} was not found.`);
        return { run: read.data.snapshot as Run, revision: Number(read.data.revision) };
      },
      async (run, revision) => {
        run.userId = ownerId;
        run.updatedAt = new Date().toISOString();
        run.runningCostUsd = run.aiCallLog.reduce((total, call) => total + call.estimatedCostUsd, 0);
        const result = await this.client.from("runs").update({ snapshot: run, current_stage: run.currentStage, job_status: run.jobStatus, updated_at: run.updatedAt, revision: revision + 1 }).eq("id", id).eq("user_id", ownerId).eq("revision", revision).select("id");
        failure("Could not update run", result.error);
        return result.data?.length === 1;
      },
      update,
    );
  }
  async getBrandKit(ownerId: string): Promise<BrandKit> {
    const { data, error } = await this.client.from("brand_kits").select("snapshot").eq("user_id", ownerId).maybeSingle();
    failure("Could not read Brand kit", error); return data ? (data.snapshot as BrandKit) : emptyBrand;
  }
  async saveBrandKit(ownerId: string, kit: BrandKit) {
    const saved = { ...kit, origin: "saved" as const };
    const { error } = await this.client.from("brand_kits").upsert({ user_id: ownerId, snapshot: saved, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    failure("Could not save Brand kit", error); return saved;
  }
  async findResearch(ownerId: string, cacheKey: string) {
    return (await this.listRuns(ownerId)).find((r) => r.research?.cacheKey === cacheKey && r.research.status === "cited" && r.facts.length && Date.now() - Date.parse(r.research.createdAt) < settings.cacheHours * 3600000);
  }
  async saveImage(ownerId: string, runId: string, bytes: Buffer, metadata: AssetMetadata = {}) {
    await this.getRun(ownerId, runId);
    const id = randomUUID(), objectPath = `${ownerId}/${runId}/${id}.png`;
    const upload = await this.client.storage.from(BUCKET).upload(objectPath, bytes, { contentType: "image/png", upsert: false });
    failure("Could not store image", upload.error);
    const { error } = await this.client.from("assets").insert({ id, user_id: ownerId, run_id: runId, bucket_id: BUCKET, object_path: objectPath, purpose: metadata.purpose ?? "image", media_type: metadata.mediaType ?? "image/png", byte_size: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
    if (error) {
      await this.client.storage.from(BUCKET).remove([objectPath]);
      throw new Error(`Could not register image: ${error.message}`);
    }
    return id;
  }
  async readImage(ownerId: string, id: string) {
    const { data: asset, error } = await this.client.from("assets").select("bucket_id,object_path").eq("id", id).eq("user_id", ownerId).maybeSingle();
    failure("Could not read image record", error);
    if (!asset) throw new StorageNotFoundError("Image was not found.");
    const result = await this.client.storage.from(asset.bucket_id).download(asset.object_path);
    failure("Could not download image", result.error);
    return Buffer.from(await result.data!.arrayBuffer());
  }
}
