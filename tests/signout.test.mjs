import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const main=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
const styles=readFileSync(new URL('../src/casa_v8.css',import.meta.url),'utf8');
test('real app exposes a labeled sign-out button in header',()=>{
  assert.match(main,/className="cf8-signout-header"/);
  assert.match(main,/aria-label=\{t.logout\}/);
  assert.match(main,/onClick=\{\(\)=>void signOut\(\)\}/);
});
test('sign-out invokes Supabase, resets account and hotel session',()=>{
  assert.match(main,/await db\.auth\.signOut\(parallelMode\?\{scope:'local'\}:undefined\)/);
  assert.match(main,/setSession\(null\);setHotel\(null\)/);
  assert.match(main,/hotelStorage\.removeItem\('casaflow-hotel'\)/);
});
test('mobile sign-out icon is visible when sidebar is hidden',()=>{
  assert.match(styles,/@media\(max-width:700px\)\{\.a7\.cf8 \.cf8-signout-header\{/);
  assert.match(styles,/\.cf8-signout-header span\{display:none\}/);
});
