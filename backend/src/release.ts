import { createHash, randomUUID } from "node:crypto";
import type { Run, ReleaseState, ReleasePackContent, ValidationIssue, PackVersion, FinalMediaVersion } from "../../frontend/lib/types.js";

export const RELEASE_POLICY_VERSION = "step5b-2026-10-01";
const now = () => new Date().toISOString();
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
function legacyPackId(run: Run) {
  const value = hash({ runId: run.id, pack: run.pack });
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-4000-8000-${value.slice(12, 24)}`;
}
function legacyPackContent(run: Run): ReleasePackContent {
  const pack = run.pack!;
  const caption = (platform: string) => pack.captions.find((item) => item.platform === platform)?.caption ?? "";
  return {
    finalPrompt: pack.finalPrompt,
    negativePrompt: pack.negativePrompt,
    thumbnailText: pack.thumbnailText,
    platforms: {
      youtube_shorts: { title: pack.title, description: caption("youtube_shorts"), tags: pack.hashtags, accessibilityNotes: "Review captions and audio description needs.", postingNotes: pack.postingNotes },
      instagram_reels: { caption: caption("instagram_reels"), hashtags: pack.hashtags, altText: "Review and add an accurate description of the finished video.", postingNotes: pack.postingNotes },
      linkedin: { title: pack.title, commentary: caption("linkedin"), hashtags: pack.hashtags, accessibilityNotes: "Review captions and audio description needs.", postingNotes: pack.postingNotes },
    },
  };
}
export function ensureRelease(run: Run): ReleaseState {
  if (run.release) return run.release;
  const release: ReleaseState = {
    schemaVersion: 1, revision: 0, approvalEpoch: 0, packVersions: [], mediaVersions: [],
    selectedDestinations: [], destinationRevision: 0, approvals: [], supersessions: [], packQuotes: [],
    readiness: { valid: false, policyVersion: RELEASE_POLICY_VERSION, blockers: [], warnings: [], checkedAt: now(), releaseRevision: 0, destinations: [] },
  };
  if (run.pack) {
    const content = legacyPackContent(run), lineage = storyboardLineage(run) ?? "legacy-unbound";
    const version: PackVersion = { id: legacyPackId(run), version: 1, origin: "legacy_sample", createdAt: run.updatedAt, createdBy: run.userId, changeSummary: "Read-compatible legacy Pack; not an exact approval", storyboardLineage: lineage, content, validation: validatePack(content), callIds: [] };
    release.packVersions.push(version);
    release.activePackVersionId = version.id;
  }
  run.release = release;
  calculateReadiness(run);
  return release;
}
export function releaseReadView(run: Run): Run {
  if (run.release || !run.pack) return run;
  const view = structuredClone(run);
  ensureRelease(view);
  if (["approve", "done"].includes(view.currentStage)) view.currentStage = "pack";
  return view;
}
export function storyboardLineage(run: Run): string | undefined {
  const g = run.generation;
  if (!g?.boardApprovedAt || !run.storyApproval || !g.activePromptId || !g.approvedKeyId || !g.board.length) return;
  return hash({ briefRevision: run.storyApproval.briefRevision, scriptVersion: run.storyApproval.scriptVersion,
    storyApprovedAt: run.storyApproval.at, directionId: run.selectedDirectionId, promptId: g.activePromptId,
    keyId: g.approvedKeyId, boardApprovedAt: g.boardApprovedAt,
    frames: g.board.map(f => ({ id: f.id, selectedAttemptId: f.selectedAttemptId,
      assetId: f.attempts.find(a => a.id === f.selectedAttemptId)?.assetId })) });
}
function issue(code: string, message: string, nextAction?: string): ValidationIssue { return { code, message, nextAction }; }
const cp = (s: string) => [...s].length;
const bytes = (s: string) => Buffer.byteLength(s, "utf8");
export function validatePack(content: ReleasePackContent) {
  const blockers: ValidationIssue[] = [], warnings: ValidationIssue[] = [];
  const required = (value: string, code: string, label: string) => { if (!value.trim()) blockers.push(issue(code, `${label} is required.`, `Add ${label.toLowerCase()}.`)); };
  required(content.finalPrompt, "final_prompt_missing", "Final video prompt");
  required(content.negativePrompt, "negative_prompt_missing", "Negative prompt");
  const y = content.platforms.youtube_shorts;
  required(y.title, "youtube_title_missing", "YouTube title"); required(y.description, "youtube_description_missing", "YouTube description");
  if (cp(y.title) > 100 || /[<>]/.test(y.title)) blockers.push(issue("youtube_title_limit", "YouTube title must be at most 100 characters and cannot contain < or >."));
  if (bytes(y.description) > 5000 || /[<>]/.test(y.description)) blockers.push(issue("youtube_description_limit", "YouTube description must be at most 5,000 UTF-8 bytes and cannot contain < or >."));
  const tagLength = y.tags.reduce((n, t, i) => n + cp(t) + (t.includes(" ") ? 2 : 0) + (i ? 1 : 0), 0);
  if (tagLength > 500) blockers.push(issue("youtube_tags_limit", "YouTube tags exceed the combined 500-character limit."));
  const i = content.platforms.instagram_reels;
  required(i.caption, "instagram_caption_missing", "Instagram caption");
  if (cp(i.caption) > 2200) blockers.push(issue("instagram_classroom_caption_limit", "Instagram caption exceeds the configured 2,200-character classroom limit."));
  if (i.hashtags.length > 30) blockers.push(issue("instagram_classroom_hashtag_limit", "Instagram hashtags exceed the configured 30-tag classroom limit."));
  const l = content.platforms.linkedin;
  required(l.commentary, "linkedin_commentary_missing", "LinkedIn commentary");
  if (cp(l.commentary) > 3000) blockers.push(issue("linkedin_classroom_commentary_limit", "LinkedIn commentary exceeds the configured 3,000-character classroom limit."));
  if (!i.altText.trim()) warnings.push(issue("instagram_alt_missing", "Instagram alt text is empty.", "Add a concise visual description."));
  if (!y.accessibilityNotes.trim() || !l.accessibilityNotes.trim()) warnings.push(issue("accessibility_notes_missing", "One or more accessibility notes are empty."));
  for (const [name, value] of Object.entries({ prompt: content.finalPrompt, negative: content.negativePrompt, youtube: y.description, instagram: i.caption, linkedin: l.commentary }))
    if (/\0/.test(value) || value.length > 20000) blockers.push(issue("unsafe_field", `${name} contains unsupported content or is too long.`));
  return { valid: blockers.length === 0, policyVersion: RELEASE_POLICY_VERSION, blockers, warnings, checkedAt: now() };
}
export function activePack(run: Run): PackVersion | undefined { const r = ensureRelease(run); return r.packVersions.find(v => v.id === r.activePackVersionId); }
export function activeMedia(run: Run): FinalMediaVersion | undefined { const r = ensureRelease(run); return r.mediaVersions.find(v => v.id === r.activeMediaVersionId); }
export function supersedeApproval(run: Run, reason: string) {
  const r = ensureRelease(run); if (!r.activeApprovalId) return;
  r.supersessions.push({ approvalId: r.activeApprovalId, at: now(), reason, releaseRevision: r.revision + 1 }); delete r.activeApprovalId; r.approvalEpoch++;
}
export function invalidateRelease(run: Run, reason: string) { const r = ensureRelease(run); supersedeApproval(run, reason); r.revision++; r.readiness = calculateReadiness(run); }
export function calculateReadiness(run: Run) {
  const release = ensureRelease(run), blockers: ValidationIssue[] = [], warnings: ValidationIssue[] = [];
  const lineage = storyboardLineage(run), pack = activePack(run), media = activeMedia(run);
  if (!lineage) blockers.push(issue("storyboard_missing", "The current Storyboard is not approved.", "Approve the current Storyboard."));
  if (!pack) blockers.push(issue("pack_missing", "No active Pack version is available.", "Generate a Pack."));
  else { blockers.push(...pack.validation.blockers); warnings.push(...pack.validation.warnings); if (lineage && pack.storyboardLineage !== lineage) blockers.push(issue("pack_stale", "The Pack belongs to an older Storyboard.", "Generate a new Pack.")); }
  if (!media) blockers.push(issue("media_missing", "No validated finished video is available.", "Upload the finished MP4."));
  else { blockers.push(...media.validation.blockers); warnings.push(...media.validation.warnings); if (lineage && media.storyboardLineage !== lineage) blockers.push(issue("media_stale", "The finished video belongs to an older Storyboard.", "Upload the current finished video.")); }
  if (!release.selectedDestinations.length) blockers.push(issue("destinations_missing", "Choose at least one destination.", "Select YouTube, Instagram or LinkedIn."));
  const result = { valid: blockers.length === 0, policyVersion: RELEASE_POLICY_VERSION, blockers, warnings, checkedAt: now(), releaseRevision: release.revision, storyboardLineage: lineage, packVersionId: pack?.id, mediaVersionId: media?.id, destinations: [...release.selectedDestinations] };
  release.readiness = result; return result;
}
export function appendPack(run: Run, content: ReleasePackContent, origin: PackVersion["origin"], summary: string, ownerId: string, lineage: string, callIds: string[] = []) {
  const release = ensureRelease(run); supersedeApproval(run, `Pack ${origin}`); release.revision++;
  const version: PackVersion = { id: randomUUID(), version: release.packVersions.length + 1, origin, createdAt: now(), createdBy: ownerId, changeSummary: summary, storyboardLineage: lineage, content, validation: validatePack(content), callIds };
  release.packVersions.push(version); release.activePackVersionId = version.id; run.currentStage = "pack"; run.jobStatus = "needs_review"; calculateReadiness(run); return version;
}
export function fingerprint(value: unknown) { return hash(value); }
