# Session 11.2 Build 6A — production preflight and deployment contract

Date: 2 October 2026
Evidence boundary: local and live-Supabase preflight only. No Render service was created or changed.

## Deployment topology and Blueprint

The Blueprint declares each service exactly once:

| Intended service | Render type/runtime | Root | Build | Start | Health |
|---|---|---|---|---|---|
| `vpo-studio` | web / Docker | `frontend` | Docker `npm ci`, then `npm run build` | `npm start -- -H 0.0.0.0` | none |
| `vpo-studio-backend` | web / Docker | `backend` | Docker `npm ci`, then `npm run build` | `npm start` → `node dist/backend/src/server.js` | `/api/ready` |

The intended URLs are `https://vpo-studio.onrender.com` and `https://vpo-studio-backend.onrender.com`. They are configuration proposals, not deployment evidence, until Build 6B identifies or creates those exact services. The backend has one instance. Render Free rejects the configurable shutdown-delay field, so the Blueprint relies on Render's 30-second default termination window and the application uses a shorter 25-second deadline. No migration command runs during build or start.

## Operating-mode stages

1. **Supabase ownership / deployed TEST application:** `AUTH_MODE=supabase`, `STORAGE_MODE=supabase`, `TEST_MODE=true`, `PUBLISH_MODE=test`.
2. **LIVE AI validation:** change only `TEST_MODE=false` after deployed authentication, persistence and browser checks pass; `GEMINI_API_KEY` then becomes mandatory.
3. **LIVE provider validation:** change only `PUBLISH_MODE=live` immediately before a separately authorized controlled provider test; token encryption and the selected provider credential then become operational requirements.

Production never derives either external-effects mode from `NODE_ENV`. Meta and LinkedIn credentials are optional capabilities and never block general readiness.

## Environment matrix

| Classification | Variables | Contract |
|---|---|---|
| Public build-time, bundled by Next.js | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_AUTH_MODE`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | All four required for production, HTTPS origins where applicable, auth mode `supabase`, no placeholders. These are the only Docker build arguments. |
| Public runtime | none independently | `NEXT_PUBLIC_*` values are compiled into the browser bundle; changing them requires a frontend rebuild/redeploy. |
| Backend configuration | `NODE_ENV`, `HOST`, Render `PORT`, `TEST_MODE`, `PUBLISH_MODE`, `AUTH_MODE`, `STORAGE_MODE`, `FRONTEND_ORIGINS`, `PUBLIC_OAUTH_CALLBACK_BASE_URL`, `PUBLIC_FRONTEND_BASE_URL`, `GEMINI_MODEL_MAIN`, `GEMINI_MODEL_SCORING`, `GEMINI_MODEL_IMAGE`, `MEDIA_UPLOAD_MAX_BYTES`, `PROVIDER_TIMEOUT_MS`, `PROVIDER_RESPONSE_LIMIT_BYTES`, `PROVIDER_POLL_BASE_MS`, `PROVIDER_POLL_MAX_MS`, `FFPROBE_PATH`, `MEDIA_PROBE_TIMEOUT_MS`, `MEDIA_PROBE_CONCURRENCY`, `MEDIA_PROBE_STDOUT_LIMIT_BYTES`, `MEDIA_PROBE_STDERR_LIMIT_BYTES`, Pack/quality/retry/cost/concurrency settings in `.env.example` | Render sets `PORT`; production binds `HOST=0.0.0.0`. Explicit staged modes are mandatory. The deployment upload ceiling is 50 MiB. |
| Backend Supabase configuration | `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | Mandatory for Supabase mode. Server-side only in the backend; corresponding browser-safe values are separately bundled in the frontend. |
| Backend secrets | `SUPABASE_SECRET_KEY`, `GEMINI_API_KEY`, `PLATFORM_TOKEN_KEYS_JSON`, `PLATFORM_TOKEN_ACTIVE_KEY_ID` | Never public or logged. Gemini key is required only for LIVE AI. Token keyring is parsed before serving when LIVE publishing is enabled. |
| Optional provider credential | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `META_CLIENT_ID`, `META_CLIENT_SECRET`, `META_GRAPH_API_VERSION`, `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_API_VERSION` | ID/secret pairs must be complete if present; provider/version requirements apply only to configured LIVE capability. They do not affect general readiness. |
| Local/test only | `STORAGE_LOCAL_PATH`, `TEST_DELAY_MS`, `TEST_SCENARIO` | Never used as a production fallback. |

`PORT` is intentionally not declared in the Blueprint because Render supplies it. Secret values use `sync: false`; none is committed.

## Health and traffic contract

- `/api/live`: process liveness only; returns `200 {"status":"live"}` without dependencies.
- `/api/ready`: Render routing readiness. In Supabase mode it performs only bounded, read-only `runs` and `publication_runs` selects, with a 1.5-second timeout, 10-second success cache, 2-second failure cache and shared in-flight request. It returns only `ready` or `not_ready`, fails immediately while draining, creates no data, and never contacts Gemini/social providers.
- `/api/health`: safe frontend metadata: readiness status, AI mode and publishing mode. It returns no URLs, keys, provider state or dependency error details.

Readiness logs only a sanitized category when the category changes. The probe timeout is comfortably below Render's five-second health timeout.

## CORS and callback origins

