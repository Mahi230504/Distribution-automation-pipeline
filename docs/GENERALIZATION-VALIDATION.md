# General-purpose local pipeline — 2026-09-26

Scope: Brief → Story → Direction → Look → approved Storyboard. This is a single-user local application, not the later public multi-user deployment.

## Changes and why

- Removed live clothing/shoe/coffee conflict rules and Instagram/analytics word bans. These words can be legitimate subjects, props, sponsors or comparisons. Publishing platform does not determine the content subject.
- All promotional/demonstration briefs need subject or offering details, regardless of industry. A saved semantic brief assessment checks essential ambiguity and actual contradictions using the writing model. Audience interests do not exclude other subjects. It is reused only for unchanged inputs/model/mode and shown in the interface with actionable clarification questions.
- Factual relevance is assessed against the full brief and objective alongside exact retrieved source evidence. Fictional storytelling and visual choices are distinguished from unsupported real-world assertions. Script feedback is evaluated in context instead of blocked by material/price keywords.
- Source pages load with bounded parallel requests (default three), retaining grounding chunk order and private-network protections. Repeated URLs share a request. Repeated resolved pages share evidence text, with all fact-to-source links retained. This removes duplication, not evidence.
- Still-image instructions select one visible moment, prioritize feedback and use only relevant continuity elements. Interfaces and functional labels are permitted when the actual subject needs them; editorial narration stays separate.
- Each newly generated image gets an independent pixel description without the target prompt, a writing-model check for contradictions between that description and the required outcome, and the cheaper model's six-dimension image/reference review. Explicit visible checks and the independent intent check can veto acceptance without altering the model's real numerical scores. All calls, descriptions, checks and costs persist and resume reuses saved work.
- Automatic corrections include critical failures, unverified visual requirements and the user's note, not only low-scoring dimensions. A human-rejected key frame cannot seed a new generation.
- Image estimates include both cheaper review calls and the writing-model intent check, automatic replacements and provider retries. Changed review pricing invalidates unused old quotes. Existing paid outputs and real scores remain unchanged as history.

## Acceptance criteria

No domain-specific blocking or forced visual style; relevant supported facts; editable/versioned script; targeted feedback preserves other beats; exact prompt review; visibly correct and distinct frames; actual reference bytes; honest failures and capped repairs; selected-frame-only changes; saved approvals after refresh/restart; usable laptop/390px interface. Finite tests do not establish equal quality across every possible topic.

## Live case selection

Randomly selected with the operating system's random-number generator from pottery, balcony herb gardening, bicycle repair and night-sky observation. Selected index 1: **balcony herb gardening**, an educational explanation for first-time apartment gardeners, with no Brand kit. Four requested moments: drainage, planting, watering and moisture checks. No clothing preset or manually substituted sample output.

Live run: `6d3c6328-c418-42f9-8aeb-7ad3beae01d6`.

## Real failures observed during the pass

The first key image had soil spillage and a stone blocking the drainage hole, contradicting the intended empty pot. The numerical reviewer initially passed it. An independent pixel description correctly noticed the obstruction, but the numerical reviewer still overlooked the contradiction. This motivated the separate blocking intent check. The image was rejected and preserved; its cost remains included.

Early brief probes also over-rejected unrelated audience interests. A gardening audience can legitimately learn coffee brewing or software; that is not a contradiction. The revised brief policy only blocks essential ambiguity and explicit incompatible requirements, and uses the writing model for this semantic decision. Numerical prompt/image scores continue to use the cheaper reviewer.

## Completed verification

- Backend suite: **50 tests passed, 0 failed**, including existing Story and Step 4 regressions. Isolated TEST_MODE data; no paid calls from tests. Includes unrelated educational, promotional, demonstration and fictional briefs, legitimate coffee and analytics subjects, mixed sponsorship, unsupported claims, concurrent edits, stale approvals/quotes, cost-gate bypass, duplicate submissions, retry limits, actual image/reference hashes, selected-frame changes, interruption/Resume and simulated provenance after mode changes.
- Frontend lint and both production builds passed. The first frontend build encountered a transient JSON read error in a Next.js dependency; the file was valid and the unchanged build passed on retry. No dependency patch or installation was needed.
- Browser: live creation through the New run form, Story feedback/diff, Direction, Look, Storyboard, saved-frame restore and approval. Laptop 1365×900 and phone 390×844: no page JavaScript errors; document width 390px on phone. Refreshed approval and restarted backend: saved run was byte-for-byte equivalent when read back through the API.
- Four other objectives complete to approved boards under controlled fixtures. Live semantic probes accepted coffee education, an analytics-interface tutorial and explicitly sponsored pottery; correctly rejected a pottery-only brief whose chosen kit required unrelated coffee activity. These are supporting checks, not four additional complete live image runs.

