const activeExecutors = new Set<Promise<unknown>>();
let draining = false;

export class DrainingError extends Error {
  status = 503;
  constructor() { super("The service is restarting. No new work can begin; try again shortly."); }
}

export function isDraining() { return draining; }
export function beginDraining() {
  const changed = !draining;
  draining = true;
  return changed;
}
export function requireWorkIntake() {
  if (draining) throw new DrainingError();
}
export function requireProviderWrite() {
  if (draining) throw new DrainingError();
}
export function rejectsDuringDrain(method: string, path: string) {
  return draining && (!["GET", "HEAD", "OPTIONS"].includes(method) || path.startsWith("/oauth/"));
}
export function trackExecutor<T>(promise: Promise<T>): Promise<T> {
  activeExecutors.add(promise);
  void promise.finally(() => activeExecutors.delete(promise)).catch(() => {});
  return promise;
}
export function activeExecutorCount() { return activeExecutors.size; }
export async function waitForExecutors(timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (activeExecutors.size && Date.now() < deadline) {
    const remaining = Math.max(1, deadline - Date.now());
    await Promise.race([
      Promise.allSettled([...activeExecutors]),
      new Promise((resolve) => setTimeout(resolve, Math.min(remaining, 50))),
    ]);
  }
  return activeExecutors.size === 0;
}
export function resetLifecycleForTest() {
  draining = false;
  activeExecutors.clear();
}
