import * as assert from 'node:assert/strict';
import { liveMessagingPeerWhere, minorUserWhere } from './production-users';
const y = new Date().getUTCFullYear();
const t = minorUserWhere();
assert.deepEqual(t, [{ birthYear: { gte: y - 18 } }, { birthYear: null }]);
const not = (liveMessagingPeerWhere().NOT as { OR: unknown[] }).OR;
assert.ok(not.some((x) => JSON.stringify(x) === JSON.stringify({ birthYear: null })), 'unknown age hidden');
assert.ok(not.some((x) => JSON.stringify(x) === JSON.stringify({ birthYear: { gte: y - 18 } })), 'teens + under-13 hidden');
console.log('directory-minors: OK');
