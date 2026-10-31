import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const r = (p) => readFileSync(p, 'utf8');
const settings = r('src/pages/SettingsPage.tsx');
const reader = r('src/pages/ReaderPage.tsx');
const auth = r('src/pages/AuthPage.tsx');
const shell = r('src/pages/LearnerShell.tsx');
const del = r('src/components/safety/DeleteAccount.tsx');
const copy = r('../../packages/shared/src/learnerCopy.ts');
const ext = r('../../packages/shared/src/learnerCopyExt.ts');

test('WL4-05: Settings App language, Delete, AI switch and reader Report follow the active UI locale', () => {
  assert.match(settings, /useState<AppLanguage>\(locale as AppLanguage\)/);
  assert.match(settings, /<DeleteAccount lang=\{locale\}/);
  assert.match(reader, /<ReportButton lang=\{locale\}/);
  assert.doesNotMatch(settings + reader, /lang=\{user\?\.uiLanguage\}/);
});
test('WL4-06: no English leftovers in uz', () => {
  assert.doesNotMatch(reader, /This item may still be processing/);
  assert.doesNotMatch(reader, /`Chapter \$\{/);
  assert.match(copy, /import: 'Yuklash'/);
  assert.match(ext, /stillProcessing: 'Material hali/);
  assert.match(settings, /LANGUAGE_META\[code\]\.nativeName/);
  assert.match(del, /wrongPw: 'Parol notoʻgʻri/);
});
test('WL4-07: consent tick-box above Create account; no "By continuing" on step 1', () => {
  assert.ok(auth.indexOf('<SignupSafetyFields') < auth.indexOf('copy.auth.createFreeAccount'));
  assert.doesNotMatch(auth, /<LegalConsent/);
});
test('WL4-08: nav, sliders, toggles, icon buttons and sign-up language inputs are named', () => {
  assert.match(shell, /<nav aria-label=\{copy\.nav\.mainLabel\}/);
  assert.match(shell, /aria-label=\{copy\.shell\.payAsYouGo\}/);
  assert.match(settings, /type="range"\r?\n\s+aria-label=\{label\}/);
  assert.match(settings, /role="switch"/);
  assert.match(auth, /labelledBy="auth-native-label"/);
  assert.match(auth, /labelledBy="auth-target-label"/);
});
test('WL4-09: empty reader state is localised and has a retry', () => {
  const i = reader.indexOf('copy.reader.stillProcessing');
  assert.ok(i > 0 && reader.slice(i, i + 600).includes('setReloadNonce'));
});
test('WL4-11 v2: Delete copy follows Privacy §8/§11 (messages kept as "Deleted user", reports ~1 year after close) in en/ru/uz', () => {
  assert.doesNotMatch(del, /imports and the messages you sent|siz yuborgan xabarlar butunlay|отправленные вами сообщения будут удалены/);
  assert.match(del, /Messages you sent to other users are not deleted/);
  assert.match(del, /“Deleted user”, and your name, email and photo are removed/);
  assert.match(del, /deleted about 1 year after the report is closed/);
  assert.match(del, /«Удалённый пользователь»/); assert.match(del, /примерно через 1 год после закрытия жалобы/);
  assert.match(del, /«Oʻchirilgan foydalanuvchi»/); assert.match(del, /taxminan 1 yil keyin oʻchiriladi/);
  const uz = del.split('\n').find((l) => l.trimStart().startsWith('uz:')) ?? '';
  assert.doesNotMatch(uz, /[A-Za-z][‘’'][a-z]/u, 'uz uses ʻ U+02BB, not ‘ ’ or apostrophe');
  assert.doesNotMatch(del, /unlimited|fair use|cheksiz|безлимит/i);
});
