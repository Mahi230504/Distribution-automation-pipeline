import { isDraining } from "./lifecycle.js";
import { settings } from "./settings.js";

export type ReadinessResult = { ready: boolean; category?: "draining" | "storage_unavailable" | "storage_timeout" };
type ProbeFetch = typeof fetch;

export function createReadinessProbe(
  probeFetch: ProbeFetch = fetch,
  now = Date.now,
  config = { storageMode: settings.storageMode, supabaseUrl: settings.supabaseUrl, supabaseSecretKey: settings.supabaseSecretKey },
  timeoutMs = 1500,
) {
  let cached: { expiresAt: number; result: ReadinessResult } | undefined;
  let pending: Promise<ReadinessResult> | undefined;
  const checkStorage = async (): Promise<ReadinessResult> => {
    if (config.storageMode !== "supabase") return { ready: true };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const base = config.supabaseUrl.replace(/\/$/, "");
      const resources = ["runs?select=id&limit=1", "publication_runs?select=run_id&limit=1"];
      const responses = await Promise.all(resources.map((resource) => probeFetch(`${base}/rest/v1/${resource}`, {
        method: "GET",
        headers: { apikey: config.supabaseSecretKey, Authorization: `Bearer ${config.supabaseSecretKey}` },
        signal: controller.signal,
      })));
      return responses.every((response) => response.ok) ? { ready: true } : { ready: false, category: "storage_unavailable" };
    } catch (error) {
      return { ready: false, category: error instanceof Error && error.name === "AbortError" ? "storage_timeout" : "storage_unavailable" };
    } finally { clearTimeout(timer); }
  };
  return async (): Promise<ReadinessResult> => {
    if (isDraining()) return { ready: false, category: "draining" };
    if (cached && cached.expiresAt > now()) return cached.result;
    if (!pending) pending = checkStorage().then((result) => {
      cached = { result, expiresAt: now() + (result.ready ? 10_000 : 2_000) };
      return result;
    }).finally(() => { pending = undefined; });
    return pending;
  };
}

export const readiness = createReadinessProbe();
