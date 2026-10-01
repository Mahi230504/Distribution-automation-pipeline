# Step 5B design — release candidates

Step 5B turns an approved Storyboard into an exact, durable release candidate. A release stores append-only Pack versions, explicit generation intents, accepted final-media versions, destination intent, readiness results, immutable approvals and separate supersession events inside the existing owner-scoped run snapshot. The active approval binds the current canonical Storyboard content lineage, Pack version and TEST/LIVE provenance, validation-policy fingerprint, approval epoch, media version and SHA-256, and sorted destinations. Build 5C may publish only that exact binding.

The course media profile is MP4/H.264, optional AAC, displayed 1080×1920 or 720×1280, 15–60 seconds and at most 100 MiB. This is a classroom/common-publishing profile, not every platform's maximum. `ffprobe` inspects temporary bytes; filename and browser MIME are not trusted.

YouTube title (100 characters), description (5,000 UTF-8 bytes) and combined tags (500 characters) come from official documentation. Instagram 2,200-character/30-hashtag and LinkedIn 3,000-character values are labelled classroom rules because accessible current official schema pages did not publish those numeric limits during the check.

Official pages checked 2026-10-01:

- https://developers.google.com/youtube/v3/docs/videos
- https://support.google.com/youtube/answer/12948449
- https://developers.facebook.com/docs/instagram-platform/content-publishing/
- https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api
- https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/little-text-format
- https://supabase.com/docs/guides/storage/uploads/resumable-uploads

A confirmed Pack intent is saved before provider contact and binds its quote ID, intent ID, job ID, preallocated Pack-version ID, canonical lineage, release revision, model/settings fingerprint, validator-policy fingerprint and TEST/LIVE provenance. Database conflicts rerun only prepared persistence mutations: they do not regenerate IDs/timestamps/versions or repeat the provider call. A restart before a call record can resume; a saved draft can finalize; a pending or successful call without a saved draft is ambiguous and is never replayed under the same intent.

Pack validation deterministically rejects removed/unknown fact references, unknown beat or selected-attempt references, and novel URLs, prices, percentages or numeric claims absent from the approved brief, script or retained facts. It does not claim to solve every qualitative semantic implication; a human must still review wording, while the listed hard syntactic/reference rules remain approval blockers. Legacy/sample Pack data is projected read-only as version 0 with `legacy_sample` provenance and can never become approval-eligible merely by adding media and destinations.

Media activation requires both release revision and the exact active-media version (including explicit `none`) before the body is accepted and again at commit. Uploads stream to exclusive private temporary files; `ffprobe` concurrency, runtime and output are bounded; all asset reads stream. A rejected or stale activation cleans up only the object created by that request.

The approved ZIP contains platform copy, exact Pack JSON, validation and approval manifest. The MP4 remains a separate authenticated download to avoid duplicating up to 100 MiB in the archive.
