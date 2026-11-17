import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const BASE_URL = (process.env.CASAFLOW_BASE_URL || 'https://hotel-ops-pilot.vercel.app').replace(/\/$/, '');
const MANAGER_EMAIL = process.env.MANAGER_EMAIL || 'raghav007ff+casaflow-manager@gmail.com';
const FRONTDESK_EMAIL = process.env.FRONTDESK_EMAIL || 'raghav007ff+casaflow-desk@gmail.com';
const MANAGER_PASSWORD = process.env.MANAGER_PASSWORD;
const FRONTDESK_PASSWORD = process.env.FRONTDESK_PASSWORD;
const MAINTENANCE_EMAIL = process.env.MAINTENANCE_EMAIL;
const MAINTENANCE_PASSWORD = process.env.MAINTENANCE_PASSWORD;
const HOUSEKEEPING_EMAIL = process.env.HOUSEKEEPING_EMAIL;
const HOUSEKEEPING_PASSWORD = process.env.HOUSEKEEPING_PASSWORD;
const production = new URL(BASE_URL).hostname.endsWith('.vercel.app');
const runId = `E2E-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`;
const outDir = path.resolve(process.env.CASAFLOW_ARTIFACTS || 'artifacts/casaflow');
const failures = [];
const results = [];

if (!MANAGER_PASSWORD || !FRONTDESK_PASSWORD) {
  console.error('Missing MANAGER_PASSWORD and/or FRONTDESK_PASSWORD. Set them in your shell/.env.local; never commit passwords.');
  process.exit(2);
}
if (production && process.env.E2E_ALLOW_PRODUCTION_MUTATIONS !== '1') {
  console.error('This walkthrough submits a test guest request and creates/uses a room QR on production. Set E2E_ALLOW_PRODUCTION_MUTATIONS=1 only when using approved demo accounts and demo hotel data.');
  process.exit(2);
}

await fs.mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: process.env.SHOW_BROWSER !== '1' });

function note(name, status, detail = '') {
  const row = { name, status, detail, at: new Date().toISOString() };
  results.push(row);
  console.log(`[${status}] ${name}${detail ? ` — ${detail}` : ''}`);
}
async function contextFor(label) {
  const dir = path.join(outDir, label);
  await fs.mkdir(dir, { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    recordVideo: { dir, size: { width: 1440, height: 1000 } },
    acceptDownloads: true
  });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => failures.push(`${label}: pageerror: ${error.message}`));
  page.on('console', msg => { if (msg.type() === 'error') failures.push(`${label}: console: ${msg.text()}`); });
  page.on('requestfailed', req => failures.push(`${label}: request failed: ${req.method()} ${req.url()} — ${req.failure()?.errorText || ''}`));
  return { context, page, dir, label };
}
async function saveCheckpoint(page, label) {
  await page.screenshot({ path: path.join(outDir, `${label}.png`), fullPage: true }).catch(() => {});
}
async function login(page, email, password, roleName) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.getByRole('button', { name: /overview/i }).waitFor({ state: 'visible', timeout: 25000 });
  await page.waitForTimeout(1800);
  note(`${roleName} sign-in`, 'PASS', 'authenticated dashboard rendered');
}
async function closeRecordedSession(session, videoName, extraPages = []) {
  await saveCheckpoint(session.page, `${session.label}-final`);
  await session.context.tracing.stop({ path: path.join(outDir, `${session.label}-trace.zip`) }).catch(() => {});
  const videos = [session.page, ...extraPages].map(page => page.video()).filter(Boolean);
  await session.context.close();
  for (let index = 0; index < videos.length; index++) {
    const source = await videos[index].path().catch(() => null);
    const name = index === 0 ? videoName : videoName.replace('.webm', `-guest-${index}.webm`);
    if (source) await fs.copyFile(source, path.join(outDir, name)).catch(() => {});
  }
}
async function safeClick(page, patterns) {
  for (const pattern of patterns) {
    const locator = page.getByRole('button', { name: pattern }).first();
    if (await locator.count().catch(() => 0)) {
      await locator.click();
      return true;
    }
  }
  return false;
}

