import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../src/casa_v8.css',import.meta.url),'utf8');
const portalCss=readFileSync(new URL('../src/preview_portals.css',import.meta.url),'utf8');
const main=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
const preview=readFileSync(new URL('../src/AtelierPreview.tsx',import.meta.url),'utf8');
const previews=readFileSync(new URL('../src/PreviewWorkspaces.tsx',import.meta.url),'utf8');
test('desktop nav is a vertical list, not a horizontally overflowing row',()=>{
 assert.match(css,/\.a7\.cf8 \.sidebar nav\{[^}]*flex-direction:column/);
 assert.match(portalCss,/@media\(min-width:701px\)\{\s*\.a7\.cf8 \.sidebar nav\{flex-direction:column!important/);
});
test('phone navigation has a reachable More menu, not vanished destinations',()=>{
 assert.match(portalCss,/cf8-mobile-more-button/);
 assert.match(main,/className=\"cf8-more-overlay\"/);
 assert.match(preview,/className=\"cf8-more-overlay\"/);
});
test('nine workspaces are still available to hotel owner',()=>{
 for(const view of ['overview','rooms','cleaning','maintenance','requests','team','messages','activity','settings']){
  assert.match(main,new RegExp("id:'"+view+"'"));
  assert.match(previews,new RegExp("id:'"+view+"'"));
 }
});
test('design preview explicitly links to the real signed-in app',()=>{
 assert.match(preview,/DESIGN PREVIEW · SAMPLE DATA/);
 assert.match(preview,/Sign in to the live hotel app/);
 assert.match(main,/db\.auth\.getSession/);
 assert.match(main,/queryData\(valid!/);
});
