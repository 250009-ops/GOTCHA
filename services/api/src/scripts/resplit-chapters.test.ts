import * as assert from 'node:assert/strict';
import { assertNotProd, parseArgs, remapByOffset } from './resplit-chapters';

assert.equal(parseArgs(['--title', 'X']).apply, false); // dry-run by default
assert.throws(() => parseArgs(['--id', 'a', '--apply']), /backup-dir/);
assert.throws(() => parseArgs([]), /--id/);
assert.doesNotThrow(() => assertNotProd('postgresql://u@localhost:55432/db'));
assert.doesNotThrow(() => assertNotProd('postgresql://u@localhost/db?host=/tmp'));
assert.throws(() => assertNotProd('postgresql://u:p@10.0.0.5:5432/gotcha'), /non-local/);
assert.throws(() => assertNotProd('postgresql://u:p@db.gotchaa.uz:5432/gotcha', 'db.gotchaa.uz'), /production/);
assert.throws(() => assertNotProd('postgresql://u@localhost:5432/gotcha_prod'), /production/);
assert.throws(() => assertNotProd(undefined), /not set/);
assert.deepEqual(remapByOffset([10, 10], [5, 5, 5, 5]), [0, 2]);
assert.deepEqual(remapByOffset([20], [1, 1]), [0]);
console.log('resplit-chapters: OK');
