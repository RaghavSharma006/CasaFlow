import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const main=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
const preview=readFileSync(new URL('../src/AtelierPreview.tsx',import.meta.url),'utf8');
const portals=readFileSync(new URL('../src/PreviewWorkspaces.tsx',import.meta.url),'utf8');
const styles=readFileSync(new URL('../src/preview_portals.css',import.meta.url),'utf8');
test('live hotel app retains all nine operational sections',()=>{
 for(const id of ['overview','rooms','cleaning','maintenance','requests','team','messages','activity','settings'])assert.ok(main.includes(`id:'${id}'`),id+' missing from live nav');
 assert.match(main,/ownerViews:View\[\]=\['overview','rooms','cleaning','maintenance','requests','team','messages','activity','settings'\]/);
});
test('design preview includes all operations, not just overview and rooms',()=>{
 for(const id of ['overview','rooms','cleaning','maintenance','requests','team','messages','activity','settings'])assert.match(portals,new RegExp(`id:'${id}'`));
 assert.match(preview,/PreviewWorkspaces/);
 assert.match(preview,/PREVIEW_NAV\.filter/);
 assert.match(preview,/ROLE_NAV\[role\]/);
});
test('mobile navigation has an explicit More entry and an accessible all-sections menu',()=>{
 assert.match(main,/cf8-mobile-more-button/);
 assert.match(main,/cf8-more-sheet/);
 assert.match(preview,/cf8-mobile-more-button/);
 assert.match(styles,/cf8-mobile-more-button/);
 assert.match(styles,/cf8-more-overlay/);
});
test('demo actions remain isolated from Supabase data',()=>{
 assert.doesNotMatch(portals,/db\.rpc\(|queryData\(|from\('rooms'\)/);
 assert.match(preview,/Sample hotel data and simulated actions/);
 assert.match(portals,/Simulated data/);
});
