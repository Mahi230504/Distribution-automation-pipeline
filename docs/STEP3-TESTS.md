# Step 3 verification — 2026-09-25

All functional tests ran with test fixtures; no paid Gemini call was made. The live-price arithmetic test injects an SDK-shaped response without network access.

- Backend production build succeeds. Tests exercise the full Story API plus rate-limit retries, the concurrency cap, malformed JSON, missing citations, private-address blocking and cost arithmetic.
- The isolated integration server writes into a temporary folder, not the user's runs. It is forcibly stopped after saving research. On restart the job is interrupted; Resume completes it without another research call.
- A topic run keeps five facts (four stated, one implied), drops one unsupported fact, resolves the fixture Google redirect and writes five linked beats. Its three AI calls total $0.
- Removing a fact changes only the linked beat. Other beats compare exactly equal. A hand-edited script survives reread and backend restart.
- A matching research request uses the saved facts and makes only the script call. Pasted narration skips research and counts VO words only.
- Browser click-through verifies topic creation, Story completion, removing a fact, explicit script saving, refresh persistence, the later-stage SAMPLE label and pasted-script length. No browser page errors were observed.
- A separate browser test stops the local backend: History shows the actual connection error and no SAMPLE DATA fallback. Restart exposes Resume on the interrupted run; clicking it completes Story.
- The Story page was inspected at 390px phone width: no horizontal overflow, and all controls remain visible.
- Frontend lint succeeds. Production build succeeds with the supported webpack builder. Turbopack failed on a local process/port restriction, including after escalation; this is recorded in DECISIONS.md.

Not exercised live: Gemini model permissions/availability for this account, real grounding coverage, publisher-page retrieval reliability or actual provider billing. The key file was opened in Antigravity with an empty key. A live Story run requires a key and the user's separate approval.
