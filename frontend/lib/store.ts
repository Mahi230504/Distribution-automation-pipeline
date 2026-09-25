// A tiny localStorage-backed "database" that stands in for the real backend
// in sample-data mode (see lib/api.ts). This is what lets a full click-through
// (create a run, approve stages, edit the pack) persist across page navigation
// and refreshes, the way a real backend + database would.

import { BrandKit, Run } from "./types";
import { SAMPLE_BRAND_KIT, seedSampleRuns } from "./sample-data";

const STORE_KEY = "vpo_studio_sample_store_v1";

interface StoreShape {
  runs: Run[];
  brandKit: BrandKit;
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function seedStore(): StoreShape {
  return {
    runs: seedSampleRuns(),
    brandKit: SAMPLE_BRAND_KIT,
  };
}

function loadStore(): StoreShape {
  if (!isBrowser()) return seedStore();
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) {
      const fresh = seedStore();
      saveStore(fresh);
      return fresh;
    }
    return JSON.parse(raw) as StoreShape;
  } catch {
    return seedStore();
  }
}

function saveStore(store: StoreShape): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(STORE_KEY, JSON.stringify(store));
}

export function resetSampleStore(): void {
  saveStore(seedStore());
}

export function listRunsFromStore(): Run[] {
  return [...loadStore().runs].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export function getRunFromStore(id: string): Run | null {
  return loadStore().runs.find((r) => r.id === id) ?? null;
}

export function saveRunToStore(run: Run): Run {
  const store = loadStore();
  const idx = store.runs.findIndex((r) => r.id === run.id);
  const updated: Run = { ...run, updatedAt: new Date().toISOString() };
  if (idx === -1) {
    store.runs.push(updated);
  } else {
    store.runs[idx] = updated;
  }
  saveStore(store);
  return updated;
}

export function getBrandKitFromStore(): BrandKit {
  return loadStore().brandKit;
}

export function saveBrandKitToStore(brandKit: BrandKit): BrandKit {
  const store = loadStore();
  store.brandKit = { ...brandKit, origin: "saved" };
  saveStore(store);
  return store.brandKit;
}
