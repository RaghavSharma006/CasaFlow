import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const ui=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
const db=readFileSync(new URL('../src/db.ts',import.meta.url),'utf8');
const migration=readFileSync(new URL('../supabase/20261121111827_preserve_offline_task_visibility_and_department_queues.sql',import.meta.url),'utf8');

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
