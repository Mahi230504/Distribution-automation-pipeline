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
| Authenticated capability/API access | **Not run** — no controllable designated-user session |
| Desktop and exact 390 px browser acceptance | **Not run** — Chrome and Safari attachment timed out; isolated browser had no designated-user session |
| Deployed OAuth-state absence | **Pass** — read-only designated-project query returned zero rows after deployment |
| Render runtime log audit | **Pass** — no Gemini/social-provider endpoint or secret pattern in the deployment window |

Render workspace `Generalist` and the existing service IDs were reconfirmed before deployment. The unrelated `media-app-builder` service was excluded. No environment value or provider credential changed.

Gate A is deployed but cannot be marked complete for curriculum purposes until the authenticated desktop and exact 390 px checks confirm the capability projection in the real UI. The exact remaining browser procedure is: sign in with a designated existing test user; open an approved release with YouTube, Instagram and LinkedIn selected; verify YouTube retains its configured action; verify Instagram and LinkedIn show **Not configured** with no Connect/Reconnect action; confirm Pack, approval and one simulated TEST publication remain usable; inspect console/network for errors, Gemini/provider requests and secrets; then re-query OAuth state for zero unavailable-provider creations.

## Gate B — LIVE Gemini with TEST publishing

**Not run.** Gate A's authenticated browser rows did not run, so the prerequisite was not satisfied. `TEST_MODE` remains `true` and `PUBLISH_MODE` remains `test`. Once Gate A browser acceptance passes, the authorized transition changes only backend `TEST_MODE=true` to `TEST_MODE=false`; `PUBLISH_MODE=test` must remain unchanged. One fictional, non-sensitive run has a strict US$1.25 application-estimated ceiling. Any failure returns only `TEST_MODE` to true.

Required evidence remains: exact project model availability, billing/rate-limit state, backend-only key handling, per-call provenance/cost, private-media lineage, refresh/session/owner isolation, simulated publication, provider network denial and verified cleanup.

## Gate C — private YouTube publication

**Not run.** Requires separate authorization after Gate B passes. It changes only `PUBLISH_MODE` and performs real Google OAuth plus one private upload. The existing frontend intent remains `private`. A TEST publication intent cannot be relabelled LIVE; any replacement approval must retain the immutable provenance boundary.

## Gate D — Instagram and LinkedIn

- Instagram: **Blocked** — Meta app/client pair, eligible controlled professional account and current product/review eligibility are absent. The implemented `media_publish` effect is externally visible.
- LinkedIn: **Blocked** — client pair, approved product access and controlled test member are absent. The current member adapter sends a PUBLIC, PUBLISHED main-feed post and does not implement organization publishing.
