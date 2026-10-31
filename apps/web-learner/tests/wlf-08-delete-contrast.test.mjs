import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// WLF-08: in dark theme the password placeholder and the Cancel button were invisible (inherited light text on the white card).
const src = readFileSync(new URL('../src/components/safety/DeleteAccount.tsx', import.meta.url), 'utf8');
const lum = (hex) => { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

test('WLF-08: password input sets its own text + placeholder colour, readable on #f9fafb (AA 4.5:1)', () => {
  const input = src.match(/<input type="password"[\s\S]*?className="([^"]+)"/)[1];
  const text = input.match(/(?:^| )text-\[(#[0-9a-f]{6})\]/i)[1];
  const ph = input.match(/placeholder:text-\[(#[0-9a-f]{6})\]/i)[1];
  assert.ok(ratio(text, '#f9fafb') >= 4.5, text);
  assert.ok(ratio(ph, '#f9fafb') >= 4.5, ph);
});

test('WLF-08: Cancel button has an explicit dark-on-white colour (AA 4.5:1)', () => {
  const cancel = src.match(/<button type="button" className="([^"]+)" onClick=\{\(\) => \{ setOpen\(false\)/)[1];
  const fg = cancel.match(/(?:^| )text-\[(#[0-9a-f]{6})\]/i)[1];
  assert.match(cancel, /bg-white/);
  assert.ok(ratio(fg, '#ffffff') >= 4.5, fg);
});
