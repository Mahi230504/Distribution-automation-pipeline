import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import type { NextFunction, Request, Response } from "express";
import type { Run } from "../../frontend/lib/types.js";
import { createAuthenticate } from "../src/auth.js";
import { safeError, settings } from "../src/settings.js";
import { optimisticRunUpdate } from "../src/supabase-storage.js";

function request(authorization?: string) {
  return {
    header: (name: string) => name.toLowerCase() === "authorization" ? authorization : undefined,
  } as Request;
}

async function invoke(authorization: string | undefined, verify: Parameters<typeof createAuthenticate>[0]) {
  const previous = settings.authMode;
  (settings as { authMode: "local" | "supabase" }).authMode = "supabase";
  try {
    const req = request(authorization);
    const error = await new Promise<unknown>((resolve) => {
      void createAuthenticate(verify)(req, {} as Response, ((value?: unknown) => resolve(value)) as NextFunction);
    });
    return { req, error };
  } finally {
    (settings as { authMode: "local" | "supabase" }).authMode = previous;
  }
}

test("Supabase authentication rejects missing, invalid and expired bearer tokens", async () => {
  const verify = async (token: string) => {
    if (token !== "valid") throw Object.assign(new Error("Your session is no longer valid. Sign in again."), { status: 401 });
    return { userId: "verified-user", email: "verified@example.test" };
  };
  for (const authorization of [undefined, "Bearer invalid", "Bearer expired"]) {
    const result = await invoke(authorization, verify);
    assert.equal((result.error as { status: number }).status, 401);
    assert.equal(result.req.principal, undefined);
  }
  const valid = await invoke("Bearer valid", verify);
  assert.equal(valid.error, undefined);
  assert.equal(valid.req.principal?.userId, "verified-user");
});

test("normal runtime rejects mismatched modes and incomplete Supabase configuration", () => {
  const run = (extra: Record<string, string>) => spawnSync(
    process.execPath,
    ["--input-type=module", "-e", "import('./dist/backend/src/settings.js')"],
    { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, ...extra } },
  );
  const mismatch = run({ AUTH_MODE: "local", STORAGE_MODE: "supabase" });
  assert.notEqual(mismatch.status, 0);
  assert.match(mismatch.stderr, /local\/local_json or supabase\/supabase/);
  const incomplete = run({ AUTH_MODE: "supabase", STORAGE_MODE: "supabase", SUPABASE_URL: "", SUPABASE_PUBLISHABLE_KEY: "", SUPABASE_SECRET_KEY: "" });
  assert.notEqual(incomplete.status, 0);
  assert.match(incomplete.stderr, /requires SUPABASE_URL/);
});

test("Supabase secrets and bearer-shaped JWTs are redacted from errors", () => {
  const previous = settings.supabaseSecretKey;
  const secret = "sb_secret_do-not-expose";
  (settings as { supabaseSecretKey: string }).supabaseSecretKey = secret;
  try {
    const message = safeError(new Error(`failed ${secret} eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.signature`));
    assert.doesNotMatch(message, /do-not-expose|eyJhbGci/);
    assert.match(message, /\[REDACTED\]/);
  } finally {
    (settings as { supabaseSecretKey: string }).supabaseSecretKey = previous;
  }
});

test("a storage conflict after a provider result never repeats the provider call", async () => {
  let providerCalls = 0;
  const providerResult = await (async () => { providerCalls += 1; return "provider-result"; })();
  let revision = 1;
  let commits = 0;
  const base = { id: "run", aiCallLog: [], providerResult: null } as unknown as Run & { providerResult: string | null };
  const saved = await optimisticRunUpdate(
    async () => ({ run: structuredClone(base), revision }),
    async (run) => {
      commits += 1;
      if (commits === 1) { revision += 1; return false; }
      Object.assign(base, run);
      return true;
    },
    (run) => { (run as Run & { providerResult: string }).providerResult = providerResult; },
  );
  assert.equal(commits, 2);
  assert.equal((saved as Run & { providerResult: string }).providerResult, "provider-result");
  assert.equal(providerCalls, 1);
});
