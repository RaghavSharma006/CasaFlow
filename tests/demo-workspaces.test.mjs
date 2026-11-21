import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const shared=read('server/demo-shared.js');
const start=read('api/demo/start.js');
const role=read('api/demo/role-session.js');
const cleanup=read('api/demo/cleanup.js');
const sql=read('supabase/20261121_public_demo_workspaces.sql');
const ui=read('src/DemoAccess.tsx');
const guest=read('src/GuestTracking.tsx');
const main=read('src/main.tsx');
const launcher=read('parallel.html');
const vercel=JSON.parse(read('vercel.json'));

test('server-side Supabase secret is used only by API code',()=>{
  assert.match(shared,/SUPABASE_SECRET_KEY/);
  assert.match(start,/auth\.admin\.createUser/);
  assert.doesNotMatch(ui,/password|service_role|sb_secret/i);
});

test('only the predefined eight demo roles may be launched',()=>{
  for(const key of ['owner','manager','reception','supervisor','cleaner1','cleaner2','ac','plumbing']) assert.ok(shared.includes(key+':'));
  assert.match(role,/hasOwnProperty\.call\(DEMO_ROLES,roleKey\)/);
});

test('demo cookies are HttpOnly, Secure, SameSite Strict and hashed at rest',()=>{
  assert.match(shared,/HttpOnly; Secure; SameSite=Strict/);
  assert.match(shared,/createHmac\('sha256'/);
  assert.match(shared,/45 \* 60/);
  assert.match(start,/cookie_hash:hashSecret\(cookieValue\)/);
});

test('role launch uses a one-time magic link and never sends credentials or token in URL',()=>{
  assert.match(role,/generateLink\(\{type:'magiclink'/);
  assert.match(role,/hashed_token/);
  assert.match(ui,/verifyOtp\(\{token_hash:body\.tokenHash,type:'magiclink'\}\)/);
  assert.doesNotMatch(ui,/access_token=|refresh_token=|token_hash=/);
});

test('database provisions eight role identities in one synthetic hotel per session',()=>{
  assert.match(sql,/public\.provision_demo_workspace/);
  assert.match(sql,/jsonb_array_length\(p_users\)<>8/);
  assert.match(sql,/insert into public\.hotels/);
  assert.match(sql,/insert into public\.memberships/);
});

test('expired or revoked demo sessions are rejected by application authorization helpers',()=>{
  assert.match(sql,/app_private\.demo_session_is_active/);
  assert.match(sql,/s\.revoked_at is null/);
  assert.match(sql,/s\.expires_at>now\(\)/);
  assert.match(sql,/create or replace function app_private\.can_access/);
  assert.match(sql,/create or replace function app_private\.can_role/);
  assert.match(sql,/create or replace function app_private\.active_work_shift/);
});

test('cleanup is protected and removes only temporary demo users and hotels',()=>{
  assert.match(cleanup,/CRON_SECRET/);
  assert.match(cleanup,/auth\.admin\.deleteUser/);
  assert.match(cleanup,/from\('hotels'\)\.delete/);
});

test('guest portal uses the existing tracked request and feedback functions',()=>{
  assert.match(guest,/submit_guest_request_tracked/);
  assert.match(guest,/guest_ticket_status/);
  assert.match(guest,/guest_ticket_feedback/);
  assert.match(main,/GuestTracking/);
});

test('parallel and demo role sign-out are tab-local',()=>{
  assert.match(main,/scope:\(parallelMode\|\|isDemoSession\)\?'local':'global'/);
  assert.match(main,/api\/demo\/status/);
});

test('public parallel page does not reveal the old shared-account emails',()=>{
  assert.match(launcher,/demo-launch/);
  assert.doesNotMatch(launcher,/raghav007ff\+/);
});

test('Vercel rewrites include public launcher routes and schedule cleanup',()=>{
  assert.ok(vercel.rewrites.some(rule=>rule.source==='/demo-launch'));
  assert.ok(vercel.rewrites.some(rule=>rule.source==='/demo-role'));
  assert.ok(vercel.crons.some(job=>job.path==='/api/demo/cleanup'));
});
