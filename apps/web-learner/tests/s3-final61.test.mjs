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

// WLF-36: ?ui= wins for guests; register step 1 links Terms/Privacy/Oferta in uz/ru/en
{
  const ctx = readFileSync(new URL('../src/lib/learnerLocaleContext.tsx', import.meta.url), 'utf8');
  assert.match(ctx, /searchParams\.get\('ui'\)[\s\S]{0,200}if \(!user && UI_LANGUAGES\.includes\(urlUi/);
  const { legalLinksText } = await import('../src/components/safety/LegalLinksLine.tsx').catch(() => ({ legalLinksText: null }));
  const ll = readFileSync(new URL('../src/components/safety/LegalLinksLine.tsx', import.meta.url), 'utf8');
  for (const k of ['/terms', '/privacy', '/oferta']) assert.ok(ll.includes('CONSENT_LINK_PATHS') && readFileSync(new URL('../src/lib/legalLinks.ts', import.meta.url), 'utf8').includes(`'${k}'`));
  assert.match(ll, /Ommaviy oferta/); assert.match(ll, /Публичная оферта/); assert.match(ll, /Public Offer/);
  assert.match(readFileSync(new URL('../src/pages/AuthPage.tsx', import.meta.url), 'utf8'), /!isLogin && <LegalLinksLine/);
  void legalLinksText;
}
// WLF-35: learner never calls the retired /marketing/landing
assert.ok(!readFileSync(new URL('../src/components/AuthShell.tsx', import.meta.url), 'utf8').includes('${API_BASE}/marketing/landing'));
console.log('s3-final61 WLF-35/36: OK');

// QA2-3: consent tick-box + separate required AI consent, uz/ru/en; Delete account in Settings
{
  const { AI_CONSENT_LABELS, CONSENT_VERSION } = await import('../src/components/safety/signupConsent.ts');
  for (const l of ['uz', 'ru', 'en']) assert.match(AI_CONSENT_LABELS[l], /OpenAI/);
  assert.ok(!/[A-Za-z]['’][A-Za-z]/.test(AI_CONSENT_LABELS.uz));
  assert.equal(CONSENT_VERSION, 'web-2026-10-31.4');
  const f = readFileSync(new URL('../src/components/safety/SignupSafetyFields.tsx', import.meta.url), 'utf8');
  assert.match(f, /data-testid="signup-consent"/); assert.match(f, /data-testid="signup-ai-consent"/);
  const a = readFileSync(new URL('../src/pages/AuthPage.tsx', import.meta.url), 'utf8');
  assert.match(a, /!acceptTerms \|\| !acceptAi\}/);
  const st = readFileSync(new URL('../src/pages/SettingsPage.tsx', import.meta.url), 'utf8');
  assert.match(st, /<DeleteAccount /);
  assert.match(readFileSync(new URL('../src/components/safety/DeleteAccount.tsx', import.meta.url), 'utf8'), /DELETE/);
  console.log('s3-final61 consents + delete: OK');
}
