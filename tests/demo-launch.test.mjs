import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const api=readFileSync(new URL('../api/demo/launch.ts',import.meta.url),'utf8');
const launcher=readFileSync(new URL('../src/DemoLaunch.tsx',import.meta.url),'utf8');
const db=readFileSync(new URL('../src/db.ts',import.meta.url),'utf8');
const main=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
test('public demo launch is disabled unless isolated data is explicitly confirmed',()=>{
 assert.match(api,/DEMO_PUBLIC_ENABLED!=='true'/);
 assert.match(api,/DEMO_DATA_ISOLATED!=='true'/);
 assert.match(api,/DEMO_TENANT_ID/);
});
test('demo roles are allowlisted and checked against tenant membership role',()=>{
 assert.match(api,/const roles:/);
 assert.match(api,/hasOwnProperty\.call\(roles,body\.role\)/);
 assert.match(api,/m\.role===selected\.expectedRole/);
 assert.match(api,/eq\('hotel_id',tenant\)/);
});
test('demo launcher requires a signed CasaFlow handshake',()=>{
 assert.match(api,/CASAFLOW_DEMO_SHARED_SECRET/);
 assert.match(api,/createHmac\('sha256'/);
 assert.match(api,/timingSafeEqual/);
 assert.match(api,/claims\.iss!=='https:\/\/casaflow\.tech'/);
 assert.match(api,/claims\.aud!=='hotel-ops-pilot'/);
 assert.match(api,/consumedTickets/);
 assert.doesNotMatch(api,/TURNSTILE|challenges\.cloudflare/i);
});
test('browser launcher automatically opens the workspace from a signed ticket',()=>{
 assert.match(launcher,/fetch\('\/api\/demo\/launch'/);
 assert.match(launcher,/body:JSON\.stringify\(\{role,ticket\}\)/);
 assert.match(launcher,/db\.auth\.setSession/);
 assert.match(launcher,/history\.replaceState/);
 assert.match(launcher,/started\.current=true;void launch\(\)/);
 assert.match(launcher,/useRef\(false\)/);
 assert.doesNotMatch(launcher,/<button|<select|onClick=|turnstile|password|service_role/i);
});
test('demo path receives a unique per-tab Supabase storage key',()=>{
 assert.match(db,/window\.location\.pathname==='\/demo-launch'/);
 assert.match(db,/casaflow-parallel-\$\{tabId\}-auth-token/);
});
test('parallel/demo tabs use local logout and never end the shared work shift',()=>{
 assert.match(main,/db\.auth\.signOut\(parallelMode\?\{scope:'local'\}:undefined\)/);
 assert.match(main,/if\(hotel&&!parallelMode\)/);
 assert.match(main,/!shiftEnd\|\|parallelMode/);
});
