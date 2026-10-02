#!/usr/bin/env node

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const backendEnv = resolve(root, "backend/.env.deployment.local");
const frontendEnv = resolve(root, "frontend/.env.deployment.local");

function parseEnv(path) {
  if (!existsSync(path)) return {};
  const result = {};
  for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index < 1) continue;
    result[line.slice(0, index)] = line.slice(index + 1);
  }
  return result;
}

function present(value) {
  return Boolean(value && !value.startsWith("__REQUIRED_"));
}

const backend = parseEnv(backendEnv);
const frontend = parseEnv(frontendEnv);
const checks = [];
const check = (name, ok, detail) => checks.push({ name, ok, detail });

check("backend private deployment env exists", existsSync(backendEnv), "backend/.env.deployment.local");
check("frontend private deployment env exists", existsSync(frontendEnv), "frontend/.env.deployment.local");
check("live publishing selected", backend.PUBLISH_MODE === "live", "PUBLISH_MODE=live");
check("Supabase auth/storage selected", backend.AUTH_MODE === "supabase" && backend.STORAGE_MODE === "supabase", "AUTH_MODE/STORAGE_MODE");
check("public backend callback base", backend.PUBLIC_OAUTH_CALLBACK_BASE_URL === "https://vpo-studio-backend.onrender.com", "production callback base");
check("frontend API URL", frontend.NEXT_PUBLIC_API_URL === "https://vpo-studio-backend.onrender.com", "production backend URL");
check("frontend Supabase mode", frontend.NEXT_PUBLIC_AUTH_MODE === "supabase", "NEXT_PUBLIC_AUTH_MODE");

let keyOkay = false;
try {
  const ring = JSON.parse(backend.PLATFORM_TOKEN_KEYS_JSON || "{}");
  const active = backend.PLATFORM_TOKEN_ACTIVE_KEY_ID;
  keyOkay = Boolean(active && ring[active] && Buffer.from(ring[active], "base64").length === 32);
} catch {}
check("32-byte platform token key", keyOkay, "encrypted OAuth-token storage");

for (const name of [
  "GEMINI_API_KEY",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "META_CLIENT_ID",
  "META_CLIENT_SECRET",
  "META_GRAPH_API_VERSION",
  "LINKEDIN_CLIENT_ID",
  "LINKEDIN_CLIENT_SECRET",
  "LINKEDIN_API_VERSION",
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
]) check(name, present(backend[name]), "backend secret/config present");

check("frontend Supabase URL", frontend.NEXT_PUBLIC_SUPABASE_URL === backend.SUPABASE_URL && present(frontend.NEXT_PUBLIC_SUPABASE_URL), "same project as backend");
check("frontend publishable key", frontend.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY === backend.SUPABASE_PUBLISHABLE_KEY && present(frontend.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY), "browser-safe key matches backend");

for (const file of [
  "supabase/migrations/202610010001_step5a_ownership.sql",
  "supabase/migrations/202610010002_step5b_release_assets.sql",
  "supabase/migrations/202610020003_step5c_publication.sql",
  "supabase/migrations/202610020004_step5c_recovery_invariants.sql",
  "supabase/migrations/202610020005_step5c_connection_atomicity.sql",
]) check(file, existsSync(resolve(root, file)), "migration present");

for (const item of checks) console.log(`${item.ok ? "PASS" : "WAIT"}  ${item.name} — ${item.detail}`);
const waiting = checks.filter((item) => !item.ok);
console.log(`\n${checks.length - waiting.length}/${checks.length} readiness checks pass; ${waiting.length} await credentials or provider setup.`);
process.exitCode = waiting.length ? 2 : 0;
