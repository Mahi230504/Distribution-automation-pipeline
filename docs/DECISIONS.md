# DECISIONS — VPO Studio

A short log of decisions made for this project and why. New entries go at the bottom, newest last, with the date they were made or last confirmed.

---

**2026-09-24 — One repository with `/frontend` and `/backend`, deployed separately (Vercel + Render)**
Why: Vercel is best-in-class for hosting Next.js frontends; Render is a straightforward, affordable place to run a long-lived Node/Express server that can hold background jobs. Splitting the repo would add coordination overhead (versioning, cross-repo PRs) with no real benefit at this scale, so one repository, two deploy targets.

**2026-09-24 — Long jobs run on the backend; frontend polls; job state is always saved with the run**
Why: research and image generation take too long for a single request/response cycle, and can fail partway. Saving job state with the run (not just in server memory) means a backend restart never silently loses work — the run is marked "interrupted" and can be resumed. This also means the backend can run as multiple stateless copies, which matters as usage grows.

**2026-09-24 — Gemini via the official `@google/genai` SDK; model IDs are environment variables; prices and dates recorded here**
Why: Google frequently updates and retires Gemini models (see the model retirement note below), so hardcoding a model name in code would eventually break the app silently. Keeping model IDs as settings, and recording the exact IDs and prices with the date checked, means a future retirement can be handled by changing a setting, not by digging through code.

