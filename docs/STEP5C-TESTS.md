# Step 5C test and evidence report

Implementation verification date: 2 October 2026. Tests use TEST publishing or injected provider fakes. No automated test calls Google, Meta, LinkedIn or OAuth endpoints.

## Automated evidence

- Exact approval mismatches, canonical approval/confirmation hashes and three stable per-target idempotency fingerprints.
- Atomic batch preparation and identical-repeat reuse without duplicate intents/jobs.
- Append-only target supersession before work and rejection after a provider effect starts.
- Deterministic success, processing, failure, reconnect and ambiguous TEST outcomes with a fetch-deny assertion proving zero platform HTTP.
- Injected-transport YouTube protocol shapes: authenticated session creation, media length, authenticated upload, 308 status/resume, 201 video ID and processing checks.
- Injected-transport LinkedIn protocol shapes: validated ordered ranges, mandatory ETags, exact finalize part IDs/token, processing, approved commentary/hashtag composition and Posts URN handling.
- Runner-level scheduler coverage proves a TEST success advances through every checkpoint without restart, delayed processing waits for its saved time, and duplicate scheduling causes one effect per checkpoint.
- Runner policy coverage proves approval supersession still permits read-only YouTube video and LinkedIn video-URN status/evidence recovery, while LinkedIn finalize and Posts creation stay blocked.
- Local journal and injected Supabase-RPC contract tests cover first authorization, reconnect/refresh CAS conflicts and atomic disconnect conflicts without exposing token material.
- LinkedIn protocol fakes cover the official empty-string upload token plus `urn:li:share:*` and `urn:li:ugcPost:*` Posts response IDs.
- Explicit safe-retry, reconcile-only, reconnect-only and attention-only behavior; Instagram's deterministic capability block cannot expose Retry.
- Reconnect-in-place and missing-scope behavior, persisted bounded polling/Retry-After metadata, claim fencing, forced-CAS metadata stability and atomic local secret/public checkpoint protection.
- OAuth callback failure headers, cookie clearing and sanitized 303 behavior. These are local route/protocol assertions, not evidence of a real provider authorization.
- Exact Supabase 206/Content-Range validation for private byte ranges.
- Immutable Pack-to-platform payload mapping without destination crossover.
- AES-256-GCM encryption, AAD binding, key length, missing old key and rotation behavior.
- OAuth state provider/cookie binding, expiry and single-use replay denial.
- Cross-owner connection and publication aggregate denial in the local adapter.
- HTTPS/host/private-address checks for provider endpoints.
- Frontend explicit confirmation, unsaved-target blocking, duplicate-click lock, partial success, failed-only retry and unknown-only reconciliation.
- All existing Story through Build 5B regression suites remain part of the full commands.

Clean verification results:

- Backend suite: **108/108 pass** (the accepted 100 plus 8 focused continuation, atomicity, LinkedIn-shape and supersession-recovery assertions).
- Backend TypeScript production build: **pass**.
- Frontend component suite: **10/10 pass**. Reconnect uses the exact bound connection; attention/reconcile checkpoints do not display Retry.
- Frontend ESLint: **pass**.
- Frontend Next.js webpack production build: **pass**.
- Backend production dependency audit: **0 vulnerabilities**.
- Frontend production dependency audit: **0 vulnerabilities**.
- Existing `backend/data` SHA-1 manifest before/after: `0c4c11713329c5493e5bdd54769a7318d270f3e1`.

## Evidence boundaries

- Browser acceptance: **Not run.** The computer-use inventory again returned `browsers: []` on 2 October 2026, so no controllable browser surface was available. Component tests are separate evidence and are not substituted.
- Database/RLS policy execution: **Not run.** No local Supabase/Docker engine was used and no migration was applied. The additive migrations and pgTAP artifacts include temporary User A/User B policy assertions, service-only secret/OAuth assertions, atomic OAuth consumption, cross-owner job-secret rejection, idempotency-conflict coverage and browser-denied atomic connection RPC assertions; their existence is not runtime policy evidence. Injected Supabase client tests prove only the application/RPC contract, not PostgreSQL transaction or policy execution.
- Local real OAuth callbacks: **Not run.** No disposable credentials or registered callbacks were supplied.
- YouTube live upload/publication: **Not run.**
- Instagram live upload/publication: **Not run.** Its private-binary Instagram Login path remains capability-blocked pending current official verification.
- LinkedIn live upload/publication: **Not run.**
- Remote Supabase verification: **not run.** No remote project was changed.
- Deployment: **not run.** Session 11.2 was not started.
