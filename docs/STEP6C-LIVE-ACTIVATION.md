# Session 11.2 Build 6C — live activation evidence

Date: 2 October 2026

Evidence boundary: staged activation only. Results are recorded as **Pass**, **Fail**, **Blocked** or **Not run**. Secret values, disposable passwords, tokens and personal account data are never recorded.

## Rollout sequence

**Supabase ownership → deployed TEST application → LIVE AI validation → LIVE provider validation**

Gate A must pass completely before Gate B. Gate C and Gate D are outside the current authorization.

## Gate A — partial-provider activation hardening

### Configuration boundary

The backend reports one safe capability item for each of `youtube`, `instagram` and `linkedin`:

```json
{
  "provider": "youtube",
  "configured": true,
  "available": true,
  "status": "available"
}
```

Only those four fields are exposed. No client ID, secret, token, scope, API version, environment name, credential diagnostic or authorization URL is part of this projection.

Both credential values absent is valid and reports unavailable. Both structurally usable values present reports configured/available. A half-pair is a startup error in every publication mode. Optional providers remain independent.

OAuth start checks availability before authorization URL construction or state persistence. LIVE target binding and batch creation repeat the check so an old stored connection cannot bypass removed credentials. Existing connections, jobs, checkpoints, adapters, storage contracts and database schema are unchanged. Missing/delayed capability data fails closed in the frontend.

### Local evidence

| Check | Result | Evidence |
|---|---|---|
| Backend TypeScript build | **Pass** | production compilation completed |
| Complete backend suite | **Pass — 124/124** | includes pair validation, capability secrecy, pre-state OAuth rejection, replay/ownership/expiry, network-denied TEST publication and existing release coverage |
| Frontend lint | **Pass** | no lint error |
| Frontend component/config suite | **Pass — 15/15** | available, unavailable, delayed and historical job states covered; not browser evidence |
| Frontend production build | **Pass** | used ignored production-public configuration; the validator separately rejected missing public values before Next.js compilation |
| Production dependency audits | **Pass** | backend 0 vulnerabilities; frontend 0 vulnerabilities |
| Source/built-bundle exact credential scan | **Pass** | nine prepared sensitive/provider values checked; no match in tracked source or 316 built frontend files |
| `backend/data` manifest | **Pass** | before/after SHA-256 manifests match byte-for-byte |
| `git diff --check` | **Pass** | no whitespace error |
| Gemini or provider network traffic | **Pass — none** | tests use deterministic fixtures/injected denial; no product workflow or OAuth was started |

### Deployment evidence

| Check | Result |
|---|---|
| Gate A source commit/push | **Pass** — normal push of `dc5d3643cf81d00b059dc3a0023b3123302bc064`; zero commits behind; unrelated files unstaged |
| Backend Render deploy | **Pass** — `dep-davrh17lk1mc73c9jdog`, exact Gate A source, live |
| Frontend Render deploy | **Pass** — `dep-davrh17lk1mc73c9jdn0`, exact Gate A source, live |
| Deployed liveness/readiness/health | **Pass** — HTTP 200; AI `test`, `testMode: true`, publishing `test` |
| Exact-origin CORS | **Pass** — production frontend allowed; hostile origin denied 403 |
| Unauthenticated protected access | **Pass** — HTTP 401 |
| Authenticated capability/API access | **Pass** — the designated retained E2E account restored its session and loaded the owner-scoped publication view for an owned disposable run |
| Capability projection | **Pass** — YouTube was configured/available with one Connect action; Instagram and LinkedIn displayed **Not configured** with no Connect/Reconnect action or keyboard target |
| Delayed capability response | **Pass** — an isolated real-browser response delay exposed no Connect/Reconnect action before capability data arrived |
| Capability secrecy | **Pass** — response and DOM checks found no client ID/secret, token, scope, API version, environment name or authorization URL |
| Desktop and exact 390 px browser acceptance | **Pass** — capability states remained distinct/readable; 390 px had no document overflow or clipped interactive control |
| Pack, approval and TEST publication | **Pass** — one synthetic TEST run reached Pack, exact release approval and terminal `simulated_external_creation_confirmed`; YouTube privacy remained private |
| Session/workflow persistence | **Pass** — authentication and the terminal simulated job survived browser refresh |
| Browser console/network | **Pass** — no product console error; browser hosts were limited to the deployed frontend and backend; no Gemini or social-provider request occurred |
| Deployed OAuth-state absence | **Pass** — zero rows before and after acceptance; unavailable providers created no OAuth state |
| Disposable-data cleanup | **Pass** — the exact run, four assets/objects, publication batch/intent/job/idempotency data and simulated connection all re-queried as zero; the retained E2E Auth account was not removed |
| Render runtime log audit | **Pass** — no Gemini/social-provider endpoint or secret pattern in the deployment window |

