import * as assert from 'node:assert/strict';
import { DailyCounter, withChildSafe, CHILD_SAFE_INSTRUCTION, aiDisabledError } from './ai-safety';

const c = new DailyCounter(() => 2);
const d1 = new Date('2026-10-31T10:00:00Z');
c.hit('u', d1); c.hit('u', d1);
assert.throws(() => c.hit('u', d1), (e: any) => e.getStatus() === 429);
c.hit('other', d1); // per-user
assert.throws(() => c.hit('u', new Date('2026-10-31T18:59:00Z')), (e: any) => e.getStatus() === 429); // 23:59 Tashkent: same day
c.hit('u', new Date('2026-10-31T19:00:01Z')); // resets at 00:00 Asia/Tashkent (final-5), not UTC midnight
assert.ok(withChildSafe('SYS', 'teen').includes(CHILD_SAFE_INSTRUCTION));
assert.ok(withChildSafe('SYS', 'under13').includes(CHILD_SAFE_INSTRUCTION));
assert.equal(withChildSafe('SYS', 'adult'), 'SYS');
assert.equal((aiDisabledError() as any).getStatus(), 403);
console.log('ai-safety: OK');

import { moderateOrBlock, MODERATED_PLACEHOLDER, AI_MODERATION_UNAVAILABLE, moderatedPlaceholder } from './ai-safety';
(async () => {
  const ok = { moderations: { create: async () => ({ results: [{ flagged: false }] }) } };
  const bad = { moderations: { create: async () => ({ results: [{ flagged: true }] }) } };
  const down = { moderations: { create: async () => { throw new Error('timeout'); } } };
  const empty = { moderations: { create: async () => ({}) as any } };
  assert.equal(await moderateOrBlock(ok, 'hello'), 'hello');
  assert.equal(await moderateOrBlock(bad, 'x'), MODERATED_PLACEHOLDER);
  assert.equal(await moderateOrBlock(bad, 'x', undefined, 'uz'), '[xavfsizlik uchun yashirildi]');
  assert.equal(await moderateOrBlock(bad, 'x', undefined, 'ru'), '[скрыто в целях безопасности]');
  assert.equal(await moderateOrBlock(bad, 'x', undefined, 'en'), '[hidden for safety]');
  assert.equal(moderatedPlaceholder('de'), '[hidden for safety]');
  assert.equal(moderatedPlaceholder(null), '[hidden for safety]');
  let logged = '';
  for (const c of [down, empty]) {
    await assert.rejects(moderateOrBlock(c, 'secret output', (m) => (logged = m)), (e: any) =>
      e.getStatus() === 503 && e.getResponse().code === AI_MODERATION_UNAVAILABLE && !JSON.stringify(e.getResponse()).includes('secret output'));
  }
  assert.ok(logged);
  console.log('moderation fail-closed: OK');
})().catch((e) => { console.error(e); process.exit(1); });
