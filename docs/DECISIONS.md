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
