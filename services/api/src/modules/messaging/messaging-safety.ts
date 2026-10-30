import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { UserReportReason } from '@prisma/client';

/**
 * P3b: report & block (Play UGC policy, families-checklist M6).
 * Kept free of Nest DI so it can be unit-tested with a fake Prisma client.
 */
export const REPORT_REASONS: readonly UserReportReason[] = [
  'spam',
  'harassment',
  'inappropriate',
  'underage',
  'other',
] as const;

export const REPORT_DETAILS_MAX = 1000;
export const BLOCKED_MESSAGE = 'You can’t message this user.';

export type SafetyPrisma = {
  userBlock: {
    findFirst(args: unknown): Promise<unknown | null>;
    findMany(args: unknown): Promise<Array<{ blockerId: string; blockedId: string; createdAt?: Date }>>;
    upsert(args: unknown): Promise<unknown>;
    deleteMany(args: unknown): Promise<{ count: number }>;
  };
  userReport: { create(args: unknown): Promise<{ id: string; status: string; createdAt: Date }> };
  user: { findFirst(args: unknown): Promise<{ id: string } | null> };
  message: { findFirst(args: unknown): Promise<{ id: string; senderId: string; body: string; conversationId: string } | null> };
  conversationParticipant: { findUnique(args: unknown): Promise<unknown | null> };
};

/** Users hidden from `userId` in either direction (I blocked them, or they blocked me). */
export async function blockedPeerIds(prisma: SafetyPrisma, userId: string): Promise<string[]> {
  const rows = await prisma.userBlock.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true },
  });
  const ids = new Set<string>();
  for (const r of rows) ids.add(r.blockerId === userId ? r.blockedId : r.blockerId);
  return [...ids];
}

export async function isBlockedEitherWay(prisma: SafetyPrisma, a: string, b: string): Promise<boolean> {
  const row = await prisma.userBlock.findFirst({
    where: {
      OR: [
        { blockerId: a, blockedId: b },
        { blockerId: b, blockedId: a },
      ],
    },
  });
  return !!row;
}

export async function assertNotBlocked(prisma: SafetyPrisma, a: string, b: string): Promise<void> {
  if (await isBlockedEitherWay(prisma, a, b)) throw new ForbiddenException(BLOCKED_MESSAGE);
}

export async function blockUser(prisma: SafetyPrisma, blockerId: string, blockedId: string) {
  if (blockerId === blockedId) throw new BadRequestException('Cannot block yourself');
  const target = await prisma.user.findFirst({ where: { id: blockedId }, select: { id: true } });
  if (!target) throw new NotFoundException('User not found');
  await prisma.userBlock.upsert({
    where: { blockerId_blockedId: { blockerId, blockedId } },
    create: { blockerId, blockedId },
    update: {},
  });
  return { blocked: true, userId: blockedId };
}

export async function unblockUser(prisma: SafetyPrisma, blockerId: string, blockedId: string) {
  await prisma.userBlock.deleteMany({ where: { blockerId, blockedId } });
  return { blocked: false, userId: blockedId };
}

export function normalizeReport(input: { reason?: string; details?: string | null }) {
  const reason = String(input.reason ?? '').trim().toLowerCase() as UserReportReason;
  if (!REPORT_REASONS.includes(reason)) throw new BadRequestException('Invalid report reason');
  const details = (input.details ?? '').trim().slice(0, REPORT_DETAILS_MAX) || null;
  if (reason === 'other' && !details) throw new BadRequestException('Please describe the problem');
  return { reason, details };
}

export async function reportUser(
  prisma: SafetyPrisma,
  reporterId: string,
  input: { reportedUserId: string; reason?: string; details?: string | null; messageId?: string; conversationId?: string; alsoBlock?: boolean },
) {
  if (reporterId === input.reportedUserId) throw new BadRequestException('Cannot report yourself');
  const { reason, details } = normalizeReport(input);
  const target = await prisma.user.findFirst({ where: { id: input.reportedUserId }, select: { id: true } });
  if (!target) throw new NotFoundException('User not found');

  let messageSnapshot: string | null = null;
  let conversationId = input.conversationId ?? null;
  if (input.messageId) {
    const msg = await prisma.message.findFirst({ where: { id: input.messageId } });
    // Only a message the reporter can see, written by the reported user, may be attached.
    if (!msg || msg.senderId !== input.reportedUserId) throw new BadRequestException('Message not found');
    const member = await prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId: msg.conversationId, userId: reporterId } },
    });
    if (!member) throw new ForbiddenException('Not a participant');
    messageSnapshot = msg.body.slice(0, 4000);
    conversationId = msg.conversationId;
  }

  const report = await prisma.userReport.create({
    data: {
      reporterId,
      reportedUserId: input.reportedUserId,
      conversationId,
      messageId: input.messageId ?? null,
      reason,
      details,
      messageSnapshot,
    },
  });
  if (input.alsoBlock) await blockUser(prisma, reporterId, input.reportedUserId);
  return { id: report.id, status: report.status, blocked: !!input.alsoBlock };
}
