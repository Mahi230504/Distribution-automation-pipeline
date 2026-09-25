# Corrective validation — 2026-09-26

**Current status: implementation and TEST_MODE acceptance verified; repaired live clothing acceptance is pending product interpretation and paid-image confirmation. No new live generation occurred during this repair.** The older 2026-09-25 results below are historical and do not establish acceptance of the repaired image pipeline.

## Failure reproduced and actual images inspected

Run `71313397-4da2-4a3b-90b9-2b0f10f800b2` says “clothing brand”, with Instagram as the platform and an audience referring to Instagram/fast-fashion teenagers. Its saved kit was Northwind Coffee Co., with a barista character and dark/gold palette. All five retained facts concerned Instagram usage, sharing, purchasing or format. The 100-word script (~40 seconds for a 30-second target) became a platform-statistics explainer. Direction and the full prompt faithfully repeated that mistake. The prompt minimum was 90; frame reviews gave high scores for the wrong intent.

Inspected all five actual saved images. The key and subsequent frames show a black/gold phone, statistics (including 91% and 72%), interface/share cards and 9:16/1080×1920 labels. They are not a clothing-product campaign. The final payoff is another phone-format card. The renderer followed the wrong upstream visual plan; blaming the renderer alone would miss the cause. The key had not been independently reviewed before propagation. Historical search queries and exact image-request text were not persisted, so those parts were reconstructed from the code path, not represented as recovered provider logs.