Render workspace `Generalist` and the existing service IDs were reconfirmed before acceptance. The unrelated `media-app-builder` service was excluded. No environment value or provider credential changed during Gate A. The synthetic run was `1f8b81f6-ed51-42b6-90af-8d4c6592a0bd`; its one TEST batch, intent and job were recorded before cleanup. The existing synthetic MP4 fixture was read without altering `backend/data`. The YouTube Connect control was deliberately not clicked; the TEST-only authenticated simulation route created the disposable connection needed for the publication regression.

Sanitized screenshots are retained as `screenshots/session11-2-gatea-history-desktop.png`, `session11-2-gatea-capabilities-desktop.png`, `session11-2-gatea-capabilities-390.png`, `session11-2-gatea-pack-approval.png` and `session11-2-gatea-test-publication.png`. The account identifier is masked. Gate A is complete.

## Gate B — LIVE Gemini with TEST publishing

Overall result: **Blocked by the authorized cost ceiling; safely rolled back.** Gate B began only after Gate A passed. `PUBLISH_MODE` remained `test` throughout. The backend changed `TEST_MODE=true` to `false` at `2026-10-02T14:43:36.685Z`, deployed as `dep-davs68id0e5s7396d4u0` from source `5087962cf373904450b50578f8120a9f88b705a2`, and returned HTTP 200 from `/api/live`, `/api/ready` and `/api/health` with LIVE AI and TEST publishing.

### Model and credential preflight

Official Google documentation was rechecked on 2 October 2026:

