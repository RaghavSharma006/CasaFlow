import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const main = fs.readFileSync(new URL('./src/main.tsx',root), 'utf8');
const resetPage = fs.readFileSync(new URL('./src/PasswordResetPage.tsx',root), 'utf8');
const vcfg = JSON.parse(fs.readFileSync(new URL('./vercel.json',root), 'utf8'));

test('forgot-password explicitly requests the production reset path',()=>{
 assert.match(main, /resetPasswordForEmail\(normalized,\{redirectTo:'https:\/\/hotel-ops-pilot\.vercel\.app\/reset-password'\}\)/);
});
test('password reset path is exposed by deployment rewrite',()=>{
 assert.ok(vcfg.rewrites.some(r=>r.source==='/reset-password' && r.destination==='/reset-password.html'));
});
test('new password requires valid recovery session',()=>{
 assert.match(resetPage,/!db\|\|!recovery\|\|!session/);
 assert.match(resetPage,/db\.auth\.updateUser\(\{password\}\)/);
});
