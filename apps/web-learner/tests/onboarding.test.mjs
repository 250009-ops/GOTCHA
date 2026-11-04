import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const lib = readFileSync('src/lib/onboarding.ts', 'utf8');
const flow = readFileSync('src/components/onboarding/Onboarding.tsx', 'utf8');
const copy = readFileSync('src/components/onboarding/copy.ts', 'utf8');
const shell = readFileSync('src/pages/LearnerShell.tsx', 'utf8');

test('onboarding finishes with a localStorage done flag', () => {
  assert.match(lib, /gotcha\.onboarding\.done/);
  assert.match(lib, /setItem\(ONBOARDING_DONE_KEY, '1'\)/);
  assert.match(flow, /markOnboardingDone/);
});

test('level and language are single-choice selects, and the book follows the chosen level', () => {
  assert.match(flow, /<select[\s\S]*id="onboarding-level"/);
  assert.match(flow, /<select[\s\S]*id="onboarding-language"/);
  assert.match(flow, /bookLevels\(level\)/);
  assert.doesNotMatch(flow, /\['a1', 'a2'\]\.map/);
});

test('the tour is level, tap-word demo, first book, then Practice', () => {
  assert.match(lib, /'level', 'demo', 'book', 'practice'/);
  assert.match(flow, /hesitation/);
  assert.match(flow, /data-testid="onboarding-lookup"/);
  assert.match(flow, /\/app\/read\/\$\{book\.id\}/);
  assert.match(shell, /data-onboarding=\{practiceMark \? 'practice'/);
  assert.match(shell, /<Onboarding/);
});

test('Uzbek onboarding copy uses U+02BB, not an ASCII apostrophe', () => {
  const uz = copy.slice(copy.indexOf('const uz'), copy.indexOf('export const ONBOARDING_COPY'));
  const values = (uz.match(/'[^']*'/g) ?? []).map((v) => v.slice(1, -1));
  assert.ok(values.some((v) => v.includes('o\u02BB')));
  for (const value of values) assert.doesNotMatch(value, /[og]'/i);
});
