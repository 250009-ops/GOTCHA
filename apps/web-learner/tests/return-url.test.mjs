import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { safeLearnerReturnPath as r } from '../src/lib/learnerReturn.ts';
const O = 'https://gotchaa.uz';
// accepted: same-origin learner app paths
assert.equal(r('/app/plus?from=landing-plus&ui=en', O), '/app/plus?from=landing-plus&ui=en');
assert.equal(r('/learn/app/plus?from=landing-plus&ui=uz', O), '/app/plus?from=landing-plus&ui=uz');
assert.equal(r('%2Fapp%2Fplus', O), null, 'raw encoded string is not a path (router decodes before)');
assert.equal(r(decodeURIComponent('%2Fapp%2Fplus%3Ffrom%3Dlanding-plus'), O), '/app/plus?from=landing-plus');
assert.equal(r('/app', O), '/app');
assert.equal(r('/app/practice', O), '/app/practice');
assert.equal(r('https://gotchaa.uz/learn/app/payments', O), '/app/payments');
assert.equal(r('/app/plus?returnUrl=https://evil.com&x=1', O), '/app/plus?x=1', 'nested returnUrl stripped');
// rejected: open redirects and non-app paths
for (const bad of ['https://evil.com/app', '//evil.com/app', '/\\evil.com', 'javascript:alert(1)', '/login', '/admin', '/app/../admin',
  '/appx', '/app/%2e%2e/x', 'http://gotchaa.uz.evil.com/learn/app', '/learn/admin', '', null, undefined, 42, '/app\nx', 'https://evil.com/learn/app/plus'])
  assert.equal(r(bad, O), null, String(bad));
// wiring: login and register both use it; ProtectedRoute passes returnUrl
const auth = readFileSync(new URL('../src/pages/AuthPage.tsx', import.meta.url), 'utf8');
assert.equal((auth.match(/navigate\(learnerReturn \?\? '\/app'/g) || []).length, 2);
assert.match(readFileSync(new URL('../src/components/ProtectedRoute.tsx', import.meta.url), 'utf8'), /\/login\?returnUrl=\$\{back\}/);
console.log('return-url: OK');
