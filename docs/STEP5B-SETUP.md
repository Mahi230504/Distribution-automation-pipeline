# Step 5B setup

Install FFmpeg so `ffprobe` is on `PATH`, or set `FFPROBE_PATH`. Local development has FFmpeg 7.1.1. Keep `TEST_MODE=true` for classroom verification. Start the backend in its existing local/local-JSON mode and the frontend with `NEXT_PUBLIC_API_URL=http://localhost:4000`; open `http://localhost:3000`, sign in with the clearly labelled local classroom identity and continue an approved Storyboard.

The normal path is Generate release Pack → explicit Pack Save/Restore → finished MP4 upload → destination selection → final review → exact approval. A standalone frontend can demonstrate sample Pack editing, but it deliberately cannot upload or approve media because there is no authenticated storage boundary.

## Later authorized Supabase verification

No remote migration or bucket update was performed in this build. When a designated project and disposable users are available, first review the diff, back up the project and apply `202610010002_step5b_release_assets.sql` through the normal Supabase migration workflow. Then run the private-bucket setup script with server-only credentials. Both project-global and bucket limits must permit 100 MiB; large server uploads use Supabase TUS in 6 MiB chunks.

Verify with two disposable users and non-sensitive fixtures: User A can generate/edit/restore Pack versions, upload and preview an accepted MP4, choose destinations, approve, refresh/restart, export and Reopen; User B receives non-enumerating failures for A's exact run, Pack, asset, approval and download IDs. Also run the pgTAP tests against that real engine, confirm direct browser table/Object Storage access remains denied, and confirm rejected uploads leave no object or asset row. Do not use Gemini live mode and do not connect or call publishing platforms during this verification.
