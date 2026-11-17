# CasaFlow walkthrough recorder

The recorder runs the real web UI with Playwright and saves browser video, screenshots, traces, and a Markdown/JSON report. It covers:

1. Front Desk sign-in and room QR generation.
2. Guest QR scan flow and a uniquely tagged Broken AC request.
3. Manager sign-in, Guest Requests queue, and staff/role workspace.
4. Optional Maintenance or Housekeeping worker sign-in to verify that the tagged request appears in that worker's queue.

## Run on Windows PowerShell

From the repository root:

```powershell
npm install
npx playwright install chromium

$env:MANAGER_PASSWORD = "your-demo-manager-password"
$env:FRONTDESK_PASSWORD = "your-demo-frontdesk-password"
$env:E2E_ALLOW_PRODUCTION_MUTATIONS = "1"
$env:SHOW_BROWSER = "1"

# Optional worker account, recommended for verifying automatic dispatch:
$env:MAINTENANCE_EMAIL = "your-demo-maintenance-email"
$env:MAINTENANCE_PASSWORD = "your-demo-maintenance-password"

npm run record:walkthrough
```

The default demo email addresses are already set in the script. Override them with `MANAGER_EMAIL` or `FRONTDESK_EMAIL` if your demo accounts differ.

Use `CASAFLOW_BASE_URL` to point at an isolated staging deployment instead of production. The production mutation guard is intentional: this walkthrough creates a guest request and generates a room QR, so only run it against a demo hotel with demo accounts. Never commit passwords or a populated `.env.local`; the recorder reads credentials from the shell environment.

## Output

Artifacts are written to `artifacts/casaflow/`:

- `01-frontdesk-and-guest.webm` and guest page video
- `02-manager.webm`
- Optional `03-worker.webm`
- PNG checkpoints
- Playwright trace ZIPs
- `report.md` and `report.json`

The recorder does not delete the created request or rotate/revoke QR tokens. Keep the test hotel isolated and use a dedicated room QR.
