import * as assert from 'node:assert/strict';
import { publicLearnerCount, PUBLIC_LEARNER_MIN } from './marketing.service';
assert.equal(PUBLIC_LEARNER_MIN, 100);
assert.equal(publicLearnerCount(0), 0);
assert.equal(publicLearnerCount(37), 0);
assert.equal(publicLearnerCount(99), 0);
assert.equal(publicLearnerCount(100), 100);
assert.equal(publicLearnerCount(2500), 2500);
console.log('public-count: OK');
