import { createHash, randomUUID } from "node:crypto";
import type {
  ApprovalSupersession,
  PackInputReferences,
  PackVersion,
  ReleaseApproval,
  ReleaseDestination,
  ReleasePackContent,
  ReleaseProvenance,
  ReleaseState,
  Run,
  ValidationIssue,
} from "../../frontend/lib/types.js";

export const RELEASE_POLICY_VERSION = "step5b-2026-10-01-r2";
const POLICY_RULES = {
  youtube: { titleCharacters: 100, descriptionBytes: 5000, tagsCharacters: 500 },
  instagramClassroom: { captionCharacters: 2200, hashtags: 30 },
  linkedinClassroom: { commentaryCharacters: 3000 },
  claims: "approved-brief-script-retained-facts-v1",
  legacyEligible: false,
};

export function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object")
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonicalize(item)]));
  return value;
}
export function canonicalJson(value: unknown) { return JSON.stringify(canonicalize(value)); }
export function fingerprint(value: unknown) { return createHash("sha256").update(canonicalJson(value)).digest("hex"); }
export const RELEASE_POLICY_FINGERPRINT = fingerprint({ version: RELEASE_POLICY_VERSION, rules: POLICY_RULES });
const issue = (code: string, message: string, nextAction?: string): ValidationIssue => ({ code, message, nextAction });
const timestamp = () => new Date().toISOString();

function selectedReleaseInputs(run: Run) {
  const generation = run.generation;
  const direction = run.directions.find((item) => item.id === run.selectedDirectionId);
  const prompt = generation?.prompts.find((item) => item.id === generation.activePromptId);
  const key = generation?.keys.find((item) => item.id === generation.approvedKeyId);
  if (!generation?.boardApprovedAt || !run.storyApproval || !run.script || !direction || !prompt || !key || !generation.board.length) return;
  const beatById = new Map(run.script.beats.map((beat) => [beat.id, beat]));
  const facts = new Map(run.facts.map((fact) => [fact.id, fact]));
  for (const beat of run.script.beats)
    for (const factId of beat.factIds ?? []) {
      const fact = facts.get(factId);
      if (!fact || fact.removed) throw new Error(`Approved script references removed or unknown fact ${factId}.`);
    }
  const board = [...generation.board].sort((a, b) => a.order - b.order).map((frame) => {
    for (const beatId of frame.beatIds) if (!beatById.has(beatId)) throw new Error(`Storyboard references unknown beat ${beatId}.`);
    const attempt = frame.attempts.find((item) => item.id === frame.selectedAttemptId);
    if (!attempt) throw new Error(`Storyboard frame ${frame.id} has no selected attempt.`);
    return { frame, attempt };
  });
  return { generation, direction, prompt, key, board };
}

function stableReview(review: unknown) {
  if (!review || typeof review !== "object") return review;
  const value = review as Record<string, unknown>;
  return { ...value, mode: value.mode ?? "unknown" };
}

export function retainedPackFacts(run: Run) {
  return run.facts.filter((fact) => !fact.removed).sort((a, b) => a.id.localeCompare(b.id));
}

export function packGenerationInputs(run: Run) {
  const script = run.script ? { ...run.script, mode: run.script.mode ?? "unknown", beats: run.script.beats.map((beat) => ({ ...beat, factIds: [...(beat.factIds ?? [])].sort() })) } : null;
  const selectedPrompt = run.generation?.prompts.find((item) => item.id === run.generation?.activePromptId);
  const prompt = selectedPrompt ? { ...selectedPrompt, mode: selectedPrompt.mode ?? "unknown", review: stableReview(selectedPrompt.review) } : undefined;
  return { brief: run.effective, audience: run.brief.audience, script, direction: run.directions.find((item) => item.id === run.selectedDirectionId), prompt, brandKit: run.brandKit, facts: retainedPackFacts(run) };
}

