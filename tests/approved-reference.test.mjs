import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const main=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
const overview=readFileSync(new URL('../src/CasaOverview.tsx',import.meta.url),'utf8');
const board=readFileSync(new URL('../src/CasaRoomBoard.tsx',import.meta.url),'utf8');
const preview=readFileSync(new URL('../src/AtelierPreview.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/casa_v8.css',import.meta.url),'utf8');
test('real and preview use the same new overview and room board components',()=>{
 for(const component of ['CasaOverview','CasaRoomBoard']){assert.match(main,new RegExp('<'+component));assert.match(preview,new RegExp('<'+component))}
 assert.match(main,/className="app atelier-app a7 cf8"/);assert.match(preview,/className="app atelier-app a7 cf8/);
});
test('approved visual anatomy remains explicit and readable',()=>{
 for(const key of ['cf8-overview-hero','cf8-readiness','cf8-overview-kpis','cf8-overview-grid','cf8-floor-widget','cf8-attention','cf8-shift'])assert.ok(overview.includes(key),key);
 for(const key of ['cf8-filterbar','cf8-count-strip','cf8-floor-group','cf8-room-tile','cf8-detail','cf8-list-row'])assert.ok(board.includes(key),key);
 for(const key of ['--cf-paper:#f4f2e9','--cf-forest:#102e24','--cf-acid:#dcf68b','.cf8-room-grid','@media(max-width:700px)'])assert.ok(css.includes(key),key);
});
test('live overview calculates actual readiness, alerts and shifts',()=>{
 assert.match(overview,/rooms\.filter\(r=>r\.status==='ready'\)/);
 assert.match(overview,/alerts\.length/);assert.match(overview,/dispatch\.filter/);
 assert.match(overview,/onRoom\(r\.id\)/);assert.match(overview,/onChat/);
});
test('design preview is fictional, standalone, bilingual, dark-mode ready',()=>{
 assert.match(preview,/sampleRooms/);assert.match(preview,/setTheme/);assert.match(preview,/setLang/);
 assert.match(css,/\[data-theme="night"\]/);assert.match(css,/@media\(max-width:700px\)/);
});