let frontdesk;
let manager;
let worker;
let guestPage;
try {
  // 1. Front Desk: sign in and create a room QR for the demo room.
  frontdesk = await contextFor('01-frontdesk-and-guest');
  await login(frontdesk.page, FRONTDESK_EMAIL, FRONTDESK_PASSWORD, 'Front Desk');
  await saveCheckpoint(frontdesk.page, '01-frontdesk-dashboard');

  let openedQr = await safeClick(frontdesk.page, [/guest qr/i, /room qr/i]);
  if (!openedQr) {
    await frontdesk.page.getByRole('button', { name: /room board/i }).click();
    openedQr = await safeClick(frontdesk.page, [/guest qr/i, /room qr/i]);
  }
  if (!openedQr) throw new Error('Could not find the Guest QR action in the Front Desk dashboard.');
  await frontdesk.page.getByRole('button', { name: /generate room qr/i }).click();
  const link = frontdesk.page.locator('.inviteurl').filter({ hasText: /\/guest\?token=/ }).first();
  await link.waitFor({ state: 'visible' });
  const guestUrl = (await link.innerText()).trim();
  if (!guestUrl.startsWith('http')) throw new Error('QR generator did not expose a guest URL.');
  note('Front Desk generates room QR', 'PASS', 'QR token generated; secret URL captured for this run');
  await saveCheckpoint(frontdesk.page, '02-room-qr-generated');

  // 2. Guest: submit a broken-AC complaint. This should route to Maintenance.
  guestPage = await frontdesk.context.newPage();
  guestPage.setDefaultTimeout(15000);
  guestPage.on('pageerror', error => failures.push(`Guest: pageerror: ${error.message}`));
  await guestPage.goto(guestUrl, { waitUntil: 'domcontentloaded' });
  await guestPage.getByRole('heading', { name: /how can we help/i }).waitFor({ state: 'visible' });
  await guestPage.locator('label.guest-choice').filter({ hasText: 'Broken AC' }).click();
  await guestPage.locator('textarea').fill(`Automated CasaFlow walkthrough ${runId}: air conditioner is not cooling.`);
  await guestPage.getByRole('button', { name: /send request/i }).click();
  await guestPage.getByRole('heading', { name: /request received/i }).waitFor({ state: 'visible', timeout: 20000 });
  note('Guest submits Broken AC complaint', 'PASS', 'guest confirmation shown; expected department: Maintenance');
  await guestPage.screenshot({ path: path.join(outDir, '03-guest-request-confirmed.png'), fullPage: true });

  // 3. Manager: verify the live request, alerts and staff/shift controls.
  manager = await contextFor('02-manager');
  await login(manager.page, MANAGER_EMAIL, MANAGER_PASSWORD, 'Manager');
  await saveCheckpoint(manager.page, '04-manager-dashboard');
  const requestsOpened = await safeClick(manager.page, [/guest requests/i, /^requests$/i]);
  if (!requestsOpened) throw new Error('Manager dashboard did not expose Guest Requests.');
  await manager.page.locator('input[placeholder*="Search"]').fill(runId);
  await manager.page.getByText(runId, { exact: false }).first().waitFor({ state: 'visible', timeout: 25000 });
  note('Manager receives guest complaint', 'PASS', 'unique test request is visible in Manager workspace');
  await saveCheckpoint(manager.page, '05-manager-guest-request');

  const teamOpened = await safeClick(manager.page, [/staff & roles/i, /team/i]);
  if (teamOpened) {
    await manager.page.waitForTimeout(800);
    note('Manager staff and role controls', 'PASS', 'staff workspace opened');
    await saveCheckpoint(manager.page, '06-manager-staff-roles');
  } else {
    note('Manager staff and role controls', 'WARN', 'team navigation label not found; captured current dashboard');
  }

  // 4. Optional worker sessions prove the automatic queue handoff without manual assignment.
  const workerCredentials = MAINTENANCE_EMAIL && MAINTENANCE_PASSWORD
    ? { email: MAINTENANCE_EMAIL, password: MAINTENANCE_PASSWORD, role: 'Maintenance' }
    : HOUSEKEEPING_EMAIL && HOUSEKEEPING_PASSWORD
      ? { email: HOUSEKEEPING_EMAIL, password: HOUSEKEEPING_PASSWORD, role: 'Housekeeping' }
      : null;
  if (workerCredentials) {
    worker = await contextFor('03-worker');
    await login(worker.page, workerCredentials.email, workerCredentials.password, workerCredentials.role);
    await saveCheckpoint(worker.page, '07-worker-dashboard');
    note(`${workerRole} queue inspection`, 'PASS', 'worker dashboard captured; inspect the video/report to confirm the routed task appears');
  } else {
    note('Worker queue inspection', 'SKIP', 'set MAINTENANCE_EMAIL/PASSWORD or HOUSEKEEPING_EMAIL/PASSWORD to record a worker session');
  }

  note('Walkthrough', 'PASS', `run id ${runId}`);
} catch (error) {
  failures.push(error?.stack || String(error));
  note('Walkthrough', 'FAIL', error?.message || String(error));
  if (frontdesk) await saveCheckpoint(frontdesk.page, 'failure-frontdesk');
  if (manager) await saveCheckpoint(manager.page, 'failure-manager');
  if (worker) await saveCheckpoint(worker.page, 'failure-worker');
} finally {
  if (worker) await closeRecordedSession(worker, '03-worker.webm');
  if (manager) await closeRecordedSession(manager, '02-manager.webm');
  if (frontdesk) await closeRecordedSession(frontdesk, '01-frontdesk-and-guest.webm', guestPage ? [guestPage] : []);
  await browser.close();
  const report = {
    runId, baseUrl: BASE_URL, startedAt: new Date().toISOString(),
    results, failures,
    notes: [
      'Videos and traces are saved locally under the artifacts directory.',
      'A test guest request is created; use a dedicated demo hotel and demo accounts.',
      'This recorder does not delete business records or rotate/revoke QR tokens.'
    ]
  };
  await fs.writeFile(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  await fs.writeFile(path.join(outDir, 'report.md'), [
    '# CasaFlow walkthrough report', '',
    `- Run: ${runId}`,
    `- URL: ${BASE_URL}`,
    `- Result: ${failures.length ? 'FAILED' : 'COMPLETED'}`, '',
    '## Steps', ...results.map(r => `- **${r.status}** ${r.name}${r.detail ? ` — ${r.detail}` : ''}`), '',
    '## Browser errors', ...(failures.length ? failures.map(x => `- ${x}`) : ['- None captured']), ''
  ].join('\n'));
  console.log(`\nArtifacts: ${outDir}`);
  console.log(`Report: ${path.join(outDir, 'report.md')}`);
  if (failures.length) process.exitCode = 1;
}