export function storyboardLineage(run: Run): string | undefined {
  const selected = selectedReleaseInputs(run); if (!selected) return;
  const { direction, prompt, key, board } = selected;
  const retainedFacts = retainedPackFacts(run);
  return fingerprint({
    packProviderInputs: packGenerationInputs(run),
    approvedBrief: { effective: run.effective, brief: { ...run.brief, sourceLinks: [...run.brief.sourceLinks].sort() }, revision: run.storyApproval!.briefRevision },
    approvedScript: { ...run.script, mode: run.script!.mode ?? "unknown", beats: run.script!.beats.map((beat) => ({ ...beat, factIds: [...(beat.factIds ?? [])].sort() })) },
    retainedFacts,
    selectedDirection: direction,
    activePrompt: { id: prompt.id, revision: prompt.revision, attempt: prompt.attempt, prompt: prompt.prompt, negativePrompt: prompt.negativePrompt, visualBible: prompt.visualBible, directionId: prompt.directionId, mode: prompt.mode ?? "unknown", review: stableReview(prompt.review) },
    approvedKey: { id: key.id, assetId: key.assetId, attempt: key.attempt, source: key.source, mode: key.mode ?? "unknown", stillPrompt: key.stillPrompt, note: key.note, observation: key.observation, intentAudit: key.intentAudit, review: stableReview(key.review) },
    storyboard: board.map(({ frame, attempt }) => ({ frameId: frame.id, order: frame.order, instruction: frame.instruction, beatIds: [...frame.beatIds], selectedAttempt: { id: attempt.id, assetId: attempt.assetId, attempt: attempt.attempt, source: attempt.source, mode: attempt.mode ?? "unknown", stillPrompt: attempt.stillPrompt, note: attempt.note, observation: attempt.observation, intentAudit: attempt.intentAudit, review: stableReview(attempt.review) } })),
  });
}

export function packInputReferences(run: Run): PackInputReferences {
  const selected = selectedReleaseInputs(run); if (!selected || !run.storyApproval || !run.script) throw new Error("Approve the current Storyboard first.");
  const retainedFactIds = retainedPackFacts(run).map((fact) => fact.id);
  const storyboard = selected.board.map(({ frame, attempt }) => ({ frameId: frame.id, order: frame.order, instruction: frame.instruction, beatIds: [...frame.beatIds], selectedAttemptId: attempt.id, assetId: attempt.assetId }));
  const refs = { briefRevision: run.storyApproval.briefRevision, scriptVersion: run.storyApproval.scriptVersion, directionId: selected.direction.id, promptId: selected.prompt.id, approvedKeyAttemptId: selected.key.id, approvedKeyAssetId: selected.key.assetId, retainedFactIds, beatIds: run.script.beats.map((beat) => beat.id), storyboard };
  return { ...refs, inputFingerprint: fingerprint(packGenerationInputs(run)) };
}

