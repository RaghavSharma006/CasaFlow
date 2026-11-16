import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const db=readFileSync(new URL('../src/db.ts',import.meta.url),'utf8');
const main=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
const launcher=readFileSync(new URL('../parallel.html',import.meta.url),'utf8');
const vite=readFileSync(new URL('../vite.config.ts',import.meta.url),'utf8');
const vercel=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
test('parallel mode is opt in and stays active when route changes',()=>{
 assert.match(db,/get\('parallel'\)==='1'/);
 assert.match(db,/sessionStorage\.setItem\(PARALLEL_FLAG,'1'\)/);
 assert.match(db,/sessionStorage\.getItem\(PARALLEL_FLAG\)/);
});
test('parallel tabs isolate Supabase sessions and BroadcastChannel key',()=>{
 assert.match(db,/window\.crypto\.randomUUID\(\)/);
 assert.match(db,/window\.sessionStorage,storageKey:parallelAuthKey/);
 assert.match(db,/parallelAuthKey=`casaflow-parallel-\$\{tabId\}-auth-token`/);
 assert.match(db,/parallelMode\?\{storage:window\.sessionStorage,storageKey:parallelAuthKey\}:\{\}/);
});
test('hotel selection and signout are isolated with role login',()=>{
 assert.match(main,/hotelStorage\.removeItem\('casaflow-hotel'\)/);
 assert.match(main,/hotelStorage\.setItem\('casaflow-hotel'/);
 assert.match(db,/parallelMode\?window\.sessionStorage:window\.localStorage/);
});
test('eight roles get opener-free links to fresh tabs',()=>{
 assert.equal((launcher.match(/role:'/g)||[]).length,8);
 assert.match(launcher,/launch\.rel='noopener noreferrer'/);
 assert.match(launcher,/\?parallel=1/);
 assert.doesNotMatch(launcher,/password:|access_token=|refresh_token=/i);
});
test('parallel page is bundled and routes correctly',()=>{
 assert.match(vite,/parallel:'parallel.html'/);
 assert.ok(vercel.rewrites.some(r=>r.source==='/parallel' && r.destination==='/parallel.html'));
});
