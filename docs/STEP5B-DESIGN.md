# Step 5B design — release candidates

Step 5B turns an approved Storyboard into an exact, durable release candidate. A release stores append-only Pack versions, accepted final-media versions, destination intent, readiness results, immutable approvals and separate supersession events inside the existing owner-scoped run snapshot. The active approval binds the current Storyboard lineage, Pack version, media version and SHA-256, and sorted destinations. Build 5C may publish only that binding.

The course media profile is MP4/H.264, optional AAC, displayed 1080×1920 or 720×1280, 15–60 seconds and at most 100 MiB. This is a classroom/common-publishing profile, not every platform's maximum. `ffprobe` inspects temporary bytes; filename and browser MIME are not trusted.

YouTube title (100 characters), description (5,000 UTF-8 bytes) and combined tags (500 characters) come from official documentation. Instagram 2,200-character/30-hashtag and LinkedIn 3,000-character values are labelled classroom rules because accessible current official schema pages did not publish those numeric limits during the check.

Official pages checked 2026-10-01:

- https://developers.google.com/youtube/v3/docs/videos
- https://support.google.com/youtube/answer/12948449
- https://developers.facebook.com/docs/instagram-platform/content-publishing/
- https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api
- https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/little-text-format
- https://supabase.com/docs/guides/storage/uploads/resumable-uploads

A confirmed Pack intent records its call before provider contact. Database conflicts retry only persistence. A restart before a call record can resume; a saved draft can finalize; a pending or successful call without a saved draft is ambiguous and is never replayed under the same intent.

The approved ZIP contains platform copy, exact Pack JSON, validation and approval manifest. The MP4 remains a separate authenticated download to avoid duplicating up to 100 MiB in the archive.
