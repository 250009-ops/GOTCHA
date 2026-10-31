/**
 * PAY2-13: a Free lookup slot is NOT consumed when minor moderation is down (503). Real Postgres
 * (atomic reserve → release path). Needs TEST_DATABASE_URL on a LOCAL migrated DB; skipped otherwise.
 */
import * as assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { AiService } from './ai.service';

async function main() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !/localhost|127\.0\.0\.1|host=\/tmp/.test(url) || /gotchaa\.uz|prod/i.test(url)) {
    console.log('lookup-mod503-db: SKIP (set TEST_DATABASE_URL to a local DB)');
    return;
  }
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  const year = new Date().getFullYear();
  const u = await prisma.user.create({ data: { email: `mod503-${Date.now()}@test.local`, passwordHash: 'x', displayName: 'm', nativeLanguage: 'en', birthYear: year - 15 } as never });
  let modDown = true;
  const mk = () => {
    const svc: any = new (AiService as any)(prisma);
    svc.getClient = () => ({
      chat: { completions: { create: async () => ({ choices: [{ message: { content: JSON.stringify({ lemma: 'run', translation: 'yugurmoq' }) } }] }) } },
      moderations: { create: async () => { if (modDown) throw new Error('down'); return { results: [{ flagged: false }] }; } },
    });
    svc.getPlatformAiSettings = async () => ({ enabled: true, lookupModel: 'm', defaultUserQuota: 20 });
    svc.assertAiAvailable = async () => undefined;
    return svc;
  };
  const count = async () => (await prisma.aiUsageDaily.findMany({ where: { userId: u.id } })).reduce((a, r) => a + r.lookupCount, 0);
  try {
    const svc = mk();
    for (let i = 0; i < 3; i++) {
      await assert.rejects(svc.lookup(u.id, { token: `run${i}`, sentence: `They run${i} home.`, sourceLang: 'en', targetLang: 'uz' }), (e: any) => e.getStatus?.() === 503);
    }
    assert.equal(await count(), 0, 'three 503 lookups consumed no Free slot');
    modDown = false;
    await svc.lookup(u.id, { token: 'walk', sentence: 'They walk home.', sourceLang: 'en', targetLang: 'uz' });
    assert.equal(await count(), 1, 'a served lookup consumes exactly one slot');
    // Parallel: 10 failing lookups next to 5 served ones → exactly 5 more counted.
    let n = 0;
    const svc2 = mk();
    svc2.getClient = () => ({
      chat: { completions: { create: async () => ({ choices: [{ message: { content: JSON.stringify({ lemma: 'x', translation: 'y' }) } }] }) } },
      moderations: { create: async () => { if (n++ % 3 !== 0) throw new Error('down'); return { results: [{ flagged: false }] }; } },
    });
    const rs = await Promise.allSettled(Array.from({ length: 15 }, (_, i) => svc2.lookup(u.id, { token: `p${i}`, sentence: `p${i} here.`, sourceLang: 'en', targetLang: 'uz' })));
    const ok = rs.filter((r) => r.status === 'fulfilled').length;
    assert.equal(await count(), 1 + ok, `counter = served lookups only (served ${ok})`);
    console.log('lookup-mod503-db: OK');
  } finally {
    await prisma.aiUsageDaily.deleteMany({ where: { userId: u.id } }).catch(() => undefined);
    await prisma.user.delete({ where: { id: u.id } }).catch(() => undefined);
    await prisma.$disconnect();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
