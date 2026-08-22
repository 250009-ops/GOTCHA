import * as assert from 'node:assert/strict';
import { resolveLearnerVisibleLanguageCodes } from './language-catalog';

const enabled = ['en', 'ru', 'uz'];

{
  const got = resolveLearnerVisibleLanguageCodes(enabled, 'uz', ['en', 'ru']);
  assert.deepEqual(got, ['en', 'ru']);
}

{
  const got = resolveLearnerVisibleLanguageCodes(enabled, 'en', ['en', 'ru']);
  assert.deepEqual(got, ['ru']);
}

{
  const got = resolveLearnerVisibleLanguageCodes(enabled, 'UZ', ['EN']);
  assert.deepEqual(got, ['en']);
}

{
  const got = resolveLearnerVisibleLanguageCodes(enabled, 'uz', ['uz']);
  assert.deepEqual(got, []);
}

{
  const got = resolveLearnerVisibleLanguageCodes(enabled, 'ru', []);
  assert.deepEqual(got, []);
}

{
  const got = resolveLearnerVisibleLanguageCodes(enabled, 'ru', null);
  assert.deepEqual(got, ['en', 'uz']);
}

{
  const got = resolveLearnerVisibleLanguageCodes(enabled, null, ['en']);
  assert.deepEqual(got, ['en']);
}

{
  const got = resolveLearnerVisibleLanguageCodes(enabled, 'en', ['fr', 'en']);
  assert.deepEqual(got, []);
}

console.log('language-catalog scope tests passed');
