# Step 4 verification — 2026-09-25

Direction, Look and Storyboard were tested with TEST_MODE enabled, an empty Gemini key and isolated temporary runtime folders. No test wrote into the user's existing run files. Integration tests use port 4102; Step 3 tests retain port 4101. Browser tests temporarily used an isolated backend on port 4000, then restored the normal local backend in TEST_MODE.

The automated suite passed **22 tests, zero failures** (including nested checks). Frontend lint and production builds for both parts passed. Browser automation used Chromium at 1440×1000 and 390×844. It reported no page errors or horizontal overflow in Direction, Look or Storyboard. Detailed performed checks follow.

| # | Requested check | Performed result |
|---|---|---|
| 1 | Approved Story produces three directions | Passed: topic-aware Story fixtures kept five facts, then Direction saved exactly three distinct cards |
| 2 | Choice and note generate complete prompt | Passed: saved choice/note produced a full timed prompt and negative prompt; browser clicked this path |
| 3 | Five prompt scores saved and displayed | Passed: API asserts five dimensions; browser shows each score and explanation |
| 4 | Overall is weakest dimension | Passed: independent minimum assertion; model-supplied overall is ignored; malformed scores are rejected |
| 5 | Weak prompt improves and is rescored | Passed: deterministic weak fixture saved two versions, first failed and second passed |
| 6 | Persistent weak prompt stops honestly | Passed: three total versions at two-rewrite limit; none marked passed |
| 7 | Direct API cost-gate bypass | Passed: missing quote rejected with 400; fabricated quote rejected with 409; no image call started |
| 8 | Double-click confirmation | Passed: concurrent confirmations returned the same job; one image call; replay after completion created no second image |
| 9 | Key generation, regeneration, approval, persistence | Passed: two versions retained, previous marked replaced, current approval persists; browser refreshed Look |
| 10 | Upload makes no AI call | Passed: uploaded decoded PNG left call count unchanged; invalid bytes labelled PNG rejected |
| 11 | Actual reference reaches frame generation | Passed: gateway hashes of submitted inline bytes matched the stored approved PNG for every remaining frame; all selected TEST_MODE frame assets are distinct |
| 12 | Actual frame and key reach reviewer | Passed: both hashes matched the stored generated frame and key, in the expected order; six scores saved |
| 13 | Weak frame regenerates once | Passed: two attempts preserved; failed then passed, each with a review |
| 14 | Persistent weak frame stops | Passed: two attempts, real overall 48 retained, retry-limit flag true |
| 15 | Manual regeneration only changes selected frame | Passed: all other frame objects were deeply identical; browser also regenerated frame 2 |
| 16 | Manual limit enforced by backend | Passed: isolated test limit of three reached; another quote rejected, no new call |
| 17 | Excess beats preserve payoff | Passed: nine script beats mapped to six frames, every ID present exactly once and final payoff retained |
| 18 | Changed direction/key invalidates dependants | Passed: upload cleared Look approval and archived Storyboard; direction change cleared active key and saved a new prompt revision |
| 19 | Stop mid-Storyboard and Resume | Passed: killed after frame 2 completed and frame 3 image was saved. Restart reported interrupted. Resume preserved the entire completed frame and reused frame 3's image for review; neither image regenerated |
| 20 | Refresh preserves state | Passed: saved activity, attempts, scores and costs matched reread JSON; browser refreshed Look and approved Storyboard |
| 21 | Backend unreachable | Passed: browser reload while backend stopped showed connection error; no SAMPLE DATA fallback |
| 22 | Step 3 regression suite | Passed: facts/sources, selective rewrite, manual version, cache, interruption/resume, pasted script, CORS, gateway concurrency/429 policy, defensive parsing and missing grounding checks |
| 23 | Laptop and 390px phone | Passed: full click-through on laptop; all three stage views checked at 390px; no horizontal overflow or browser page errors |
| 24 | Lint and production builds | Passed: frontend lint; frontend webpack production build; backend TypeScript production build |

The pasted-script regression expectation was narrowly updated: it still skips research, preserves narration length and costs zero, but now starts with no placeholder directions. The real Step 4 Direction job creates those cards. No Story research or rewriting behaviour was rebuilt.

After a manual product check exposed coffee-specific Story content and near-identical image placeholders for unrelated topics, the TEST_MODE fixtures were corrected. A “Shoe brand” regression now requires topic-matched facts and script text with no coffee/brewing content. Key-frame and Storyboard fixtures now include the run topic, mapped visual instruction and frame identity, generate distinct saved PNG assets, and explicitly state that they are simulated fixtures with no Gemini image call. A fresh local Shoe-brand run produced five topic-matched facts, no coffee text and five unique selected image assets.

Additional checks: existing Step 3 runs at sample Look can generate real directions while keeping their approved script; a direction change invalidates an earlier image quote. Image cost arithmetic separates image output from text/thinking tokens; a recovery quote is single-use. These pure cost-calculation checks temporarily use live-rate arithmetic with an injected local response, **never a live client or network transport**. API integration and browser tests remain TEST_MODE throughout.

Screenshots were inspected from temporary output files for Direction, Look and Storyboard, including phone views. Generated test image files, runtime JSON and screenshots are not part of the commit.

## Not run and remaining limitations

**Live calls: not run.** The local key field is empty. No model-list request or paid generation was made. Official model capability and pricing documentation was verified separately in DECISIONS.md.

Live access for this account, actual visual quality, consistency with a photographic reference, provider refusals, and the review model's real visual judgement remain unverified. Deterministic local PNG fixtures validate wiring and recovery, not model quality. No deployment, Pack generation, real final Approve, social integration, authentication or database migration was tested or implemented in this step.

The original standalone frontend SAMPLE DATA path remains available when the API URL is unset. The main browser test used the configured backend; it did not treat a failed backend as permission to enter standalone mode.

## 2026-09-26 corrective pass

See `LIVE-VALIDATION.md` for failure reproduction, inspected original pixels, corrective regression coverage, browser observations and the separate pending live acceptance journey. Final corrective run: 39 automated tests passed, zero failed; frontend lint and both production builds passed. Browser click-through reached approved Storyboard with zero JavaScript errors and no 390px overflow. Repaired live generation is not run, pending confirmation. New regressions are in `backend/test/repair.test.ts`; generation tests also ensure a lower-scored relevant replacement wins over a polished wrong-subject frame. No runtime runs, secrets or generated test images are committed.
