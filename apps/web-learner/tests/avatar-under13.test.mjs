import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isUnder13, AVATAR_UNDER13_NOTE } from '../src/lib/agePolicy.ts';
test('LG4-05 avatar gate', () => {
  assert.equal(isUnder13({ ageBand: 'under13' }), true);
  assert.equal(isUnder13({ ageBand: 'teen' }), false);
  assert.equal(isUnder13(null), false);
  for (const l of ['en', 'ru', 'uz']) assert.ok(AVATAR_UNDER13_NOTE[l].length > 10);
});
