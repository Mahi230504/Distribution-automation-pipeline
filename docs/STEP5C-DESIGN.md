# Step 5C design — owner-scoped publishing with evidence

Verified against official provider documentation on 1 October 2026. Implemented on 2 October 2026. Build 5C consumes, but never changes, the exact active Step 5B approval.

## Publication boundary

One explicit confirmation atomically saves a batch plus one immutable intent and one logical job for every canonical approved destination. The confirmation and per-job idempotency hashes bind the owner, run, approval epoch/fingerprint, platform, exact saved target/capability revision, canonical Pack payload and YouTube privacy. Repeated confirmation returns the existing logical batch. Provider effects start only after the complete batch is durable.

Publishing data is separate from `Run.release`. Safe connection metadata, target bindings and publication aggregates are owner-scoped. Supabase also keeps a unique idempotency registry populated atomically by the publication-snapshot RPC. Access/refresh tokens, PKCE material and signed upload/session URLs use separate AES-256-GCM envelopes with record-bound authenticated data and a versioned server key ring. They never enter run JSON, browser responses, evidence or logs.

Each worker has a fenced claim ID and monotonically increasing fence. IDs, timestamps and events are prepared before retryable storage work. The claim is verified and renewed immediately before provider effects. An expired claim is reconciled before another worker advances it, and an older worker cannot replace a newer secret or public checkpoint. Local storage uses a recoverable checkpoint journal; Supabase uses one transaction RPC for encrypted job-secret material and the matching public snapshot. `unknown` is reconcile-only, authorization failures are reconnect-only, capability/configuration blockers are attention-only, and Retry is exposed only for an explicitly safe checkpoint.

The local scheduler owns one timer or executor for each owner/run/job key. An execution returns its persisted continuation time; only after the current scheduler entry is released is that continuation armed. Duplicate scheduling keeps one executor, while startup recovery reconstructs timers from persisted `nextAttemptAt` and fenced claims.

Connection metadata and encrypted authorization are also one logical commit. Local mode journals create/reconnect/refresh/disconnect and replays an incomplete journal on startup. Supabase mode uses service-only transaction RPCs that verify owner, provider and expected revision, create the parent before its secret, rotate metadata plus authorization together, and mark disconnected before deleting authorization. Browser roles cannot execute these RPCs or read secret rows.

Polling stores `nextAttemptAt` and a bounded backoff counter. Valid `Retry-After` values are honored. Approval is revalidated before each write effect. If approval changes before any effect, the job is superseded; after an external artifact exists, only read-only polling/reconciliation may continue to capture truthful evidence. A later post/publication action is never created from the superseded approval.

`PUBLISH_MODE=test|live` is independent from Gemini `TEST_MODE`. Test publishing imports no HTTP client and progresses through the same saved states without DNS or HTTP. Both AI and publishing provenance are displayed and persisted.

## Provider checkpoints

- YouTube: authorization → authenticated resumable session creation with exact media length → authenticated byte/range progress → private video ID created → authenticated provider processing → external video evidence. Resume/status PUTs carry the bearer token only to the validated Google API host. Only supported `snippet` and `status` fields are sent, and metadata lookup does not open an unused whole-file stream.
- Instagram: authorization/account capability → container/upload → processing → one `media_publish` call → media ID/permalink evidence. LIVE execution is deliberately blocked in this build because the exact current Instagram Login private-binary/resumable contract could not be verified consistently from accessible official material. No permanent public media URL fallback is used.
- LinkedIn: owner/role → validated ordered upload instructions, token and video URN saved → each exact instructed range and required ETag saved → complete-part finalize → `AVAILABLE` → one Posts API call composed from approved commentary plus hashtags. The documented empty-string `uploadToken` is valid and is forwarded unchanged; missing or non-string tokens are rejected. Missing ETags and incomplete/out-of-order ranges stop finalization. Returned `urn:li:share:*` and `urn:li:ugcPost:*` IDs are retained exactly and safely encoded into a feed URL; an unrecognized ID retains a general provider inspection path without inventing an activity URN. An ambiguous Posts response may remain `unknown` with manual inspection guidance.

Connection targets can change only before provider work. Such a change supersedes the old prepared intent/job append-only. Started jobs cannot be retargeted. Reopen, a new approval, disconnect or later release edits block new use of old approval state but retain already-created provider evidence.

## OAuth and request security

The public callback consumes a SHA-256 state hash atomically and exactly once. State is random, ten-minute, provider/owner/initiation/return-path bound and paired with a short-lived HttpOnly SameSite=Lax browser cookie. Reconnect state additionally binds the existing connection ID and expected revision; callback completion rotates authorization and capability data on that same connection so started intents keep their binding. Missing or denied required scopes produce attention state rather than assuming the requested scopes were granted. Real HTTPS callbacks use `Secure`; localhost is the deliberate non-Secure development exception. Callback responses are `no-store`, use `no-referrer`, clear the callback cookie, expose no provider body/code/state/token and redirect only to a sanitized relative application path.

Provider URLs require HTTPS and exact documented hosts or narrow signed-upload suffixes. DNS results that are private, loopback or link-local are rejected. Redirects are not followed automatically. Response bodies and request time are bounded. Bearer credentials cannot be forwarded to signed-upload hosts unless the specific API call explicitly authorizes them.

## Official references

- [YouTube videos.insert](https://developers.google.com/youtube/v3/docs/videos/insert)
- [YouTube resumable upload protocol](https://developers.google.com/youtube/v3/guides/using_resumable_upload_protocol)
- [Google OAuth web-server flow](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Google OAuth security practices](https://developers.google.com/identity/protocols/oauth2/resources/best-practices)
- [YouTube channels.list](https://developers.google.com/youtube/v3/docs/channels/list)
- [YouTube videos.list](https://developers.google.com/youtube/v3/docs/videos/list)
- [Instagram API with Instagram Login](https://www.postman.com/meta/instagram/folder/1z5vxzu/instagram-api-with-instagram-login)
- [Meta Reels publishing reference](https://github.com/fbsamples/reels_publishing_apis/blob/main/insta_reels_publishing_api_sample/README.md)
- [LinkedIn authorization-code flow](https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow)
- [LinkedIn Videos API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/videos-api)
- [LinkedIn Posts API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api)
- [LinkedIn API versioning](https://learn.microsoft.com/en-us/linkedin/marketing/versioning)
- [LinkedIn Community Management access](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/community-management-overview)
- [LinkedIn organization authorization](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/organizations/organization-access-control-by-role)

YouTube uses least-privilege `youtube.upload`; unverified API projects can be restricted to private uploads. Instagram uses professional Business/Creator accounts and the current `instagram_business_basic`/`instagram_business_content_publish` permissions. LinkedIn member publishing uses `w_member_social`; organization targets require `w_organization_social`, an eligible member role and vetted Community Management access. The configured initial LinkedIn version is `202609`; it must be reviewed before its published sunset rather than silently upgraded.
