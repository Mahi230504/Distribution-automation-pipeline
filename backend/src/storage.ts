// Only this module accesses persistent files. The public storage interface is the step-5 replacement boundary.
import {
  mkdir,
  readFile,
  writeFile,
  rename,
  readdir,
  unlink,
} from "node:fs/promises";
import path from "node:path";
import type { Run, BrandKit } from "../../frontend/lib/types.js";
import { settings } from "./settings.js";
const root = path.resolve(settings.dataPath);
let writes: Promise<unknown> = Promise.resolve();
function serial<T>(work: () => Promise<T>): Promise<T> {
  const next = writes.then(work);
  writes = next.catch(() => {});
  return next;
}
async function read<T>(name: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path.join(root, name), "utf8"));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}
async function write(name: string, data: unknown) {
  const tmp = path.join(root, name + ".tmp");
  await writeFile(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
  await rename(tmp, path.join(root, name));
}
function runFile(id: string) {
  if (!/^[\w-]+$/.test(id)) throw new Error("Invalid run ID");
  return `run-${id}.json`;
}
export const storage = {
  async init() {
    await mkdir(root, { recursive: true });
    const lock = await read<{ pid: number }>("server.lock");
    if (lock) {
      try {
        process.kill(lock.pid, 0);
        throw new Error(
          "Local JSON storage already has a running backend. Use one process until step 5.",
        );
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "ESRCH") throw e;
      }
      await unlink(path.join(root, "server.lock"));
    }
    await writeFile(
      path.join(root, "server.lock"),
      JSON.stringify({ pid: process.pid }),
      { flag: "wx", mode: 0o600 },
    );
  },
  async close() {
    await writes;
    await unlink(path.join(root, "server.lock")).catch(() => {});
  },
  async listRuns(userId = "local-user") {
    await writes;
    const names = await readdir(root);
    const runs = await Promise.all(
      names.filter((n) => /^run-.*\.json$/.test(n)).map((n) => read<Run>(n)),
    );
    return runs
      .filter((r): r is Run => !!r && r.userId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  async getRun(id: string, userId = "local-user") {
    await writes;
    const r = await read<Run>(runFile(id));
    if (!r || r.userId !== userId) throw new Error(`Run ${id} was not found.`);
    return r;
  },
  createRun(run: Run) {
    return serial(async () => {
      if (await read(runFile(run.id))) throw new Error("Run already exists");
      await write(runFile(run.id), run);
      return run;
    });
  },
  updateRun(id: string, update: (run: Run) => void, userId = "local-user") {
    return serial(async () => {
      const r = await read<Run>(runFile(id));
      if (!r || r.userId !== userId)
        throw new Error(`Run ${id} was not found.`);
      update(r);
      r.updatedAt = new Date().toISOString();
      r.runningCostUsd = r.aiCallLog.reduce(
        (n, c) => n + c.estimatedCostUsd,
        0,
      );
      await write(runFile(id), r);
      return r;
    });
  },
  async getBrandKit(): Promise<BrandKit> {
    await writes;
    return (
      (await read<BrandKit>("brand.json")) ?? {
        brandName: "Northwind Coffee Co.",
        palette: ["#2E2A24", "#C48A3E"],
        characterDescription: "A friendly barista in a denim apron",
        tone: "Warm and clear",
        constraints: "No unsupported claims",
        preferredPlatforms: ["instagram_reels"],
      }
    );
  },
  saveBrandKit(kit: BrandKit) {
    return serial(async () => {
      await write("brand.json", kit);
      return kit;
    });
  },
  async findResearch(cacheKey: string) {
    return (await this.listRuns()).find(
      (r) =>
        r.research?.cacheKey === cacheKey &&
        r.research.status === "cited" &&
        r.facts.length &&
        Date.now() - Date.parse(r.research.createdAt) <
          settings.cacheHours * 3600000,
    );
  },
};
