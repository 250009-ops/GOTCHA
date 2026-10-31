/**
 * WL4-11 / Privacy §8, §11: delete account → sent messages KEPT, shown as from "Deleted user" (no name, email, photo) in
 * thread, conversation list and notifications; reports kept and unlinked (user ids + conversationId null, messageId kept,
 * snapshot + details kept); recipients' stale message notifications dropped; consent_ip cleared.
 * Needs a LOCAL migrated DB in TEST_DATABASE_URL (skipped otherwise; never prod).
 */
import * as assert from 'node:assert/strict';
import * as bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { UsersService } from './users.service';
import { MessagingService } from '../messaging/messaging.service';
import { NotificationsService } from '../notifications/notifications.service';

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
    await prisma.conversationParticipant.createMany({ data: [{ conversationId: conv.id, userId: del.id }, { conversationId: conv.id, userId: other.id }] });
    await prisma.user.update({ where: { id: del.id }, data: { avatarUrl: '/uploads/avatars/x.jpg' } });
    await prisma.userNotification.create({ data: { userId: other.id, kind: 'message', title: 'del sent you a message', body: 'hi from del', refId: conv.id, dedupeKey: `message:${conv.id}` } });
    const r1 = await prisma.userReport.create({ data: { reporterId: other.id, reportedUserId: del.id, conversationId: conv.id, messageId: mine.id, reason: 'harassment' as never, details: 'rude', messageSnapshot: 'hi from del' } });
    const r2 = await prisma.userReport.create({ data: { reporterId: del.id, reportedUserId: other.id, conversationId: conv.id, messageId: theirs.id, reason: 'spam' as never, details: 'spam d' } });
    const cr = await prisma.contentReport.create({ data: { reporterId: del.id, reason: 'spam' as never, details: 'c' } });
    const svc = new UsersService(prisma as never, { isDevUser: () => false } as never);
    await svc.deleteAccount(del.id, { currentPassword: pw } as never);

    const u = await prisma.user.findUniqueOrThrow({ where: { id: del.id } });
    assert.equal(u.consentIp, null); assert.ok(u.consentAt); assert.ok(u.deletedAt);
    assert.equal(u.displayName, 'Deleted user'); assert.equal(u.avatarUrl, null); assert.ok(u.email.endsWith('@deleted.gotcha.app'));
    assert.equal(await prisma.message.count({ where: { id: mine.id } }), 1, 'own sent message KEPT (Privacy §11)');
    assert.equal(await prisma.message.count({ where: { id: theirs.id } }), 1, "other user's message kept");
    // read paths seen by the other user
    const msg = new MessagingService(prisma as never, { sendMail: async () => undefined } as never, { get: () => undefined } as never);
    const thread = await msg.getConversation(other.id, conv.id) as { peer: { displayName: string; avatarUrl: unknown; handle: string; online: boolean }; messages: Array<{ id: string; body: string; sender: { displayName: string; avatarUrl: unknown } }> };
    assert.equal(thread.peer.displayName, 'Deleted user'); assert.equal(thread.peer.avatarUrl, null); assert.equal(thread.peer.online, false);
    const m = thread.messages.find((x) => x.id === mine.id)!;
    assert.equal(m.body, 'hi from del'); assert.equal(m.sender.displayName, 'Deleted user'); assert.equal(m.sender.avatarUrl, null);
    const list = await msg.listConversations(other.id) as Array<{ id: string; peer: { displayName: string; avatarUrl: unknown } }>;
    const item = list.find((c) => c.id === conv.id)!;
    assert.ok(item, 'conversation still listed'); assert.equal(item.peer.displayName, 'Deleted user'); assert.equal(item.peer.avatarUrl, null);
    const leak = JSON.stringify([thread, list]);
    for (const s of ['del-', '@test.local', 'avatars/x.jpg', '"del"']) assert.ok(!leak.includes(s), `no ${s} in read paths`);
    assert.equal(await prisma.userNotification.count({ where: { userId: other.id, refId: conv.id, title: { contains: 'del sent' } } }), 0, 'stale named notification dropped');
    (prisma as unknown as { dbAvailable: boolean }).dbAvailable = true; // NotificationsService.list() returns [] without it
    const notif = new NotificationsService(prisma as never);
    const nList = JSON.stringify(await (notif as unknown as { list(u: string): Promise<unknown> }).list(other.id));
    assert.ok(!nList.includes('del sent') && !nList.includes('@test.local'), 'notifications show no name/email');
    // follow-up: deleted flag, localised notification name, no new contact with a deleted account
    assert.equal((m.sender as unknown as { deleted: boolean }).deleted, true);
    assert.ok(!JSON.stringify(m.sender).includes('@'), 'sender has no email');
    assert.equal((thread.peer as unknown as { deleted: boolean }).deleted, true);
    await prisma.user.update({ where: { id: other.id }, data: { uiLanguage: 'uz' } as never });
    await prisma.userNotification.deleteMany({ where: { userId: other.id } });
    // an unread message from the (now deleted) account must be the latest one for the derived notification
    await prisma.message.create({ data: { conversationId: conv.id, senderId: del.id, body: 'kept later msg', createdAt: new Date(Date.now() + 1000) } });
    await prisma.conversationParticipant.update({ where: { conversationId_userId: { conversationId: conv.id, userId: other.id } }, data: { lastReadAt: null } });
    const nUz = JSON.stringify(await (notif as unknown as { list(u: string): Promise<unknown> }).list(other.id));
    assert.ok(nUz.includes('Oʻchirilgan foydalanuvchi'), 'uz notification names the deleted user in uz: ' + nUz.slice(0, 300));
    const code403 = async (f: () => Promise<unknown>, what: string) => {
      await assert.rejects(f(), (e: { getStatus?(): number; getResponse?(): { code?: string } }) => e.getStatus?.() === 403 && e.getResponse?.().code === 'USER_DELETED', what);
    };
    const reportsBefore = await prisma.userReport.count();
    await code403(() => msg.sendMessage(other.id, conv.id, { body: 'still there?' } as never), 'send into conversation');
    await code403(() => msg.startConversation(other.id, { peerUserId: del.id } as never), 'new conversation');
    await code403(() => msg.report(other.id, { reportedUserId: del.id, reason: 'spam' } as never), 'report');
    const { sendFriendRequest } = await import('../safety/friend-gate');
    await code403(() => sendFriendRequest(prisma as never, other.id, del.id), 'friend request');
    assert.equal(await prisma.userReport.count(), reportsBefore, 'no new report; existing kept');
    // reports: kept, unlinked from the deleted user, reported message still attached
    const a = await prisma.userReport.findUniqueOrThrow({ where: { id: r1.id } });
    assert.equal(a.reportedUserId, null); assert.equal(a.conversationId, null); assert.equal(a.messageId, mine.id); assert.equal(a.reporterId, other.id);
    assert.equal(a.messageSnapshot, 'hi from del'); assert.equal(a.details, 'rude');
    const b = await prisma.userReport.findUniqueOrThrow({ where: { id: r2.id } });
    assert.equal(b.reporterId, null); assert.equal(b.conversationId, null); assert.equal(b.reportedUserId, other.id); assert.equal(b.messageId, theirs.id);
    const c = await prisma.contentReport.findUniqueOrThrow({ where: { id: cr.id } });
    assert.equal(c.reporterId, null); assert.equal(c.details, 'c');
    console.log('wl4-11-delete-purge: OK');
  } finally {
    await prisma.userReport.deleteMany({ where: { OR: [{ reporterId: other.id }, { reportedUserId: other.id }, { messageSnapshot: 'hi from del' }] } });
    await prisma.contentReport.deleteMany({ where: { details: 'c', reporterId: null } });
    await prisma.conversation.deleteMany({ where: { pairKey: `${del.id}:${other.id}` } });
    await prisma.user.deleteMany({ where: { id: { in: [del.id, other.id] } } });
    await prisma.$disconnect();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
