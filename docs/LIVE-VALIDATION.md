# Corrective validation — 2026-09-26

**Current status: repaired live clothing journey reached approved Storyboard on 2026-09-26. Total estimated live cost: $0.57671915. Actual images, script feedback, selective regeneration, browser refresh and backend restart were inspected. Automated review missed a sleeve detail; human inspection and two targeted revisions corrected it.** The older 2026-09-25 results below are historical and do not establish acceptance of the repaired image pipeline.

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

## Observed live acceptance — 2026-09-26

The owner authorized image generation without another permission question and requested incurred costs. The assistant confirmed the existing itemised quote gates on the owner's behalf. The product's server-side cost gates were not removed or bypassed.

Run: [`35dc3778-ec10-40f5-8b97-616b69351fa3`](http://localhost:3000/runs/35dc3778-ec10-40f5-8b97-616b69351fa3). Confirmed interpretation: a 30-second plain oversized T-shirt launch for young adults, Instagram 9:16 distribution, neutral studio styling, no Brand kit and no material, price, sustainability, availability or performance claims. The global coffee kit and historical runs were preserved.

Observed flow:

1. Grounded queries concerned oversized T-shirt styling, silhouette, proportions and neutral colours, not Instagram adoption or analytics. Eight facts were retained, zero dropped; research is cited.
2. The initial five-beat product-led script had 61 VO words. Opening-only feedback produced script v2 with 59 words (about 24 seconds at 2.5 words/second for a 30-second target). The opening became “Meet the oversized tee, designed with a boxy drape for everyday outfits.” All four remaining beats are exactly unchanged. The prior version, feedback and change summary are saved.
3. Story approval binds script v2 and brief v1. Exactly three clothing directions were generated. “Studio Silhouette Study” produced one full prompt, reviewed at 90/100 (the minimum of the five scores), with no critical failures. No prompt rewrite was required in this live run.
4. Generated key: model in a plain white oversized T-shirt and jeans in a neutral studio. Inspected actual PNG before approving Look. No coffee or analytics content.
5. Four remaining frames depict a neutral garment display, front-tuck styling, a sleeve/layering detail and the tailored-trouser payoff. Saved reference hashes confirm the actual key bytes accompanied all six subsequent image calls, including the two manual revisions. Each of their reviews received both actual frame and reference; the key review received the actual key image.
6. The reviewer scored the original sleeve frame highly even though the cuff was not visibly rolled. The first manual revision incorrectly combined the white cuff and overshirt. It also passed automated review. A second focused note separated the sleeve-roll moment from the later layering action; the resulting close-up visibly shows the rolled white T-shirt sleeve and bare forearm. All three attempts remain inspectable. This is a demonstrated reviewer limitation, not a fabricated automatic success.
7. Only frame 4 changed during both manual revisions. The other four frame records and image bytes are unchanged. All five selected PNGs have distinct content hashes, and their actual pixels were inspected; they form a coherent clothing sequence. The final sleeve still represents one moment within its multi-action video beat, rather than depicting both actions simultaneously.
8. Approved Storyboard in the browser, then refreshed. Laptop 1365px and phone 390px checks showed no browser JavaScript errors or horizontal overflow. Restarted the live backend after completion and confirmed identical script, selected images, attempts, calls, costs and completed state. Mid-job crash/Resume and downstream invalidation remain verified by isolated TEST_MODE regressions; they were not destructively repeated on this paid run.

### Actual ledger estimates

| Stage | Estimated USD |
|---|---:|
| Story, including opening revision and fidelity checks | $0.06784545 |
| Direction, prompt and prompt review | $0.01806590 |
| Look generation and review | $0.06982470 |
| Storyboard, including both manual sleeve revisions and their reviews | $0.42098310 |
| **Total** | **$0.57671915** |

23 provider calls; seven generated images; zero provider errors; zero rate-limit retries; zero unknown-usage entries. Two visually unsatisfactory sleeve versions are included in the total, despite their calls technically succeeding. The second sleeve revision cost $0.07032930; the first cost $0.07003120. There were no automatic image replacements in this live run. Automatic retry caps and failure behavior were exercised separately in fixtures.

The image/review quote allowances were $0.8688 for the key, $3.4752 for four remaining frames, and $0.8688 for each of two manual revisions: $6.0816 in total. This used five final frames plus two manual revisions instead of six final frames plus one revision, within the same previously proposed allowance. Actual image/review spend was $0.49080780; text work was $0.08591135. These are usage-based estimates, not a reconciled Google invoice. Models and prices are recorded with official sources in `DECISIONS.md`; no model substitution occurred.

### Inspectable outputs

- [Approved live run](http://localhost:3000/runs/35dc3778-ec10-40f5-8b97-616b69351fa3)
- [Key frame](http://localhost:4000/api/images/4978589e-cbea-4096-a811-5338d5029c42)
- [Neutral garment display](http://localhost:4000/api/images/fdaccfb8-a83d-4858-b165-b324ebfad51d)
- [Front tuck](http://localhost:4000/api/images/faa9cebb-eebe-49ad-bce3-c0990e8d4252)
- [Corrected sleeve detail](http://localhost:4000/api/images/66487f93-0385-484d-84be-bf00eb86ae68)
- [Tailored-trouser payoff](http://localhost:4000/api/images/c70cd75d-3aa9-4eef-ac85-19b851ed0d7a)
- Local screenshots: [laptop](../screenshots/live-repair/Storyboard-images-laptop.png), [phone](../screenshots/live-repair/Storyboard-images-phone.png), [full approved board](../screenshots/live-repair/Storyboard-laptop.png), [Look](../screenshots/live-repair/Look-laptop.png), [Direction](../screenshots/live-repair/Direction-laptop.png).

Runtime runs, images and screenshots stay local and are not committed. Prior automated result remains 39/39 passing, with frontend lint and both production builds passing. This follow-up changed documentation only, so those code checks were not rerun. New observations are live provider calls, actual-pixel inspection, byte/record comparisons, browser checks and completed-run restart persistence. Live wrong-subject rejection, automatic quality repair, retry exhaustion and interrupted paid-call recovery were not deliberately triggered; their coverage remains controlled fixtures.

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
