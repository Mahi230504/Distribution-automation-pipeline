# Step 5A test and evidence report — 2026-10-01

## Scope result

Implemented Supabase Auth integration, owner-explicit local/Supabase storage adapters, protected API/media routes, persisted job ownership, private Storage metadata, reproducible migration/policy tests, and a minimal accessible sign-in/session/sign-out experience. Pack and Approve remain SAMPLE. Finished-video handling, publishing adapters, Telegram, deployment, quotas, monitoring, Autopilot and multi-worker scaling were not built.

## Automated local evidence

All commands ran with isolated test data; no command used `backend/data`.

| Check | Result |
|---|---|
| Backend TypeScript production build | PASS — `npm run build` |
| Backend automated suite | PASS — 61/61 tests, 0 failed, 46.09 s after the protected-media correction |
| Frontend ESLint | PASS — `npm run lint` |
| Frontend Next.js 16.3.6 webpack production build | PASS — 5 routes built |
| Isolated local runtime smoke | PASS — frontend HTTP 200, health HTTP 200 with `authMode=local`, `storageMode=local_json`, and rendered `LOCAL FIXTURE IDENTITY` |
| Real Gemini calls | None — backend tests explicitly used `TEST_MODE=true` |
| Pack/Approve scope | Remain SAMPLE |

Ownership coverage includes: verified owner overrides a browser `userId`; A and B list only their own runs; exact cross-user run, job, AI-call and image IDs return 404; Brand kits remain separate; new jobs save the initiating verified owner; background execution continues with that owner; missing/invalid/expired bearer auth returns 401; sign-in mode misconfiguration fails startup; and Supabase configuration never falls back to samples. A frontend API regression proves sign-out removes protected requests and a restored session attaches only its current token. Existing Story, feedback, Direction, Look, Storyboard, cost-gate, provider-error, interruption and Resume regressions remain green.

The optimistic-concurrency regression obtains one simulated provider result, forces the first database commit to conflict, retries only persistence, and proves the provider call count remains exactly one. Existing interruption tests retain the separate rule that a provider response lost before persistence has unknown usage and may require explicit recovery.

The local ownership test seeds only its temporary directory on port 4105. It proves an authenticated A cannot fetch B's run, call log, Resume endpoint, saved job or exact asset ID. B receives the same denial against A. The storage implementations additionally require parent-run ownership before an image upload and resolve image reads through owner-scoped asset metadata.

## Raw-data and credential audit

The persisted `Run` type and write paths were searched for access/refresh tokens, authorization headers, API keys, raw provider responses, system prompts and filesystem/object paths. No auth token, API key, raw provider response or hidden system prompt is persisted in run snapshots. Run snapshots do include retrieved source-page evidence, user-visible generated prompts, full revision history and AI-call/error/cost metadata. Asset rows include private `object_path` and SHA-256 values. Therefore production grants revoke raw `anon`/`authenticated` access to all three application tables; authenticated browsers use Express only. Server secrets remain backend-only and are redacted from errors.

## Database and Storage policy evidence

Migration: `supabase/migrations/202610010001_step5a_ownership.sql`.

Policy test: `supabase/tests/database/step5a_rls.test.sql` contains 18 pgTAP assertions covering schema/policies, anonymous denial, production raw-table denial, temporary-grant RLS allow/deny for authenticated A and B, cross-owner insert/update/direct-ID denial, the ownership index, and A/B private-object SELECT isolation. Storage fixture rows exist only inside the rolled-back test transaction; application object mutations use the Storage API.

**Database/RLS/Storage policy tests: Not run.** The Supabase CLI is not installed in this environment, and the installed Docker client cannot connect to its daemon (`permission denied ... /Users/mohan/.docker/run/docker.sock`). No mocked application test is claimed as database-policy evidence.

## Live and remote evidence

Local product start-up in explicit local mode is available at `http://localhost:3000`, backed by `http://localhost:4000`; it uses the labelled local fixture identity and does not show a sign-in form. Supabase mode presents the email/password form, but live sign-in/session restore requires a designated project.

Remote Supabase verification: not run.

No remote project or bucket was created or modified. No importer was built or run. Existing local run JSON and images remain where they were and were not uploaded, renamed, rewritten or deleted. Their aggregate SHA-1 manifest hash was `0c4c11713329c5493e5bdd54769a7318d270f3e1` before and after the isolated runtime smoke.

## Remaining risks

- `getClaims()` verifies signing key and expiry without an online user lookup on every poll. A server-revoked access token can remain valid until its configured access-token expiry.
- The server secret bypasses RLS; isolation therefore depends on both the explicit owner predicates tested at the application layer and the database constraints. Real policy-engine evidence remains pending.
- Email delivery/confirmation and hosted redirect behaviour are project configuration and remain unverified.
- Optimistic revisions prevent silent lost writes, but distributed job claiming and a shared Gemini concurrency limiter are not implemented; run only one backend worker.
- No claim is made about remote persistence or private Storage behaviour until the separate verification checklist in `STEP5A-SETUP.md` is completed.

## Protected-media correction — 2026-10-01

- Authenticated image responses now use `Cache-Control: private, no-store` and `Vary: Authorization`. The two-user image integration test asserts both headers on an allowed response and still requires a 404 for the other owner.
- Protected-image display state is source-bound. A changed source immediately derives a clean loading state rather than retaining the earlier source's error/blob URL; the prior effect cleanup still revokes its object URL. A focused unit regression covers failed source → new source → loaded source.
- Archived-image links reserve a blank tab synchronously before awaiting the authenticated fetch, detach `opener`, then navigate to the blob URL. The unit regression verifies that ordering. Fetch failure closes the reserved tab; popup blocking falls back to a download and an announced recovery message.
- Browser interaction checks: Not run. The available in-app/Chrome browser surfaces reported unavailable, and two attempts to attach to the running Chrome app timed out. Automated state and interaction-order regressions, frontend lint/build and an isolated runtime were used instead; no manual/browser success is claimed.
- Database/RLS/Storage policy tests: Not run. The Supabase CLI/local engine blocker is unchanged.
- Remote Supabase verification: not run.
