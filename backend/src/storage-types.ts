import type { BrandKit, Run } from "../../frontend/lib/types.js";

export interface AssetMetadata {
  purpose?: string;
  mediaType?: string;
}

export interface StorageAdapter {
  init(): Promise<void>;
  close(): Promise<void>;
  listRuns(ownerId: string): Promise<Run[]>;
  listRecoverableRuns(): Promise<Run[]>;
  getRun(ownerId: string, id: string): Promise<Run>;
  createRun(ownerId: string, run: Run): Promise<Run>;
  updateRun(ownerId: string, id: string, update: (run: Run) => void): Promise<Run>;
  getBrandKit(ownerId: string): Promise<BrandKit>;
  saveBrandKit(ownerId: string, kit: BrandKit): Promise<BrandKit>;
  findResearch(ownerId: string, cacheKey: string): Promise<Run | undefined>;
  saveImage(ownerId: string, runId: string, bytes: Buffer, metadata?: AssetMetadata): Promise<string>;
  readImage(ownerId: string, id: string): Promise<Buffer>;
}

export class StorageNotFoundError extends Error { status = 404; }
export class StorageConflictError extends Error { status = 409; }
