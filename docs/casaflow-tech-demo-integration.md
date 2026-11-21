# CasaFlow marketing-site demo integration

This repository owns the interactive hotel operations application. The marketing website at `casaflow.tech` should link to the app; it should not attempt to authenticate users itself.

## CTA contract

Use a normal link (not an iframe) for the marketing site's primary demo CTA:

- Label: **Explore the interactive demo**
- Current Preview target for internal review only: `https://hotel-ops-pilot-c6hsv5qq4-raghav-sharmas-projects-4bb7ee00.vercel.app/demo-launch`
- Intended stable Production target after this branch is reviewed, merged, and deployed: `https://hotel-ops-pilot.vercel.app/demo-launch`

Open the target in the same tab or a new tab with the usual safe external-link attributes. Do not pass credentials, access tokens, role passwords, or Supabase keys in the URL or query string. Optional role deep-linking is supported with one of the allowlisted values, for example `?role=manager`, but the default owner role is fine.

## Important launch status

The route and server-side launcher are implemented on `feat/secure-public-demo-launch`. The public launch endpoint intentionally remains fail-closed because `DEMO_PUBLIC_ENABLED=false` and `DEMO_DATA_ISOLATED=false`. Cloudflare Turnstile has deliberately not been configured yet. Therefore, do not present the CTA as a live, publicly usable demo until the app branch has been deployed to Production and the owner explicitly approves enabling public access after security and tenant-isolation testing.

For now, the Preview link is for internal review only. Do not point the live marketing website at the Preview URL as a public CTA.

## Responsibilities

- Marketing site: render the CTA and link to the app URL above.
- CasaFlow app: own demo role selection, authentication, session handling, role authorization, and guest QR workflows.
- Never embed the app in an iframe or attempt cross-site session injection.
