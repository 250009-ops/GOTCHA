import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const r = (p) => readFileSync(p, 'utf8');
const app = r('src/App.tsx');
const tg = r('src/lib/telegram.ts');
const api = r('src/lib/api.ts');
const routes = r('src/lib/authRoutes.ts');
const auth = r('src/pages/AuthPage.tsx');
const shell = r('src/tg/TelegramShell.tsx');
const html = r('index.html');

test('mini app routes exist and /app swaps to the Telegram shell inside Telegram', () => {
  for (const p of ['"/tg"', '"/tg/signup"', '"/tg/login"']) assert.ok(app.includes(`path=${p}`), p);
  assert.match(app, /telegram \? <TelegramShell \/> : <LearnerShell \/>/);
  assert.match(app, /path="profile"/);
});

test('the Telegram SDK only loads when opened from Telegram', () => {
  assert.match(html, /tgWebApp\(Data\|Version\|Platform\)=/);
  assert.match(html, /telegram\.org\/js\/telegram-web-app\.js/);
});

test('startapp deep links map to the agreed routes', () => {
  assert.match(tg, /startsWith\('book_'\)\) return `\/app\/read\//);
  assert.match(tg, /=== 'mashq'\) return '\/app\/practice'/);
  assert.match(tg, /startsWith\('chat_'\)\) return `\/app\/messages\?c=/);
  assert.doesNotMatch(tg, /referral/);
});

test('Telegram auth endpoints are public (no Bearer/refresh) and /tg sign-up pages do not bootstrap', () => {
  assert.match(api, /startsWith\('\/auth\/telegram\/'\)/);
  assert.match(api, /startsWith\('\/auth\/login\/'\)/);
  assert.match(routes, /'\/tg\/signup'/);
  assert.match(routes, /'\/tg\/login'/);
});

test('website login: email or phone, Telegram code step, and the bot button under Kirish', () => {
  assert.match(auth, /isLogin \? tx\.identifier : copy\.auth\.email/);
  assert.match(auth, /session\.telegramCode/);
  assert.match(auth, /<TelegramCodeCard/);
  assert.match(auth, /<TelegramLinkWait/);
  assert.ok(auth.indexOf('copy.auth.signIn') < auth.indexOf('tx.continueWithBot'), 'bot button sits below Kirish');
  assert.match(auth, /telegramBotLink\('signup'\)/);
});

test('floating tab bar: 5 tabs, rounded, hidden on full-screen sub-pages', () => {
  assert.match(shell, /rounded-\[34px\]/);
  assert.match(shell, /grid-cols-5/);
  assert.match(shell, /NO_TABBAR = \['\/app\/messages', '\/app\/plus'/);
});
