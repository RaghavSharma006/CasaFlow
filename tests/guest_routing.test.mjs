import test from 'node:test';
import assert from 'node:assert/strict';
import{readFileSync}from'node:fs';
const sql=readFileSync(new URL('../supabase/20261115_guest_qr_routing.sql',import.meta.url),'utf8');
const sqlBulk=readFileSync(new URL('../supabase/20261115_bulk_qr_and_security.sql',import.meta.url),'utf8');
const ui=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
const db=readFileSync(new URL('../src/db.ts',import.meta.url),'utf8');
test('guest choices route towels and supplies to housekeeping',()=>{assert.match(sql,/p_category in\('extra_towels','missing_supplies'\) then 'housekeeping'/)});
test('AC and plumbing requests require verified maintenance skills',()=>{assert.match(sql,/when 'broken_ac' then 'ac' when 'plumbing' then 'plumbing'/);assert.match(sql,/v_skill=any\(s\.verified_skills\)/)});
test('no unverified or off-shift employee automatically receives guest jobs',()=>{assert.match(sql,/s\.on_shift/);assert.match(sql,/m\.active/);assert.match(sql,/s\.max_open_tasks/)});
test('guest requests are rate limited and QR secrets are hashed',()=>{assert.match(sql,/last_request_at>now\(\)-interval '30 seconds'/);assert.match(sql,/extensions\.digest\(p_token,'sha256'\)/);assert.match(sql,/extensions\.gen_random_bytes\(32\)/)});
test('urgent and unassigned requests add management alerts',()=>{assert.match(sql,/reason,target,body/);assert.match(sql,/values\(v_hotel,v_task,'urgent','both'/);assert.match(sql,/values\(v_hotel,v_task,'no_worker','management'/)});
test('unaccepted requests escalate by a lock-safe database process',()=>{assert.match(sql,/public\.escalate_guest_requests/);assert.match(sql,/for update skip locked/);assert.match(sql,/values\(v_task.hotel_id,v_id,'unaccepted','management'/)});
test('non-urgent worker acceptance is version checked and assignee restricted',()=>{assert.match(sql,/function public\.accept_guest_request/);assert.match(sql,/v_task\.assigned_to is distinct from auth\.uid\(\)/);assert.match(sql,/Version conflict/)});
test('operational alert RLS prevents unauthorized read and acknowledgement',()=>{assert.match(sql,/create policy ops_alerts_read/);assert.match(sqlBulk,/a\.target in\('frontdesk','both'\)/)});
test('guest form lists predefined categories and creates categorized request',()=>{for(const c of ['extra_towels','broken_ac','plumbing','missing_supplies','other'])assert.match(ui,new RegExp(c));assert.match(ui,/submit_guest_request/);assert.match(ui,/guest_room_info/)});
test('worker dashboards show guest tasks routed to their actual department',()=>{assert.match(ui,/g\.department==='housekeeping'/);assert.match(ui,/g\.department==='maintenance'/)});
test('manager sets verified skills; login automatically starts employee shifts',()=>{assert.match(sql,/function public\.set_staff_dispatch/);assert.match(sql,/function public\.set_my_shift/);assert.doesNotMatch(ui,/rpc\('set_my_shift'/);assert.match(ui,/begin_work_shift/);assert.match(ui,/set_staff_dispatch/)});
test('bulk printable QRs are limited to 60 and never replace existing labels',()=>{assert.match(sqlBulk,/p_limit>60/);assert.match(sqlBulk,/c\.room_id is null/);assert.match(ui,/issue_room_qrs_bulk/)});
test('guest QR and staff metadata use role-filtered RLS',()=>{assert.match(sql,/alter table public\.room_qr_codes enable row level security/);assert.match(sql,/alter table public\.guest_request_meta enable row level security/);assert.match(db,/from\('ops_alerts'\)/)});
test('room-specific QR printer uses selected room, not first room',()=>{assert.match(ui,/initialRoom=\{qrRoomId\}/);assert.match(ui,/setQrRoomId\(room\.id\)/);assert.match(ui,/useState\(initialRoom\|\|rooms\[0\]\?\.id/)});

const offlineVisibility=readFileSync(new URL('../supabase/20261121_preserve_offline_task_visibility.sql',import.meta.url),'utf8');
test('offline technicians can still read their assigned open tasks',()=>{
 assert.match(offlineVisibility,/or assigned_to = \(select auth\.uid\(\)\)/);
 assert.match(offlineVisibility,/assigned_to is null[\s\S]*status in \('open','doing'\)/);
});
test('unassigned AC guest requests remain visible only to maintenance staff with verified AC skill',()=>{
 assert.match(offlineVisibility,/gm\.category = 'broken_ac'[\s\S]*'ac' = any\(sd\.verified_skills\)/);
 assert.match(offlineVisibility,/gm\.department = 'maintenance'[\s\S]*app_private\.can_role\(hotel_id, array\['maintenance'\]/);
});
test('offline queue access does not remove write-side shift guards',()=>{
 assert.match(offlineVisibility,/for select to authenticated/);
 assert.match(offlineVisibility,/for select to authenticated/);
 assert.doesNotMatch(offlineVisibility,/for (insert|update|delete)/i);
});
test('technicians can see room details for rooms containing tasks visible to them',()=>{
 assert.match(offlineVisibility,/create policy rooms_read[\s\S]*exists \([\s\S]*from public\.tasks t[\s\S]*t\.room_id = rooms\.id/);
});
