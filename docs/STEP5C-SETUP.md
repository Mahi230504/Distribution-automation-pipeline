# Step 5C setup

## Safe classroom mode

Keep `PUBLISH_MODE=test` in `backend/.env`. Connect buttons create clearly labelled simulated accounts. The default UI fixtures produce a YouTube success, an Instagram processing checkpoint and a LinkedIn failure so partial-success and recovery behavior can be demonstrated without DNS, OAuth or platform calls.

Start the existing backend and frontend normally. `TEST_MODE` controls Gemini; `PUBLISH_MODE` controls platform effects. They are deliberately independent.

## LIVE setup — implementation complete, provider verification pending

Set `PUBLISH_MODE=live`, the exact public callback base URL and a versioned encryption key ring. Each key value is base64 for exactly 32 random bytes. The active key encrypts new records; retain older keys while connections encrypted with them still exist. Missing, malformed or unknown keys fail closed.

Create provider applications only during a separately authorized setup pass. Register these exact callbacks:

```text
<PUBLIC_OAUTH_CALLBACK_BASE_URL>/oauth/youtube/callback
<PUBLIC_OAUTH_CALLBACK_BASE_URL>/oauth/instagram/callback
<PUBLIC_OAUTH_CALLBACK_BASE_URL>/oauth/linkedin/callback
```

Configure Google, Meta and LinkedIn client IDs/secrets only in the backend environment. Never use `NEXT_PUBLIC_` variables. Google needs YouTube Data API access and may need sensitive-scope verification. Instagram needs a reviewed app and eligible professional account. LinkedIn needs Community Management access; organization publishing additionally needs an eligible member role.

Set these backend variables before starting a LIVE verification environment:

```text
PUBLISH_MODE=live
PUBLIC_OAUTH_CALLBACK_BASE_URL=https://<public-backend-host>
PLATFORM_TOKEN_KEYS_JSON={"<key-id>":"<base64-32-byte-key>"}
PLATFORM_TOKEN_ACTIVE_KEY_ID=<key-id>

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

META_CLIENT_ID=
META_CLIENT_SECRET=
META_GRAPH_API_VERSION=<currently supported version, for example v24.0 only if still supported>

LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
LINKEDIN_API_VERSION=<currently supported YYYYMM version>
```

Provider requirements:

- Google: enable YouTube Data API v3, register the exact callback, grant `youtube.upload`, and confirm whether the API project is restricted to private uploads. Public or unlisted validation must wait for the project to be eligible.
- Meta: use Facebook Login, grant `business_management`, `pages_read_engagement`, `pages_show_list`, `instagram_basic` and `instagram_content_publish`, and connect an eligible Instagram professional account to a Facebook Page. The app may require review/Advanced Access before non-role users can connect.
- LinkedIn: add Sign In with LinkedIn and Share on LinkedIn, grant `r_liteprofile` and `w_member_social`, register the callback, and obtain any Community Management access required by the current Videos and Posts APIs. This build publishes to the authenticated member target returned by `/v2/me`; organization discovery is not included.

The application now implements all three protocol paths, but a LIVE verification is complete only after one disposable/private publication per provider is observed in the provider account and its saved evidence is reconciled in VPO Studio. Do not treat injected provider tests as that evidence.

Apply `supabase/migrations/202610020003_step5c_publication.sql`, `supabase/migrations/202610020004_step5c_recovery_invariants.sql`, and `supabase/migrations/202610020005_step5c_connection_atomicity.sql` in order only after review against a designated project. The second migration adds the normalized owner/run job registry, strict idempotency conflict checks and the atomic fenced secret/checkpoint RPC. The third adds service-only atomic authorization and disconnect RPCs so connection metadata and encrypted tokens cannot split during create, reconnect, refresh or disconnect. Then run all Step 5C pgTAP files against the designated database.

The five ordered migrations and all five pgTAP artifacts were executed against designated project `yljdwhankreidsgslbgi` on 2 October 2026. The 73 assertions passed after correcting two pgTAP calls that had never previously run against PostgreSQL: the service-role checks now wrap the three-argument built-in `has_function_privilege` with `ok`, and the job-secret assertion names the complete composite foreign key. These are database-contract results; provider OAuth and live publication remain separate evidence gates.
