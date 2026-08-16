import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { isDevAuthEnabled } from '../../common/dev-auth/dev-auth.config';
import { PrismaService } from '../../prisma/prisma.service';

type Draft = {
  kind: string;
  title: string;
  body: string;
  href: string;
  refId?: string | null;
  dedupeKey: string;
  eventAt?: Date;
  bumpUnread?: boolean;
};

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async list(userId: string) {
    if (!this.prisma.dbAvailable) {
      return { items: [], unreadCount: 0 };
    }
    await this.syncDerived(userId);
    const rows = await this.prisma.userNotification.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }],
      take: 80,
    });
    return {
      items: rows.map((row) => this.toItem(row)),
      unreadCount: rows.filter((row) => !row.readAt).length,
    };
  }

  async unreadCount(userId: string) {
    if (!this.prisma.dbAvailable) return { unreadCount: 0 };
    await this.syncDerived(userId);
    const unreadCount = await this.prisma.userNotification.count({
      where: { userId, readAt: null },
    });
    return { unreadCount };
  }

  async markRead(userId: string, id: string) {
    if (!this.prisma.dbAvailable) {
      throw new NotFoundException('Notification not found');
    }
    const existing = await this.prisma.userNotification.findFirst({
      where: { id, userId },
    });
    if (!existing) throw new NotFoundException('Notification not found');
    const item = existing.readAt
      ? existing
      : await this.prisma.userNotification.update({
          where: { id },
          data: { readAt: new Date() },
        });
    const unreadCount = await this.prisma.userNotification.count({
      where: { userId, readAt: null },
    });
    return { ok: true, unreadCount, item: this.toItem(item) };
  }

  async markAllRead(userId: string) {
    if (!this.prisma.dbAvailable) return { ok: true, unreadCount: 0 };
    await this.prisma.userNotification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true, unreadCount: 0 };
  }

  private toItem(row: {
    id: string;
    kind: string;
    title: string;
    body: string;
    href: string | null;
    refId: string | null;
    readAt: Date | null;
    createdAt: Date;
  }) {
    return {
      id: row.id,
      kind: row.kind,
      title: row.title,
      body: row.body,
      href: row.href,
      refId: row.refId,
      unread: !row.readAt,
      createdAt: row.createdAt,
    };
  }

  private async syncDerived(userId: string) {
    if (isDevAuthEnabled() && !this.prisma.dbAvailable) return;
    const drafts = await this.buildDrafts(userId);
    for (const draft of drafts) {
      await this.upsertDraft(userId, draft);
    }
  }

  private async upsertDraft(userId: string, draft: Draft) {
    const existing = await this.prisma.userNotification.findUnique({
      where: { userId_dedupeKey: { userId, dedupeKey: draft.dedupeKey } },
    });
    const data: Prisma.UserNotificationUncheckedCreateInput = {
      userId,
      kind: draft.kind,
      title: draft.title,
      body: draft.body,
      href: draft.href,
      refId: draft.refId ?? null,
      dedupeKey: draft.dedupeKey,
    };
    if (!existing) {
      await this.prisma.userNotification.create({ data });
      return;
    }
    const newerEvent =
      draft.bumpUnread &&
      !!existing.readAt &&
      !!draft.eventAt &&
      draft.eventAt.getTime() > existing.readAt.getTime();
    await this.prisma.userNotification.update({
      where: { id: existing.id },
      data: {
        title: draft.title,
        body: draft.body,
        href: draft.href,
        refId: draft.refId ?? existing.refId,
        ...(newerEvent ? { readAt: null } : {}),
      },
    });
  }

  private async buildDrafts(userId: string): Promise<Draft[]> {
    const today = todayKey();
    const [user, prefs, dueCount, todaySeconds, campaigns, participations] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { streakCount: true, streakLastDate: true, displayName: true },
      }),
      this.prisma.userPreferences.findUnique({
        where: { userId },
        select: { dailyGoalMinutes: true },
      }),
      this.prisma.userVocabulary.count({
        where: { userId, mastered: false, dueAt: { lte: new Date() } },
      }),
      this.todayReadSeconds(userId, today),
      this.prisma.notificationCampaign.findMany({
        where: {
          status: 'sent',
          sentAt: { gte: daysAgo(14) },
        },
        orderBy: { sentAt: 'desc' },
        take: 10,
      }),
      this.prisma.conversationParticipant.findMany({
        where: { userId },
        include: {
          conversation: {
            include: {
              messages: { orderBy: { createdAt: 'desc' }, take: 1 },
              participants: {
                where: { userId: { not: userId } },
                include: { user: { select: { displayName: true, email: true } } },
              },
            },
          },
        },
      }),
    ]);

    const drafts: Draft[] = [];
    const firstName = (user?.displayName ?? 'there').split(/\s+/)[0] || 'there';
    const streakLast = user?.streakLastDate
      ? user.streakLastDate.toISOString().slice(0, 10)
      : null;
    const streakCount = user?.streakCount ?? 0;
    if (streakCount > 0 && streakLast !== today) {
      drafts.push({
        kind: 'streak',
        title: `Don't lose your ${streakCount}-day streak!`,
        body: `Hi ${firstName} — read a few minutes today to keep your streak alive.`,
        href: 'streak',
        dedupeKey: `streak:${today}`,
      });
    }

    const goal = prefs?.dailyGoalMinutes ?? 15;
    const todayMinutes = Math.round(todaySeconds / 60);
    if (goal > 0 && todayMinutes < goal) {
      const left = Math.max(1, goal - todayMinutes);
      drafts.push({
        kind: 'goal',
        title: 'Daily reading goal',
        body: `${left} min left to hit today's ${goal}-minute goal.`,
        href: 'daily_goal',
        dedupeKey: `goal:${today}`,
      });
    }

    if (dueCount > 0) {
      drafts.push({
        kind: 'vocab',
        title: 'Vocabulary review ready',
        body:
          dueCount === 1
            ? 'You have 1 word due for review.'
            : `You have ${dueCount} words ready for your SRS review.`,
        href: 'vocab_review',
        dedupeKey: 'vocab:due',
      });
    }

    for (const part of participations) {
      const last = part.conversation.messages[0];
      if (!last || last.senderId === userId) continue;
      const unread =
        !part.lastReadAt || last.createdAt.getTime() > part.lastReadAt.getTime();
      if (!unread) continue;
      const peer = part.conversation.participants[0]?.user;
      const peerName =
        peer?.displayName?.trim() ||
        peer?.email?.split('@')[0] ||
        'A learner';
      drafts.push({
        kind: 'message',
        title: `New message from ${peerName}`,
        body: last.body.slice(0, 160),
        href: `chat/${part.conversationId}`,
        refId: part.conversationId,
        dedupeKey: `message:${part.conversationId}`,
        eventAt: last.createdAt,
        bumpUnread: true,
      });
    }

    for (const campaign of campaigns) {
      drafts.push({
        kind: 'system',
        title: campaign.subject || campaign.name,
        body: campaign.body.slice(0, 220),
        href: 'library',
        refId: campaign.id,
        dedupeKey: `campaign:${campaign.id}`,
      });
    }

    return drafts;
  }

  private async todayReadSeconds(userId: string, today: string) {
    const start = new Date(`${today}T00:00:00.000Z`);
    const sessions = await this.prisma.readingSession.findMany({
      where: { userId, startedAt: { gte: start } },
      select: { durationSeconds: true },
    });
    return sessions.reduce((sum, row) => sum + (row.durationSeconds ?? 0), 0);
  }
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}
