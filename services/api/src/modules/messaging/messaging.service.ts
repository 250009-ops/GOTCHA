import { resolveCoverKey } from '@gotcha/shared';
import { DELETED_USER_NAME, assertNotDeletedUser, isDeletedAccount } from '../../common/deleted-user';
import { notifyNewReport } from '../../common/safety/report-notify';
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppLanguage, Prisma } from '@prisma/client';
import {
  isFigmaSampleDisplayName,
  isSyntheticUserEmail,
  liveMessagingPeerWhere,
} from '../../common/production-users';
import { MailService } from '../../common/mail/mail.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EditMessageDto, ReportUserDto, SendMessageDto, StartConversationDto } from './dto/messaging.dto';
import { assertCanMessage, assertPeerVisible, GatePrisma } from '../safety/friend-gate';
import { safeAvatarUrl } from '../users/avatar-image';
import {
  assertNotBlocked,
  blockedPeerIds,
  blockUser,
  isBlockedEitherWay,
  reportUser,
  SafetyPrisma,
  unblockUser,
} from './messaging-safety';

const MESSAGE_PAGE = 50;
const INBOX_PAGE = 30;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const EDIT_WINDOW_MS = 48 * 60 * 60 * 1000;
const ONLINE_WINDOW_MS = 90 * 1000;
const TYPING_WINDOW_MS = 4 * 1000;
const MESSAGE_EMAIL_COOLDOWN_MS = 10 * 60 * 1000;

const messageInclude = {
  sender: { select: { id: true, displayName: true, avatarUrl: true, email: true } },
  replyTo: {
    select: {
      id: true,
      body: true,
      translation: true,
      bodyLang: true,
      senderId: true,
      deletedAt: true,
    },
  },
} as const;

type PeerUser = {
  id: string;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
  nativeLanguage: AppLanguage;
  lastSeenAt?: Date | null;
  birthYear?: number | null;
  preferences?: { showOnlineStatus: boolean } | null;
  targetLanguages: Array<{ targetLanguage: AppLanguage; isPrimary: boolean; cefrLevel: string }>;
  adminProfile?: { userId: string } | null;
};

function isLiveMessagingPeer(user: {
  email: string | null;
  displayName: string | null;
  adminProfile?: { userId: string } | null;
}) {
  if (user.adminProfile) return false;
  if (isSyntheticUserEmail(user.email)) return false;
  if (isFigmaSampleDisplayName(user.displayName)) return false;
  return true;
}

