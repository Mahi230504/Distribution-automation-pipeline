# Step 5C setup

## Safe classroom mode

Keep `PUBLISH_MODE=test` in `backend/.env`. Connect buttons create clearly labelled simulated accounts. The default UI fixtures produce a YouTube success, an Instagram processing checkpoint and a LinkedIn failure so partial-success and recovery behavior can be demonstrated without DNS, OAuth or platform calls.

Start the existing backend and frontend normally. `TEST_MODE` controls Gemini; `PUBLISH_MODE` controls platform effects. They are deliberately independent.

## Later LIVE setup — not performed in Build 5C

Set `PUBLISH_MODE=live`, the exact public callback base URL and a versioned encryption key ring. Each key value is base64 for exactly 32 random bytes. The active key encrypts new records; retain older keys while connections encrypted with them still exist. Missing, malformed or unknown keys fail closed.

Create provider applications only during a separately authorized setup pass. Register these exact callbacks:

```text
<PUBLIC_OAUTH_CALLBACK_BASE_URL>/oauth/youtube/callback
<PUBLIC_OAUTH_CALLBACK_BASE_URL>/oauth/instagram/callback
<PUBLIC_OAUTH_CALLBACK_BASE_URL>/oauth/linkedin/callback
```

Configure Google, Meta and LinkedIn client IDs/secrets only in the backend environment. Never use `NEXT_PUBLIC_` variables. Google needs YouTube Data API access and may need sensitive-scope verification. Instagram needs an reviewed app and eligible professional account. LinkedIn needs Community Management access; organization publishing additionally needs an eligible member role.

Apply `supabase/migrations/202610020003_step5c_publication.sql` and then additive correction `supabase/migrations/202610020004_step5c_recovery_invariants.sql` only after review against a designated project. The second migration adds the normalized owner/run job registry, strict idempotency conflict checks and the atomic fenced secret/checkpoint RPC. Then run both Step 5C pgTAP files using the supported local Supabase workflow. None of these actions was performed in Build 5C or its correction pass.