- [models](https://ai.google.dev/gemini-api/docs/models)
- [Gemini 3.8 Flash](https://ai.google.dev/gemini-api/docs/latest-model)
- [pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [image generation](https://ai.google.dev/gemini-api/docs/image-generation)
- [rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)

| Role | Configured identifier | Exact-project result | Current application price basis |
|---|---|---|---|
| Main | `gemini-3.8-flash` | **Pass** — listed; `generateContent` and `countTokens` supported | $0.75 / 1M input; $3.75 / 1M output through 31 December 2026 |
| Scoring | `gemini-3.5-flash-lite` | **Pass** — listed; `generateContent` and `countTokens` supported | $0.30 / 1M input; $2.50 / 1M output |
| Image | `gemini-3.1-flash-image` | **Pass** — listed; `generateContent` and `countTokens` supported | $0.50 / 1M input; $3 / 1M text/thinking output; $0.067 per 1K image |

The backend-only model-list request and a five-token `countTokens` request for each identifier returned HTTP 200. No model was substituted. The redacted readiness checker passed 26/26, with YouTube ready and Meta/LinkedIn optional. Exact-value scans found no prepared backend secret in 165 tracked files, 316 built frontend files, frontend deployment environment, captured run response, DOM, browser storage or 64,896 bytes of Render logs. The billing/rate-limit dashboard itself was **Not run** because no authenticated AI Studio dashboard session was available in the controlled browser; the eight successful paid operations supplied operational billing/rate evidence and produced no billing or 429 error, but do not prove unused quota or a billing-console invoice.

### Bounded LIVE workflow

The disposable run `e1655247-eff6-41bb-b71c-ab393485fd89` used only a fictional Lumen Sprout brief with no source URL or personal/confidential data.

| Check | Result | Evidence |
|---|---|---|
| Brief assessment, research/script and Story approval | **Pass** | LIVE run provenance; zero cited facts/sources because grounding returned no usable metadata, surfaced honestly as an uncited-research warning rather than invented citations |
| Direction generation/selection and prompt optimization | **Pass** | selected direction saved; final prompt score 100/100; all calls `testMode: false` |
| Models and usage | **Pass** | eight successful calls: five main-model, three scoring-model; 6,010 input tokens, 5,314 output tokens, zero images and zero billed search requests |
| Recorded application estimate | **Pass** | $0.0226027 cumulative before Look confirmation |
| Key-frame confirmation boundary | **Pass** | UI disclosed a maximum $1.4466 allowance for six possible image attempts plus reviews/audits |
| Cost-ceiling enforcement | **Pass** | $0.0226027 + $1.4466 would exceed $1.25, so **Confirm and generate was not clicked** |
| Look, Storyboard, Pack, MP4, approval and TEST publication | **Blocked** | not executed because the next authorized paid boundary exceeded the ceiling; no partial result is described as passed |
| Desktop LIVE UI | **Pass** | Story, Direction and the blocking cost confirmation rendered without console/API error |
| Exact 390 px LIVE regression | **Not run** | Gate A passed 390 px; Gate B stopped at the paid boundary before the requested end-to-end responsive pass |
| Refresh/session persistence during Gate B | **Not run** | Gate A passed refresh restoration; Gate B stopped before this evidence point |
| Cross-user/private-media denial during Gate B | **Not run** | no second clean account was available and no LIVE image/media asset was created |
| TEST publication evidence during Gate B | **Not run** | the run never reached release state; Gate A separately passed deployed simulated publication |
| Social-provider traffic | **Pass — none** | browser hosts were only the VPO frontend/backend; Render-log audit found no YouTube, Meta/Instagram or LinkedIn host; `PUBLISH_MODE=test` never changed |
| Secret exposure | **Pass — none found** | digest/exact-value scans of source, bundle, browser state, captured response and Render logs; screenshots were visually reviewed with the account identifier masked |

The cost-boundary screenshot is `screenshots/session11-2-gateb-cost-ceiling-block.png`.

### Rollback and cleanup

Because the required workflow could not complete, only `TEST_MODE` was returned from `false` to `true` at `2026-10-02T14:50:15.333Z`. Rollback deploy `dep-davs9c7avr4c73d84uv0` became live from the same source commit. All health routes returned 200 and `/api/health` again reported TEST AI and TEST publishing.

Cleanup re-queried `runs`, `assets`, `publication_runs`, `publication_idempotency`, `publication_job_registry`, `publication_job_secrets` and the exact private Storage prefix: every count was zero. No asset, Pack, approval, publication state or provider connection was created by Gate B. The reusable E2E Auth account remains. `backend/data` retained manifest SHA-1 `91fe0716392577ad5523343ec8ffc1e1c434594d`.

Final modes: `TEST_MODE=true`, `PUBLISH_MODE=test`. Gate B remains **Blocked** until a reviewer either raises the authorization ceiling above the application’s conservative $1.4466 Look allowance (plus already-recorded text cost) or changes the approved test to a no-generation reference upload. This execution did neither.

## Gate C — private YouTube publication

**Not run.** Requires separate authorization after Gate B passes. It changes only `PUBLISH_MODE` and performs real Google OAuth plus one private upload. The existing frontend intent remains `private`. A TEST publication intent cannot be relabelled LIVE; any replacement approval must retain the immutable provenance boundary.

## Gate D — Instagram and LinkedIn

- Instagram: **Blocked** — Meta app/client pair, eligible controlled professional account and current product/review eligibility are absent. The implemented `media_publish` effect is externally visible.
- LinkedIn: **Blocked** — client pair, approved product access and controlled test member are absent. The current member adapter sends a PUBLIC, PUBLISHED main-feed post and does not implement organization publishing.
