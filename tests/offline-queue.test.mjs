import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const ui=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
const db=readFileSync(new URL('../src/db.ts',import.meta.url),'utf8');
const migration=readFileSync(new URL('../supabase/20261121111827_preserve_offline_task_visibility_and_department_queues.sql',import.meta.url),'utf8');
const dispatchMigration=readFileSync(new URL('../supabase/20261121120811_restore_worker_shift_access_and_queue_refill.sql',import.meta.url),'utf8');

test('maintenance overview counts the department queue, not only personally assigned tasks',()=>{
 assert.match(ui,/const workerQueue=pending\.filter/);
 assert.match(ui,/role==='maintenance'[\s\S]*?guestMeta\.some\(g=>g\.task_id===k\.id&&g\.department==='maintenance'\)/);
 assert.match(ui,/label=\{lang==='en'\?'My department queue'/);
 assert.match(ui,/taskCards\(workerQueue\)/);
});
test('housekeeping overview also retains unassigned department tasks',()=>{
 assert.match(ui,/role==='housekeeping'[\s\S]*?guestMeta\.some\(g=>g\.task_id===k\.id&&g\.department==='housekeeping'\)/);
});
test('unassigned AC and plumbing guest tasks are visible only to skilled maintenance staff',()=>{
 assert.match(migration,/gm\.department = 'maintenance'[\s\S]*?app_private\.can_role\(hotel_id, array\['maintenance'\]/);
 assert.match(migration,/gm\.category = 'broken_ac'[\s\S]*?'ac' = any\(sd\.verified_skills\)/);
 assert.match(migration,/gm\.category = 'plumbing'[\s\S]*?'plumbing' = any\(sd\.verified_skills\)/);
});
test('tasks assigned to a worker stay readable when that worker is offline',()=>{
 assert.match(migration,/or assigned_to = \(select auth\.uid\(\)\)/);
});
test('queue visibility grants no off-shift task mutation privileges',()=>{
 assert.match(migration,/for select to authenticated/);
 assert.doesNotMatch(migration,/for (insert|update|delete)/i);
 assert.match(ui,/rpc\('begin_work_shift'/);
});
test('task and room reads still require active hotel membership',()=>{
 assert.match(migration,/app_private\.can_access\(hotel_id\)/);
 assert.match(migration,/app_private\.can_access\(hotel_id\)[\s\S]*?create policy rooms_read/);
});
test('workers can renew expired shifts without a forced sign-out',()=>{
 assert.match(ui,/const shiftInactive=!parallelMode&&!demoMode&&isShiftWorker/);
 assert.match(ui,/rpc\('begin_work_shift'/);
 assert.doesNotMatch(ui,/await db\.auth\.signOut\(\);[\s\S]{0,180}Please sign in again to start your next shift/);
 assert.match(ui,/startShift=async/);
});
test('workers can claim eligible open unassigned tasks through a protected RPC',()=>{
 assert.match(ui,/const mayClaim=\(task:Task\)=>/);
 assert.match(ui,/rpc\('claim_department_task'/);
 assert.match(dispatchMigration,/v_task\.assigned_to IS NOT NULL/);
 assert.match(dispatchMigration,/v_required_skill=ANY\(s\.verified_skills\)/);
 assert.match(dispatchMigration,/v_open_count>=v_capacity/);
});
test('completed work triggers automatic queue refill',()=>{
 assert.match(dispatchMigration,/CREATE TRIGGER casaflow_rebalance_released_work/);
 assert.match(dispatchMigration,/PERFORM app_private\.rebalance_work\(NEW\.hotel_id\)/);
});
