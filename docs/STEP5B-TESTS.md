# Step 5B test and evidence report

Verified 1 October 2026. All Step 5B integration data used isolated temporary local storage on port 4106. The media test generated a real 15-second 720×1280 H.264/AAC MP4 with local FFmpeg 7.1.1. No test read or wrote `backend/data`. The required manifest command was run before and after the correction pass:

```text
find backend/data -type f -print0 | sort -z | xargs -0 shasum | shasum
0c4c11713329c5493e5bdd54769a7318d270f3e1  -
```

## Automated results

- Backend TypeScript production build: pass.
- Backend suite: 77/77 pass. Existing Steps 1–4 and 5A regressions remain green.
- Focused Step 5B backend selection: 16/16 pass.
- Frontend component suite: 6/6 pass.
- Frontend ESLint: pass.
- Frontend Next.js 16.3.6 webpack production build: pass.
- Backend production dependency audit: zero vulnerabilities.
- Frontend production dependency audit: zero vulnerabilities.

## Asserted Step 5B evidence

- Canonical Storyboard lineage changes when approved brief, script, any non-removed fact sent to Pack, direction, prompt, approved key, Storyboard instruction or selected attempt content changes. Equivalent objects with different key insertion order produce the same hash. Changing an excluded removed fact changes neither lineage nor quote input hash.
- Provider context, lineage, recorded `retainedFactIds` and claim corpus use the same ID-sorted set of every non-removed fact. Provider context is canonical JSON, and its input hash is stable across object-key insertion order.
- TEST and live generated Pack provenance, version 1 creation, policy fingerprint and exact input references are persisted. Legacy/sample Pack data projects as read-only version 0 and remains blocked by `legacy_sample_ineligible` even if other release pieces exist.
- A serialized pre-r2 release fixture with no saved policy fingerprint or provenance remains readable, retains those absent fields after read projection, receives `pack_policy_stale`/`pack_provenance_unknown`, fails the exact approved-export gate, and can create a separate current-policy version only through explicit revalidation.
- Table-driven Pack validation rejects removed/unknown references and novel URLs, prices, percentages and numeric claims. Matching approved-source values pass. This is deterministic claim syntax/reference evidence, not proof of all qualitative semantics.
- A Pack quote and intent bind the quote/intent/job/Pack IDs, canonical input hash, lineage/revision, settings fingerprint, policy fingerprint and provenance. Old-policy and changed-provenance quotes are stale. A forced retry that crosses quote expiry retains the prepared confirmation decision; confirmation after expiry fails. Reconfirmation is idempotent; a simultaneous second intent is rejected. Pre-call and saved-draft checkpoints resume the same intent, while an ambiguous result refuses reuse.
- Forced compare-and-swap retries reuse the exact prepared Pack intent, Pack version, media version, approval and Reopen/supersession payloads without duplicates. An injected persistence conflict after a provider result leaves the provider-call count at one.
- Pack edit creates a version, stale edit is rejected, restore creates another version, and history is preserved. The shared mutation guard rejects restore during both queued and running Pack jobs without changing version history.
- The real MP4 passes byte probing. Deterministic tests accept an 8-second video and a long positive-duration video, while rejecting unreadable/non-positive duration metadata, spoofed headers, corrupt input, wrong container, video codec, audio codec, dimensions and size. Oversized `Content-Length` is rejected before streaming; an aborted stream removes its temporary directory.
- Probe stdout/stderr bounds, timeout, unavailable status, one-settlement behavior and concurrency cap are asserted with injected child-process fakes.
- Media activation requires both release revision and the exact active-media token. A stale token fails before probing. Two concurrent uploads using the same tokens produce one activation and one conflict; the losing request removes only its new object/metadata. Previous accepted media remains in history.
- User B receives non-enumerating failures for User A’s exact run inspection, Pack edit/restore, media preview/download/replacement, approval, approved export and approved-video paths.
- Each implemented hard-readiness condition is asserted independently: missing Storyboard, missing/invalid/stale/old-policy Pack, legacy Pack, missing/invalid/stale media and missing destinations. Stale request-version conflicts are asserted separately at mutation boundaries.
- `release/review` persists Pack → Approve, approval persists Approve → done, restart restores the exact approval/media history, Reopen atomically supersedes and returns to Approve, and the stale-safe edit action returns Approve → Pack.
- Approval is repeat-idempotent and binds policy, provenance, epoch, lineage, exact Pack/media/hash and canonical destinations. Tampering changes the readiness fingerprint. Export is unavailable before approval or cross-owner, and the ZIP response asserts `X-Content-Type-Options: nosniff`.
- Frontend tests assert explicit Save, inspectable history/restore, dirty-draft warning, stale-save conflict with draft preservation, remount from refreshed server state, unsaved-destination approval blocking, explicit Reopen confirmation, upload progress/error, media warnings, protected video source cleanup and authenticated MP4 download behavior.

The approved ZIP contains human-readable platform copy, exact Pack JSON, validation summary and approval manifest. The exact MP4 is a separate authenticated download, as stated in that manifest.

## Evidence not run

- Browser acceptance: **Not run.** The computer-use inventory exposed no controllable browser surface (`browsers: []`). Component tests are reported separately and are not substituted as browser evidence. Laptop/390 px layout, native playback, downloaded ZIP inspection and console checks therefore remain unverified in a real browser.
- Database/RLS/Storage policy tests: **Not run.** No real local Supabase engine was used. Existing pgTAP/migration files were not represented by mocks as policy evidence.
- Remote Supabase verification: **not run.** No remote project was created, migrated or modified.
- Real Gemini calls: **not run.** TEST_MODE and injected fakes made no provider call.
- Platform OAuth/publication: **not run.** Build 5C was not started.
- Deployment: **not run.** Session 11.2 was not started.
