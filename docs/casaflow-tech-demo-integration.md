# CasaFlow marketing-site demo integration

The marketing site at `casaflow.tech` creates a short-lived signed launch ticket. The hotel operations app verifies it server-side before creating a demo session.

## Shared secret

Configure the exact same random secret in both server environments:
- Hotel app (Vercel): `CASAFLOW_DEMO_SHARED_SECRET`
- Marketing site server: `CASAFLOW_DEMO_SHARED_SECRET`

Never expose this secret in browser code, `VITE_*` variables, HTML, client bundles, URLs, logs, or Git.

## Ticket contract

The marketing backend signs a compact ticket using HMAC-SHA256:
1. JSON claims: `{iss:"https://casaflow.tech",aud:"hotel-ops-pilot",role,iat,exp,jti}`
2. Base64url encode the JSON without padding to produce `payload`.
3. Compute `signature = HMAC_SHA256(secret, payload)`, base64url encode without padding.
4. Ticket is `payload.signature`.
5. `iat` and `exp` are Unix seconds; expiry must be within 120 seconds of issue.
6. `jti` must be a fresh cryptographically random unique ID.
7. Allowed roles: `owner`, `manager`, `reception`, `supervisor`, `cleaner1`, `cleaner2`, `ac-technician`, `plumbing-technician`.

Redirect the visitor to:
`https://hotel-ops-pilot.vercel.app/demo-launch?role=owner&ticket=<ticket>`

The hotel app removes the ticket from the address bar immediately and posts it to `/api/demo/launch`. It checks HMAC, issuer, audience, role, issue/expiry times, nonce reuse, origin, demo enablement, and demo account membership before returning a Supabase session.

## Required hotel app environment

Server-only:
- `CASAFLOW_DEMO_SHARED_SECRET` (same value as marketing backend)
- `DEMO_ALLOWED_ORIGINS=https://hotel-ops-pilot.vercel.app`
- `DEMO_TENANT_ID`
- `DEMO_PUBLIC_ENABLED=false` until owner approves
- `DEMO_DATA_ISOLATED=false` until synthetic-only tenant and RLS isolation are verified
- Existing dedicated demo role email/password variables listed in `public-demo-launch.md`

Existing Supabase URL and publishable key remain as configured. Cloudflare Turnstile is not required.

## Security limitation

The Vercel in-memory nonce cache prevents ticket reuse within a warm function instance, but is best-effort across serverless instances/restarts. For strict global single-use enforcement, persist consumed `jti` values in a shared database with a unique constraint before enabling broad public traffic. Short expiry, HMAC verification, rate limiting, demo-only accounts, and RLS remain required.