/** covers-01: content card fields; coverImageKey is the EFFECTIVE cover (null in template mode → client draws it). */
const CONTENT_CARD_SELECT = {
  id: true,
  title: true,
  coverImageKey: true,
  coverMode: true,
  originalCoverKey: true,
  genre: true,
  language: true,
} as const;
function cardContent<T extends { coverImageKey: string | null; coverMode: string; originalCoverKey: string | null }>(
  c: T | null | undefined,
): (Omit<T, 'originalCoverKey'> & { coverImageKey: string | null }) | null {
  if (!c) return null;
  const { originalCoverKey: _o, ...rest } = c;
  return { ...rest, coverImageKey: resolveCoverKey(c) };
}

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);
  private lastMessageEmailAt = new Map<string, number>();

  constructor(
    private prisma: PrismaService,
    private mail: MailService,
    private config: ConfigService,
  ) {}

  private presenceOf(lastSeenAt?: Date | null) {
    const online = !!lastSeenAt && Date.now() - lastSeenAt.getTime() < ONLINE_WINDOW_MS;
    return {
      online,
      lastSeenAt: lastSeenAt ? lastSeenAt.toISOString() : null,
    };
  }

  private typingActive(until?: Date | null) {
    return !!until && until.getTime() > Date.now();
  }

  private assertUuid(id: string, label: string) {
    if (!UUID_RE.test(id)) throw new BadRequestException(`Invalid ${label}`);
  }

  private messageStatus(mine: boolean, createdAt: Date, peerLastReadAt?: Date | null) {
    if (!mine) return null;
    if (peerLastReadAt && peerLastReadAt.getTime() >= createdAt.getTime()) return 'read';
    return 'sent';
  }

  private pairKey(a: string, b: string) {
    return [a, b].sort().join(':');
  }

  private peerSummary(user: PeerUser, opts?: { hidePresence?: boolean }) {
    if (isDeletedAccount(user)) {
      // Privacy §11: shown as "Deleted user"; no name, email, photo, languages or presence.
      return {
        id: user.id,
        displayName: DELETED_USER_NAME,
        handle: '@deleted_user',
        avatarUrl: null,
        nativeLanguage: user.nativeLanguage,
        primaryLanguage: user.nativeLanguage,
        online: false,
        lastSeenAt: null,
        targetLanguages: [],
        deleted: true,
      };
    }
    const show = !opts?.hidePresence && user.preferences?.showOnlineStatus === true;
    const primary = show
      ? (user.targetLanguages.find((t) => t.isPrimary)?.targetLanguage ??
        user.targetLanguages[0]?.targetLanguage ??
        user.nativeLanguage)
      : user.nativeLanguage;
    const handle =
      '@' +
      (user.displayName ?? user.email?.split('@')[0] ?? 'learner')
        .toLowerCase()
        .replace(/[^a-z0-9_]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 24);
    return {
      id: user.id,
      displayName: user.displayName ?? user.email?.split('@')[0] ?? 'Learner',
      handle,
      avatarUrl: safeAvatarUrl(user.avatarUrl),
      nativeLanguage: user.nativeLanguage,
      primaryLanguage: primary,
      online: show ? this.presenceOf(user.lastSeenAt).online : false,
      lastSeenAt: show ? this.presenceOf(user.lastSeenAt).lastSeenAt : null,
      targetLanguages: show
        ? user.targetLanguages.map((t) => ({
            language: t.targetLanguage,
            cefrLevel: t.cefrLevel,
            isPrimary: t.isPrimary,
          }))
        : [],
    };
  }

  private presentMessage(
    m: {
      id: string;
      body: string;
      translation: string | null;
      bodyLang: AppLanguage | null;
      senderId: string | null;
      createdAt: Date;
      editedAt?: Date | null;
      deletedAt?: Date | null;
      replyToId?: string | null;
      sender?: { id: string; displayName: string | null; avatarUrl: string | null; email?: string | null } | null;
      replyTo?: {
        id: string;
        body: string;
        translation?: string | null;
        bodyLang?: AppLanguage | null;
        senderId: string | null;
        deletedAt: Date | null;
      } | null;
    },
    userId: string,
    peerLastReadAt?: Date | null,
  ) {
    const deleted = !!m.deletedAt;
    const mine = m.senderId === userId;
    return {
      id: m.id,
      body: deleted ? '' : m.body,
      translation: deleted ? null : m.translation,
      bodyLang: m.bodyLang,
      senderId: m.senderId,
      // email is selected only to detect a deleted account; it never leaves the API.
      sender: m.sender
        ? { id: m.sender.id, displayName: m.sender.displayName, avatarUrl: safeAvatarUrl(m.sender.avatarUrl), deleted: isDeletedAccount(m.sender) }
        : m.senderId === null
          ? { id: null, displayName: DELETED_USER_NAME, avatarUrl: null, deleted: true } // final-5 WL4-11 B: hard-deleted sender
          : m.sender,
      mine,
      createdAt: m.createdAt,
      editedAt: m.editedAt ?? null,
      status: this.messageStatus(mine, m.createdAt, peerLastReadAt),
      deleted,
      replyTo: m.replyTo
        ? {
            id: m.replyTo.id,
            body: m.replyTo.deletedAt ? '' : m.replyTo.body,
            translation: m.replyTo.deletedAt ? null : m.replyTo.translation,
            bodyLang: m.replyTo.bodyLang,
            senderId: m.replyTo.senderId,
            deleted: !!m.replyTo.deletedAt,
          }
        : m.replyToId
          ? { id: m.replyToId, body: '', senderId: '', deleted: true }
          : null,
    };
  }

  private async peerLastReadAt(conversationId: string, userId: string) {
    const peer = await this.prisma.conversationParticipant.findFirst({
      where: { conversationId, userId: { not: userId } },
      select: { lastReadAt: true },
    });
    return peer?.lastReadAt ?? null;
  }

  private async assertParticipant(conversationId: string, userId: string) {
    const row = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!row) throw new ForbiddenException('Not a participant');
    return row;
  }

  private get safety(): SafetyPrisma {
    return this.prisma as unknown as SafetyPrisma;
  }

  async listBlocks(userId: string) {
    const rows = await this.prisma.userBlock.findMany({
      where: { blockerId: userId },
      orderBy: { createdAt: 'desc' },
      include: { blocked: { select: { id: true, displayName: true, avatarUrl: true } } },
    });
    return rows.map((r) => ({
      userId: r.blockedId,
      displayName: r.blocked.displayName,
      avatarUrl: safeAvatarUrl(r.blocked.avatarUrl),
      blockedAt: r.createdAt,
    }));
  }

  block(userId: string, peerUserId: string) {
    return blockUser(this.safety, userId, peerUserId);
  }

  unblock(userId: string, peerUserId: string) {
    return unblockUser(this.safety, userId, peerUserId);
  }

  async report(userId: string, dto: ReportUserDto) {
    if (dto.messageId) {
      const existing = await this.prisma.userReport.findFirst({
        where: { reporterId: userId, messageId: dto.messageId },
      });
      if (existing) return existing;
    }
    try {
      const r = await reportUser(this.safety, userId, dto);
      notifyNewReport(this.mail, { id: r.id, kind: 'user', reason: dto.reason });
      return r;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002' && dto.messageId) {
        const existing = await this.prisma.userReport.findFirst({
          where: { reporterId: userId, messageId: dto.messageId },
        });
        if (existing) return existing;
      }
      throw err;
    }
  }

  private async assertSendRate(userId: string) {
    const minuteAgo = new Date(Date.now() - 60_000);
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [minute, day] = await Promise.all([
      this.prisma.message.count({ where: { senderId: userId, createdAt: { gte: minuteAgo } } }),
      this.prisma.message.count({ where: { senderId: userId, createdAt: { gte: dayAgo } } }),
    ]);
    if (minute >= 20 || day >= 300) {
      throw new HttpException(
        {
          statusCode: 429,
          code: 'RATE_LIMITED',
          message: minute >= 20 ? 'You can send 20 messages a minute.' : 'You can send 300 messages a day.',
        },
        429,
      );
    }
  }

  async listConversations(userId: string, q?: string, before?: string) {
    if (before) this.assertUuid(before, 'cursor');
    const hidden = await blockedPeerIds(this.safety, userId);
    const rows = await this.prisma.conversation.findMany({
      where: {
        participants: { some: { userId } },
        ...(hidden.length ? { NOT: { participants: { some: { userId: { in: hidden } } } } } : {}),
      },
      take: INBOX_PAGE,
      ...(before ? { cursor: { id: before }, skip: 1 } : {}),
      include: {
        participants: {
          include: {
            user: {
              include: {
                targetLanguages: true,
                preferences: { select: { showOnlineStatus: true } },
                adminProfile: { select: { userId: true } },
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        content: { select: CONTENT_CARD_SELECT },
      },
      orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
    });

    const query = q?.trim().toLowerCase();
    const liveRows = rows.filter((c) => {
      const peer = c.participants.find((p) => p.userId !== userId)?.user;
      return !peer || isLiveMessagingPeer(peer);
    });
    const unreadRows = await this.prisma.$queryRaw<Array<{ conversationId: string; unread: number }>>`
      SELECT m.conversation_id::text AS "conversationId", COUNT(*)::int AS unread
      FROM messages m
      JOIN conversation_participants me
        ON me.conversation_id = m.conversation_id AND me.user_id = ${userId}::uuid
      LEFT JOIN messages seen ON seen.id = me.last_read_message_id
      WHERE (m.sender_id IS DISTINCT FROM ${userId}::uuid)
        AND (seen.id IS NULL OR m.created_at > seen.created_at)
      GROUP BY m.conversation_id
    `;
    const unreadById = new Map(unreadRows.map((row) => [row.conversationId, Number(row.unread)]));
    const withUnread = liveRows.map((c) => {
        const peerPart = c.participants.find((p) => p.userId !== userId);
        const peer = peerPart ? this.peerSummary(peerPart.user) : null;
        const last = c.messages[0] ?? null;
        const peerLastReadAt = peerPart?.lastReadAt ?? null;
        const unreadCount = unreadById.get(c.id) ?? 0;
        return {
          id: c.id,
          language: c.language,
          content: cardContent(c.content),
          peer,
          lastMessage: last
            ? {
                id: last.id,
                body: last.deletedAt ? 'Message deleted' : last.body,
                translation: last.deletedAt ? null : last.translation,
                senderId: last.senderId,
                createdAt: last.createdAt,
                deleted: !!last.deletedAt,
                status: this.messageStatus(last.senderId === userId, last.createdAt, peerLastReadAt),
              }
            : null,
          unreadCount,
          lastMessageAt: c.lastMessageAt,
          updatedAt: c.updatedAt,
        };
    });

    if (!query) return withUnread;
    return withUnread.filter((item) => {
      const hay = [
        item.peer?.displayName,
        item.peer?.handle,
        item.lastMessage?.body,
        item.lastMessage?.translation,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(query);
    });
  }

  async unreadTotal(userId: string) {
    const rows = await this.prisma.$queryRaw<Array<{ unread: number }>>`
      SELECT COUNT(*)::int AS unread
      FROM messages m
      JOIN conversation_participants me
        ON me.conversation_id = m.conversation_id AND me.user_id = ${userId}::uuid
      LEFT JOIN messages seen ON seen.id = me.last_read_message_id
      WHERE (m.sender_id IS DISTINCT FROM ${userId}::uuid)
        AND (seen.id IS NULL OR m.created_at > seen.created_at)
    `;
    return { unreadCount: Number(rows[0]?.unread ?? 0) };
  }

  async getConversation(userId: string, conversationId: string, cursor?: { before?: string; after?: string }) {
    this.assertUuid(conversationId, 'conversation');
    if (cursor?.before) this.assertUuid(cursor.before, 'cursor');
    if (cursor?.after) this.assertUuid(cursor.after, 'cursor');
    if (cursor?.before && cursor?.after) throw new BadRequestException('Pass only one cursor');
    await this.assertParticipant(conversationId, userId);
    const c = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: {
          include: { user: { include: { targetLanguages: true,
                preferences: { select: { showOnlineStatus: true } }, } } },
        },
        content: { select: CONTENT_CARD_SELECT },
      },
    });
    if (!c) throw new NotFoundException('Conversation not found');

    const peerPart = c.participants.find((p) => p.userId !== userId);
    const peerLastReadAt = await this.seenAt(peerPart?.lastReadMessageId, peerPart?.lastReadAt);
    const hidePresence = peerPart ? await isBlockedEitherWay(this.safety, userId, peerPart.userId) : false;
    let cursorAt: Date | undefined;
    if (cursor?.before || cursor?.after) {
      const row = await this.prisma.message.findFirst({
        where: { id: (cursor.before ?? cursor.after)!, conversationId },
        select: { createdAt: true },
      });
      if (!row) throw new BadRequestException('Invalid cursor');
      cursorAt = row.createdAt;
    }
    const newer = !!cursor?.after;
    const messages = await this.prisma.message.findMany({
      where: {
        conversationId,
        ...(cursor?.before ? { createdAt: { lt: cursorAt } } : {}),
        ...(cursor?.after ? { createdAt: { gt: cursorAt } } : {}),
      },
      orderBy: { createdAt: newer ? 'asc' : 'desc' },
      take: MESSAGE_PAGE,
      include: messageInclude,
    });
    const ordered = newer ? messages : [...messages].reverse();
    return {
      id: c.id,
      language: c.language,
      content: cardContent(c.content),
      peer: peerPart
        ? {
            ...this.peerSummary(peerPart.user, { hidePresence }),
            typing: hidePresence ? false : this.typingActive(peerPart.typingUntil),
          }
        : null,
      peerLastReadAt,
      messages: ordered.map((m) => this.presentMessage(m, userId, peerLastReadAt)),
      hasOlder: !newer && messages.length === MESSAGE_PAGE,
      lastMessageAt: c.lastMessageAt,
    };
  }

  private async seenAt(messageId?: string | null, fallback?: Date | null) {
    if (!messageId) return fallback ?? null;
    const row = await this.prisma.message.findUnique({ where: { id: messageId }, select: { createdAt: true } });
    return row?.createdAt ?? fallback ?? null;
  }

  async startConversation(userId: string, dto: StartConversationDto) {
    if (dto.peerUserId === userId) {
      throw new BadRequestException('Cannot message yourself');
    }
    await assertNotDeletedUser(this.prisma as never, dto.peerUserId);
    const peer = await this.prisma.user.findFirst({
      where: { id: dto.peerUserId, deletedAt: null },
      include: { targetLanguages: true,
                preferences: { select: { showOnlineStatus: true } }, adminProfile: { select: { userId: true } } },
    });
    if (!peer || !isLiveMessagingPeer(peer)) throw new NotFoundException('User not found');
    await assertNotBlocked(this.safety, userId, dto.peerUserId);
    await assertCanMessage(this.prisma as never, userId, dto.peerUserId);

    const key = this.pairKey(userId, dto.peerUserId);
    let conversation = await this.prisma.conversation.findUnique({
      where: { pairKey: key },
    });

    if (!conversation) {
      try {
        conversation = await this.prisma.conversation.create({
          data: {
            pairKey: key,
            language: dto.language ?? peer.nativeLanguage,
            contentId: dto.contentId,
            participants: {
              create: [{ userId }, { userId: dto.peerUserId }],
            },
          },
        });
      } catch (err) {
        if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') throw err;
        conversation = await this.prisma.conversation.findUnique({ where: { pairKey: key } });
        if (!conversation) throw err;
      }
    } else if (dto.contentId && !conversation.contentId) {
      conversation = await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: { contentId: dto.contentId },
      });
    }

    return this.getConversation(userId, conversation.id);
  }

  async sendMessage(userId: string, conversationId: string, dto: SendMessageDto) {
    await this.assertParticipant(conversationId, userId);
    const other = await this.prisma.conversationParticipant.findFirst({
      where: { conversationId, userId: { not: userId } },
      select: { userId: true },
    });
    if (other) await assertNotDeletedUser(this.prisma as never, other.userId);
    if (other) await assertNotBlocked(this.safety, userId, other.userId);
    if (other) await assertCanMessage(this.prisma as never, userId, other.userId);
    await this.assertSendRate(userId);
    const body = dto.body.trim();
    if (!body) throw new BadRequestException('Message body required');
    if (body.length > 4000) throw new BadRequestException('Message is too long');

    let replyToId: string | undefined;
    if (dto.replyToId) {
      const parent = await this.prisma.message.findFirst({
        where: { id: dto.replyToId, conversationId },
      });
      if (!parent) throw new BadRequestException('Reply target not found');
      replyToId = parent.id;
    }

    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId: userId,
        body,
        originalBody: body,
        translation: dto.translation?.trim() || null,
        bodyLang: dto.bodyLang,
        replyToId,
      },
      include: messageInclude,
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: message.createdAt },
    });

    const presented = this.presentMessage(message, userId, await this.peerLastReadAt(conversationId, userId));
    void this.notifyRecipientsByEmail(userId, conversationId, presented.body).catch((err) => {
      this.logger.warn(
        `Message email notify failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    });
    return presented;
  }

  async editMessage(userId: string, conversationId: string, messageId: string, dto: EditMessageDto) {
    await this.assertParticipant(conversationId, userId);
    const existing = await this.prisma.message.findFirst({
      where: { id: messageId, conversationId },
    });
    if (!existing) throw new NotFoundException('Message not found');
    if (existing.senderId !== userId) throw new ForbiddenException('You can only edit your own messages');
    if (existing.deletedAt) throw new BadRequestException('Cannot edit a deleted message');
    if (Date.now() - existing.createdAt.getTime() > EDIT_WINDOW_MS) {
      throw new BadRequestException('Edit window has expired');
    }

    const body = dto.body.trim();
    if (!body) throw new BadRequestException('Message body required');

    const message = await this.prisma.$transaction(async (tx) => {
      await tx.messageEdit.create({ data: { messageId, body: existing.body } });
      return tx.message.update({
        where: { id: messageId },
        data: {
          body,
          originalBody: existing.originalBody ?? existing.body,
          translation: dto.translation?.trim() || null,
          bodyLang: dto.bodyLang ?? existing.bodyLang,
          editedAt: new Date(),
        },
        include: messageInclude,
      });
    });

    return this.presentMessage(message, userId, await this.peerLastReadAt(conversationId, userId));
  }

  async deleteMessage(userId: string, conversationId: string, messageId: string) {
    await this.assertParticipant(conversationId, userId);
    const existing = await this.prisma.message.findFirst({
      where: { id: messageId, conversationId },
    });
    if (!existing) throw new NotFoundException('Message not found');
    if (existing.senderId !== userId) throw new ForbiddenException('You can only delete your own messages');
    if (existing.deletedAt) {
      return this.presentMessage(
        { ...existing, sender: undefined, replyTo: null },
        userId,
        await this.peerLastReadAt(conversationId, userId),
      );
    }

    const message = await this.prisma.message.update({
      where: { id: messageId },
      data: {
        deletedAt: new Date(),
        originalBody: existing.originalBody ?? existing.body,
        body: '',
        translation: null,
      },
      include: messageInclude,
    });

    return this.presentMessage(message, userId, await this.peerLastReadAt(conversationId, userId));
  }

  async heartbeat(userId: string) {
    const row = await this.prisma.user.update({
      where: { id: userId },
      data: { lastSeenAt: new Date() },
      select: { lastSeenAt: true },
    });
    return { ok: true, lastSeenAt: row.lastSeenAt };
  }

  async setTyping(userId: string, conversationId: string, typing: boolean) {
    await this.assertParticipant(conversationId, userId);
    await this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { typingUntil: typing ? new Date(Date.now() + TYPING_WINDOW_MS) : null },
    });
    return { ok: true };
  }

  async conversationStatus(userId: string, conversationId: string) {
    await this.assertParticipant(conversationId, userId);
    const parts = await this.prisma.conversationParticipant.findMany({
      where: { conversationId },
      include: { user: { select: { id: true, lastSeenAt: true } } },
    });
    const peer = parts.find((p) => p.userId !== userId);
    const hidePresence = peer ? await isBlockedEitherWay(this.safety, userId, peer.userId) : false;
    const prefs = peer && !hidePresence
      ? await this.prisma.userPreferences.findUnique({
          where: { userId: peer.userId },
          select: { showOnlineStatus: true },
        })
      : null;
    const show = prefs?.showOnlineStatus === true;
    return {
      peerLastReadAt: await this.seenAt(peer?.lastReadMessageId, peer?.lastReadAt),
      peer: peer
        ? {
            id: peer.userId,
            online: show ? this.presenceOf(peer.user.lastSeenAt).online : false,
            lastSeenAt: show ? this.presenceOf(peer.user.lastSeenAt).lastSeenAt : null,
            typing: show && this.typingActive(peer.typingUntil),
          }
        : null,
    };
  }

  async markRead(userId: string, conversationId: string, messageId?: string) {
    await this.assertParticipant(conversationId, userId);
    const message = messageId
      ? await this.prisma.message.findFirst({ where: { id: messageId, conversationId }, select: { id: true, createdAt: true } })
      : await this.prisma.message.findFirst({
          where: { conversationId },
          orderBy: { createdAt: 'desc' },
          select: { id: true, createdAt: true },
        });
    if (messageId && !message) throw new BadRequestException('Message not found');
    if (!message) return { ok: true };
    await this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadMessageId: message.id, lastReadAt: message.createdAt },
    });
    return { ok: true };
  }

  async suggestions(userId: string) {
    const hidden = await blockedPeerIds(this.safety, userId);
    const myProgress = await this.prisma.readingProgress.findMany({
      where: { userId },
      select: { contentId: true },
      take: 20,
    });
    const contentIds = myProgress.map((p) => p.contentId);
    if (contentIds.length === 0) {
      // Fallback: recent active learners with any reading progress
      const peers = await this.prisma.user.findMany({
        where: {
          id: { notIn: [userId, ...hidden] },
          ...liveMessagingPeerWhere(),
          readingProgress: { some: {} },
        },
        include: {
          targetLanguages: true,
                preferences: { select: { showOnlineStatus: true } },
          readingProgress: {
            take: 1,
            orderBy: { lastReadAt: 'desc' },
            include: {
              content: { select: CONTENT_CARD_SELECT },
            },
          },
        },
        take: 8,
      });
      return peers.map((p) => ({
        ...this.peerSummary(p),
        reading: cardContent(p.readingProgress[0]?.content),
      }));
    }

    const peers = await this.prisma.user.findMany({
      where: {
        id: { notIn: [userId, ...hidden] },
        ...liveMessagingPeerWhere(),
        readingProgress: { some: { contentId: { in: contentIds } } },
      },
      include: {
        targetLanguages: true,
                preferences: { select: { showOnlineStatus: true } },
        readingProgress: {
          where: { contentId: { in: contentIds } },
          take: 1,
          orderBy: { lastReadAt: 'desc' },
          include: {
            content: { select: CONTENT_CARD_SELECT },
          },
        },
      },
      take: 12,
    });

    return peers.map((p) => ({
      ...this.peerSummary(p),
      reading: cardContent(p.readingProgress[0]?.content),
    }));
  }

  async findLearners(userId: string, q?: string, lang?: string, sameReadings?: boolean) {
    const hidden = await blockedPeerIds(this.safety, userId);
    const query = q?.trim().replace(/^@/, '') ?? '';
    let contentIds: string[] = [];
    if (sameReadings) {
      const myProgress = await this.prisma.readingProgress.findMany({
        where: { userId },
        select: { contentId: true },
        take: 40,
      });
      contentIds = myProgress.map((p) => p.contentId);
    }

    const searchAnd: Prisma.UserWhereInput[] = [];
    if (query) {
      searchAnd.push({
        OR: [
          { displayName: { equals: query, mode: 'insensitive' } },
          { email: { startsWith: `${query}@`, mode: 'insensitive' } },
        ],
      });
    }
    if (lang) {
      if (!Object.values(AppLanguage).includes(lang as AppLanguage)) {
        throw new BadRequestException('Invalid language');
      }
      const language = lang as AppLanguage;
      searchAnd.push({
        OR: [
          { nativeLanguage: language },
          { targetLanguages: { some: { targetLanguage: language } } },
        ],
      });
    }

    const peers = await this.prisma.user.findMany({
      where: {
        id: { notIn: [userId, ...hidden] },
        ...liveMessagingPeerWhere(),
        AND: searchAnd,
        ...(sameReadings && contentIds.length
          ? { readingProgress: { some: { contentId: { in: contentIds } } } }
          : {}),
      },
      include: {
        targetLanguages: true,
                preferences: { select: { showOnlineStatus: true } },
        readingProgress: {
          take: 1,
          orderBy: { lastReadAt: 'desc' },
          include: {
            content: { select: CONTENT_CARD_SELECT },
          },
        },
      },
      take: 30,
      orderBy: { updatedAt: 'desc' },
    });

    return peers.map((p) => ({
      ...this.peerSummary(p),
      reading: cardContent(p.readingProgress[0]?.content),
    }));
  }

  async peerProfile(userId: string, peerUserId: string) {
    await assertPeerVisible(this.prisma as unknown as GatePrisma, userId, peerUserId); // WL4-12
    const peer = await this.prisma.user.findFirst({
      where: { id: peerUserId, deletedAt: null },
      include: {
        targetLanguages: true,
                preferences: { select: { showOnlineStatus: true } },
        adminProfile: { select: { userId: true } },
        readingProgress: {
          take: 1,
          orderBy: { lastReadAt: 'desc' },
          include: {
            content: { select: CONTENT_CARD_SELECT },
          },
        },
      },
    });
    if (!peer || !isLiveMessagingPeer(peer)) throw new NotFoundException('User not found');

    const [booksRead, wordsLearned, chats] = await Promise.all([
      this.prisma.readingProgress.count({
        where: { userId: peerUserId, progressPct: { gte: 99 } },
      }),
      this.prisma.userVocabulary.count({ where: { userId: peerUserId } }),
      this.prisma.conversationParticipant.count({ where: { userId: peerUserId } }),
    ]);

    const myContentIds = (
      await this.prisma.readingProgress.findMany({
        where: { userId },
        select: { contentId: true },
      })
    ).map((p) => p.contentId);

    const sharedVocab =
      myContentIds.length === 0
        ? 0
        : await this.prisma.userVocabulary.count({
            where: {
              userId: peerUserId,
              contentId: { in: myContentIds },
            },
          });

    const showPresence = peer.preferences?.showOnlineStatus === true
      && !(await isBlockedEitherWay(this.safety, userId, peerUserId));
    return {
      ...this.peerSummary(peer, { hidePresence: !showPresence }),
      ...(showPresence ? { createdAt: peer.createdAt } : {}),
      // P3b: lets the client show Block vs Unblock.
      blockedByMe: !!(await this.prisma.userBlock.findUnique({
        where: { blockerId_blockedId: { blockerId: userId, blockedId: peerUserId } },
      })),
      stats: { booksRead, wordsLearned, chats },
      currentlyReading: peer.readingProgress[0]
        ? {
            ...cardContent(peer.readingProgress[0].content)!,
            progressPct: peer.readingProgress[0].progressPct,
          }
        : null,
      sharedReadingsNote:
        sharedVocab > 0
          ? `Shared Readings: You both saved ${sharedVocab} common words.`
          : null,
    };
  }

  private learnerAppUrl(): string {
    return (
      this.config.get<string>('LEARNER_APP_URL')?.trim() ||
      this.config.get<string>('VITE_LEARNER_APP_URL')?.trim() ||
      'https://gotchaa.uz/learn'
    ).replace(/\/$/, '');
  }

  private async notifyRecipientsByEmail(senderId: string, conversationId: string, preview: string) {
    if (!this.mail.isConfigured()) return;

    const recipients = await this.prisma.conversationParticipant.findMany({
      where: { conversationId, userId: { not: senderId } },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            emailVerifiedAt: true,
            lastSeenAt: true,
            deletedAt: true,
            preferences: { select: { notificationsEnabled: true } },
          },
        },
      },
    });

    const sender = await this.prisma.user.findUnique({
      where: { id: senderId },
      select: { displayName: true, email: true },
    });
    const senderName =
      sender?.displayName?.trim() || sender?.email?.split('@')[0] || 'A learner';

    const now = Date.now();
    for (const row of recipients) {
      const user = row.user;
      if (!user || user.deletedAt) continue;
      if (!user.email || !user.emailVerifiedAt) continue;
      if (isSyntheticUserEmail(user.email)) continue;
      if (user.preferences?.notificationsEnabled === false) continue;
      if (user.lastSeenAt && now - user.lastSeenAt.getTime() < ONLINE_WINDOW_MS) continue;
      if (row.lastReadAt && now - row.lastReadAt.getTime() < ONLINE_WINDOW_MS) continue;

      const cooldownKey = `${conversationId}:${user.id}`;
      const lastSent = this.lastMessageEmailAt.get(cooldownKey) ?? 0;
      if (now - lastSent < MESSAGE_EMAIL_COOLDOWN_MS) continue;
      this.lastMessageEmailAt.set(cooldownKey, now);

      const messagesUrl = `${this.learnerAppUrl()}/app/messages?c=${encodeURIComponent(conversationId)}`;
      const recipientName = user.displayName?.trim() || user.email.split('@')[0] || 'there';
      await this.mail.sendNewMessageEmail(
        user.email,
        recipientName,
        senderName,
        preview,
        messagesUrl,
      );
    }
  }
}
