import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('WLF-05: reader outline "{n} pages" is localised (uz/ru), no hard-coded English', () => {
  const page = readFileSync('src/pages/ReaderPage.tsx', 'utf8');
  assert.doesNotMatch(page, /\{group\.pageCount\} pages/);
  assert.match(page, /pagesLabel\(group\.pageCount, locale\)/);
  const lib = readFileSync('src/lib/pagesLabel.ts', 'utf8');
  assert.match(lib, /pluralRu\(n, 'страница', 'страницы', 'страниц'\)/);
  assert.match(lib, /`\$\{n\} sahifa`/);
});
