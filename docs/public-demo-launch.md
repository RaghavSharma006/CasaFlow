# CasaFlow public demo launcher configuration

The public demo launch endpoint is deliberately fail-closed. It returns 503 until both `DEMO_PUBLIC_ENABLED=true` and `DEMO_DATA_ISOLATED=true` are configured. Do not set the latter until the demo tenant has been reviewed and confirmed to contain synthetic-only data and RLS/RPC access is restricted to that tenant.

## Vercel environment variables

Set these in the `hotel-ops-pilot` project. Keep secrets server-only; never prefix credentials with `VITE_`.

Required public/build configuration:
- `VITE_SUPABASE_URL` (existing)
- `VITE_SUPABASE_PUBLISHABLE_KEY` (existing)
- `VITE_DEMO_TURNSTILE_SITE_KEY` (Cloudflare Turnstile public site key)

Required server-only configuration:
- `TURNSTILE_SECRET_KEY`
- `DEMO_ALLOWED_ORIGINS=https://hotel-ops-pilot.vercel.app`
- `DEMO_ALLOWED_HOSTNAMES=hotel-ops-pilot.vercel.app`
- `DEMO_TENANT_ID` (the dedicated synthetic demo hotel UUID)
- `DEMO_PUBLIC_ENABLED=false` initially
- `DEMO_DATA_ISOLATED=false` initially

Add credentials only after verifying each dedicated demo account:
- `DEMO_OWNER_EMAIL`, `DEMO_OWNER_PASSWORD`
- `DEMO_MANAGER_EMAIL`, `DEMO_MANAGER_PASSWORD`
- `DEMO_RECEPTION_EMAIL`, `DEMO_RECEPTION_PASSWORD`
- `DEMO_SUPERVISOR_EMAIL`, `DEMO_SUPERVISOR_PASSWORD`
- `DEMO_CLEANER1_EMAIL`, `DEMO_CLEANER1_PASSWORD`
- `DEMO_CLEANER2_EMAIL`, `DEMO_CLEANER2_PASSWORD`
- `DEMO_AC_TECH_EMAIL`, `DEMO_AC_TECH_PASSWORD`
- `DEMO_PLUMBING_TECH_EMAIL`, `DEMO_PLUMBING_TECH_PASSWORD`

For Preview deployments, add the exact preview origin and hostname to the allowlists, and add the preview domain to the Turnstile widget configuration. Never allow arbitrary origins.

## Launch URL

`https://hotel-ops-pilot.vercel.app/demo-launch?role=owner`

Supported role values: `owner`, `manager`, `reception`, `supervisor`, `cleaner1`, `cleaner2`, `ac-technician`, `plumbing-technician`.

## Security notes

- The endpoint has a strict role allowlist, origin check, Turnstile verification, basic per-instance IP throttling, and a server-side tenant/role membership check.
- The browser receives a Supabase session for the selected demo user because it must use the real app. A visitor can inspect their own session tokens in browser developer tools. Do not represent these as hidden from the visitor.
- Do not use shared demo accounts until their hotel data is confirmed synthetic. The endpoint checks membership in the configured demo tenant but cannot independently prove the tenant has no real-world data.
- The in-memory throttle is best-effort and is not a globally coordinated rate limiter across Vercel instances. For production-grade abuse control, add a shared rate-limit store (for example Upstash Redis) before enabling broad public traffic.
- Closing a tab does not guarantee immediate JWT revocation. The app uses per-tab storage and local sign-out; configure appropriate short session lifetimes and monitor demo usage.
- The app's public role dashboards are intentionally accessible only through a valid demo account session. RLS remains the actual data boundary.
