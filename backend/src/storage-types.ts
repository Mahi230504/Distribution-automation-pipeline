import type { BrandKit, Run } from "../../frontend/lib/types.js";
import type { Readable } from "node:stream";

export interface AssetMetadata {
  purpose?: string;
  mediaType?: string;
}
export interface StoredAssetRecord {
  id: string; ownerId: string; runId: string; purpose: string; mediaType: string;
  byteSize: number; sha256: string; originalFilename?: string; detectedMetadata?: unknown;
  validation?: unknown; mediaVersion?: number;
}
export interface SaveFileAssetInput extends AssetMetadata {
  filePath: string; extension: string; byteSize: number; sha256: string; originalFilename?: string;
  detectedMetadata?: unknown; validation?: unknown; mediaVersion?: number;
}
export interface OpenAssetResult { record: StoredAssetRecord; stream: Readable; }

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
  saveAssetFromFile(ownerId: string, runId: string, input: SaveFileAssetInput): Promise<StoredAssetRecord>;
  openAsset(ownerId: string, id: string): Promise<OpenAssetResult>;
  deleteAsset(ownerId: string, id: string): Promise<void>;
}

export class StorageNotFoundError extends Error { status = 404; }
export class StorageConflictError extends Error { status = 409; }
