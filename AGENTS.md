# AGENTS.md — VPO Studio

This file is the map for anyone (human or AI assistant) picking up work on this project. Read it before making changes.

## 1. What this product is

**VPO Studio** turns a topic into a ready-to-publish short-video content pack. A marketer or product manager types in a topic, and the app:

1. researches it and writes a timestamped script,
2. develops a creative direction into a strong prompt for an AI video model,
3. previews that direction as a storyboard of AI-generated images,
4. and packages everything (video prompt, captions, hashtags, posting notes) ready to publish.

The guiding rule: **people decide only where their judgement matters or money is about to be spent**. Everywhere else, the app checks its own quality automatically (scoring, retries, thresholds) instead of asking the user to judge intermediate AI output.

"Short-video content pack" = a bundle of everything needed to publish a short video: the prompt used to generate it, captions for each platform, hashtags, and notes on how to post it.

## 2. The end-to-end flow

★ marks a step where a real person must look at something and decide.

1. **Brief** — topic, audience, platform, aspect ratio (9:16 vertical or 16:9 horizontal), duration (15–60 seconds), target AI video model (default: Veo 3.1, Google's video-generation model), optional source links or notes. The user explicitly chooses no Brand kit, the saved kit, or an edited run-specific copy. The confirmed interpretation and kit are frozen on the run. Alternatively, the user can paste their own script and skip straight to step 3.
2. **★ Story** — one AI job does two things in sequence: first it uses "grounding" (an AI feature that backs its answers with live Google Search results instead of guessing) to pull up to 8 useful, relevant facts about the confirmed content subject; then it writes a timestamped script using *only* those facts, broken into beats like `[0:00–0:05] VISUAL: … VO: … ON-SCREEN: …` ("VO" = voice-over, the narration track). Every source shown to the user comes from the search grounding data itself — never from a URL the AI might have typed into its own answer, since that could be a made-up link. Each fact is labelled "stated" (said directly by the source) or "implied" (inferred by the AI). A plain, non-AI check compares the script's word count against the chosen duration at a fixed speaking rate, to catch scripts that are too long or short to read aloud in time. The user sees facts and script together: unchecking a fact removes it and rewrites the script without it; the script text itself is editable.
3. **★ Direction** — the app proposes 3 short creative directions (each with a name, hook, angle, visual look, mood, and one-line summary). The user picks one, optionally adding a note (e.g. "make it more playful"). The app then writes the full text prompt that will drive the video model, scores that prompt itself across 5 quality dimensions (its overall score is the *lowest* of the five, so one weak dimension can't be hidden by strong ones), and automatically rewrites and rescores it until it clears a quality bar or hits a retry limit — both configurable. The final score is shown to the user for confidence, not for them to act on.
4. **★ Look** — after showing the estimated cost and getting the user's confirmation (image generation costs real money), the app renders one "key frame": a still image that sets the main character and visual style for the whole video. The user can approve it, ask for a change with a note, or skip generation entirely and upload their own reference image (free, since no AI call is made).
5. **Storyboard** — the app renders the remaining frames (up to 6 frames total, one per script beat), using the approved key frame as a visual reference so the character and style stay consistent. An automatic reviewer scores each frame across 6 quality dimensions; any frame scoring below the threshold is regenerated once automatically. The user can also manually regenerate any single frame with a note, as many times as they like (within a per-run setting).
6. **Pack** — automatically generated, and fully editable: the final video prompt and its "negative prompt" (a list of things to *avoid* in the generated video, which most video models support), a title, captions written for Instagram Reels, YouTube Shorts and LinkedIn, hashtags, on-screen thumbnail text, and notes on how/when to post.
7. **★ Approve** — the user gives final approval, then downloads everything as a zip file, copies individual pieces, or sends the pack to a Telegram chat.

**Brand kit**: saved once per user (brand name, colour palette, character description, tone of voice, constraints, preferred platforms) and automatically applied to every new run, so the user doesn't re-enter it each time.

**Autopilot** (designed now, built in step 7): a mode that runs the whole flow straight through using saved defaults, only stopping at cost-confirmation points and the final approval — for users who trust the defaults and want speed.

Every run is saved with whatever stage it has reached, listed on the user's **History** page, and can be reopened and continued at any time — nothing is lost if the user closes the tab.

## 3. Rules this project always follows

- **One repository**, two deployed parts: `/frontend` (Next.js App Router, TypeScript, Tailwind CSS) on Vercel, and `/backend` (Node.js, TypeScript, Express) on Render.
- **Long-running work happens on the backend.** The frontend asks "is it done yet?" every few seconds ("polling") rather than the backend pushing updates. Every job's progress is saved with its run — never held only in the server's memory — so if the backend restarts mid-job, the run is marked "interrupted" and the user can resume it rather than losing it. This supports restart and resume. Local JSON is limited to one process; multiple copies require shared database locks in step 5.
- **Gemini** (Google's AI model family) is called through Google's official `@google/genai` code library. Every model name is stored as an environment variable (a setting kept outside the code, so it can change without a code change), with separate variables for: the main model that writes facts/scripts/prompts, a cheaper model used only for scoring and reviewing, and the image-generation model. `docs/DECISIONS.md` records the exact model names and prices used, and the date they were checked, because AI providers frequently retire old models and change prices. The app's health check (a simple "is everything working?" endpoint) confirms the configured models still exist before the app is trusted to be healthy.
- **Quality checks are automatic, not manual.** Every AI output that matters is scored against a threshold, with a capped number of automatic retries — both the threshold and the cap are settings, not hardcoded. Users judge finished outcomes, not the AI's intermediate attempts.
- **Every AI call is logged**: which model, how many tokens (units of text an AI model is billed by) or images, and the estimated cost, using prices kept in settings. Each run shows its running total cost. Before any image is generated, the app shows the estimated cost and requires the user to confirm — image generation is the most expensive part of a run. Limits on frame count, retries, and manual regenerations per run are all settings, so they can be tuned without a code change.
- **Rate limits**: at most a set number of Gemini calls happen at the same time. If Gemini replies with a "rate limit" error (too many requests too fast), the app waits and retries, at most twice, showing the user what's happening. Any other kind of error is shown to the user in full and is never silently retried.
- **Research reuse**: if the same signed-in user researches the same topic again within 24 hours, the app reuses the earlier research instead of paying for it again — unless the user explicitly asks for a fresh run.
- **Data storage**: from step 5 onward, Supabase (a hosted service bundling a Postgres database, file storage, and user sign-in) holds everything. Until step 5, the backend saves runs as local JSON files, but always through one storage module — so switching to Supabase later only means rewriting that one module, not the rest of the app. Once Supabase is in place, every run and every Brand kit belongs to exactly one user; that ownership is always set by the server from the signed-in session (never trusted from what the browser sends); and every database query is filtered down to the signed-in user's own data.
- **TEST_MODE** is on by default. While on, every AI call instantly returns realistic sample output — including sample images — at zero cost, and the interface always shows a visible "TEST MODE" badge so nobody mistakes sample output for real results.
- **Secrets** (API keys, passwords) live only in `.env` files, which are excluded from Git (`.gitignore`) and only ever read by the backend server. The Gemini API key never reaches the browser and is never written to a log. Instead of committing real `.env` files, this repo commits `.env.example` files that show which variables are needed, with placeholder values.
- If the frontend has no backend address configured, it shows sample data with a visible "SAMPLE DATA" badge, so it always looks presentable even with nothing running behind it (useful for early demos, like step 2 of the build plan).
- **The people using this app are non-technical.** Anyone helping build or operate it should never ask them to run a Terminal command — run commands for them and explain what happened in plain English.

## 4. Folder layout

```
/                       — this file, docs/, .gitignore, root config
/frontend               — Next.js app (Vercel). Screens, components, polling logic.
/backend                — Express app (Render). API routes, AI calls, storage module, job runner.
/docs
  ARCHITECTURE.md       — system design, data model, API list, cost model, scaling, production checklist
  DECISIONS.md          — log of decisions and why they were made
```

Both `/frontend` and `/backend` now exist. Story, Direction, Look and Storyboard are implemented. Session 10.3 ends with an approved Storyboard. Pack and Approve remain explicitly labelled SAMPLE.

## 5. How to run and test each part

- `/frontend`: a standard Next.js app.
  - Install once: `npm install` (run from inside `/frontend`).
  - Run locally: `npm run dev`, then open `http://localhost:3000`.
  - Check for mistakes before shipping: `npm run lint` and `npm run build`.
  - With no `NEXT_PUBLIC_API_URL` set (the default — see `/frontend/.env.example`), every screen runs entirely on realistic sample data with a "SAMPLE DATA" badge, for a standalone demo. When configured, backend failures are shown and never replaced with samples. Nothing needs to be installed or running beyond the frontend itself.
- `/backend`: run `npm install`, `npm run dev` from that folder. Production: `npm run build`, then `npm start`. Tests: `npm run build` then `npm test` (uses isolated temporary data and port 4101).
- Step 4 tests add isolated temporary data on port 4102, image-reference checks and interruption recovery. See `docs/STEP4-TESTS.md`. Image files and all reviews/activity are saved through the existing storage module; local JSON remains single-process.
- Backend settings live in `backend/.env`; copy `.env.example` for a new checkout. `TEST_MODE=true` by default, key empty. Local frontend configuration: `NEXT_PUBLIC_API_URL=http://localhost:4000` in `frontend/.env.local`. Open `http://localhost:3000`.
- The assistant runs these commands; the user uses Antigravity, not VS Code. Open the key file there and never ask for the key in chat.
- Local JSON storage allows one backend process. Multiple copies require shared database job locks in step 5. Stopping a backend during a job leaves it resumable after restart.
- Frontend production builds use Next.js’s webpack builder because Turbopack’s CSS helper hits a local process/port restriction in this environment.

## 6. The 7-step build plan

| Step | What it delivers | Status |
|---|---|---|
| 1 | AGENTS.md and architecture docs | ✅ Done |
| 2 | Frontend with every screen on sample data, deployed to Vercel | 🟨 Frontend built and tested locally on sample data; not yet deployed to Vercel |
| 3 | Backend, test mode, cost tracking, and the Story stage | ✅ TEST_MODE tests pass; live research, source review, script, selective rewrite and saved edit validated; see docs/LIVE-VALIDATION.md |
| 4 | Direction, Look and Storyboard stages | ✅ Local corrective build and live clothing journey through approved Storyboard verified; reviewer limitations documented in docs/LIVE-VALIDATION.md |
| 5 | Pack and Approve stages, Supabase (database, storage, accounts, Brand kit), Telegram sending | ⬜ Not started |
| 6 | Backend deployed to Render, whole flow live end to end | ⬜ Not started |
| 7 | Hardening: Autopilot, per-user daily limits, a Usage page, error tracking, full error states, README | ⬜ Not started |

## 7. Working rules

- **Plan before building.** Before writing code for a step, restate what that step needs and check it against this file and `docs/ARCHITECTURE.md`.
- **Change only what the current step needs.** Don't build ahead (e.g. don't wire up Supabase during step 3) — the plan sequences work deliberately to keep each step reviewable and low-risk.
- **Test in TEST_MODE before spending on real AI calls.** Every new piece of AI-calling code must work correctly against sample output first.
- **Commit after each working step.** Small, working commits over large, uncertain ones.
- **Update the docs when a decision changes.** If a model, price, threshold, or architectural choice changes, update `docs/DECISIONS.md` (and `docs/ARCHITECTURE.md` if it affects the design) in the same commit as the code change — the docs must never fall out of date with reality.

## Corrective pass rules (2026-09-26)

- Content subject and objective are separate from publishing platform. Confirm “What we’re creating” before calls; broad clothing/shoe campaigns need product details. Never silently apply the coffee demo kit.
- Facts must be supported AND useful to the brief. Creative product moments need no invented citations or statistics. Grounding metadata remains the only source of source URLs.
- Script feedback and Restore preserve versions. Approval binds exact script and brief revisions. Reopen explicitly invalidates downstream work while retaining evidence, paid images and call history.
- Review prompt and actual pixels against the original brief as well as the script. Critical subject/claim failures override high scores. Review the key frame before allowing approval. Use dedicated still prompts and actual reference bytes.
- Stop optimization on stalled improvement or the configured retry cap. Confirm image allowances including reviews and automatic repairs. Keep provider retries separate from quality repair.
- Persist TEST/LIVE provenance. Switching server mode cannot convert simulated artifacts into live work.
- Repair regressions use isolated data on port 4103. Browser verification uses isolated TEST_MODE data on port 4104. See docs/LIVE-VALIDATION.md for observed TEST_MODE and live results; never infer live image quality from fixture scores.
