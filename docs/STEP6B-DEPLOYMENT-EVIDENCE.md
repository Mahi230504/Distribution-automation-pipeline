# Session 11.2 Build 6B — deployed TEST environment evidence

Date: 2 October 2026

Environment: Render workspace `Generalist` (`tea-daqf10g473hc73ftquug`), Singapore, Free

Evidence boundary: deployed Stage 1 TEST application. No live Gemini, OAuth exchange or provider publication was performed.

## Outcome

VPO Studio is deployed as two one-instance Render web services backed by the designated Supabase project. Authentication, persistence, private media, TEST AI, simulated TEST publishing, browser session restoration, cross-user isolation and restart recovery were exercised against the deployed application. The required rollout remains:

**Supabase ownership → deployed TEST application → LIVE AI validation → LIVE provider validation**

The deployed modes remained `AUTH_MODE=supabase`, `STORAGE_MODE=supabase`, `TEST_MODE=true` and `PUBLISH_MODE=test` throughout Build 6B.

## Source and Render resources

The accepted baseline `c491dadd8c7a73e8a394098b97512bb64e2286f5` was fetched, checked as zero commits behind `origin/master`, and fast-forward pushed without staging unrelated files. The deployed corrections are ordinary descendants of that baseline; no force push or history rewrite occurred.

| Resource | Identifier | Live deploy | Source commit | URL |
|---|---|---|---|---|
| Blueprint `vpo-studio` | `exs-davqc9flk1mc73c5f3d0` | initial execution `exe-davqcmp42hec73dphrv0`; corrective sync `exe-davqf60u01pc73founfg` | repository Blueprint | n/a |
| Backend `vpo-studio-backend` | `srv-davqdau0tbcc73evt97g` | `dep-davqnu7lk1mc73c6k340` — live | `fe0a28dd67b140a6590c675343e68320ef9684c8` | `https://vpo-studio-backend.onrender.com` |
| Frontend `vpo-studio` | `srv-davqdau0tbcc73evt970` | `dep-davqr060tbcc73f1dra0` — live | `9ffea8b5334b436439ae9d91b34880a7623f0d5b` | `https://vpo-studio.onrender.com` |

The initial backend deploy `dep-davqdb60tbcc73evtb5g` failed because a backend source import was outside the Docker root context. The Blueprint was corrected to repository root plus `./backend/Dockerfile`; sync `exe-davqf60u01pc73founfg` produced live deploy `dep-davqf8u0tbcc73f04ct0`. A later current-Supabase-key resumable-upload correction produced the live backend deploy above. The initial frontend deploy `dep-davqdbm0tbcc73evtc9g` was superseded by the responsive-layout correction above.

The Blueprint was applied once. Inventory inspection after every uncertain/corrective operation confirmed the same Blueprint and the same two VPO service IDs. The unrelated `media-app-builder` service (`srv-daqf2349v7es73cupmo0`) was not changed. Current Blueprint validation reports `valid: true`, `totalActions: 0`.

Both VPO services are Docker web services in Singapore on the Free plan with one instance. There is no Render Postgres resource, persistent disk, paid plan or migration command. The backend health path is `/api/ready`.

## Configuration transferred

No value is reproduced here. Values were transferred directly from ignored mode-0600 deployment files or fixed Blueprint configuration.

| Category | Configured names |
|---|---|
| Fixed public/backend configuration | `HOST`, `NODE_ENV`, `TEST_MODE`, `PUBLISH_MODE`, `AUTH_MODE`, `STORAGE_MODE`, `FRONTEND_ORIGINS`, `PUBLIC_OAUTH_CALLBACK_BASE_URL`, `PUBLIC_FRONTEND_BASE_URL`, `MEDIA_UPLOAD_MAX_BYTES`, `GEMINI_MODEL_MAIN`, `GEMINI_MODEL_SCORING`, `GEMINI_MODEL_IMAGE` |
| Browser-public build values | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_AUTH_MODE`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| Required backend secrets/config | `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `PLATFORM_TOKEN_KEYS_JSON`, `PLATFORM_TOKEN_ACTIVE_KEY_ID` |
| Prepared but inert in Stage 1 | `GEMINI_API_KEY`, complete Google client ID/secret pair |
| Intentionally absent | Meta client pair/version; LinkedIn client pair/version |

Render sets `PORT`. The only Docker build arguments are the four `NEXT_PUBLIC_*` names. Meta and LinkedIn declarations were removed from the initial Blueprint because the values are unavailable and Render required every declared `sync: false` value during creation; they remain documented optional Stage 3 configuration. No placeholder, dummy secret or incomplete pair was entered.

The actual Render URLs exactly match the configured callback base, frontend base, CORS origin and frontend API URL. Provider `redirect_uri` values use the backend origin; callback completion returns to the frontend origin. A deployed TEST callback returned `303` to the frontend with only a sanitized failure marker.

