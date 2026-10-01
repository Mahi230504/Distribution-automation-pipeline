# Step 5A setup — identity and durable ownership

## Offline classroom mode

This mode needs no account and makes no Supabase calls. Keep these values in `backend/.env`:

```env
TEST_MODE=true
AUTH_MODE=local
STORAGE_MODE=local_json
```

Keep `NEXT_PUBLIC_AUTH_MODE=local` in `frontend/.env.local` and set `NEXT_PUBLIC_API_URL=http://localhost:4000`. The assistant starts the backend and frontend; the user opens `http://localhost:3000`. The header says **LOCAL FIXTURE IDENTITY** and **TEST MODE**. Existing `backend/data` runs remain in place and continue to belong to the local fixture identity.

## Supabase mode

Use a designated project; do not paste credentials into chat or commit them. In the Supabase dashboard:

1. Confirm email/password sign-in is enabled under Authentication. For a classroom project, decide whether email confirmation is required; the local Supabase config disables confirmation for deterministic tests, but a hosted project keeps its chosen policy.
2. Add `http://localhost:3000` as an allowed local site/redirect URL for Auth.
3. Copy the project URL, publishable key and server secret key. A legacy `anon` key can fill the publishable-key field if that is the key type the project currently exposes. A legacy `service_role` key can fill the server-secret field. Never put a secret/service-role key in a `NEXT_PUBLIC_` variable.
4. Put server values only in `backend/.env`:

   ```env
   TEST_MODE=true
   AUTH_MODE=supabase
   STORAGE_MODE=supabase
   SUPABASE_URL=...
   SUPABASE_PUBLISHABLE_KEY=...
   SUPABASE_SECRET_KEY=...
   ```

5. Put only public browser values in `frontend/.env.local`:

   ```env
   NEXT_PUBLIC_API_URL=http://localhost:4000
   NEXT_PUBLIC_AUTH_MODE=supabase
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
   ```

6. Review `supabase/migrations/202610010001_step5a_ownership.sql`, then apply it to the designated project using the current Supabase CLI migration workflow. Run `backend`'s `supabase:storage:setup` script once to create the private `vpo-private` bucket through the Storage API. The migration intentionally does not insert rows into `storage.objects`.
7. Start both apps and open `http://localhost:3000`. A signed-out visitor sees the VPO sign-in form. Create or sign in to an account; refresh to verify restoration. Sign out to remove access.

Supabase mode never imports or alters existing files in `backend/data`. There is no importer in Step 5A.

## Exact remote verification actions (not performed in this build)

After the owner designates a project and authorizes changes:

1. Confirm the project reference and inspect the pending migration diff.
2. Apply the single Step 5A migration, then create/update the private bucket through `npm run supabase:storage:setup` from `backend`.
3. Create two disposable, non-sensitive users A and B using the project's chosen email-confirmation policy.
4. In `TEST_MODE=true`, sign in as A, create a run and Brand kit, complete Story through approved Storyboard, refresh/reopen, and retain A's run/asset IDs.
5. Sign out, sign in as B, and verify History and Brand kit contain only B data. Attempt A's exact run, job, AI-call and asset URLs and require non-enumerating denial. Create B data and repeat the reverse checks.
6. Restart the backend and reopen each user's saved run to prove persistence and saved job ownership.
7. Verify private object access: A succeeds through the authenticated Express image route; B fails for A's exact asset ID. Confirm the bucket is not public.
8. Sign out and verify protected data is unavailable; sign A back in, refresh, and verify only A data returns.
9. Confirm Gemini logs show fixture calls only and no publishing/platform calls occurred.
10. Delete the disposable users and their cascaded fixture rows/objects only after evidence is captured.

No remote project was created or modified during the Step 5A implementation pass.
