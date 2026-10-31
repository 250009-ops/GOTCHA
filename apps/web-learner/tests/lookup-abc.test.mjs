import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extractSentenceAround } from '../src/lib/phraseSpan.ts';

test('lookup (a): soft-wrapped and hyphen-broken lines join into one context sentence', () => {
  const t = 'Intro line.\nShe answered without\nany hesi-\ntation and left.\n\nNext para.';
  const i = t.indexOf('hesi');
  assert.equal(extractSentenceAround(t, i, i + 10), 'She answered without any hesitation and left.');
  const t2 = 'Para one ends\n\nHello world';
  assert.equal(extractSentenceAround(t2, t2.indexOf('world'), t2.length), 'Hello world');
});
test('lookup (b): reader and chat lookups ask for the UI language', () => {
  const reader = readFileSync('src/pages/ReaderPage.tsx', 'utf8');
  const msgs = readFileSync('src/pages/MessagesPage.tsx', 'utf8');
  assert.match(reader, /const targetLang = locale;/);
  assert.match(msgs, /targetLang: uiLocale,/);
});
