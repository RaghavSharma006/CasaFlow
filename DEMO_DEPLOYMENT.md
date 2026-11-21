# CasaFlow public demo deployment handoff

Branch: `feat/public-isolated-demo-sessions`

This branch introduces a public demo launcher using temporary isolated hotel workspaces. It is not yet deployed to production, and the SQL migration has not been applied.

## Required Vercel environment variables

Add these directly in Vercel Project Settings → Environment Variables, for Preview and Production:

- `SUPABASE_SECRET_KEY`: the Supabase server-only secret key (`sb_secret_...`) for project `casaflow-hotel-ops`. Never use a `VITE_` prefix.
- `DEMO_SESSION_PEPPER`: at least 32 random bytes, base64url or hex.
- `CRON_SECRET`: at least 32 random bytes, used to authorize the cleanup endpoint. Add the exact same value to GitHub Actions as `CASAFLOW_DEMO_CRON_SECRET`.
- Optional Turnstile pair: `VITE_DEMO_TURNSTILE_SITE_KEY` (public site key) and `DEMO_TURNSTILE_SECRET_KEY` (server-only secret). Configure both or leave both unset; add `hotel-ops-pilot.vercel.app` as an allowed hostname in Cloudflare.

Existing browser variables remain:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Do not commit or paste actual secrets into GitHub, source code, chat, browser storage, or URLs.

## Database migration

Review and apply `supabase/20261121_public_demo_workspaces.sql` only to the existing Supabase project `casaflow-hotel-ops` (`vfpsteazmvcfaqpxaskq`). This migration does not reset or replace existing hotel records. It creates:
- server-only session and role mapping tables,
- a DB-backed IP rate-limit function,
- an atomic demo workspace provisioner,
- a session-expiry check integrated into the existing authorization helpers.

Do not run `supabase/schema.sql`; it is an initial schema for a new isolated database and is not an update migration.

## Public demo flow

1. Visitor opens `/demo-launch`.
2. Server creates a 45-minute session, eight temporary Supabase Auth users with random passwords, and a separate synthetic hotel with seeded rooms and staff dispatch rows.
3. Browser gets only an HttpOnly, Secure, SameSite=Strict session cookie scoped to `/api/demo`.
4. Visitor opens a role; the server generates a one-time Supabase magic-link token hash and returns it in the same-origin response body.
5. The role tab verifies that one-time token using its per-tab Supabase session storage and opens its actual role dashboard.
6. All eight identities belong only to that visitor's synthetic hotel. Database authorization helpers reject their requests once the session expires or is revoked.
7. Visitor can use the real room QR, submit a tracked request, follow status updates, confirm resolution, or reopen the request.

## Expiry and cleanup

- Demo workspace authorization expires at 45 minutes even if the browser remains open.
- The dashboard polls session status and signs out the current tab locally when the parent demo session ends.
- Closing a tab clears its tab-scoped Supabase session storage. Browser close events are not a security boundary.
- A GitHub Actions schedule calls cleanup every 15 minutes. The same random value must be set as Vercel `CRON_SECRET` and GitHub Actions secret `CASAFLOW_DEMO_CRON_SECRET`. Database authorization denies access at the 45-minute mark even if a cleanup run is delayed.

## Deployment gates

1. Connect GitHub repository `RaghavSharma006/CasaFlow` to the existing Vercel project `hotel-ops-pilot`; the project currently reports no Git repo link.
2. Configure the three server-only environment variables.
3. Add the same random cleanup secret as Vercel's `CRON_SECRET` to GitHub repository Actions secrets as `CASAFLOW_DEMO_CRON_SECRET` (the workflow calls the cleanup API every 15 minutes; it runs after this workflow reaches the default branch).
4. Apply the reviewed migration to the existing Supabase project.
5. Deploy this branch as a Vercel Preview first.
6. Test all eight roles in separate tabs, logout isolation, expiry, QR request routing, tracking, feedback, and cross-visitor isolation.
7. Only merge to the configured production branch after the Preview checks pass.

No credentials are included in this repository.
