import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const reset=fs.readFileSync(new URL('../src/PasswordResetPage.tsx',import.meta.url),'utf8');
const config=JSON.parse(fs.readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
const vite=fs.readFileSync(new URL('../vite.config.ts',import.meta.url),'utf8');
test('Site sends recovery URLs into dedicated reset flow before rendering main app',()=>{assert.match(index,/p\.get\('type'\)==='recovery'/);assert.match(index,/\/reset-password/);});
test('Vercel and Vite serve a static reset page on deep links',()=>{assert.ok(config.rewrites.some(x=>x.source==='/reset-password'&&x.destination==='/reset-password.html'));assert.match(vite,/'reset-password.html'/);});
test('Reset form verifies recovery event and saves password securely',()=>{assert.match(reset,/PASSWORD_RECOVERY/);assert.match(reset,/session&&recovery/);assert.match(reset,/db\.auth\.updateUser\(\{password\}\)/);assert.match(reset,/password!==confirm/);assert.match(reset,/db\.auth\.signOut\(\)/);});
