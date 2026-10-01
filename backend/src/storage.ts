import { LocalStorageAdapter } from "./local-storage.js";
import { settings } from "./settings.js";
import type { StorageAdapter } from "./storage-types.js";
import { SupabaseStorageAdapter } from "./supabase-storage.js";

export const storage: StorageAdapter = settings.storageMode === "supabase"
  ? new SupabaseStorageAdapter()
  : new LocalStorageAdapter();

export type { StorageAdapter } from "./storage-types.js";
