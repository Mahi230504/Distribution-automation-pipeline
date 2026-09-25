# VPO Studio prompting playbook

Prepared 2026-09-25 for Step 4 / Session 10.3. This is project authoring and evaluation policy, not evidence that any provider guarantees the result.

## Provenance and boundaries

Adapted from the previous app at `/Users/mohan/Prompt-optimizer`: `video-generation-prompting-research.md`, `backend/app/guide.py`, and `backend/app/signatures.py`. Reuse their content principles, not the Python/DSPy implementation. The research dates from July 2026; model-specific capabilities, syntax, prompt-length claims and prices need fresh official verification before use. Do not treat its verification labels as current evidence.

Step 4 creates directions, a video prompt, a key frame and storyboard images. It does not render video, generate the final publishing Pack, publish, or deploy. Script narration and on-screen copy must remain saved even when omitted from image-generation instructions.

## Inputs and continuity

Use the approved script and its ordered beat IDs, brief, target video model, aspect ratio, intended duration, Brand kit and user feedback. Do not introduce new factual claims while developing visuals. Maintain a shared description of the subject, wardrobe, setting, palette and style. Carry supplied character descriptions verbatim where appropriate. If there is no character, describe the recurring product or visual subject rather than inventing a person.

Respect deliberate changes in the script. Do not impose the old demo's cold-blue-to-warm-gold palette transition. Resolve feedback that conflicts with locked brand constraints explicitly instead of silently changing the constraints.

## Direction and prompt authoring

1. Propose exactly three concise directions: name, hook, angle, visual look, mood and one-line summary. Differentiate the visual approach and narrative emphasis, not just adjectives. All must preserve the approved facts and script.
2. Only after selection, write the full video prompt for that direction, incorporating the optional note.
3. State the subject and action clearly; supply concrete setting, framing, shot size, angle, lighting, palette and atmosphere. Choose a simple, coherent camera instruction for each shot. Camera vocabulary is useful only when it communicates an intended effect.
4. Separate the constant visual description from timed changes. Cover opening, development and payoff in script order. Keep mappings to beat IDs.
5. Prefer descriptions of the desired image over long exclusion lists. Avoid vague filler such as “cinematic, high quality” without visible specifics. Do not enforce the old 150–250-word heuristic as a vendor limit or claim a universal element order.
6. Preserve one coherent whole-video prompt; internal beat blocks may make timing legible. A 15–60-second content plan is not a promise that a target model renders it in a single generation.
7. Check the exact target model's current official guidance before adding special audio, timestamp or negative-prompt syntax. For unknown targets use plain-language visual instructions without unsupported capability claims. Keep negative constraints separately; do not automatically send a negative-prompt field to models that do not support it.

## Five-dimension prompt rubric

Each score is in the app's documented score scale; translate the legacy 0–1 rubric consistently if the UI uses another scale. Require a reason grounded in the candidate text. The server computes overall as the minimum, never trusts a model-supplied average, and compares it to the configured threshold.

| Dimension | What the reviewer checks |
| --- | --- |
| clarity | Instructions are understandable, mutually compatible and suitable for the target. |
| specificity | Subject, action, setting, camera and lighting have useful concrete detail. |
| faithfulness | Approved script beats and intended emotional progression are covered in order without new claims. |
| consistency_intent | Recurring subjects and visual style are explicitly kept coherent. |
| constraint_compliance | Brief, brand constraints, aspect ratio and relevant generation limitations are respected. |

Use the cheaper scoring model to score the exact saved prompt. Use the main writing model for targeted repairs, then rescore the revised version. Preserve attempts, reasons and costs. Thresholds and rewrite caps come from settings. A exhausted retry budget is not a pass: show the retained result and its unmet threshold honestly without adding an intermediate manual scoring task.

## Key frame and storyboard

The key frame establishes the main subject and visual treatment. User approval locks that reference for the current storyboard. User-uploaded references replace key-frame generation at zero AI-call cost. Later AI generation and review are still chargeable in live mode.

Create one still-image instruction per planned beat: subject, observable action, setting, composition, lighting and palette. A still depicts a moment, not an entire camera movement. Do not ask an image reviewer to verify motion, spoken audio or exact video timing from pixels. Keep narration, captions, overlays and posting copy separate from image instructions unless explicitly required by the brief.

Send the actual approved reference image to the image model for remaining frames, not merely its filename or description. Preserve beat order and the full story arc within the configured frame cap (at most six total by default, key frame included). If a pasted script has too many beats, present an explicit storyboard mapping that groups beats without discarding the payoff or modifying the user's script.

## Six-dimension frame rubric

The cheaper reviewer must receive the actual frame, approved key frame, relevant beat, visual prompt and brand constraints. Require concrete visual evidence for scores. Compute overall on the server as the minimum.

| Dimension | What the reviewer checks |
| --- | --- |
| adherence | Frame depicts the intended subject, setting and action. |
| character_consistency | Recurring person or product identity matches the approved reference. For no recurring subject, document that fact rather than fabricate an identity comparison. |
| consistency | Style, setting and visual treatment match the reference and intended sequence. |
| palette | Frame matches the intended palette for this beat, including any explicitly planned change. |
| cleanliness | No unintended text, watermarks, unwanted branding or visible anatomical/object defects. |
| script_adherence | Frame communicates the corresponding approved beat and its intended emotion. |

Regenerate a below-threshold storyboard frame once automatically by default, using focused reviewer feedback; keep the cap configurable. Review the replacement too. Preserve a below-threshold result and explain that the retry limit was reached rather than marking it passed. Manual regeneration affects only the selected frame, incorporates the user's note and obeys the per-run limit and cost confirmation.

## Corrections to the legacy implementation

- Three short creative directions precede one full prompt; do not generate three expensive full candidates upfront.
- Separate writing from scoring and score the version actually shown.
- Use per-frame review against an approved reference, not a montage-only verdict.
- Quality thresholds and caps are settings, not the legacy hardcoded 0.75 or confidence ceiling.
- Human feedback guides the requested change but does not erase brand constraints or approved factual content.
- Do not unconditionally favour generated pixels over the approved brief: an incorrect render needs correction.
- No hardcoded provider IDs, obsolete pricing or claims that score improvement guarantees video quality.
