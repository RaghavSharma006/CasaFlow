import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const main=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
const overview=readFileSync(new URL('../src/CasaOverview.tsx',import.meta.url),'utf8');
const board=readFileSync(new URL('../src/CasaRoomBoard.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/casa_v8.css',import.meta.url),'utf8');
const route=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
test('selected final Signal Atelier is active for real hotel accounts',()=>{
 assert.match(main,/className="app atelier-app a7 cf8"/);assert.match(main,/<CasaOverview lang=\{lang\}/);assert.match(main,/<CasaRoomBoard lang=\{lang\}/);
});
test('public preview does not require staff login',()=>{
 assert.match(main,/location\.pathname==='\/design'/);assert.match(main,/if\(location\.pathname==='\/design'\)return <AtelierPreview/);
 assert.ok(route.rewrites.some(x=>x.source==='/design'&&x.destination==='/index.html'));
});
test('role portals and secure guest route are preserved',()=>{
 for(const p of ['/owner','/manager','/desk','/supervisor','/cleaner','/technician','/guest','/dev'])assert.ok(route.rewrites.some(x=>x.source===p));
 for(const marker of ['guestCategories','set_staff_dispatch','send_private_message','checkin_room','checkout_room'])assert.ok(main.includes(marker));
});
test('room operations use bounded floor renders and no overflowing kanban cards',()=>{
 assert.match(board,/items\.slice\(0,limits\[f\]\|\|100\)/);
 assert.match(board,/items\.slice\(0,limits\[s\]\|\|30\)/);
 assert.match(board,/filtered\.slice\(0,limits\.list\|\|150\)/);
 assert.match(css,/\.cf8-status-grid\{[^}]*overflow-x:auto/);
 assert.match(css,/\.cf8-room-grid\{[^}]*repeat\(auto-fit,minmax\(94px,1fr\)\)/);
});
test('theme and accessibility rules survive desktop and mobile',()=>{
 assert.match(css,/\.a7\.cf8\[data-theme="night"\]/);
 assert.match(css,/@media\(max-width:700px\)/);
 assert.match(css,/:focus-visible/);
 assert.match(board,/aria-expanded=\{open\}/);
 assert.match(board,/aria-pressed=\{selected===r\.id\}/);
});