The Supabase Auth URL Configuration dashboard was compared after the actual Render URLs were known. Site URL is the exact deployed frontend. The redirect allow-list contains the exact production root and its deliberate `/**` entry plus the approved localhost root and `/**` entry. The dashboard showed no pending change, so Build 6B made no Supabase configuration mutation. No schema, RLS, migration, bucket or Storage setting changed.

## Deployed technical verification

| Check | Result | Evidence |
|---|---|---|
| Backend `/api/live` | Pass | HTTP 200, `{"status":"live"}` |
| Backend `/api/ready` | Pass | HTTP 200, `{"status":"ready"}` |
| Backend `/api/health` | Pass | HTTP 200; ready, AI `test`, `testMode: true`, publishing `test` |
| Public health secret disclosure | Pass | responses contain no URLs, keys, tokens or dependency errors |
| Frontend HTTPS | Pass | HTTP 200 from actual Render URL |
| Production CORS | Pass | exact frontend origin allowed; hostile origin denied 403; approved localhost preflight allowed |
| Missing authentication | Pass | protected API returned 401 |
| Production local fallback | Pass | deployed ownership/storage are Supabase; no local/sample fallback observed |
| Frontend bundle public values | Pass | deployed backend/auth/public Supabase values present; no localhost backend |
| Frontend bundle secret scan | Pass | no exact backend-secret digest match and no service-role, Gemini-key or provider-secret pattern |
| Render log secret scan | Pass | inspected runtime/build evidence contained no tokens, keys or sensitive database records |
| External-provider network audit | Pass | no Gemini, Google publishing, Meta or LinkedIn provider endpoint in inspected logs; browser resources used only the two VPO origins |

## Deployed browser acceptance

This section is evidence from real Safari/Chrome browser engines, not component tests or HTTP mocks. Two disposable, confirmed Supabase users and synthetic content were used.

| Browser check | Result |
|---|---|
| User A sign-in, refresh and session restoration | Pass |
| Create deterministic TEST run and persist through refresh | Pass |
| History lists the run | Pass |
| Sign-out removes protected access; sign-in restores the same run | Pass |
| User B history excludes User A run | Pass |
| User B exact User A run ID request | Pass — non-enumerating not-found response |
| Private MP4 owner access | Pass — bytes/hash matched the local synthetic file |
| User B exact private-media access | Pass — non-enumerating 404 |
| Direct unauthenticated/non-owner Storage access | Pass — denied |
| TEST Story through approved Storyboard | Pass — deterministic fixtures, no Gemini request |
| Pack, synthetic MP4 validation and exact release approval | Pass |
| Simulated TEST publication | Pass — recovered to simulated external-published evidence, no provider URL/effect |
| Visible mode labels | Pass — TEST AI, TEST publishing and simulated-only labels visible |

The synthetic MP4 was H.264/AAC, 360×640 and 22,545 bytes, below the 50 MiB deployment ceiling. No source URL, personal content or production social account was used. Safe authentication-screen evidence was captured without credentials; screenshots are not committed.

Responsive browser acceptance passed at 1440 px and exact 390 px viewport widths for authentication, History and the run workspace. A real 390 px overflow in the publishing target selector was found, corrected and redeployed. The final 390 px viewport had `scrollWidth === innerWidth` and retained usable Pack, approval, publishing, error and TEST/LIVE-label surfaces.

## Restart and recovery

Before the controlled backend restart, the TEST publication had exactly one batch, one intent, one logical job and one idempotency binding. Its saved state was `provider_processing` at checkpoint `simulated_provider_processing`; the evidence contained only a simulated marker and no provider URL or external effect.

The backend service was restarted exactly once. Render routing kept all 32 readiness samples at HTTP 200 across the 12.046-second observation window, so a draining 503 was **not observed**. After recovery, the same logical job reached `externally_published` at `simulated_external_creation_confirmed`. Counts remained exactly one batch, one intent, one job and one idempotency binding. The frontend reconnected and displayed the recovered job. This demonstrates durable exactly-once intent/evidence over retryable execution; it is not a claim of exactly-once network execution.

## Cleanup proof

Cleanup ran in a finally path after browser/restart verification. Four private objects (three generated images and one MP4) were removed. Both disposable Auth users were deleted. For both user IDs, re-queries returned zero rows in:

- `publication_job_secrets`
- `publication_job_registry`
- `publication_idempotency`
- `publication_runs`
- `oauth_states`
- `platform_connection_secrets`
- `platform_connections`
- `assets`
- `brand_kits`
- `runs`

Both user Storage root prefixes and the exact test-run prefix contained zero objects. Auth admin lookups returned no users. Cleanup errors and non-zero residue lists were both empty. Existing unrelated Supabase data was not touched.

## Verification ledger

