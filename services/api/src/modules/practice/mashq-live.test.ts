import * as assert from 'node:assert/strict';
import { mashqNeedsLive } from './mashq.service';

assert.equal(mashqNeedsLive(0), true);
assert.equal(mashqNeedsLive(4), true);
assert.equal(mashqNeedsLive(5), false);
assert.equal(mashqNeedsLive(8), false);
console.log('mashq-live ok');
