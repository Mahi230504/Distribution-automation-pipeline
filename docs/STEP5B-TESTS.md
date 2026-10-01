# Step 5B test and evidence report

Verified 1 October 2026. The Step 5B integration uses isolated temporary local storage on port 4106 and generates a real 15-second 720×1280 H.264/AAC MP4 with local FFmpeg 7.1.1. It never reads or writes `backend/data`; the before/after data-manifest SHA-1 remained `0c4c11713329c5493e5bdd54769a7318d270f3e1`.

## Automated results

- Backend TypeScript production build: pass.
- Backend suite: 64/64 pass. The prior 61 Step 1–5A tests remain green; three Step 5B tests cover the complete release flow, deterministic hard validators and the injected provider-result/storage-conflict regression.
- Frontend component suite: 3/3 pass. It covers protected-video failure → valid-source recovery and object-URL revocation, explicit Pack Save and Restore, destination Save and explicit Reopen.
- Frontend ESLint: pass.
- Frontend Next.js 16.3.6 webpack production build: pass.
- Production dependency audit: zero vulnerabilities in both backend and frontend.

The integration covers: approved-Storyboard gating; deterministic TEST_MODE Pack generation with one saved Pack call; immutable edit and restore; stale-write rejection; a real byte-probed MP4; wrong container/header, corrupt bytes, wrong codec, wrong dimensions, wrong duration and oversize validators; rejected-upload history preservation; `private, no-store` plus `Vary: Authorization`; two-user direct-ID denial for Pack edit, media preview/replacement, approval and approved downloads; destination invalidation; exact-version idempotent approval; new approval identity after supersession; media replacement; restart persistence; approved ZIP; Reopen; and no-repeat provider behavior after an injected persistence conflict.

The ZIP contains platform copy, exact Pack JSON, validation summary and approval manifest. The exact MP4 is a separate authenticated download as declared in that manifest.

## Evidence not run

- Browser acceptance: **Not run.** The available computer-use state exposed no browser provider surface, so laptop/390 px layout, drag/select progress, native video playback, downloaded ZIP inspection and console checks were not claimed. Equivalent state transitions have automated component/API coverage, but that is not browser evidence.
- Database/RLS/Storage policy tests: **Not run.** The additive migration and pgTAP schema test are present; the earlier unavailable local Supabase CLI/Docker engine blocker remains. Mocks are not reported as policy evidence.
- Remote Supabase verification: **not run.** No remote project was created, migrated or changed.
- Real Gemini calls: **not run.** All Pack evidence used TEST_MODE or injected local fakes.
- Platform OAuth/publication calls: **not run.** Build 5C was not started.
- Deployment: **not run.** Session 11.2 was not started.
