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
  return Boolean(value && !value.startsWith("__REQUIRED_") && !/^<.+>$/.test(value));
}
function origin(value, https = true) {
  try { const url = new URL(value); return (!https || url.protocol === "https:") && ["http:", "https:"].includes(url.protocol) && !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash; }
  catch { return false; }
}

const backend = parseEnv(backendEnv);
const frontend = parseEnv(frontendEnv);
const checks = [], providers = [];
const check = (name, ok, detail) => checks.push({ name, ok, detail });
const provider = (name, ok, detail) => providers.push({ name, ok, detail });

check("backend private deployment env exists", existsSync(backendEnv), "backend/.env.deployment.local");
check("frontend private deployment env exists", existsSync(frontendEnv), "frontend/.env.deployment.local");
check("explicit AI mode", ["true", "false"].includes(backend.TEST_MODE), "TEST_MODE is explicit");
check("explicit publishing mode", ["test", "live"].includes(backend.PUBLISH_MODE), "PUBLISH_MODE is explicit");
check("Supabase auth/storage selected", backend.AUTH_MODE === "supabase" && backend.STORAGE_MODE === "supabase", "AUTH_MODE/STORAGE_MODE");
check("public backend callback base", origin(backend.PUBLIC_OAUTH_CALLBACK_BASE_URL), "valid HTTPS backend origin");
check("public frontend base", origin(backend.PUBLIC_FRONTEND_BASE_URL), "valid HTTPS frontend origin");
check("frontend origin allowed", (backend.FRONTEND_ORIGINS ?? "").split(",").map(v=>v.trim()).includes(backend.PUBLIC_FRONTEND_BASE_URL), "frontend base is in CORS allow-list");
check("frontend API URL", frontend.NEXT_PUBLIC_API_URL === backend.PUBLIC_OAUTH_CALLBACK_BASE_URL && origin(frontend.NEXT_PUBLIC_API_URL), "matches backend origin");
check("frontend Supabase mode", frontend.NEXT_PUBLIC_AUTH_MODE === "supabase", "NEXT_PUBLIC_AUTH_MODE");
check("50 MiB deployment media limit", backend.MEDIA_UPLOAD_MAX_BYTES === "52428800", "MEDIA_UPLOAD_MAX_BYTES");
for (const name of ["GEMINI_MODEL_MAIN", "GEMINI_MODEL_SCORING", "GEMINI_MODEL_IMAGE"])
  check(name, present(backend[name]), "model configured");
check("Gemini credential for LIVE AI", backend.TEST_MODE === "true" || present(backend.GEMINI_API_KEY), "required only when TEST_MODE=false");

let keyOkay = false;
try {
  const ring = JSON.parse(backend.PLATFORM_TOKEN_KEYS_JSON || "{}");
  const active = backend.PLATFORM_TOKEN_ACTIVE_KEY_ID;
  keyOkay = Boolean(active && ring[active] && Buffer.from(ring[active], "base64").length === 32);
} catch {}
check("platform token key for LIVE publishing", backend.PUBLISH_MODE !== "live" || keyOkay, "required only when PUBLISH_MODE=live");

for (const name of [
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
]) check(name, present(backend[name]), "backend secret/config present");

for (const [name,id,secret,extra] of [
  ["YouTube", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", true],
  ["Instagram", "META_CLIENT_ID", "META_CLIENT_SECRET", /^v\d+\.\d+$/.test(backend.META_GRAPH_API_VERSION ?? "")],
  ["LinkedIn", "LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET", /^\d{6}$/.test(backend.LINKEDIN_API_VERSION ?? "")],
]) provider(name, present(backend[id]) && present(backend[secret]) && extra, "optional LIVE provider capability");

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
for (const item of providers) console.log(`${item.ok ? "READY" : "OPTIONAL"}  ${item.name} — ${item.detail}`);
const waiting = checks.filter((item) => !item.ok);
console.log(`\nCore deployment: ${checks.length - waiting.length}/${checks.length} checks pass. Optional providers: ${providers.filter(item=>item.ok).length}/${providers.length} ready.`);
process.exitCode = waiting.length ? 2 : 0;