The original run and all paid PNGs were preserved. Its saved ledger contains 15 calls, zero recorded failed calls, and **$0.4334426 estimated cost**. This is historical spend, not a charge from the corrective pass. Example original output: [wrong-subject key frame](http://localhost:4000/api/images/14005acb-e398-4e7e-8403-0b517947bf3d); [wrong-subject final frame](http://localhost:4000/api/images/9fe61df1-ada7-4409-9dcb-39f8ded607bf).

## What the repair changes

Explicit confirmed content interpretation and kit choice now precede generation. Evidence is checked for relevance as well as support. Creative product beats can omit factual narration. Script feedback, revision drafts, versions, change summaries and Restore persist. Approval binds exact brief/script revisions; Reopen archives evidence and paid assets while invalidating dependent work. Prompt repairs use stable inputs, exact-version review, critical failures and a stall stop. Dedicated still prompts keep VO/platform reports out of image requests. Generated key frames are reviewed against original intent before approval and propagation. Actual reference/frame bytes reach generation and review. Mode provenance survives a server-mode switch.

## Automated and browser observations

Final result: **39 tests passed, zero failed**. Tests use isolated runtime directories and TEST_MODE, with no Gemini network or paid calls. Covered: clothing/shoe relevance versus an explicitly requested Instagram explainer; ambiguous briefs; conflicting saved coffee kit; opening/full feedback and preserved beats; unsupported claims; restoration and restart; saved revision-draft Resume; stale approval and quote rejection; simultaneous revision rejection; prompt feedback; critical failures despite high style scores; actual reference and frame hashes at gateway boundaries; byte-distinct frames; selected-frame-only changes; direct cost-gate bypass and duplicate confirmation; retry caps; storyboard interruption/Resume; and simulated artifacts remaining simulated in LIVE mode. Review judgments in these fixtures are controlled test data, not evidence of a live model's visual judgment.

The final browser run was `6c8f3b35-36f0-4042-80e4-2fc358b2fe64`, saved only in isolated test data. It used the actual frontend and an isolated TEST_MODE backend. No browser JavaScript errors were reported. It reached approved Storyboard, including opening feedback, cost confirmations, selected-frame regeneration and refresh. Laptop viewport: 1365×900. Phone viewport: 390×844. The phone page has no horizontal overflow. A blocked backend connection displays a real error rather than sample fallback. Screenshots: [brief](../screenshots/repair/01-brief-laptop.png), [script changes](../screenshots/repair/03-script-feedback-laptop.png), [prompt and Look controls](../screenshots/repair/04-direction-and-prompt-laptop.png), [Look](../screenshots/repair/05-look-laptop.png), [approved Storyboard](../screenshots/repair/06-approved-storyboard-laptop.png), [phone Storyboard](../screenshots/repair/07-approved-storyboard-phone.png), [connection error](../screenshots/repair/09-connection-error-phone.png), [frozen brief at phone width](../screenshots/repair/10-frozen-brief-phone.png). Local screenshots are under `screenshots/repair/`; they show simulated output and are excluded from the source commit.

Frontend lint and both production builds pass. The live backend health check reports all three configured models accessible. This health check is non-generative; it does not prove output quality.

## Bounded live acceptance awaiting confirmation

Proposed interpretation: a 30-second plain oversized T-shirt launch for young adults, Instagram 9:16 distribution, neutral studio styling, no coffee kit and no material, price, sustainability or performance claims. Product choice must be confirmed before live generation.

Planned text calls: `gemini-3.8-flash` for one grounded research, script, opening revision, directions and up to three prompt attempts; `gemini-3.5-flash-lite` for fact review, revision fidelity, Story-approval fidelity and each retained prompt review. Each provider call keeps at most two 429 retries; other provider errors stop. Text usage/cost will be reported separately from image allowances.

Planned image actions: `gemini-3.1-flash-image` key frame, remaining frames (maximum six total), and one selected-frame change; `gemini-3.5-flash-lite` reviews each generated version. One automatic replacement per slot is allowed. Conservative combined image/review allowance: **$6.0816**, reserving up to 14 generated versions and 42 image-request attempts including 429 retries. Use the app's itemised, server-enforced quote confirmation for each action; do not bypass it. Inspect actual pixels before approving Look and Storyboard. Stop if quality or budget cannot be satisfied; no automatic expansion of scope or spend.

**Not yet performed:** the repaired live research → revised script → optimized prompt → clothing key frame → coherent distinct clothing storyboard → selected-frame feedback → approved Storyboard journey. New live generation cost for this corrective pass: none incurred. Live visual relevance, reference consistency and reviewer accuracy remain unverified. Paid outputs must not be claimed accepted based on fixture tests.

Remaining production limits: single local user/process and local JSON files; no accounts or user isolation for public access; no shared worker locks, deployment, backups or monitoring service. Provider reviews can be wrong. Basic conflict detection is deliberately narrow and not a general semantic guarantee. Source retrieval excludes unavailable/non-text evidence. Costs are estimates; interrupted responses may have unknown charges. Later-session infrastructure is still required before public use.

---

# Historical live validation — 2026-09-25

Scope: Story, Direction, Look and Storyboard only. No deployment or later-stage integration.

The owner entered the Gemini key locally. All three configured model-access checks passed. Backend `.env` is now live; the file remains ignored by Git and owner-readable only. Keys were not printed. Existing TEST_MODE runs remain saved simulations and must not be treated as live outputs.

## Observed live results

- Run `b5b3ce0d-e856-4a64-88f5-60912956941f`: everyday running shoes for beginner urban runners.
- Two JSON research attempts omitted grounding. A logged numbered-prose diagnostic returned grounding chunks/supports. Research now uses numbered atomic prose with deterministic parsing; JSON fixtures remain supported.
- Fixed a real Node 22 pinned-DNS callback shape error that prevented all source retrieval. HTML/text sources now load; blocked sites, unavailable pages and non-text formats remain excluded.
- Successful Story attempt: seven researched facts, four kept and three dropped for unavailable evidence; script generated. Logged estimated cost for that successful attempt: $0.0513627.
- Live fact removal changed only the affected beat. A manual visual edit persisted on reread and across subsequent backend restart.
- Three live shoe-specific directions generated. The saved global Brand kit is still Northwind Coffee Co.; explicit brief/direction notes excluded its irrelevant barista/coffee defaults for this validation.
- Fixed a live prompt response returning visualBible as an object. Direction and prompt calls now enforce their JSON schemas at the provider as well as locally.
- Saved full prompt passed at overall 85/100, calculated from the weakest of five dimensions; threshold 75.
- Cumulative ledger estimate through prompt review: $0.1871919, including failed attempts and the grounding diagnostic. This is an estimate from returned usage and configured prices, not a provider invoice.
- Key-frame quote prepared: $0.339 including rate-limit retry allowance. No image call has been made; owner cost confirmation is pending.

## Verification and limits

25 automated tests passed, including interruption/recovery in TEST_MODE and new prose-attribution/DNS regressions. Backend production build, frontend lint and frontend production build passed. The browser displayed LIVE and the saved run; the live image journey is still pending.

The original live script was 96 words, approximately 38 seconds for a 30-second target. The length warning worked; this is not a final campaign-ready script. Model review labels are automated judgments and do not replace editorial fact checking. Public multi-user production readiness still requires the later planned authentication, shared storage, deployment and operations work.

Not yet live-validated: image account quota/billing access, key-frame output, reference consistency, multimodal frame review, storyboard regeneration and live image recovery. Do not claim Step 4 live validation is complete until these have been observed.
