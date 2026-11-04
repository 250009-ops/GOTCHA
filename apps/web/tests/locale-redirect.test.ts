import assert from 'node:assert/strict';
import { test } from 'node:test';
import { withLocaleQuery } from '../src/lib/localeRedirect.ts';
test('redirects keep ?lang/?ui only', () => {
  assert.equal(withLocaleQuery('/', '?lang=ru&utm=x'), '/?lang=ru');
  assert.equal(withLocaleQuery('/', '?ui=uz&lang=en'), '/?lang=en&ui=uz');
  assert.equal(withLocaleQuery('/', ''), '/');
});
