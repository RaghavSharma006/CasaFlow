import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const main=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
test('password sign-in hands the authenticated session to the app immediately',()=>{
 const auth=main.slice(main.indexOf('function Auth('),main.indexOf('function Onboard('));
 assert.match(auth,/signInWithPassword\(\{email:normalized,password\}\)/);
 assert.match(auth,/onAuthenticated\(login\.session\)/);
 assert.doesNotMatch(auth,/from\('memberships'\)|begin_work_shift|casaflow-signin-pending/);
});
test('hotel selection does not recreate load or queue a duplicate startup fetch',()=>{
 assert.match(main,/const hotelRef=useRef<string\|null>\(hotel\);hotelRef\.current=hotel/);
 assert.match(main,/\},\[session\?\.user\?\.id\]\);/);
});
test('initial workspace load reuses membership and starts shift after painting data',()=>{
 assert.match(main,/queryData\(valid!,\{memberships,includeChats:false\}\)/);
 assert.match(main,/next\.staffDispatch\.find/);
 assert.match(main,/setData\(next\);setLastSync\(Date\.now\(\)\);setLastError\(''\);setSync\('live'\)/);
 assert.match(main,/void rpc\('begin_work_shift',\{p_hotel:valid!\}\)/);
});
test('chat history is not fetched during login and loads when its screen is opened',()=>{
 const db=readFileSync(new URL('../src/db.ts',import.meta.url),'utf8');
 assert.match(db,/options\.includeChats===false/);
 assert.match(db,/options\.memberships/);
 assert.match(main,/if\(view==='messages'\)void refreshChats\(\)/);
});
test('realtime subscription does not immediately trigger a duplicate full load',()=>{
 assert.match(main,/\.subscribe\(s=>\{if\(s==='SUBSCRIBED'\)\{setSync\('live'\)\}/);
 assert.doesNotMatch(main,/if\(s==='SUBSCRIBED'\)\{setSync\('live'\);refreshRef\.current\(\)\}/);
});
test('password submission shows a dedicated verification state instead of a stuck login form',()=>{
 const auth=main.slice(main.indexOf('function Auth('),main.indexOf('function Onboard('));
 assert.match(auth,/working&&!resetMode&&!signUp/);
 assert.match(auth,/Verifying your sign-in securely/);
});
test('successful signup sessions also immediately enter the authenticated app',()=>{
 assert.match(main,/if\(data\.session\)\{\s*onAuthenticated\(data\.session\)/);
});

test('setup is shown only after membership lookup confirms no active membership',()=>{
 assert.match(main,/membershipState==='none'\)return <Onboard/);
 assert.match(main,/setMembershipState\('ready'\);[\s\S]*?memberships:memberships as Member\[\]/);
 assert.doesNotMatch(main,/if\(!hotel\|\|!myMember\)return <Onboard/);
});
test('workspace query errors cannot route an existing member into onboarding',()=>{
 assert.match(main,/setMembershipState\(current=>current==='ready'\?'ready':'error'\)/);
});
test('initial auth event wins over a late getSession response',()=>{
 assert.match(main,/let authEventSeen=false/);
 assert.match(main,/if\(!authEventSeen\)setSession\(data.session\)/);
});
test('sign-in screen has no create-account toggle',()=>{
 const auth=main.slice(main.indexOf('function Auth('),main.indexOf('function Onboard('));
 assert.doesNotMatch(auth,/className="authswitch"/);
});
