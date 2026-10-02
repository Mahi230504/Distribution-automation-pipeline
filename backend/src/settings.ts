import "dotenv/config";
export type AuthMode = "local" | "supabase";
export type StorageMode = "local_json" | "supabase";
export type PublishMode = "test" | "live";

function choice<T extends string>(name: string, fallback: T, allowed: T[]): T {
  const value = (process.env[name] ?? fallback) as T;
  if (!allowed.includes(value))
    throw new Error(`${name} must be one of: ${allowed.join(", ")}`);
  return value;
}
function number(name: string, fallback: number) {
  const n = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(n) || n < 0) throw new Error(`Invalid setting ${name}`);
  return n;
}
function boolean(name: string, fallback: boolean) {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  if (raw !== "true" && raw !== "false")
    throw new Error(`${name} must be true or false`);
  return raw === "true";
}
function publicOrigin(name: string, value: string, requireHttps: boolean) {
  let url: URL;
  try { url = new URL(value); }
  catch { throw new Error(`${name} must be an absolute HTTP origin.`); }
  if (!['http:', 'https:'].includes(url.protocol) || (requireHttps && url.protocol !== 'https:') || url.username || url.password || url.pathname !== '/' || url.search || url.hash)
    throw new Error(`${name} must be an ${requireHttps ? 'HTTPS' : 'HTTP(S)'} origin without credentials, path, query or fragment.`);
  return url.origin;
}
const production = process.env.NODE_ENV === "production";
if (production) {
  for (const name of ["TEST_MODE", "PUBLISH_MODE", "AUTH_MODE", "STORAGE_MODE"])
    if (process.env[name] === undefined) throw new Error(`${name} must be set explicitly in production.`);
}
const configuredOrigins = (process.env.FRONTEND_ORIGINS ?? "http://localhost:3000")
  .split(",").map((value) => value.trim()).filter(Boolean)
  .map((value) => publicOrigin("FRONTEND_ORIGINS", value, production && !/^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(value)));
export const settings = {
  port: number("PORT", 4000),
  host: process.env.HOST ?? "127.0.0.1",
  test: boolean("TEST_MODE", true),
  key: process.env.GEMINI_API_KEY ?? "",
  origins: configuredOrigins,
  main: process.env.GEMINI_MODEL_MAIN ?? "gemini-3.8-flash",
  scoring: process.env.GEMINI_MODEL_SCORING ?? "gemini-3.5-flash-lite",
  image: process.env.GEMINI_MODEL_IMAGE ?? "gemini-3.1-flash-image",
  sourceConcurrency: Math.max(
    1,
    Math.min(6, Math.floor(number("SOURCE_FETCH_CONCURRENCY", 3))),
  ),
  concurrency: Math.max(
    1,
    Math.floor(number("GEMINI_MAX_CONCURRENT_CALLS", 2)),
  ),
  retries: Math.min(2, Math.floor(number("GEMINI_RETRY_MAX_ATTEMPTS", 2))),
  retryDelay: number("GEMINI_RETRY_DELAY_MS", 1000),
  speakingRate: Math.max(0.1, number("SPEAKING_RATE", 2.5)),
  cacheHours: number("RESEARCH_CACHE_HOURS", 24),
  dataPath: process.env.STORAGE_LOCAL_PATH ?? "./data",
  authMode: choice<AuthMode>("AUTH_MODE", "local", ["local", "supabase"]),
  storageMode: choice<StorageMode>("STORAGE_MODE", "local_json", [
    "local_json",
    "supabase",
  ]),
  publishMode: choice<PublishMode>("PUBLISH_MODE", "test", ["test", "live"]),
  publicOAuthCallbackBaseUrl: publicOrigin("PUBLIC_OAUTH_CALLBACK_BASE_URL", process.env.PUBLIC_OAUTH_CALLBACK_BASE_URL ?? "http://localhost:4000", production),
  publicFrontendBaseUrl: publicOrigin("PUBLIC_FRONTEND_BASE_URL", process.env.PUBLIC_FRONTEND_BASE_URL ?? "http://localhost:3000", production),
  platformTokenKeysJson: process.env.PLATFORM_TOKEN_KEYS_JSON ?? "",
  platformTokenActiveKeyId: process.env.PLATFORM_TOKEN_ACTIVE_KEY_ID ?? "",
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  metaClientId: process.env.META_CLIENT_ID ?? "",
  metaClientSecret: process.env.META_CLIENT_SECRET ?? "",
  metaGraphApiVersion: process.env.META_GRAPH_API_VERSION ?? "",
  linkedinClientId: process.env.LINKEDIN_CLIENT_ID ?? "",
  linkedinClientSecret: process.env.LINKEDIN_CLIENT_SECRET ?? "",
  linkedinApiVersion: process.env.LINKEDIN_API_VERSION ?? "202609",
  providerTimeoutMs: number("PROVIDER_TIMEOUT_MS", 30000),
  providerResponseLimitBytes: number("PROVIDER_RESPONSE_LIMIT_BYTES", 1048576),
  providerPollBaseMs: Math.max(250, number("PROVIDER_POLL_BASE_MS", 2000)),
  providerPollMaxMs: Math.max(1000, number("PROVIDER_POLL_MAX_MS", 60000)),
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY ?? "",
  supabaseSecretKey: process.env.SUPABASE_SECRET_KEY ?? "",
  testDelay: number("TEST_DELAY_MS", 350),
  mainInput: number("MAIN_INPUT_PRICE", 0.75),
  mainOutput: number("MAIN_OUTPUT_PRICE", 3.75),
  scoringInput: number("SCORING_INPUT_PRICE", 0.3),
  scoringOutput: number("SCORING_OUTPUT_PRICE", 2.5),
  imagePrice: number("IMAGE_PRICE", 0.067),
  imageInput: number("IMAGE_INPUT_PRICE", 0.5),
  imageOutput: number("IMAGE_TEXT_OUTPUT_PRICE", 3),
  promptThreshold: number("PROMPT_QUALITY_THRESHOLD", 75),
  promptRewrites: Math.floor(number("PROMPT_REWRITE_LIMIT", 2)),
  frameThreshold: number("FRAME_QUALITY_THRESHOLD", 70),
  autoRegenerations: Math.floor(number("FRAME_AUTO_REGENERATION_LIMIT", 1)),
  manualRegenerations: Math.floor(number("MANUAL_REGENERATION_LIMIT", 6)),
  maxFrames: Math.max(1, Math.floor(number("MAX_TOTAL_FRAMES", 6))),
  uploadBytes: number("UPLOAD_SIZE_LIMIT_BYTES", 5242880),
  fixtureScenario: process.env.TEST_SCENARIO ?? "pass",
  searchPrice: number("SEARCH_REQUEST_PRICE", 0.014),
  ffprobePath: process.env.FFPROBE_PATH ?? "ffprobe",
  mediaProbeTimeoutMs: number("MEDIA_PROBE_TIMEOUT_MS", 30000),
  mediaProbeConcurrency: Math.max(1, Math.floor(number("MEDIA_PROBE_CONCURRENCY", 2))),
  mediaProbeStdoutBytes: Math.max(1024, Math.floor(number("MEDIA_PROBE_STDOUT_LIMIT_BYTES", 2_000_000))),
  mediaProbeStderrBytes: Math.max(1024, Math.floor(number("MEDIA_PROBE_STDERR_LIMIT_BYTES", 65536))),
  mediaUploadMaxBytes: Math.max(1, Math.floor(number("MEDIA_UPLOAD_MAX_BYTES", 100 * 1024 * 1024))),
  packInputAllowance: number("PACK_INPUT_TOKEN_ALLOWANCE", 16000),
  packOutputAllowance: number("PACK_OUTPUT_TOKEN_ALLOWANCE", 6000),
};

