import * as assert from 'node:assert/strict';
import {
  DEFAULT_MARKETING_MIN_LEARNER_COUNT,
  marketingMinLearnerCount,
  publicLearnerCount,
} from './public-learner-count';

assert.equal(DEFAULT_MARKETING_MIN_LEARNER_COUNT, 100);
// Small DB: hidden, never an invented floor.
assert.equal(publicLearnerCount(7, 100), 0);
assert.equal(publicLearnerCount(0, 100), 0);
assert.equal(publicLearnerCount(NaN, 100), 0);
// At/above the threshold: the real number, unchanged.
assert.equal(publicLearnerCount(100, 100), 100);
assert.equal(publicLearnerCount(1234, 100), 1234);
// Threshold is configurable; bad values fall back to the default.
assert.equal(marketingMinLearnerCount({ MARKETING_MIN_LEARNER_COUNT: '5' } as NodeJS.ProcessEnv), 5);
assert.equal(marketingMinLearnerCount({ MARKETING_MIN_LEARNER_COUNT: 'x' } as NodeJS.ProcessEnv), 100);
assert.equal(marketingMinLearnerCount({} as NodeJS.ProcessEnv), 100);
assert.equal(publicLearnerCount(7, 5), 7);
console.log('public-learner-count tests passed');
