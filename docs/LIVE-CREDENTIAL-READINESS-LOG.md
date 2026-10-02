# Live credential and deployment readiness log

Date: 2 October 2026  
Scope: Session 11.1 provider/OAuth readiness plus deployment preparation. Production deployment, remote migrations and live publications remain Session 11.2 actions.

This log intentionally records identifiers, callback URLs, configuration names and verification results without recording client secrets, access tokens, refresh tokens, service-role keys or API-key values.

## Fixed application endpoints

- Production frontend: `https://vpo-studio.onrender.com`
- Production backend: `https://vpo-studio-backend.onrender.com`
- YouTube callback: `https://vpo-studio-backend.onrender.com/oauth/youtube/callback`
- Instagram callback: `https://vpo-studio-backend.onrender.com/oauth/instagram/callback`
- LinkedIn callback: `https://vpo-studio-backend.onrender.com/oauth/linkedin/callback`
- Local callback base for controlled tests: `http://localhost:4000`

## Actions and observations

### Google / YouTube

1. Opened Google Cloud project `VPO Studio Live` (`vpo-studio-live`) using `mohan.shrivastava@newtonschool.co`.
2. Verified that YouTube Data API v3 is enabled.
3. Verified that Google Auth Platform reports no project-health recommendation.
4. Verified that no OAuth client existed at inspection time.
5. Created Web application OAuth client `VPO Studio Web` after explicit action-time confirmation.
6. Registered both the production and localhost YouTube callback URLs.
7. Generated a fresh retrievable client secret because Google no longer reveals a dismissed secret. Downloaded its JSON once, transferred the client ID and secret into `backend/.env.deployment.local`, and removed the transient download. No credential value was printed or committed.
8. Readiness checks now pass for both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Real OAuth exchange and YouTube publication remain Not run.

### Meta / Instagram

1. Opened Meta for Developers.
2. The browser reached Facebook login and did not have an authenticated Meta session.
3. No Meta developer app, client ID, client secret, test-user role or permission request was created or inferred.
4. Required next input: sign in to the existing Facebook account that owns or can create the relevant Page and link an Instagram Professional account. Creating a duplicate work-email Facebook identity is intentionally avoided.

### LinkedIn

1. Opened LinkedIn Developers.
2. The browser reached LinkedIn login and did not have an authenticated developer session.
3. Google login offered to create a new work-email LinkedIn identity. This was not accepted because it could duplicate the user's existing professional profile.
4. No LinkedIn app, client ID, client secret, Company Page association or product access was created or inferred.
5. Required next input: sign in to the existing LinkedIn profile that will publish and administer the developer app.

### Supabase

1. Located the existing free-tier organization for `mohan.shrivastava@newtonschool.co` from the account's notification email.
2. Located project ID `yljdwhankreidsgslbgi` and organization ID `zawgfjqnekrfeybgkbwi`.
3. Confirmed the project is paused after inactivity and remains within Supabase's stated 90-day restoration window.
4. Prepared the project URL `https://yljdwhankreidsgslbgi.supabase.co` in the private deployment templates.
5. Dashboard authentication is pending. Publishable and secret keys have not been read. The project has not been restored, changed or migrated.
6. The five ordered migrations and all five pgTAP files are present locally. None has been applied or represented as executed.

### Render

1. Verified Render CLI v2.28.0 is installed and authenticated as `mohan_s@hs.iitr.ac.in` in workspace `Generalist` (`tea-daqf10g473hc73ftquug`).
2. Inspected the workspace. It contains an older `media-app-builder` service; no VPO service currently exists.
3. Validated `render.yaml`. Render reported a valid Blueprint containing `vpo-studio-backend` and `vpo-studio` with two planned service actions.
4. Verified the declared VPO URLs currently return HTTP 404, consistent with the services not yet being created.
5. No Blueprint was applied and no service, environment variable or deployment was created in this pass.

### Local secret-safe preparation

1. Generated a new 32-byte platform-token encryption key and stored it only in ignored private environment files.
2. Copied the existing Gemini key into the ignored backend deployment template without printing it.
3. Added `scripts/verify-live-readiness.mjs`. It reports only PASS/WAIT status and never prints credential values.
4. Kept `backend/.env` and `frontend/.env.local` unchanged so the working local run remains intact.

## Remaining credential gates

- Meta: authenticate the existing Facebook owner, create/configure a Business app, add Facebook Login, configure callbacks, attach an eligible Page-linked Instagram Professional account and request only the implemented permissions.
- LinkedIn: authenticate the existing member, create/configure an app tied to an eligible Company Page, add Sign In with LinkedIn and Share on LinkedIn, and configure the callback.
- Supabase: authenticate the existing account, restore the project, retrieve the current publishable/secret keys and review its Auth settings.
- Render: apply the validated Blueprint and transfer the completed environment values during Session 11.2 deployment.

## Evidence boundary

At the time of this log, Google credentials are present but Meta, LinkedIn and Supabase credentials remain incomplete. The redacted checker reports 19/27 passing. Real OAuth exchange, remote Supabase policy execution, Render deployment and real YouTube/Instagram/LinkedIn publication are **Not run**.
