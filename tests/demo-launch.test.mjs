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
test('launch endpoint requires origin and Turnstile verification',()=>{
 assert.match(api,/allowedOrigin\(req\)/);
 assert.match(api,/verifyTurnstile\(body\.turnstileToken,ip\)/);
 assert.match(api,/TURNSTILE_SECRET_KEY/);
});
test('browser launcher never accepts credentials and hands off session without URL tokens',()=>{
 assert.match(launcher,/fetch\('\/api\/demo\/launch'/);
 assert.match(launcher,/db\.auth\.setSession/);
 assert.doesNotMatch(launcher,/password|service_role/i);
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
