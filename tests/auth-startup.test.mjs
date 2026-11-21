import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const main=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
test('password sign-in hands the authenticated session to the app immediately',()=>{
 const auth=main.slice(main.indexOf('function Auth('),main.indexOf('const guestCategories'));
 assert.match(auth,/signInWithPassword\(\{email:normalized,password\}\)/);
 assert.match(auth,/onAuthenticated\(login\.session\)/);
 assert.doesNotMatch(auth,/from\('memberships'\)|begin_work_shift|casaflow-signin-pending/);
});
test('workspace initialization does not reload just because the hotel id was not cached',()=>{
 assert.match(main,/if\(valid!==hotel\)\{setHotel\(valid\);hotelStorage\.setItem\('casaflow-hotel',valid!\)\}/);
 assert.doesNotMatch(main,/if\(valid!==hotel\)\{setHotel\(valid\);hotelStorage\.setItem\('casaflow-hotel',valid!\);return\}/);
});
test('first-time shift creation overlaps initial workspace data loading',()=>{
 assert.match(main,/Promise\.all\(\[queryData\(valid!\),!shift\.data\?\.shift_started_at\?rpc\('begin_work_shift'/);
 assert.match(main,/shift\.data\.shift_started_at&&\(!shift\.data\.on_shift/);
});
test('successful signup sessions also immediately enter the authenticated app',()=>{
 assert.match(main,/if\(data\.session\)\{\s*onAuthenticated\(data\.session\)/);
});
