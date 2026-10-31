/**
 * WL4-10: the TTS counter lives in ai_usage_daily.tts_count and survives a "restart" (a new AiService).
 * Needs a LOCAL migrated DB: TEST_DATABASE_URL=postgresql://...localhost... (skipped otherwise; never point at prod).
 */
import * as assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { AiService } from './ai.service';

async function main() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !/localhost|127\.0\.0\.1|host=\/tmp/.test(url) || /gotchaa\.uz|prod/i.test(url)) {
    console.log('tts-quota-db: SKIP (set TEST_DATABASE_URL to a local DB)');
    return;
  }
  process.env.TTS_DAILY_LIMIT_PER_USER = '3';
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  const email = `tts-${Date.now()}@test.local`;
  const u = await prisma.user.create({ data: { email, passwordHash: 'x', displayName: 'tts', nativeLanguage: 'en' } as never });
  try {
    const mk = () => Object.assign(Object.create(AiService.prototype), { prisma, useMemory: () => false }) as AiService;
    const a = mk();
    assert.equal(await a.hitTts(u.id), 1);
    assert.equal(await a.hitTts(u.id), 2);
    const b = mk(); // "restart"
    assert.equal(await b.hitTts(u.id), 3);
    await assert.rejects(b.hitTts(u.id), (e: any) => e.getStatus() === 429 && e.getResponse().code === 'TTS_DAILY_LIMIT');
    await assert.rejects(a.hitTts(u.id), (e: any) => e.getStatus() === 429);
    const tomorrow = new Date(Date.now() + 86_400_000);
    assert.equal(await a.hitTts(u.id, tomorrow), 1);
    console.log('tts-quota-db: OK');
  } finally {
    await prisma.user.delete({ where: { id: u.id } }).catch(() => undefined);
    await prisma.$disconnect();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
