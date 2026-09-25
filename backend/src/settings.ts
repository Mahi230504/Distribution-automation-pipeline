import "dotenv/config";
function number(name: string, fallback: number) {
  const n = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(n) || n < 0) throw new Error(`Invalid setting ${name}`);
  return n;
}
export const settings = {
  port: number("PORT", 4000),
  test: process.env.TEST_MODE !== "false",
  key: process.env.GEMINI_API_KEY ?? "",
  origins: (process.env.FRONTEND_ORIGINS ?? "http://localhost:3000")
    .split(",")
    .map((s) => s.trim()),
  main: process.env.GEMINI_MODEL_MAIN ?? "gemini-3.8-flash",
  scoring: process.env.GEMINI_MODEL_SCORING ?? "gemini-3.5-flash-lite",
  image: process.env.GEMINI_MODEL_IMAGE ?? "gemini-3.1-flash-image",
  concurrency: Math.max(
    1,
    Math.floor(number("GEMINI_MAX_CONCURRENT_CALLS", 2)),
  ),
  retries: Math.min(2, Math.floor(number("GEMINI_RETRY_MAX_ATTEMPTS", 2))),
  retryDelay: number("GEMINI_RETRY_DELAY_MS", 1000),
  speakingRate: Math.max(0.1, number("SPEAKING_RATE", 2.5)),
  cacheHours: number("RESEARCH_CACHE_HOURS", 24),
  dataPath: process.env.STORAGE_LOCAL_PATH ?? "./data",
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
};
export function safeError(error: unknown) {
  let message = error instanceof Error ? error.message : String(error);
  if (settings.key) message = message.split(settings.key).join("[REDACTED]");
  return message
    .replace(/(?:\/Users\/|\/home\/|\/tmp\/)[^\s"']+/g, "[private path]")
    .replace(/AIza[\w-]+/g, "[REDACTED]")
    .replace(/([?&]key=)[^&\s]+/g, "$1[REDACTED]");
}

if (settings.promptThreshold > 100 || settings.frameThreshold > 100)
  throw new Error("Quality thresholds must be between 0 and 100");
