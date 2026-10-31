import * as assert from 'node:assert/strict';
import {
  assertNotBlocked,
  blockedPeerIds,
  blockUser,
  normalizeReport,
  reportUser,
  SafetyPrisma,
  unblockUser,
} from './messaging-safety';

type Block = { blockerId: string; blockedId: string };

function fakePrisma() {
  const blocks: Block[] = [];
  const reports: any[] = [];
  const users = new Set(['a', 'b', 'c']);
  const messages = [{ id: 'm1', senderId: 'b', body: 'rude words', conversationId: 'conv1' }];
  const members = new Set(['conv1:a', 'conv1:b']);
  const match = (w: any, r: Block) =>
    w.OR ? w.OR.some((o: any) => match(o, r)) : Object.entries(w).every(([k, v]) => (r as any)[k] === v);
  const prisma: SafetyPrisma = {
    userBlock: {
      async findFirst({ where }: any) { return blocks.find((r) => match(where, r)) ?? null; },
      async findMany({ where }: any) { return blocks.filter((r) => match(where, r)); },
      async upsert({ create }: any) {
        if (!blocks.some((r) => r.blockerId === create.blockerId && r.blockedId === create.blockedId)) blocks.push(create);
        return create;
      },
      async deleteMany({ where }: any) {
        const before = blocks.length;
        for (let i = blocks.length - 1; i >= 0; i--) if (match(where, blocks[i])) blocks.splice(i, 1);
        return { count: before - blocks.length };
      },
    },
    userReport: {
      async create({ data }: any) {
        const r = { id: `r${reports.length + 1}`, status: 'open', createdAt: new Date(), ...data };
        reports.push(r);
        return r;
      },
    },
    user: { async findFirst({ where }: any) { return users.has(where.id) ? { id: where.id } : null; } },
    message: { async findFirst({ where }: any) { return messages.find((m) => m.id === where.id) ?? null; } },
    conversationParticipant: {
      async findUnique({ where }: any) {
        const k = where.conversationId_userId;
        return members.has(`${k.conversationId}:${k.userId}`) ? {} : null;
      },
    },
  } as SafetyPrisma;
  return { prisma, blocks, reports };
}

async function main() {
  // Block is symmetric in effect, idempotent, and reversible.
  {
    const { prisma, blocks } = fakePrisma();
    await blockUser(prisma, 'a', 'b');
    await blockUser(prisma, 'a', 'b');
    assert.equal(blocks.length, 1);
    await assert.rejects(assertNotBlocked(prisma, 'a', 'b'), /can’t message/);
    await assert.rejects(assertNotBlocked(prisma, 'b', 'a'), /can’t message/);
    await assertNotBlocked(prisma, 'a', 'c');
    assert.deepEqual(await blockedPeerIds(prisma, 'b'), ['a']);
    assert.deepEqual(await blockedPeerIds(prisma, 'a'), ['b']);
    await unblockUser(prisma, 'a', 'b');
    await assertNotBlocked(prisma, 'a', 'b');
    await assert.rejects(blockUser(prisma, 'a', 'a'), /yourself/);
    await assert.rejects(blockUser(prisma, 'a', 'zz'), /not found/);
  }
  // Report validation.
  {
    assert.throws(() => normalizeReport({ reason: 'nope' }), /Invalid report reason/);
    assert.throws(() => normalizeReport({ reason: 'other', details: '  ' }), /describe/);
    assert.equal(normalizeReport({ reason: 'SPAM' }).reason, 'spam');
    assert.equal(normalizeReport({ reason: 'harassment', details: 'x'.repeat(5000) }).details!.length, 1000);
  }
  // Report with message snapshot + also block.
  {
    const { prisma, reports, blocks } = fakePrisma();
    const r = await reportUser(prisma, 'a', { reportedUserId: 'b', reason: 'harassment', messageId: 'm1', alsoBlock: true });
    assert.equal(r.status, 'open');
    assert.equal(r.blocked, true);
    assert.equal(reports[0].messageSnapshot, 'rude words');
    assert.equal(reports[0].conversationId, 'conv1');
    assert.equal(blocks.length, 1);
    // Cannot attach someone else's message or a message from a conversation you are not in.
    await assert.rejects(reportUser(prisma, 'a', { reportedUserId: 'c', reason: 'spam', messageId: 'm1' }), /Message not found/);
    await assert.rejects(reportUser(prisma, 'c', { reportedUserId: 'b', reason: 'spam', messageId: 'm1' }), /participant/);
    await assert.rejects(reportUser(prisma, 'a', { reportedUserId: 'a', reason: 'spam' }), /yourself/);
  }
  console.log('messaging-safety tests passed');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