## Observed live outcome

Research kept **6 relevant facts**, dropping **2** lacking usable page evidence. Grounded sources included university gardening guidance. The platform did not become the subject. Targeted script feedback changed the opening beats; remaining beats stayed unchanged. Script v2 and brief v1 were approved before generating three directions and reviewing the selected prompt.

The final four distinct images show an open pot drainage hole, planting an exposed basil root ball, watering the soil, and checking soil. Actual PNGs were inspected, and all four selected images have different SHA-256 content hashes. Recurring terracotta pot, basil, green watering can and balcony setting remain recognizable, with some normal generated prop variation.

The initial watering image directed water towards leaves. Its numerical reviewer gave 100, but the independent intent check rejected it. One automatic replacement showed water reaching the soil and passed. A wider planting-frame request initially left the plant inside its nursery container; the blocking check caught this, and one replacement visibly showed exposed roots above the pot. Other frames were unchanged.

A precise top-down, single-finger moisture-check request **did not succeed within its two-image allowance**. Both versions remain visible as failed attempts. A direct final-approval request returned 409. The earlier passing moisture frame was restored through the browser with no AI call or additional charge; the board was then approved at `2026-09-26T05:58:52.907Z`. Restoring rejects stale selections and preserves later failed attempts. This is successful recovery, not a claim that the precise requested image was produced.

## Measured performance

| Measure | Before | After | Meaning |
|---|---:|---:|---|
| Controlled source I/O | 309ms | 114ms | 63% less waiting, identical output/order; not a whole-Gemini-run benchmark |
| Live fact-review evidence input | 157,932 characters | 94,326 characters | 40.27% smaller, all retained source text and citation edges preserved |
| Initial live Story job | — | 29.635 seconds | Observed run timing, not a universal service guarantee; later main-model preflight differs |

The independent observation and intent audit deliberately add calls and time to prevent false visual passes. We have not established faster total generation across all subjects or equal quality in all domains. No visual quality checks were removed for speed.

## Actual logged estimated costs

| Work | USD |
|---|---:|
| Story, assessment and feedback | 0.06863765 |
| Direction and prompt | 0.01593820 |
| Look, including rejected key | 0.14367500 |
| Storyboard, including automatic/manual replacements | 0.60603525 |
| Main run total (49 logged calls) | **0.83428610** |
| Separate pixel-review and semantic diagnostic probes | 0.01833970 |
| Entire generalization validation | **0.85262580** |

These are estimates from recorded usage and configured prices, not invoices. Failed visual attempts are included. No HTTP 429 provider retries occurred in the live case. The user authorized image generation; each action still went through the app's backend-confirmed quote gate. Actual spend stayed below the $6.08 session allowance. Current conservative allowance is $1.4466 per frame slot including two image attempts, observations, intent audits, reviews and rate-limit retry allowance; unused allowances are not charges.

## Open and inspect

- App: http://localhost:3000
- Completed run: http://localhost:3000/runs/6d3c6328-c418-42f9-8aeb-7ad3beae01d6
- Locally saved screenshots: `screenshots/generality/` (Story, Direction, Look, approved Storyboard, laptop and phone views; intentionally excluded from this code commit).
- Selected image assets: `7d3e710f-bc08-4737-baca-639ea15a3676`, `4cd6bc02-d1d8-4da2-b89f-ed70eec3575b`, `7a243ee2-80cf-4076-a4b7-6e1e7ec998ee`, `6094ff76-2e4c-41bb-b392-732fd95fab73`. Open locally at `http://localhost:4000/api/images/<asset-id>`.

Runs, versions, observations, reviews, costs and activity remain in local JSON through the storage module. Image bytes remain in its image directory. Paid outputs were preserved. Both servers were left running.

## Remaining limits

Ready for local single-user use through approved Storyboard. Image models can miss fine physical details, reviewers remain fallible, and precise feedback can exhaust its cap. Human Look and Storyboard approval remain necessary. Generality is supported by removed domain-specific production rules and varied tests; it is not a guarantee for every topic. Public production requirements—accounts, shared database/locks, durable hosted storage, operational monitoring and deployment—remain later steps. Pack and Approve remain SAMPLE. No finished videos or publishing were implemented.
