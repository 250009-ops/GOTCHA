import { MailService } from '../../common/mail/mail.service';
import { notifyNewReport } from '../../common/safety/report-notify';
import { BadRequestException, HttpException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizeReport } from '../messaging/messaging-safety';
import { removeFriend, respondFriendRequest, sendFriendRequest } from './friend-gate';
import { safeAvatarUrl } from '../users/avatar-image';

@Injectable()
export class SafetyService {
  private log = new Logger('Safety');
  constructor(private prisma: PrismaService, private mail: MailService) {}
  private get p() {
    return this.prisma as never;
  }

  async listFriends(userId: string) {
    const rows = await this.prisma.friendRequest.findMany({
      where: { OR: [{ requesterId: userId }, { addresseeId: userId }], status: { in: ['pending', 'accepted'] } },
      include: {
        requester: { select: { id: true, displayName: true, avatarUrl: true } },
        addressee: { select: { id: true, displayName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    const view = (r: (typeof rows)[0]) => {
      const user = r.requesterId === userId ? r.addressee : r.requester;
      return {
        id: r.id,
        status: r.status,
        createdAt: r.createdAt,
        user: { ...user, avatarUrl: safeAvatarUrl(user.avatarUrl) },
      };
    };
    return {
      friends: rows.filter((r) => r.status === 'accepted').map(view),
      incoming: rows.filter((r) => r.status === 'pending' && r.addresseeId === userId).map(view),
      outgoing: rows.filter((r) => r.status === 'pending' && r.requesterId === userId).map(view),
    };
  }
  async sendRequest(userId: string, peer: string) {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sent = await this.prisma.friendRequest.count({
      where: { requesterId: userId, createdAt: { gte: dayAgo } },
    });
    if (sent >= 20) {
      throw new HttpException(
        { statusCode: 429, code: 'RATE_LIMITED', message: 'You can send 20 friend requests a day.' },
        429,
      );
    }
    return sendFriendRequest(this.p, userId, peer);
  }
  respond(userId: string, id: string, accept: boolean) {
    return respondFriendRequest(this.p, userId, id, accept);
  }
  async unfriend(userId: string, peer: string) {
    await removeFriend(this.p, userId, peer);
    return { removed: true };
  }

  async reportContent(userId: string, dto: { contentId?: string; importId?: string; reason?: string; details?: string }) {
    if (!dto.contentId && !dto.importId) throw new BadRequestException('contentId or importId required');
    const { reason, details } = normalizeReport(dto);
    const r = await this.prisma.contentReport.create({
      data: { reporterId: userId, contentId: dto.contentId ?? null, importId: dto.importId ?? null, reason, details },
    });
    notifyNewReport(this.mail, { id: r.id, kind: 'content', reason });
    return { id: r.id, status: r.status };
  }

  async queue(kind: 'user' | 'content', status?: string) {
    const where = status ? { status: status as never } : { status: 'open' as never };
    if (kind === 'content') {
      return this.prisma.contentReport.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        take: 200,
        include: { reporter: { select: { id: true, displayName: true, email: true } } },
      });
    }
    return this.prisma.userReport.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: 200,
      include: {
        reporter: { select: { id: true, displayName: true, email: true } },
        reportedUser: { select: { id: true, displayName: true, email: true, birthYear: true } },
      },
    });
  }

  async messageContext(id: string) {
    const report = await this.prisma.userReport.findUnique({ where: { id } });
    if (!report) throw new NotFoundException('Report not found');
    const anchor = report.messageId
      ? await this.prisma.message.findUnique({
          where: { id: report.messageId },
          select: { id: true, conversationId: true, body: true, originalBody: true, senderId: true, createdAt: true, deletedAt: true, editedAt: true },
        })
      : null;
    const conversationId = anchor?.conversationId ?? report.conversationId;
    if (!conversationId) return { reportId: id, messages: [] };
    const at = anchor?.createdAt ?? new Date();
    const [older, newer] = await Promise.all([
      this.prisma.message.findMany({
        where: { conversationId, createdAt: { lt: at } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, body: true, originalBody: true, senderId: true, createdAt: true, deletedAt: true, editedAt: true },
      }),
      this.prisma.message.findMany({
        where: { conversationId, createdAt: { gt: at } },
        orderBy: { createdAt: 'asc' },
        take: 5,
        select: { id: true, body: true, originalBody: true, senderId: true, createdAt: true, deletedAt: true, editedAt: true },
      }),
    ]);
    const rows = [...older.reverse(), ...(anchor ? [anchor] : []), ...newer];
    return {
      reportId: id,
      messages: rows.map((m) => ({
        id: m.id,
        senderId: m.senderId,
        createdAt: m.createdAt,
        deleted: !!m.deletedAt,
        edited: !!m.editedAt,
        reported: m.id === report.messageId,
        body: m.originalBody || m.body,
      })),
    };
  }

  async resolve(adminId: string, kind: 'user' | 'content', id: string, status: 'reviewed' | 'actioned' | 'dismissed') {
    const data = { status, reviewedAt: new Date() } as never;
    await this.prisma.$transaction(async (tx) => {
      const before = kind === 'content'
        ? await tx.contentReport.findUnique({ where: { id }, select: { status: true } })
        : await tx.userReport.findUnique({ where: { id }, select: { status: true } });
      const res = kind === 'content'
        ? await tx.contentReport.updateMany({ where: { id }, data })
        : await tx.userReport.updateMany({ where: { id }, data });
      if (!res.count) throw new NotFoundException('Report not found');
      await tx.auditLog.create({
        data: { actorId: adminId, action: 'safety.report.resolve', entityType: `${kind}_report`, entityId: id, metadata: { status, before: before?.status ?? null } },
      });
    });
    this.log.log(`report ${kind}/${id} -> ${status} by ${adminId}`);
    return { id, status };
  }

  async setAiDisabled(adminId: string, userId: string, aiDisabled: boolean) {
    await this.prisma.$transaction(async (tx) => {
      const before = await tx.user.findUnique({ where: { id: userId }, select: { aiDisabled: true } });
      const res = await tx.user.updateMany({ where: { id: userId }, data: { aiDisabled, aiDisabledBy: aiDisabled ? 'admin' : null } });
      if (!res.count) throw new NotFoundException('User not found');
      await tx.auditLog.create({
        data: { actorId: adminId, action: 'user.ai_disabled', entityType: 'user', entityId: userId, metadata: { aiDisabled, before: before?.aiDisabled ?? null } },
      });
    });
    this.log.log(`aiDisabled=${aiDisabled} for ${userId} by ${adminId}`);
    return { userId, aiDisabled };
  }
}