function approvedClaimCorpus(run: Run) {
  const retained = retainedPackFacts(run);
  return canonicalJson({ effective: run.effective, brief: run.brief, script: run.script, facts: retained.map((fact) => ({ id: fact.id, text: fact.text, supportedText: fact.supportedText })) });
}
function packText(content: ReleasePackContent) { return canonicalJson(content); }
const urls = (text: string) => [...text.matchAll(/https?:\/\/[^\s"'<>]+/gi)].map((match) => match[0].replace(/[),.;]+$/, "").toLowerCase());
const prices = (text: string) => [...text.matchAll(/(?:[$€£₹]\s?\d+(?:[.,]\d+)?|\b\d+(?:[.,]\d+)?\s?(?:usd|eur|gbp|inr)\b)/gi)].map((match) => match[0].toLowerCase().replace(/\s+/g, ""));
const percentages = (text: string) => [...text.matchAll(/\b\d+(?:[.,]\d+)?\s?(?:%|percent\b)/gi)].map((match) => match[0].toLowerCase().replace(/\s+/g, ""));
const numbers = (text: string) => [...text.matchAll(/\b\d+(?:[.,]\d+)?(?:\s?(?:million|billion|thousand|times?|users?|customers?|people|units?|kg|years?|days?|hours?|minutes?|seconds?))?\b/gi)].map((match) => match[0].toLowerCase().replace(/\s+/g, ""));
function novel(values: string[], allowed: string[]) { const set = new Set(allowed); return [...new Set(values.filter((value) => !set.has(value)))]; }

const cp = (value: string) => [...value].length;
const bytes = (value: string) => Buffer.byteLength(value, "utf8");
export function validatePack(content: ReleasePackContent, options: { run?: Run; checkedAt?: string } = {}) {
  const blockers: ValidationIssue[] = [], warnings: ValidationIssue[] = [];
  const required = (value: string, code: string, label: string) => { if (!value.trim()) blockers.push(issue(code, `${label} is required.`, `Add ${label.toLowerCase()}.`)); };
  required(content.finalPrompt, "final_prompt_missing", "Final video prompt"); required(content.negativePrompt, "negative_prompt_missing", "Negative prompt");
  const youtube = content.platforms.youtube_shorts;
  required(youtube.title, "youtube_title_missing", "YouTube title"); required(youtube.description, "youtube_description_missing", "YouTube description");
  if (cp(youtube.title) > 100 || /[<>]/.test(youtube.title)) blockers.push(issue("youtube_title_limit", "YouTube title must be at most 100 characters and cannot contain < or >."));
  if (bytes(youtube.description) > 5000 || /[<>]/.test(youtube.description)) blockers.push(issue("youtube_description_limit", "YouTube description must be at most 5,000 UTF-8 bytes and cannot contain < or >."));
  const tagLength = youtube.tags.reduce((total, tag, index) => total + cp(tag) + (tag.includes(" ") ? 2 : 0) + (index ? 1 : 0), 0);
  if (tagLength > 500) blockers.push(issue("youtube_tags_limit", "YouTube tags exceed the combined 500-character limit."));
  const instagram = content.platforms.instagram_reels;
  required(instagram.caption, "instagram_caption_missing", "Instagram caption");
  if (cp(instagram.caption) > 2200) blockers.push(issue("instagram_classroom_caption_limit", "Instagram caption exceeds the configured 2,200-character classroom limit."));
  if (instagram.hashtags.length > 30) blockers.push(issue("instagram_classroom_hashtag_limit", "Instagram hashtags exceed the configured 30-tag classroom limit."));
  const linkedin = content.platforms.linkedin;
  required(linkedin.commentary, "linkedin_commentary_missing", "LinkedIn commentary");
  if (cp(linkedin.commentary) > 3000) blockers.push(issue("linkedin_classroom_commentary_limit", "LinkedIn commentary exceeds the configured 3,000-character classroom limit."));
  if (!instagram.altText.trim()) warnings.push(issue("instagram_alt_missing", "Instagram alt text is empty.", "Add a concise visual description."));
  if (!youtube.accessibilityNotes.trim() || !linkedin.accessibilityNotes.trim()) warnings.push(issue("accessibility_notes_missing", "One or more accessibility notes are empty."));
  for (const [name, value] of Object.entries({ prompt: content.finalPrompt, negative: content.negativePrompt, youtube: youtube.description, instagram: instagram.caption, linkedin: linkedin.commentary }))
    if (/\0/.test(value) || value.length > 20000) blockers.push(issue("unsafe_field", `${name} contains unsupported content or is too long.`));
  if (options.run) {
    try { packInputReferences(options.run); } catch (error) { blockers.push(issue("input_reference_invalid", error instanceof Error ? error.message : String(error))); }
    const output = packText(content), allowed = approvedClaimCorpus(options.run);
    for (const [code, values, allowedValues, label] of [
      ["novel_url", urls(output), urls(allowed), "URL"],
      ["novel_price", prices(output), prices(allowed), "price"],
      ["novel_percentage", percentages(output), percentages(allowed), "percentage"],
      ["novel_numeric_claim", numbers(output), numbers(allowed), "numeric claim"],
    ] as const) for (const value of novel(values, allowedValues)) blockers.push(issue(code, `Pack contains a ${label} not present in the approved brief, script or retained facts: ${value}.`, "Remove it or revise the approved Story inputs first."));
  }
  return { valid: blockers.length === 0, policyVersion: RELEASE_POLICY_VERSION, blockers, warnings, checkedAt: options.checkedAt ?? timestamp() };
}

function emptyRelease(at: string): ReleaseState { return { schemaVersion: 1, revision: 0, approvalEpoch: 0, packVersions: [], mediaVersions: [], selectedDestinations: [], destinationRevision: 0, approvals: [], supersessions: [], packQuotes: [], packIntents: [], readiness: { valid: false, policyVersion: RELEASE_POLICY_VERSION, blockers: [], warnings: [], checkedAt: at, releaseRevision: 0, destinations: [] } }; }
function legacyPackId(run: Run) { const value = fingerprint({ runId: run.id, pack: run.pack }); return `${value.slice(0,8)}-${value.slice(8,12)}-4000-8000-${value.slice(12,24)}`; }
function legacyPackContent(run: Run): ReleasePackContent { const pack=run.pack!, caption=(platform:string)=>pack.captions.find((item)=>item.platform===platform)?.caption??""; return { finalPrompt:pack.finalPrompt,negativePrompt:pack.negativePrompt,thumbnailText:pack.thumbnailText,platforms:{youtube_shorts:{title:pack.title,description:caption("youtube_shorts"),tags:pack.hashtags,accessibilityNotes:"Review captions and audio description needs.",postingNotes:pack.postingNotes},instagram_reels:{caption:caption("instagram_reels"),hashtags:pack.hashtags,altText:"Review and add an accurate description of the finished video.",postingNotes:pack.postingNotes},linkedin:{title:pack.title,commentary:caption("linkedin"),hashtags:pack.hashtags,accessibilityNotes:"Review captions and audio description needs.",postingNotes:pack.postingNotes}}}; }
export function ensureRelease(run: Run): ReleaseState {
  if (run.release) { run.release.packIntents ??= []; return run.release; }
  const release=emptyRelease(run.updatedAt);
  if(run.pack){const content=legacyPackContent(run),lineage=storyboardLineage(run)??"legacy-unbound";const version:PackVersion={id:legacyPackId(run),version:0,origin:"legacy_sample",provenance:"legacy_sample",validationPolicyFingerprint:"legacy-sample",createdAt:run.updatedAt,createdBy:run.userId,changeSummary:"Read-only legacy sample Pack; generate a new Pack to approve",storyboardLineage:lineage,content,validation:validatePack(content,{checkedAt:run.updatedAt}),callIds:[]};release.packVersions.push(version);release.activePackVersionId=version.id;}
  run.release=release; calculateReadiness(run,run.updatedAt); return release;
}
export function releaseReadView(run:Run):Run{if(!run.release&&!run.pack)return run;const view=structuredClone(run);ensureRelease(view);if(view.release?.packVersions.some((pack)=>pack.origin==="legacy_sample")&&["approve","done"].includes(view.currentStage))view.currentStage="pack";return view;}
export function activePack(run:Run){const release=ensureRelease(run);return release.packVersions.find((version)=>version.id===release.activePackVersionId);}
export function activeMedia(run:Run){const release=ensureRelease(run);return release.mediaVersions.find((version)=>version.id===release.activeMediaVersionId);}
export function assertPackUserMutationIdle(run:Run){if(["queued","running"].includes(run.jobStatus))throw new Error("Wait for the active Pack job before editing or restoring a Pack version.");}

export interface PreparedSupersession { approvalId:string; at:string; reason:string; releaseRevision:number; }
export function prepareSupersession(run:Run,reason:string,at=timestamp()):PreparedSupersession|undefined{const release=ensureRelease(run);return release.activeApprovalId?{approvalId:release.activeApprovalId,at,reason,releaseRevision:release.revision+1}:undefined;}
export function applySupersession(run:Run,prepared?:PreparedSupersession){if(!prepared)return;const release=ensureRelease(run);if(release.activeApprovalId!==prepared.approvalId)throw new Error("Approval changed. Refresh first.");if(!release.supersessions.some((item)=>item.approvalId===prepared.approvalId&&item.at===prepared.at)){release.supersessions.push(prepared as ApprovalSupersession);release.approvalEpoch++;}delete release.activeApprovalId;}
export function supersedeApproval(run:Run,reason:string,prepared?:PreparedSupersession){applySupersession(run,prepared??prepareSupersession(run,reason,run.updatedAt));}
export function invalidateRelease(run:Run,reason:string){const release=ensureRelease(run);supersedeApproval(run,reason);release.revision++;calculateReadiness(run,run.updatedAt);}

export function calculateReadiness(run:Run,checkedAt=timestamp()){
  const release=ensureRelease(run),blockers:ValidationIssue[]=[],warnings:ValidationIssue[]=[];const lineage=storyboardLineage(run),pack=activePack(run),media=activeMedia(run);
  if(!lineage)blockers.push(issue("storyboard_missing","The current Storyboard is not approved.","Approve the current Storyboard."));
  if(!pack)blockers.push(issue("pack_missing","No active Pack version is available.","Generate a Pack."));else{blockers.push(...pack.validation.blockers);warnings.push(...pack.validation.warnings);if(pack.provenance==="legacy_sample")blockers.push(issue("legacy_sample_ineligible","This legacy/sample Pack cannot be approved.","Generate a new Pack from the approved Storyboard."));else if(pack.provenance!=="test"&&pack.provenance!=="live")blockers.push(issue("pack_provenance_unknown","This Pack predates saved TEST/LIVE provenance.","Save, restore or regenerate it under the current policy."));if(lineage&&pack.storyboardLineage!==lineage)blockers.push(issue("pack_stale","The Pack belongs to an older Storyboard.","Generate a new Pack."));if(pack.validationPolicyFingerprint!==RELEASE_POLICY_FINGERPRINT)blockers.push(issue("pack_policy_stale","The Pack was validated under an older or unknown policy.","Save, restore or generate a new Pack."));}
  if(!media)blockers.push(issue("media_missing","No validated finished video is available.","Upload the finished MP4."));else{blockers.push(...media.validation.blockers);warnings.push(...media.validation.warnings);if(lineage&&media.storyboardLineage!==lineage)blockers.push(issue("media_stale","The finished video belongs to an older Storyboard.","Upload the current finished video."));}
  if(!release.selectedDestinations.length)blockers.push(issue("destinations_missing","Choose at least one destination.","Select YouTube, Instagram or LinkedIn."));
  const result={valid:blockers.length===0,policyVersion:RELEASE_POLICY_VERSION,blockers,warnings,checkedAt,releaseRevision:release.revision,storyboardLineage:lineage,packVersionId:pack?.id,mediaVersionId:media?.id,destinations:[...release.selectedDestinations].sort() as ReleaseDestination[]};release.readiness=result;return result;
}

export function preparePackVersion(run:Run,content:ReleasePackContent,origin:PackVersion["origin"],summary:string,ownerId:string,options:{id?:string;createdAt?:string;version?:number;provenance?:ReleaseProvenance;callIds?:string[];storyboardLineage?:string}={}):PackVersion{
  const release=ensureRelease(run),createdAt=options.createdAt??timestamp(),lineage=options.storyboardLineage??storyboardLineage(run);if(!lineage)throw new Error("Approve the current Storyboard first.");
  const provenance=options.provenance??(run.mode==="live"?"live":"test");return{id:options.id??randomUUID(),version:options.version??(release.packVersions.filter((item)=>item.version>0).length+1),origin,provenance,validationPolicyFingerprint:RELEASE_POLICY_FINGERPRINT,createdAt,createdBy:ownerId,changeSummary:summary,storyboardLineage:lineage,inputReferences:packInputReferences(run),content:structuredClone(content),validation:validatePack(content,{run,checkedAt:createdAt}),callIds:[...(options.callIds??[])]};
}
export function applyPackVersion(run:Run,version:PackVersion,expectedRevision:number,expectedActivePackVersionId?:string,preparedSupersession?:PreparedSupersession){const release=ensureRelease(run);if(release.packVersions.some((item)=>item.id===version.id))return version;if(release.revision!==expectedRevision||(expectedActivePackVersionId!==undefined&&release.activePackVersionId!==expectedActivePackVersionId))throw new Error("The Pack changed. Refresh and apply the action again.");applySupersession(run,preparedSupersession);release.revision++;release.packVersions.push(structuredClone(version));release.activePackVersionId=version.id;run.currentStage="pack";run.jobStatus="needs_review";calculateReadiness(run,version.createdAt);return version;}

export function applyMediaVersion(run:Run,version:import("../../frontend/lib/types.js").FinalMediaVersion,expectedRevision:number,expectedActiveMediaVersionId:string|undefined,preparedSupersession?:PreparedSupersession){const release=ensureRelease(run);if(release.mediaVersions.some((item)=>item.id===version.id))return version;if(release.revision!==expectedRevision||release.activeMediaVersionId!==expectedActiveMediaVersionId||storyboardLineage(run)!==version.storyboardLineage)throw new Error("The release or active video changed during upload. Refresh and upload again.");const hadApproval=!!release.activeApprovalId;applySupersession(run,preparedSupersession);release.revision++;release.mediaVersions.push(structuredClone(version));release.activeMediaVersionId=version.id;run.currentStage=hadApproval?"approve":"pack";run.jobStatus="needs_review";calculateReadiness(run,version.createdAt);return version;}

export function readinessFingerprint(run:Run){const release=ensureRelease(run),pack=activePack(run),media=activeMedia(run),lineage=storyboardLineage(run),destinations=[...release.selectedDestinations].sort();if(!pack||!media||!lineage)return;return fingerprint({policyVersion:RELEASE_POLICY_VERSION,policyFingerprint:RELEASE_POLICY_FINGERPRINT,packProvenance:pack.provenance??"unknown",approvalEpoch:release.approvalEpoch,lineage,packVersionId:pack.id,mediaVersionId:media.id,mediaSha256:media.sha256,destinations});}
export function approvalMatchesActive(run:Run,approval:ReleaseApproval){const release=ensureRelease(run),pack=activePack(run),media=activeMedia(run),lineage=storyboardLineage(run);return !!pack&&!!media&&!!lineage&&pack.validationPolicyFingerprint===RELEASE_POLICY_FINGERPRINT&&approval.ownerId===run.userId&&approval.runId===run.id&&approval.approvalEpoch===release.approvalEpoch&&approval.storyboardLineage===lineage&&approval.packVersionId===pack.id&&approval.packProvenance===pack.provenance&&approval.policyFingerprint===RELEASE_POLICY_FINGERPRINT&&approval.mediaVersionId===media.id&&approval.mediaSha256===media.sha256&&canonicalJson([...approval.destinations].sort())===canonicalJson([...release.selectedDestinations].sort())&&approval.readinessFingerprint===readinessFingerprint(run);}
export function applyApproval(run:Run,approval:ReleaseApproval,expectedRevision:number,checkedAt:string){const release=ensureRelease(run);if(release.activeApprovalId===approval.id&&release.approvals.some((item)=>item.id===approval.id))return approval;const readiness=calculateReadiness(run,checkedAt);if(!readiness.valid||release.revision!==expectedRevision||readinessFingerprint(run)!==approval.readinessFingerprint)throw new Error("Release changed before approval. Refresh and review again.");if(!release.approvals.some((item)=>item.id===approval.id))release.approvals.push(structuredClone(approval));release.activeApprovalId=approval.id;run.currentStage="done";run.jobStatus="completed";return approval;}
export function applyReopen(run:Run,approvalId:string,expectedRevision:number,supersession:PreparedSupersession,checkedAt:string){const release=ensureRelease(run);if(release.supersessions.some((item)=>item.approvalId===approvalId&&item.at===supersession.at)){run.currentStage="approve";return;}if(release.revision!==expectedRevision||release.activeApprovalId!==approvalId)throw new Error("Approval changed. Refresh first.");applySupersession(run,supersession);release.revision++;run.currentStage="approve";run.jobStatus="needs_review";calculateReadiness(run,checkedAt);}
