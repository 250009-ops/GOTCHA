import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// S7: learner Settings has an AI-off switch (uz/ru/en) wired to the per-account flag (PATCH /users/me/ai → users.ai_disabled).
const sw = readFileSync('src/components/safety/AiSwitch.tsx', 'utf8');
const settings = readFileSync('src/pages/SettingsPage.tsx', 'utf8');
test('AI switch is rendered in Settings', () => {
  assert.match(settings, /<AiSwitch\b[^>]*aiDisabled=/);
  assert.match(settings, /aiSwitchText\(locale\)\.title/); // WL4-05: follows the active UI language
});
test('AI switch calls the per-account endpoint, is a11y switch, and respects the support lock', () => {
  assert.match(sw, /'\/users\/me\/ai', \{ method: 'PATCH'/);
  assert.match(sw, /aiDisabled: /);
  assert.match(sw, /role="switch"/);
  assert.match(sw, /aiDisabledBy === 'admin'|aiDisabledBy !== 'user'/);
});
test('AI switch copy exists in uz/ru/en', () => {
  for (const l of ['uz:', 'ru:', 'en:']) assert.ok(sw.includes(l), l);
});