Production origins must be exact HTTPS origins without credentials, path, query or fragment; trailing slashes normalize away. Explicit localhost and `127.0.0.1` HTTP origins remain allowed for local browser checks. `FRONTEND_ORIGINS` is an exact allow-list and must contain `PUBLIC_FRONTEND_BASE_URL`.

Provider `redirect_uri` values are always constructed from `PUBLIC_OAUTH_CALLBACK_BASE_URL` (backend). Successful and failed post-callback browser navigation always uses `PUBLIC_FRONTEND_BASE_URL`. Neither value is inferred from `Host`, `Origin`, forwarded headers or request input.

Supabase's Site URL should be the exact deployed frontend root. Its redirect allow-list should contain only the intended frontend root and deliberate local roots (plus explicitly chosen path wildcards); the backend provider callback URLs belong in provider consoles, not Supabase Auth redirects.

## Shutdown and restart

The first `SIGTERM` or `SIGINT` atomically enters draining; repeated signals reuse the same shutdown promise. Readiness fails immediately. New mutating requests and OAuth callbacks receive `503`; safe reads may finish while `server.close()` drains connections. Queued AI, Pack and publication starts are cancelled/rejected. A provider write guard runs before and after the final persisted fence/approval check, so no new irreversible write begins after draining starts.

An already-started bounded provider request may finish and persist its exact outcome. Tracked executors receive 20 seconds; the process exits within the 25-second application deadline. If that deadline is reached, durable checkpoints and claims remain for recovery.

Startup loads recoverable Supabase run/publication state. Publication scheduling uses one in-process entry per owner/run/job; a durable optimistic revision, expiring fenced claim, stable intent/idempotency fingerprints and provider evidence prevent duplicate logical scheduling across redeploys. An interrupted claim waits for expiry and resumes in reconciliation mode. This preserves exactly-once intent/evidence over retryable execution; it does not claim exactly-once provider network execution. Ambiguous external outcomes remain reconciliation/inspection work, never blind retries.

## Verification evidence

| Check | Result | Evidence boundary |
|---|---|---|
| Live Render Blueprint validation, no apply | Pass | Render CLI validator; two planned services |
| Backend TypeScript production build | Pass | Local |
| Complete backend suite | Pass — 121/121 | Local/injected dependencies |
| Frontend tests | Pass — 13/13 | Component and configuration tests, not deployed-browser evidence |
| Frontend lint | Pass | Local |
| Frontend production build with deployment public config | Pass | Local Next.js build |
| Missing/placeholder public config fails build | Pass | Local subprocess test and direct failed preflight |
| Production configuration/mode/local-fallback tests | Pass | Local subprocess tests |
| Liveness/readiness/health, secret leakage, CORS | Pass | Local HTTP and unit tests |
| Read-only readiness against designated Supabase | Pass | Direct dependency probe; not Render evidence |
| Callback construction and frontend return | Pass | Local route test |
| SIGTERM draining and bounded exit | Pass | Local child-process HTTP test |
| Restart recovery and duplicate scheduling | Pass | Local scheduler tests plus live-Supabase smoke |
| TEST publication network denial | Pass | Injected network-deny test |
| Controlled Supabase restart smoke and cleanup | Pass | Live designated Supabase; synthetic TEST records only; cleanup re-queried |
| Backend production dependency audit | Pass — 0 vulnerabilities | npm registry audit |
| Frontend production dependency audit | Pass — 0 vulnerabilities | npm registry audit |
| `backend/data` before/after manifest | Pass — `91fe0716392577ad5523343ec8ffc1e1c434594d` both times | Local SHA-1 manifest |
| `git diff --check` | Pass | Git working tree |
| Render deploy / deployed browser E2E | Not run | Build 6B gate |
| Real Google OAuth / Gemini / YouTube publication | Not run | Separately authorized controlled validation |
| Meta/LinkedIn OAuth and publication | Not run | Credentials/eligibility unavailable |

Mocks, component tests, local HTTP tests and protocol fakes are not Render, deployed-browser, PostgreSQL OAuth or provider-publication evidence.

## Remaining Build 6B gates and limits

Before deployment: review/merge this commit, ensure Render receives every mandatory secret/public build value, confirm the intended service names are available, apply the validated Blueprint, and verify `/api/live`, `/api/ready`, `/api/health`, exact CORS, Supabase login/ownership/private media and restart behavior on the deployed TEST application. Only then authorize Stage 2 LIVE AI. Stage 3 LIVE publishing remains a separate action-time decision.

Supabase Free limits deployment media to 50 MiB. Render Free may cold-start/spin down and does not provide production-like availability. Instagram requires an eligible Page-linked Professional account; LinkedIn app/product/account eligibility remains unverified. Google OAuth exchange and YouTube upload remain unverified.

## Official sources verified 2026-10-02

- [Render Blueprint specification](https://render.com/docs/blueprint-spec)
- [Render Infrastructure as Code](https://render.com/docs/infrastructure-as-code)
- [Render health checks](https://render.com/docs/health-checks)
- [Render environment variables](https://render.com/docs/configure-environment-variables)
- [Render web services](https://render.com/docs/web-services)
- [Render troubleshooting deploys](https://render.com/docs/troubleshooting-deploys)
- [Next.js self-hosting](https://nextjs.org/docs/app/guides/self-hosting)
- [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
