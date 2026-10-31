import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveLegacyPath } from '../src/lib/legacyRoutes.ts';
import { shouldShowAgePrompt, rememberAgePromptDismissed, AGE_PROMPT_KEY } from '../src/lib/agePromptPolicy.ts';
import { buildLabel } from '../src/lib/buildInfo.ts';

// S3a: legacy routes → new equivalents; unknown → null (404 page)
const exp = { '/app/profile': '/app/settings', '/profile': '/app/settings', '/app/library': '/app', '/library': '/app',
  '/app/upgrade': '/app/plus', '/upgrade': '/app/plus', '/app/pricing': '/app/plus', '/pricing': '/app/plus',
  '/app/billing': '/app/payments', '/billing': '/app/payments', '/app/statistics': '/app/stats', '/statistics': '/app/stats',
  '/practice': '/app/practice', '/app/profile/': '/app/settings' };
for (const [k, v] of Object.entries(exp)) assert.equal(resolveLegacyPath(k), v, k);
for (const k of ['/app/nope', '/xyz', '/app/settings/zzz', '/admin']) assert.equal(resolveLegacyPath(k), null, k);
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
assert.equal((app.match(/path="\*" element={<NotFoundPage \/>}/g) || []).length, 2, 'nested /app/* and top-level * both use NotFoundPage');
assert.ok(!/path="\*" element={<LocaleNavigate to="\/app"/.test(app), 'no silent catch-all redirect to /app');
assert.match(readFileSync(new URL('../src/pages/NotFoundPage.tsx', import.meta.url), 'utf8'), /404/);

// S3b: shown once, dismissible, remembered, never modal
const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
const s = mem(); const u = { id: 'u1', needsAgePrompt: true };
assert.equal(shouldShowAgePrompt(u, s), true);
assert.equal(shouldShowAgePrompt({ id: 'u1', needsAgePrompt: false }, s), false);
assert.equal(shouldShowAgePrompt(null, s), false);
rememberAgePromptDismissed('u1', s);
assert.equal(s.getItem(AGE_PROMPT_KEY('u1')), '1');
assert.equal(shouldShowAgePrompt(u, s), false, 'dismissal remembered');
assert.equal(shouldShowAgePrompt({ id: 'u2', needsAgePrompt: true }, s), true, 'per user');
const throwing = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
assert.equal(shouldShowAgePrompt(u, throwing), true); rememberAgePromptDismissed('u1', throwing);
const ap = readFileSync(new URL('../src/components/safety/AgePrompt.tsx', import.meta.url), 'utf8');
assert.match(ap, /aria-modal="false"/); assert.ok(!/aria-modal="true"/.test(ap));
assert.ok(!/fixed inset-0/.test(ap), 'no full-screen backdrop');
assert.match(ap, /Escape/); assert.match(ap, /aria-label={CLOSE/);
assert.match(ap, /pointer-events-none/);

// S4: build id
assert.equal(buildLabel({ VITE_BUILD_SHA: 'abc1234', VITE_BUILD_DATE: '2026-10-31' }), 'build abc1234 · 2026-10-31');
assert.equal(buildLabel({}), 'build dev');
assert.match(readFileSync(new URL('../src/pages/SettingsPage.tsx', import.meta.url), 'utf8'), /data-testid="build-id"/);
console.log('s3-final61: OK');