*Model IDs and prices checked 2026-09-24, from `ai.google.dev/gemini-api/docs/models` and `ai.google.dev/gemini-api/docs/pricing` (Google's official documentation):*

| Setting | Model chosen | Price (standard tier, ≤200k-token prompts) |
|---|---|---|
| `GEMINI_MODEL_MAIN` (research, scripts, directions, prompt writing) | `gemini-3.8-flash` | $0.75 / 1M input tokens, $3.75 / 1M output tokens (promotional pricing through 2026-12-31, per Google's pricing page) |
| `GEMINI_MODEL_SCORING` (quality scoring/review, cheap) | `gemini-3.5-flash-lite` | $0.30 / 1M input tokens, $2.50 / 1M output tokens |
| `GEMINI_MODEL_IMAGE` (key frame + storyboard) | `gemini-3.1-flash-image` ("Nano Banana 2") | ≈$0.045 per generated image at standard resolution (billed as $0.50/1M input tokens + $60/1M output tokens) |
| Google Search grounding (used only in the Story stage) | — | 5,000 free requests/month, shared across all Gemini 3.x models, then $14 per 1,000 requests |

*Why these specific models:* `gemini-3.8-flash` is the current flagship Flash-tier model — strong enough for research synthesis and creative writing, far cheaper than the Pro tier (`gemini-3.1-pro-preview`, at $2.00/$12.00 per 1M tokens), which this app doesn't need. `gemini-3.5-flash-lite` is the cheapest currently-supported Flash-Lite model with no announced shutdown date (its predecessor, `gemini-3.1-flash-lite`, is already scheduled to retire 2027-05-07 in favour of 3.5, per Google's deprecations page) — using the newer one now avoids an unnecessary migration later. `gemini-3.1-flash-image` is Google's current production-tier image model; the older `gemini-2.5-flash-image` ("Nano Banana") is being shut down 2026-10-02 — only 8 days after this decision was recorded — so it was never a candidate. A premium option, `gemini-3-pro-image` ("Nano Banana Pro", studio-quality, ≈$0.134/image), exists for higher-quality output; it isn't the default because it would roughly triple image cost, which dominates the cost of a run (see `docs/ARCHITECTURE.md` section 7), but it's worth revisiting for the key frame specifically once real output quality can be judged in step 4.

*Known upcoming retirements to watch (from Google's deprecations page, checked 2026-09-24):* `imagen-4.0-generate-001` and variants shut down 2026-08-17 (already past — not used here); `gemini-2.0-flash` and `gemini-2.0-flash-lite` shut down 2026-06-01 (already past — not used here); `gemini-3.1-flash-lite` shuts down 2027-05-07. None of the models chosen above have an announced shutdown date as of this check.

**2026-09-24 — Quality checks are automatic (scores + thresholds + capped retries), not manual review of AI output**
Why: the product's core promise is that "people decide only where their judgement matters or money is about to be spent." Making users review and grade every AI draft would defeat that promise and slow the flow down. Thresholds and retry caps are settings so they can be tuned without a code change as real output quality is observed.

**2026-09-24 — Every AI call is logged with model, token/image counts, and estimated cost; image generation always requires cost confirmation first**
Why: image generation is by far the most expensive part of a run (≈90% of total cost, see `docs/ARCHITECTURE.md` section 7), and this is a real product where uncontrolled spend is a real risk. Logging every call (rather than just totals) gives a full audit trail for debugging cost surprises later, and confirming cost before spending protects both the user and the business from surprise bills.

**2026-09-24 — Rate limits: capped concurrent Gemini calls; retry only on rate-limit errors, at most twice; all other errors surfaced immediately**
Why: retrying every kind of error automatically can mask real problems (a bad prompt, an invalid API key) behind a slow, confusing hang. Rate-limit errors are the one case where a short wait-and-retry is the correct, expected behaviour, because they're transient by nature.

**2026-09-24 — Research reuse: same user + topic within 24 hours reuses prior research unless a fresh run is explicitly requested**
Why: research (grounded fact-finding) is the one step users are likely to trigger repeatedly while iterating on a Brief, and re-researching an unchanged topic wastes both the grounding request allowance and money for no benefit to the user.

**2026-09-24 — Supabase from step 5; local JSON files behind one storage module until then**
Why: introducing Supabase (database + storage + auth) before there's any UI or backend logic to use it with would be premature — steps 2–4 need somewhere to persist runs for development and demos, but not yet a production-grade multi-user database. Isolating all persistence behind one storage module means the eventual switch to Supabase changes one file's internals, not every place a run is read or written.

**2026-09-24 — TEST_MODE on by default; frontend shows sample data with no backend configured**
Why: the people using and reviewing this app are non-technical, and much of the build (steps 2–4) happens before real AI spend should occur at all. TEST_MODE lets the entire flow be built, demoed, and tested end-to-end at zero cost and with predictable output, and a visible badge always makes it obvious that output isn't real.

**2026-09-24 — Secrets only in gitignored `.env` files; `.env.example` committed instead**
Why: standard practice to avoid ever committing a real API key to version control, where it could leak (e.g. if the repository is later made public, or shared).

**2026-09-24 — Never ask the non-technical user to run a Terminal command**
Why: stated directly by the project owner — the people using this app are not developers, so all setup, running, and troubleshooting must be done for them, with plain-English explanations.

---

## Decisions made independently (not directly specified), and the reasoning

- **Exact stage and job-status values** (`brief → story → direction → look → storyboard → pack → approve → done` for stage; `idle, queued, running, waiting_confirmation, needs_review, interrupted, failed, completed` for job status) — needed a concrete, finite list to build the data model and API around. Chosen to map one-to-one onto the flow's 7 steps plus the distinction between "paused for cost confirmation" and "paused for a human checkpoint," since those two pauses need different UI treatment.
- **Splitting frame quality dimensions (6) from prompt quality dimensions (5)** as separate settings rather than one shared scoring config — a video prompt (text) and a rendered frame (image) are different kinds of artifact being judged on different criteria, so they shouldn't share a single threshold/dimension-count setting.
- **`gemini-3.5-flash-lite` over `gemini-3.1-flash-lite` for the scoring model** — both are current and inexpensive, but 3.1 already has a scheduled retirement (2027-05-07) while 3.5 doesn't; picking the one with a longer runway avoids a foreseeable near-term migration.
- **Reserving `gemini-3-pro-image` as a possible key-frame-only upgrade rather than the default image model** — not asked for, but since the key frame sets the visual identity for every other frame in the run, it's the one image worth spending more on if quality testing in step 4 shows it's needed; storyboard frames (which follow the key frame's lead) are the better place to keep cost down.
- **API route list and naming** (section 3 of `ARCHITECTURE.md`) — the brief specified the flow's stages but not literal endpoint names; routes were named to mirror the stage names directly (`/story`, `/directions`, `/key-frame`, `/storyboard`, `/pack`, `/approve`) so the API surface stays self-explanatory as the team grows.


**2026-09-25 — Step 3: durable local jobs, honest evidence and explicit sample stages**

- Local JSON is single-process, enforced by a process lock. Saved state alone does not make workers safe to run concurrently. Step 5 must add shared job claims and a shared Gemini limiter before scaling out.
- Checkpoint research, review and script separately. Resume preserves completed work; interrupted provider calls have unknown usage and may need to be repeated. Log each attempt before contacting the provider.
- Use the official SDK generate-content API to match the requested `groundingMetadata` contract. Request JSON in prompt text, then validate it; do not silently retry parser errors or other non-429 errors.
- Grounding support passages are model-answer text, not source-page quotations. Fetch metadata-linked pages to obtain evidence; block private network addresses, cap redirects, time and response size. Unavailable evidence is unsupported, not automatically “stated.” Missing grounding fails safely with an uncited warning if no facts can be kept.
- Fact review is one cheaper-model call that returns a verdict for every fact. Only beats referencing a removed fact are rewritten. Explicit Save script avoids an autosave/approval race and retains prior versions.
- Cache keys include audience, notes, source links, mode and models as well as owner/topic; changed instructions must not receive stale research. Cache hits reuse research/review but still write a new script.
- Keep later stages working through explicit sample backend handlers at zero cost, with a SAMPLE label. Never substitute browser samples for API failures. Brand kit JSON persistence supports the existing form; accounts remain step 5.
- Use `NEXT_PUBLIC_API_URL`, correcting the earlier architecture variable name to match the frontend and user request. The user uses Antigravity; the key file is opened there, never requested in chat.
- Frontend builds use Next.js's supported webpack builder because the local Turbopack CSS helper encountered a process/port restriction. No UI library was added.

Text model rates reconfirmed 2026-09-25 against [Google pricing](https://ai.google.dev/gemini-api/docs/pricing): main `gemini-3.8-flash` $0.75/$3.75 per million input/output tokens through 2026-12-31; scoring `gemini-3.5-flash-lite` $0.30/$2.50. Main rates rise to $1.50/$7.50 on 2027-01-01, so update settings then. Image model remains the prior documented setting and is never called in step 3. Grounding estimates use $0.014 per reported search query, conservatively without deducting the account-wide allowance. The prior $0.007 Story estimate is superseded by measured call logs and the explicit three-call planning example in ARCHITECTURE.md.

References: [Google grounding guide](https://ai.google.dev/gemini-api/docs/google-search), official installed `@google/genai` type definitions (GenerateContentResponse, GroundingMetadata, HttpRetryOptions). No live generation was performed during implementation without user approval.

**2026-09-25 — Step 4: Direction through approved Storyboard only**

- Extend the existing job runner, gateway and storage interface. Keep Story logic intact. Pasted scripts now start with no placeholder directions; the user starts the real Direction job. Pack and Approve remain SAMPLE. An explicit Storyboard approval ends Session 10.3. Existing Step 3 runs at sample Direction/Look/Storyboard can start real Direction without redoing their approved Story.
- Snapshot the current local Brand kit when generating directions. Keep approved Story facts and script unchanged. Apply the knowledge in `docs/reference/prompting-playbook.md`; no Python or DSPy code is imported.
- Use a separate saved `generation` record on each run, so legacy sample score fields are never mistaken for real reviews. Every prompt and image attempt links to its call records. A changed direction clears active dependent work but preserves old attempts; changed/rejected Look archives the prior Storyboard.
- Score 0–100 with validated explanations; calculate overall as the weakest dimension. Defaults: prompt threshold 75 with two rewrites (three versions maximum); frame threshold 70 with one automatic replacement. Stop honestly at the limit. Manual replacements have a shared per-run limit of six, including Look changes.
- An image quote is a saved, one-use cost confirmation. Bind it to action, run revision, reference image, selected frame, note and current models/prices/limits. Expire it after 15 minutes. Consuming it and starting the job happen in one serialized storage update; repeated confirmation returns the existing run. Estimates include allowed automatic replacements and all three possible HTTP 429 request attempts. They are conservative allowances, not invoices.
- Live image recovery requires a fresh explicit quote, including when a provider result may have been lost. Saved images and reviews are still reused. Previous unknown charges remain unknown and are not hidden inside a new zero. Failed jobs never retry automatically except for the existing HTTP 429 policy.
- Keep each generated image and review as separate saved checkpoints. Send actual PNG bytes to image and review requests. Log content hashes (checksums that identify the bytes) to verify the reference wiring without exposing image payloads.
- Use Sharp, an image-decoding library, to verify PNG/JPEG/WebP content, reject animated images and images over 20 million pixels, remove metadata, and store PNG files under generated IDs. Default upload limit: 5 MB. No user filename becomes a server path. The same decoder/storage path handles provider images. Deterministic test PNGs are generated locally, not fetched from the web.
- Group excess script beats into ordered, contiguous frame groups; retain every beat ID, including the payoff. The approved key frame counts toward the six-frame default. No saved script is shortened. Generation text inputs are capped at 24,000 characters so oversized inputs fail before an unbudgeted call.

**Models and pricing reverified 2026-09-25, official Google Gemini API documentation**

| Role | Exact configured default | Standard paid estimate |
|---|---|---|
| Writing | `gemini-3.8-flash` | $0.75 input / $3.75 output per million tokens through 2026-12-31; $1.50 / $7.50 from 2027-01-01 |
| Prompt and multimodal frame review | `gemini-3.5-flash-lite` | $0.30 input / $2.50 output per million tokens |
| Images | `gemini-3.1-flash-image` | $0.50 input and $3 text/thinking output per million tokens, plus $0.067 per 1K image |

Sources: [official pricing](https://ai.google.dev/gemini-api/docs/pricing), [image model](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-image), [Generate Content image guide](https://ai.google.dev/gemini-api/docs/generate-content/image-generation), [review model input types](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite).

The image guide documents real reference-image input and both 9:16 and 16:9. The review model accepts image input. Use the existing official SDK `models.generateContent` path with inline image data and explicit `imageConfig` at 1K. The earlier $0.045 image planning rate described 0.5K and is superseded for Step 4. No premium-model fallback is implemented. Model availability for this particular key, image quality, consistency and live multimodal judgement still require an approved live test; documentation verification does not establish live performance.

**2026-09-25 — TEST_MODE fixtures must preserve the run topic and visibly distinguish generated artifacts**

Why: a deterministic fixture can validate workflow code while still giving a false product impression if it ignores the user's input or reuses one picture. Story research fixtures now derive their facts, grounding metadata, evidence and script language from the run's topic and audience. Image fixtures now derive their topic label, mapped scene, frame identity and visual variation from the current run. Every selected Storyboard frame must have a distinct stored asset. The image itself says it is simulated and made no Gemini call. These rules improve zero-cost testing without presenting fixtures as evidence of live research or image quality.

**2026-09-25 — Live research validation: prose grounding and Node 22 DNS compatibility**

The saved key passed model-access checks for all three configured models. Two JSON-constrained research requests returned relevant facts but no grounding metadata. A numbered-prose diagnostic returned grounding chunks and supports. Research now requests 5–8 numbered atomic statements, parses them without another model call, and retains JSON parsing for fixtures. Attribution tolerates markdown bold and terminal punctuation differences but never assigns a source based on topic similarity or model-written URLs. Uncited/unsupported results still fail closed.

Live source retrieval also exposed Node 22 requesting an array from the pinned DNS callback. Returning a single-address callback shape caused `ERR_INVALID_IP_ADDRESS`. The callback now supports both shapes using the validated address. Non-HTML/text responses are rejected so PDF bytes cannot masquerade as page evidence. Regression tests cover both DNS shapes and research parsing/attribution. No API key is committed or logged.

The first live full-prompt response also returned `visualBible` as an object instead of the required string. Non-search Direction and prompt-writing calls now send the JSON schema to Gemini as well as validating it locally. Research remains prose because grounding behaved differently under JSON constraints. Errors remain saved and explicit; no silent provider retry was added.

## 2026-09-26 — Corrective pass: content fidelity and visual review

The failed clothing run demonstrated a chain failure: a broad brief was interpreted as platform marketing research, the saved coffee kit contaminated the visual plan, and reviewers rewarded faithfulness to an already off-topic script. A high score did not establish relevance.

- A confirmed **effective brief** (the exact interpretation used for this run) separates subject, objective, audience, format, product details, visual preferences and factual constraints. New runs use no Brand kit unless explicitly selected. Demo presets, explicitly saved kits and older kits of unknown origin are labelled separately. A saved kit or an edited run-only copy is frozen at creation; fixing a run never overwrites the global kit. Broad clothing/shoe promotion briefs need product details before calls begin. Obvious clothing/coffee conflicts stop generation; the semantic AI checks cover other conflicts but remain fallible.
- Research uses this content interpretation, notes and supplied links. Platform statistics/specifications are rejected when the platform is not the requested subject. Source provenance, numbered grounded prose and the Node 22 DNS fix remain intact. Facts are optional support for a product campaign: accept up to eight useful claims, not a quota of unrelated statistics. With no retained evidence, a product-led creative script may still proceed with an explicit uncited warning and no unsupported factual narration.
- Script feedback runs as a saved job. Opening/selected-beat feedback preserves protected IDs, timing and untouched beats; whole-script feedback revises all beats. Save the draft before its independent factual/relevance review so Resume can reuse it. New claims or changed subjects require explicitly updating the brief and requesting research. Restore creates a new version; it does not roll the counter backwards.
- Story approval binds script version and brief revision. Reopen archives the script, evidence, feedback, Brand kit, directions and image work before clearing dependent active selections and approvals. Brief edits clear obsolete current research/script. Busy runs reject edits; stale version tokens and stale quotes are rejected. Old paid files and call logs remain intact.
- Prompt optimization uses one stable brief/script/direction/feedback input across attempts. The five scores use their minimum. Critical failures (wrong subject/objective, unrelated brand, unsupported claims) override a high score. Rewrites address recorded weaknesses, rescore the exact saved result, and stop at the configured cap or stalled minimum score. Prompt feedback produces a new reviewed version and invalidates image quotes/approvals.
- Every image has a saved dedicated still prompt. It includes product identity, visible beat, visual style/constraints and image reference, not the full narration/platform report. Editorial VO and intended overlays stay in the script. Review the actual key-frame pixels before human approval as well as every generated storyboard frame. A failed key cannot seed the storyboard. Do not use a failed generated key as the identity reference for its automatic repair.
- Optional product-photo upload supplies identity bytes to generation/review. Uploading a finished Look skips AI generation and retains human approval. Both use the existing byte validation and safe storage path.
- The confirmed image allowance now includes key-frame review and bounded automatic repairs as well as frame reviews and 429 retries. Costs remain estimates, not invoices. Provider retries, user feedback and quality-driven repairs are separate saved events.
- Persist simulation/live provenance on runs and artifacts. Infer legacy provenance from saved call records, never the server's current mode. Mixed/unknown legacy provenance stays unknown. A run cannot switch generation mode halfway through.

Useful principles adapted from the original Python optimizer: human-feedback revision, targeted repairs, concrete evidence in critiques, exact-version scoring, reference continuity, caps and stopping on stalled improvement. No DSPy/Python runtime, fixed palette transition, or rule elevating incorrect pixels above user intent was imported.

### Official model verification — 2026-09-26

Models retained; no silent substitutions:

| Role | Model | Standard paid USD price |
|---|---|---|
| Writing/research | `gemini-3.8-flash` | $0.75 input / $3.75 output per million tokens, including thinking; current promotional rates through 2026-12-31 |
| Text/image review | `gemini-3.5-flash-lite` | $0.30 input / $2.50 output per million tokens |
| Still images | `gemini-3.1-flash-image` | $0.50 input / $3 text/thinking output per million tokens; approximately $0.067 per 1K output image |
| Google Search | Grounding | $0.014 per reported search query, conservatively excluding the shared free allowance |

Sources: [Google pricing](https://ai.google.dev/gemini-api/docs/pricing), [image generation and editing](https://ai.google.dev/gemini-api/docs/image-generation), [review model capabilities](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite). The image guide supports reference-image input and both 9:16 and 16:9; Flash-Lite accepts image input and structured text output. These documentation checks establish supported capabilities, not the quality of this app's live output. Writing prices rise to $1.50/$7.50 on 2027-01-01 according to the checked page; update settings before then.


## 2026-09-26 — Authorized live validation and review limits

The owner authorized image generation without further permission questions. Existing backend quote confirmations were used on the owner's behalf; no global removal of cost gates was implemented. Five final frames and two targeted sleeve revisions stayed within the proposed $6.0816 image/review allowance. Observed total including text: $0.57671915. See `LIVE-VALIDATION.md` for the ledger and outputs.

The cheap reviewer gave high scores to two sleeve images that did not precisely satisfy the requested visible detail. Keep its real scores, preserve the images, and retain human Look/Storyboard judgment and focused feedback. Do not represent a high score as proof of exact visual fidelity. No model or threshold was silently changed to force acceptance.

## 2026-10-01 — Step 5A: durable identity and owner-scoped storage

- Keep AI mode separate from identity/storage mode. Runtime accepts only `local` + `local_json` or `supabase` + `supabase`. A broken Supabase configuration is a startup error, never permission to reveal local or sample data. The `test-user:` identity hook is guarded by `NODE_ENV=test` and is not a production option.
- Use email/password for the classroom-friendly first sign-in flow. The supported Supabase browser client persists and refreshes the session. The frontend waits for session restoration before mounting protected pages and adds the current access token to all real backend data/media requests.
- Verify normal bearer requests with `auth.getClaims()`. This verifies signature and expiry using the project's signing keys and avoids a Supabase Auth network call on every poll. It does not instantly consult server-side revocation state: a revoked, otherwise-valid access token can work until expiry. Keep access-token lifetime short enough for the project risk; use an online user check only for a future especially sensitive action, not every poll.
- Store full run state as JSONB behind the existing storage interface, plus indexed owner/stage/status/timestamps and an optimistic revision. This is safer for the already-validated Steps 3–4 than normalizing every nested revision, call, prompt and review now. Postgres revision compare-and-swap prevents silent lost updates. Provider calls occur before, and outside, retryable persistence mutations so a storage conflict cannot repeat a paid side effect.
- Use the server secret for backend/background work. Because that credential bypasses RLS, every adapter operation includes an explicit trusted owner predicate and parent-run ownership check. Saved jobs carry the verified owner after the request ends. RLS remains enabled as defence in depth and is tested independently when a real Supabase engine is available.
- Keep Postgres and Storage private behind Express. The snapshot audit found no auth tokens, secrets, raw provider responses or hidden system prompts, but snapshots do contain retrieved page evidence, user-visible prompts, revision history and AI-call/error metadata. Asset rows contain private object paths and hashes. Therefore `anon` and `authenticated` receive no production table grants; the browser does not read these tables directly. Storage is private and server-created objects are delivered only after an owner-scoped asset lookup.
- Preserve local data in place. The local adapter understands legacy run/image references without rewriting them. No automatic upload or importer is included. Pack, final-media approval, Telegram and platform publishing remain outside 5A.

Official documentation verified 2026-10-01:

- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [JSON Web Tokens and `getClaims()`](https://supabase.com/docs/guides/auth/jwts)
- [Postgres Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Storage access control](https://supabase.com/docs/guides/storage/security/access-control)
- [Storage object ownership](https://supabase.com/docs/guides/storage/security/ownership)
- [Supabase local development and migrations](https://supabase.com/docs/guides/local-development)
- [Supabase CLI database testing](https://supabase.com/docs/guides/local-development/testing/overview)
- Installed Next.js 16.3.6 documentation under `frontend/node_modules/next/dist/docs`: Client Components and the Next 16 `proxy` convention were checked. This app needs a client-side auth gate rather than server cookie proxying because its protected product reads are client API calls to Express; adding an unused proxy would widen scope.


## 2026-09-26 — Remove category assumptions; optimize evidence and verify visual intent

- Replace narrow clothing/coffee and platform keyword guards with a brief-relative assessment, factual relevance checks and exact-version reviews. Different audience interests alone are not a contradiction; sponsorship and mixed-subject content can be intentional. Keep domain-specific examples only in fixtures and UI examples.
- Use the configured writing model for semantic brief assessment and independent text visual-intent auditing. Live probes showed that the cheaper model could be overly restrictive about audience interests and could overlook a visible contradiction despite high scores. The cheap model still performs numerical scoring and multimodal review; there is no hidden model fallback or replacement.
- An independent pixel observer receives no target prompt, reducing suggestion from the desired answer. Its observations are compared with the intended state by a separate blocking audit. Persist that audit and veto a pass when it fails. This adds verification latency/cost intentionally; report that tradeoff rather than claiming all work became faster.
- Fetch up to three public source pages concurrently and share duplicate resolved evidence while preserving every attribution edge. The controlled benchmark and retained-evidence comparison measure this improvement without comparing unrelated live topics as if they were controlled experiments.
- Extend existing image estimates to include both cheap review calls and the writing-model audit. Current per-slot conservative allowance is $1.4466; old unused quotes become stale. Keep exact real scores, failed images and paid attempts as history.

Configured model IDs and official price sources remain those verified on 2026-09-26 above. The main model now has two additional text-only tasks; no new image model, external service, account integration or deployment was introduced. Detailed validation is in `GENERALIZATION-VALIDATION.md`.

### 2026-09-26 — Recover after an unsuccessful manual frame change

Live fine-grained image feedback exhausted its cap. Added a version-checked restore action for earlier passing frame attempts, without deleting failures or spending again. Final approval rejects unresolved visual failures; scores alone cannot authorize it. Live generalization evidence and all costs are in GENERALIZATION-VALIDATION.md.

## 2026-09-26 — Reduce user work, preserve automatic verification

The user found the explicit interpretation form and always-visible diagnostic panels exhausting. Removed repeated summary entry, confirmation checkbox and mandatory product-details field. A short topic is sufficient for a generic concept without invented claims. Optional fields and technical review details remain available through expandable sections. Essential conflicts still require clarification. The existing promotional default is disclosed; other objectives remain available in settings.

Keep independent visual checks after they caught real errors; do not remove them merely to claim faster AI generation. Instead eliminate overlapping polling and repeated provider model-metadata queries. Health cache: five-minute healthy TTL, ten-second unhealthy TTL, shared in-flight request, checkedAt timestamp. This trades at most five minutes of model-availability freshness for substantially less repeated provider traffic. No live AI output was regenerated for this UI pass.

## 2026-10-01 — Step 5B: immutable release candidates

- Pack output, final media, destinations and approvals are append-only versioned release state behind the owner-scoped run adapter. Legacy `run.pack` remains read-compatible and is not silently rewritten or approval-eligible.
- Storyboard lineage is a canonical SHA-256 over the exact approved brief and script, referenced retained facts, selected direction, active prompt, approved key content/asset reference, and ordered selected Storyboard instructions/attempt content. Object keys and non-semantic reference sets are canonicalized, while semantic beat/frame order is retained. Pack and media bind it; upstream content changes make them stale without deleting history.
- Pack generation persists one intent before scheduling. The intent binds the quote, job and future Pack-version IDs, lineage/release revision, model/settings fingerprint, validator-policy fingerprint and TEST/LIVE provenance. IDs, timestamps, version numbers and validation payloads are prepared outside retryable compare-and-swap closures. Storage conflicts retry persistence only. Pre-call and saved-draft checkpoints can resume the same intent; a provider call with an unknown result makes that intent terminal and requires a newly confirmed intent.
- Finished video is a private generalized asset. Server inspection uses `ffprobe`; the classroom profile is MP4/H.264, optional AAC, vertical 1080×1920 or 720×1280, 15–60 seconds and at most 100 MiB.
- Approval explicitly and idempotently binds exact versions, media SHA-256, canonical destinations, Pack provenance, policy fingerprint and approval epoch. A canonical readiness fingerprint is rechecked before approval, ZIP export and approved-video download. Supersession is a separate audit event. Reopen returns to final review; a separate stale-safe action returns an unapproved review to Pack editing. Export is a metadata/copy ZIP plus a separate authenticated MP4.
- YouTube metadata limits use current official documentation. Numeric Instagram and LinkedIn editorial limits are labelled classroom rules where current official pages did not expose a verifiable number. See `STEP5B-DESIGN.md`.

## 2026-10-02 — Step 5C: exact-approval publishing jobs

- Keep `PUBLISH_MODE` independent from Gemini `TEST_MODE`. Test publishing is the default; its adapter contains no HTTP/DNS operation and a network-deny test proves zero requests. Both provenances are bound and shown; a deliberately authorized future LIVE publication is not inferred from AI provenance.
- Store connections, OAuth state, targets and publication aggregates outside release snapshots. Store tokens and upload/session URLs only as versioned AES-256-GCM envelopes with fresh nonces and owner/provider/record AAD. The browser has no raw table grant.
- Prepare the complete canonical destination batch before scheduling. Per-target idempotency binds the exact approval, payload, target capability revision and YouTube privacy. Fenced claims and append-only checkpoints prevent an old worker from overwriting newer evidence.
- Treat upload acceptance, provider processing and external post creation as different evidence. Partial success is durable. Ambiguous final creation is `unknown` and is reconciled or inspected, never blindly repeated.
- Support YouTube resumable sessions, Meta's documented Facebook Login private-binary Reels flow and LinkedIn instructed ranges in the LIVE adapters. Keep provider-version inputs explicit and do not create a permanent public media URL as an Instagram workaround.
- Keep local JSON single-process and Supabase service-role queries explicitly owner-filtered. The additive migration, RPC CAS/state consumption and pgTAP policy tests are committed but not applied in this pass.

Official provider documentation and retrieval date are recorded in `STEP5C-DESIGN.md`.

### 2026-10-02 — Step 5C recovery correction

- Persist an explicit retry-safety class and allowed action on every destination job. A generic terminal-state Retry is unsafe: unknown outcomes reconcile, expired authorization reconnects the exact bound connection, and capability/configuration blockers require attention.
- Use claim fences at every provider effect and one claim-bound secret/public-checkpoint commit. Local mode journals the pair for crash recovery; Supabase uses an additive transaction RPC and owner/run/job registry. CAS retries reuse prepared IDs, times and events.
- Persist bounded poll/backoff timing and honor valid `Retry-After`. Approval supersession stops new external writes while permitting only read-only inspection needed to retain evidence for an already-created artifact.
- Treat injected transport tests as protocol-shape evidence only. They do not establish provider account eligibility, OAuth approval, upload success or external publication.

### 2026-10-02 — Step 5C live-provider completion

- Use Meta's official Facebook Login Page flow for private Reels bytes: discover Page-linked professional accounts, create a resumable container, upload only to the validated `rupload.facebook.com` URI, poll status, and issue `media_publish` once. Persist session evidence so recovery never guesses after an ambiguous final write.
- Resolve the LinkedIn member ID through `/v2/me` under `r_liteprofile`; never turn the OpenID Connect pairwise subject into a Person URN. Member publishing continues to use `w_member_social`. Organization discovery remains a separate future capability.
- Require an explicit supported Meta Graph API version in LIVE configuration. Provider fakes remain contract evidence. A real LIVE claim requires configured provider applications, real OAuth, observed private/disposable publications and provider-side evidence.

### 2026-10-02 — Explicit Storyboard review override

- Automated frame review remains visible and still drives automatic repair, but it is advisory at the final human Storyboard decision. A completed Storyboard with selected, reviewed attempts can be approved only through an explicit warning acknowledgement when any selected frame still fails intent, visible checks or critical review. The exact overridden frame IDs and failed evidence remain saved and enter the canonical Storyboard lineage. Missing frames, attempts or reviews cannot be overridden.

### 2026-10-02 — Live Pack structured-output recovery

- Supply Gemini with the complete Pack JSON Schema, including all three platform-specific objects and their required fields. A generic object schema can allow a successful but unusable provider response.
- If parsing still fails after a provider response, keep the original intent terminal and ambiguous. The recovery UI requires a fresh estimate and explicit confirmation for a new intent; it never replays the paid call whose result could not be reconciled.
