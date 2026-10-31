// WL1-04: every /learn CTA carries the page language. Run: node --experimental-strip-types --test tests/links.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { libraryUrl, loginUrl, registerUrl } from '../src/lib/links.ts';

for (const ui of ['uz', 'ru', 'en'] as const) {
  test(`all CTAs pass ui=${ui}`, () => {
    for (const href of [loginUrl({ ui }), registerUrl({ plan: 'free', ui }), libraryUrl({ ui })]) {
      assert.equal(new URL(href).searchParams.get('ui'), ui, href);
    }
  });
}

test('register only carries lang (learn-language) when picked', () => {
  assert.equal(new URL(registerUrl({ plan: 'free', ui: 'en' })).searchParams.get('lang'), null);
  assert.equal(new URL(registerUrl({ plan: 'free', ui: 'ru', lang: 'en' })).searchParams.get('lang'), 'en');
});