| Verification | Result | Boundary/notes |
|---|---|---|
| Source fetch/divergence/staged push checks | Pass | normal fast-forward pushes only; unrelated files unstaged |
| Live Blueprint validation | Pass | `valid: true`, zero remaining actions |
| Render backend Docker build | Pass | live deploy `dep-davqnu7lk1mc73c6k340` |
| Render frontend Docker build | Pass | live deploy `dep-davqr060tbcc73f1dra0` |
| Backend production build | Pass | local |
| Complete backend suite | Pass — 122/122 | local; final isolated deployment-contract rerun 6/6 |
| Frontend lint | Pass | local |
| Frontend component tests | Pass — 13/13 | local, not browser evidence |
| Frontend production build | Pass | local with production public configuration |
| Backend/frontend production audits | Pass — 0 vulnerabilities each | npm registry audit |
| Core readiness checker | Pass — 26/26 | YouTube optional capability ready; Meta/LinkedIn optional absent |
| Deployed liveness/readiness/health/CORS/auth | Pass | actual Render endpoints |
| Auth/RLS/private-media isolation | Pass | deployed API plus designated Supabase |
| Supabase Site URL / redirect reconciliation | Pass | exact production frontend and retained localhost entries; no change required |
| Deployed real-browser E2E | Pass | Safari/Chrome browser engines |
| Restart persistence/deduplication | Pass | actual backend restart and durable Supabase state |
| TEST publication network denial | Pass | local injected denial plus deployed log/resource audit |
| Disposable deployed-data cleanup | Pass | table, Storage and Auth re-queries |
| `backend/data` manifest | Pass | unchanged SHA-1 `91fe0716392577ad5523343ec8ffc1e1c434594d` |
| `git diff --check` | Pass | final working diff |
| Free-plan cold-start timing | Not run | waiting for idle spin-down was disproportionate; see procedure below |
| Rollback execution | Not run | no defect was manufactured and no useful known-good revert was needed |
| Real Gemini validation | Not run | Stage 2 only |
| Real Google OAuth / YouTube upload | Not run | separately authorized Stage 3 only |
| Meta/LinkedIn OAuth or publication | Not run | credentials and eligibility unavailable |
| Local Docker-daemon build | Not run | local daemon unavailable; actual Render Docker builds passed |

A parallel final-suite rerun produced one transient localhost connection refusal in the deployment HTTP child-process test while the rest of the suite was under load. The same deployment-contract file immediately passed 6/6 in isolation, and an earlier complete post-change run passed 122/122. No product assertion failed.

## Cold start and rollback

Cold-start test: **Not run**. Manual procedure: leave both Free services idle for at least 15 minutes; open the frontend; record the initial response; poll backend `/api/live` and `/api/ready` until 200; verify the browser reconnects without sample/local fallback; record wake latency as a Free-plan cold start, not an application outage.

Rollback execution: **Not run**. Procedure verified and documented: identify the service, select the known-good deploy/commit in Render Deploys, confirm modes and environment are unchanged, redeploy/rollback only that service, wait for `/api/ready`, then repeat health, CORS, auth and frontend connectivity checks. Current known-good anchors are backend `fe0a28dd67b140a6590c675343e68320ef9684c8` / `dep-davqnu7lk1mc73c6k340` and frontend `9ffea8b5334b436439ae9d91b34880a7623f0d5b` / `dep-davqr060tbcc73f1dra0`. Supabase data is not rolled back by an application deploy.

## Remaining gates

Before LIVE AI: explicitly authorize Stage 2, retain `PUBLISH_MODE=test`, change only `TEST_MODE=false`, verify the selected Gemini model IDs still exist and pricing is current, run a bounded non-sensitive live-AI validation, inspect cost/quality evidence, and return to TEST if the validation fails.

Before any LIVE provider action: separately authorize Stage 3 immediately before the controlled test; complete and verify the chosen provider's credential pair, scopes, callback and account eligibility; keep unavailable providers absent; change only `PUBLISH_MODE=live`; reconnect through real OAuth; use a non-personal controlled target; and verify reconciliation/idempotency evidence. Google OAuth and YouTube upload remain unverified. Meta Page-linked Instagram Professional eligibility and LinkedIn app/product/Company Page eligibility remain unverified.

Render Free can spin services down and provides no production availability guarantee. Supabase Free limits deployment media to 50 MiB. The deployed design intentionally has no persistent Render disk or Render database.

## Gate A follow-up boundary

Local capability hardening was completed after this Build 6B baseline. It adds a credential-free provider capability projection and prevents unavailable providers from creating OAuth state or beginning new LIVE publication work. Local verification passed; deployment and browser evidence are tracked separately in `STEP6C-LIVE-ACTIVATION.md`. Until that deployment passes, this document's Build 6B service/deploy rows remain the authoritative deployed source evidence.
