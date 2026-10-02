import "dotenv/config";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { SupabasePublicationStorage } from "../src/publication-storage.js";
import { claimPublicationJob } from "../src/publication-runner.js";
import type { PublicationAggregate } from "../src/publication-types.js";

if (process.env.TEST_MODE !== "true" || process.env.PUBLISH_MODE !== "test") {
  throw new Error("This smoke test requires TEST_MODE=true and PUBLISH_MODE=test.");
}
const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY are required.");

const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const runId = randomUUID(), batchId = randomUUID(), intentId = randomUUID(), jobId = randomUUID();
const fingerprint = createHash("sha256").update(`build6a:${runId}:${intentId}`).digest("hex");
let userId: string | undefined;

function fail(message: string, error: { message: string } | null) {
  if (error) throw new Error(`${message}: ${error.message}`);
}

try {
  const auth = await client.auth.admin.createUser({
    email: `vpo-build6a-${runId}@example.invalid`,
    password: randomBytes(24).toString("base64url"),
    email_confirm: true,
  });
  fail("Could not create the disposable smoke-test user", auth.error);
  userId = auth.data.user?.id;
  if (!userId) throw new Error("The disposable smoke-test user has no identifier.");

  // Every application record identifier is known before application data is created.
  const now = new Date().toISOString();
  const runSnapshot = { id: runId, userId, currentStage: "pack", jobStatus: "completed", createdAt: now, updatedAt: now };
  const runInsert = await client.from("runs").insert({ id: runId, user_id: userId, current_stage: "pack", job_status: "completed", snapshot: runSnapshot, created_at: now, updated_at: now });
  fail("Could not create the disposable run", runInsert.error);

  const aggregate: PublicationAggregate = {
    schemaVersion: 1, ownerId: userId, runId, revision: 0, bindings: [],
    batches: [{ id: batchId, ownerId: userId, runId, approvalId: randomUUID(), approvalFingerprint: fingerprint, confirmationFingerprint: fingerprint, provenance: "test", createdAt: now, intentIds: [intentId], jobIds: [jobId] }],
    intents: [{ id: intentId, ownerId: userId, runId, batchId, approvalId: randomUUID(), approvalEpoch: 1, approvalFingerprint: fingerprint, platform: "youtube_shorts", connectionId: randomUUID(), target: { platform: "youtube_shorts", connectionId: randomUUID(), targetId: "synthetic", targetType: "channel", targetLabel: "Synthetic TEST target", capabilityRevision: 1, revision: 1, updatedAt: now }, payload: {}, payloadHash: fingerprint, idempotencyFingerprint: fingerprint, provenance: "test", createdAt: now, status: "started" }],
    jobs: [{ id: jobId, ownerId: userId, runId, intentId, platform: "youtube_shorts", state: "provider_processing", checkpoint: "synthetic_interrupted_claim", revision: 1, activeClaim: { id: randomUUID(), fence: 1, expiresAt: new Date(Date.now() - 1_000).toISOString() }, attemptCount: 1, retrySafety: "reconcile_only", allowedAction: "reconcile", backoffAttempt: 0, evidence: { videoId: "synthetic-test-video" }, attempts: [], createdAt: now, updatedAt: now }],
  };
  const firstStore = new SupabasePublicationStorage(client);
  await firstStore.init();
  await firstStore.putAggregate(aggregate, 0);
  await firstStore.close();

  // Reconstructing adapters simulates a restarted instance. Two recovery contenders
  // race for the same expired durable claim; the database revision permits one owner.
  const restartedA = new SupabasePublicationStorage(client), restartedB = new SupabasePublicationStorage(client);
  await Promise.all([restartedA.init(), restartedB.init()]);
  const contenders = await Promise.allSettled([
    claimPublicationJob(userId, runId, jobId, true, restartedA),
    claimPublicationJob(userId, runId, jobId, true, restartedB),
  ]);
  const claimed = contenders.filter((value) => value.status === "fulfilled");
  if (claimed.length !== 1) throw new Error(`Expected one durable recovery claim, received ${claimed.length}.`);
  const recovered = await restartedA.getAggregate(userId, runId), job = recovered.jobs.find((value) => value.id === jobId);
  if (!job?.activeClaim || job.activeClaim.fence !== 2 || job.attemptCount !== 2) {
    throw new Error("The recovered job did not retain one fenced restart claim.");
  }
  await Promise.all([restartedA.close(), restartedB.close()]);
  console.log("PASS: durable Supabase restart recovery admitted exactly one TEST publication claimant.");
} finally {
  if (userId) {
    try {
      const removedRun = await client.from("runs").delete().eq("id", runId).eq("user_id", userId);
      fail("Could not remove the disposable run", removedRun.error);
      const removedUser = await client.auth.admin.deleteUser(userId);
      fail("Could not remove the disposable smoke-test user", removedUser.error);
      const tables = ["runs", "publication_runs", "publication_idempotency", "publication_job_registry", "publication_job_secrets"];
      for (const table of tables) {
        const check = await client.from(table).select("*", { count: "exact", head: true }).eq("user_id", userId);
        fail(`Could not verify cleanup for ${table}`, check.error);
        if (check.count !== 0) throw new Error(`Cleanup incomplete: ${table} retains ${check.count} row(s) for ${userId}.`);
      }
      const authCheck = await client.auth.admin.getUserById(userId);
      if (authCheck.data.user) throw new Error(`Cleanup incomplete: auth user ${userId} remains.`);
      console.log("PASS: disposable database and Auth records were removed and cleanup was verified.");
    } catch (error) {
      console.error(`CLEANUP NOT VERIFIED: user=${userId} run=${runId} batch=${batchId} intent=${intentId} job=${jobId}`);
      throw error;
    }
  }
}