const validModePair =
  (settings.authMode === "local" && settings.storageMode === "local_json") ||
  (settings.authMode === "supabase" && settings.storageMode === "supabase");
if (!validModePair)
  throw new Error(
    "AUTH_MODE and STORAGE_MODE must be local/local_json or supabase/supabase.",
  );
if (
  settings.authMode === "supabase" &&
  (!settings.supabaseUrl ||
    !settings.supabasePublishableKey ||
    !settings.supabaseSecretKey)
)
  throw new Error(
    "Supabase mode requires SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY.",
  );
if (production && (settings.authMode !== "supabase" || settings.storageMode !== "supabase"))
  throw new Error("Production requires AUTH_MODE=supabase and STORAGE_MODE=supabase; local adapters never run as a fallback.");
if (production && settings.host !== "0.0.0.0")
  throw new Error("Production HOST must be 0.0.0.0.");
if (production && !settings.origins.includes(settings.publicFrontendBaseUrl))
  throw new Error("FRONTEND_ORIGINS must include PUBLIC_FRONTEND_BASE_URL.");
if (production && !settings.test && !settings.key)
  throw new Error("Production TEST_MODE=false requires GEMINI_API_KEY.");
for (const [provider, clientId, secret] of [
  ["Google", settings.googleClientId, settings.googleClientSecret],
  ["Meta", settings.metaClientId, settings.metaClientSecret],
  ["LinkedIn", settings.linkedinClientId, settings.linkedinClientSecret],
] as const)
  if (settings.publishMode === "live" && !!clientId !== !!secret) throw new Error(`${provider} OAuth client ID and secret must be configured together for LIVE publishing.`);
if (settings.publishMode === "live" && settings.metaClientId && !/^v\d+\.\d+$/.test(settings.metaGraphApiVersion))
  throw new Error("Configured Meta OAuth requires META_GRAPH_API_VERSION such as v24.0.");
if (settings.publishMode === "live" && settings.linkedinClientId && !/^\d{6}$/.test(settings.linkedinApiVersion))
  throw new Error("Configured LinkedIn OAuth requires LINKEDIN_API_VERSION in YYYYMM format.");
export function safeError(error: unknown) {
  let message = error instanceof Error ? error.message : String(error);
  for (const secret of [settings.key, settings.supabaseSecretKey, settings.googleClientSecret, settings.metaClientSecret, settings.linkedinClientSecret])
    if (secret) message = message.split(secret).join("[REDACTED]");
  return message
    .replace(/(?:\/Users\/|\/home\/|\/tmp\/)[^\s"']+/g, "[private path]")
    .replace(/AIza[\w-]+/g, "[REDACTED]")
    .replace(/sb_secret_[\w.-]+/g, "[REDACTED]")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[REDACTED]")
    .replace(/([?&](?:key|code|state|access_token|refresh_token)=)[^&\s]+/gi, "$1[REDACTED]")
    .replace(/(Bearer\s+)[A-Za-z0-9._~-]+/gi, "$1[REDACTED]");
}

if (settings.promptThreshold > 100 || settings.frameThreshold > 100)
  throw new Error("Quality thresholds must be between 0 and 100");
