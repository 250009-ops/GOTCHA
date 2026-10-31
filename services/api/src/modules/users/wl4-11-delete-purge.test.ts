/**
 * WL4-11: delete account → sent messages deleted, reports kept but anonymised (null user refs), consent_ip cleared.
 * Needs a LOCAL migrated DB in TEST_DATABASE_URL (skipped otherwise; never prod).
 */
import * as assert from 'node:assert/strict';
import * as bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { UsersService } from './users.service';

async function main() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !/localhost|127\.0\.0\.1|host=\/tmp/.test(url) || /gotchaa\.uz|prod/i.test(url)) {
    console.log('wl4-11-delete-purge: SKIP (set TEST_DATABASE_URL to a local DB)');
    return;
  }
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  const t = Date.now();
  const pw = 'correct horse battery';
  const mk = (n: string) => prisma.user.create({ data: { email: `${n}-${t}@test.local`, passwordHash: bcrypt.hashSync(pw, 4), displayName: n, nativeLanguage: 'en', consentIp: '203.0.113.7', consentVersion: 'v', consentAt: new Date() } as never });
  const [del, other] = [await mk('del'), await mk('other')];
  try {
    const conv = await prisma.conversation.create({ data: { pairKey: `${del.id}:${other.id}` } });
    const mine = await prisma.message.create({ data: { conversationId: conv.id, senderId: del.id, body: 'hi from del' } });
    const theirs = await prisma.message.create({ data: { conversationId: conv.id, senderId: other.id, body: 'hi back' } });
    const r1 = await prisma.userReport.create({ data: { reporterId: other.id, reportedUserId: del.id, messageId: mine.id, reason: 'harassment' as never, messageSnapshot: 'hi from del' } });
    const r2 = await prisma.userReport.create({ data: { reporterId: del.id, reportedUserId: other.id, reason: 'spam' as never } });
    const svc = new UsersService(prisma as never, { isDevUser: () => false } as never);
    await svc.deleteAccount(del.id, { currentPassword: pw } as never);

    const u = await prisma.user.findUniqueOrThrow({ where: { id: del.id } });
    assert.equal(u.consentIp, null); assert.ok(u.consentAt); assert.ok(u.deletedAt);
    assert.equal(await prisma.message.count({ where: { id: mine.id } }), 0, 'own message deleted');
    assert.equal(await prisma.message.count({ where: { id: theirs.id } }), 1, "other user's message kept");
    const a = await prisma.userReport.findUniqueOrThrow({ where: { id: r1.id } });
    assert.equal(a.reportedUserId, null); assert.equal(a.messageId, null); assert.equal(a.reporterId, other.id); assert.equal(a.messageSnapshot, 'hi from del');
    const b = await prisma.userReport.findUniqueOrThrow({ where: { id: r2.id } });
    assert.equal(b.reporterId, null); assert.equal(b.reportedUserId, other.id);
    console.log('wl4-11-delete-purge: OK');
  } finally {
    await prisma.userReport.deleteMany({ where: { OR: [{ reporterId: other.id }, { reportedUserId: other.id }] } });
    await prisma.user.deleteMany({ where: { id: { in: [del.id, other.id] } } });
    await prisma.$disconnect();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
