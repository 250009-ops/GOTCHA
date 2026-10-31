import * as assert from 'node:assert/strict';
import { DailyCounter, withChildSafe, CHILD_SAFE_INSTRUCTION, aiDisabledError } from './ai-safety';

const c = new DailyCounter(() => 2);
const d1 = new Date('2026-10-31T10:00:00Z');
c.hit('u', d1); c.hit('u', d1);
assert.throws(() => c.hit('u', d1), (e: any) => e.getStatus() === 429);
c.hit('other', d1); // per-user
c.hit('u', new Date('2026-11-01T00:00:01Z')); // resets at UTC midnight
assert.ok(withChildSafe('SYS', 'teen').includes(CHILD_SAFE_INSTRUCTION));
assert.ok(withChildSafe('SYS', 'under13').includes(CHILD_SAFE_INSTRUCTION));
assert.equal(withChildSafe('SYS', 'adult'), 'SYS');
assert.equal((aiDisabledError() as any).getStatus(), 403);
console.log('ai-safety: OK');
