import { DELETED_USER_NAME, assertNotDeletedUser, isDeletedAccount } from '../../common/deleted-user';
import { notifyNewReport } from '../../common/safety/report-notify';
import {
  BadRequestException,
  ForbiddenException,
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
import {
  assertNotBlocked,
  blockedPeerIds,
  blockUser,
  reportUser,
  SafetyPrisma,
  unblockUser,
} from './messaging-safety';

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
  email: string;
  avatarUrl: string | null;
  nativeLanguage: AppLanguage;
  lastSeenAt?: Date | null;
  targetLanguages: Array<{ targetLanguage: AppLanguage; isPrimary: boolean; cefrLevel: string }>;
  adminProfile?: { userId: string } | null;
};

function isLiveMessagingPeer(user: {
  email: string;
  displayName: string | null;
  adminProfile?: { userId: string } | null;
}) {
  if (user.adminProfile) return false;
  if (isSyntheticUserEmail(user.email)) return false;
  if (isFigmaSampleDisplayName(user.displayName)) return false;
  return true;
}

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);
  private typingUntil = new Map<string, number>();
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

  private typingKey(conversationId: string, userId: string) {
    return `${conversationId}:${userId}`;
  }

  private isTyping(conversationId: string, userId: string) {
    return (this.typingUntil.get(this.typingKey(conversationId, userId)) ?? 0) > Date.now();
  }

  private messageStatus(mine: boolean, createdAt: Date, peerLastReadAt?: Date | null) {
    if (!mine) return null;
    if (peerLastReadAt && peerLastReadAt.getTime() >= createdAt.getTime()) return 'read';
    return 'sent';
  }

  private pairKey(a: string, b: string) {
    return [a, b].sort().join(':');
  }

  private peerSummary(user: PeerUser) {
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
    const primary =
      user.targetLanguages.find((t) => t.isPrimary)?.targetLanguage ??
      user.targetLanguages[0]?.targetLanguage ??
      user.nativeLanguage;
    const handle =
      '@' +
      (user.displayName ?? user.email.split('@')[0] ?? 'learner')
        .toLowerCase()
        .replace(/[^a-z0-9_]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 24);
    return {
      id: user.id,
      displayName: user.displayName ?? user.email.split('@')[0] ?? 'Learner',
      handle,
      avatarUrl: user.avatarUrl,
      nativeLanguage: user.nativeLanguage,
      primaryLanguage: primary,
      ...this.presenceOf(user.lastSeenAt),
      targetLanguages: user.targetLanguages.map((t) => ({
        language: t.targetLanguage,
        cefrLevel: t.cefrLevel,
        isPrimary: t.isPrimary,
      })),
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
      sender?: { id: string; displayName: string | null; avatarUrl: string | null; email?: string } | null;
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
        ? { id: m.sender.id, displayName: m.sender.displayName, avatarUrl: m.sender.avatarUrl, deleted: isDeletedAccount(m.sender) }
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
      avatarUrl: r.blocked.avatarUrl,
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
    const r = await reportUser(this.safety, userId, dto);
    notifyNewReport(this.mail, { id: r.id, kind: 'user', reason: dto.reason });
    return r;
  }

  async listConversations(userId: string, q?: string) {
    const hidden = await blockedPeerIds(this.safety, userId);
    const rows = await this.prisma.conversation.findMany({
      where: {
        participants: { some: { userId } },
        ...(hidden.length ? { NOT: { participants: { some: { userId: { in: hidden } } } } } : {}),
      },
      include: {
        participants: {
          include: {
            user: {
              include: {
                targetLanguages: true,
                adminProfile: { select: { userId: true } },
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        content: { select: { id: true, title: true, coverImageKey: true, language: true } },
      },
      orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
    });

    const query = q?.trim().toLowerCase();
    const liveRows = rows.filter((c) => {
      const peer = c.participants.find((p) => p.userId !== userId)?.user;
      return !peer || isLiveMessagingPeer(peer);
    });
    const withUnread = await Promise.all(
      liveRows.map(async (c) => {
        const peerPart = c.participants.find((p) => p.userId !== userId);
        const me = c.participants.find((p) => p.userId === userId);
        const peer = peerPart ? this.peerSummary(peerPart.user) : null;
        const last = c.messages[0] ?? null;
        const peerLastReadAt = peerPart?.lastReadAt ?? null;
        const unreadCount = await this.prisma.message.count({
          where: {
            conversationId: c.id,
            OR: [{ senderId: { not: userId } }, { senderId: null }], // final-5: messages from hard-deleted users still count as unread
            ...(me?.lastReadAt ? { createdAt: { gt: me.lastReadAt } } : {}),
          },
        });
        return {
          id: c.id,
          language: c.language,
          content: c.content,
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
      }),
    );

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

  async getConversation(userId: string, conversationId: string) {
    await this.assertParticipant(conversationId, userId);
    const c = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: {
          include: { user: { include: { targetLanguages: true } } },
        },
        content: { select: { id: true, title: true, coverImageKey: true, language: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 200,
          include: messageInclude,
        },
      },
    });
    if (!c) throw new NotFoundException('Conversation not found');

    const peerPart = c.participants.find((p) => p.userId !== userId);
    const peerLastReadAt = peerPart?.lastReadAt ?? null;
    return {
      id: c.id,
      language: c.language,
      content: c.content,
      peer: peerPart
        ? {
            ...this.peerSummary(peerPart.user),
            typing: this.isTyping(conversationId, peerPart.userId),
          }
        : null,
      peerLastReadAt,
      messages: c.messages.map((m) => this.presentMessage(m, userId, peerLastReadAt)),
      lastMessageAt: c.lastMessageAt,
    };
  }

  async startConversation(userId: string, dto: StartConversationDto) {
    if (dto.peerUserId === userId) {
      throw new BadRequestException('Cannot message yourself');
    }
    await assertNotDeletedUser(this.prisma as never, dto.peerUserId);
    const peer = await this.prisma.user.findFirst({
      where: { id: dto.peerUserId, deletedAt: null },
      include: { targetLanguages: true, adminProfile: { select: { userId: true } } },
    });
    if (!peer || !isLiveMessagingPeer(peer)) throw new NotFoundException('User not found');
    await assertNotBlocked(this.safety, userId, dto.peerUserId);
    await assertCanMessage(this.prisma as never, userId, dto.peerUserId);

    const key = this.pairKey(userId, dto.peerUserId);
    let conversation = await this.prisma.conversation.findUnique({
      where: { pairKey: key },
    });

    if (!conversation) {
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
    const body = dto.body.trim();
    if (!body) throw new BadRequestException('Message body required');

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
        translation: dto.translation?.trim() || null,
        bodyLang: dto.bodyLang,
        replyToId,
      },
      include: messageInclude,
    });

    await this.prisma.$transaction([
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: message.createdAt },
      }),
      this.prisma.conversationParticipant.update({
        where: { conversationId_userId: { conversationId, userId } },
        data: { lastReadAt: message.createdAt },
      }),
    ]);

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

    const message = await this.prisma.message.update({
      where: { id: messageId },
      data: {
        body,
        translation: dto.translation?.trim() || null,
        bodyLang: dto.bodyLang ?? existing.bodyLang,
        editedAt: new Date(),
      },
      include: messageInclude,
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
    const key = this.typingKey(conversationId, userId);
    if (typing) this.typingUntil.set(key, Date.now() + TYPING_WINDOW_MS);
    else this.typingUntil.delete(key);
    return { ok: true };
  }

  async conversationStatus(userId: string, conversationId: string) {
    await this.assertParticipant(conversationId, userId);
    const parts = await this.prisma.conversationParticipant.findMany({
      where: { conversationId },
      include: { user: { select: { id: true, lastSeenAt: true } } },
    });
    const peer = parts.find((p) => p.userId !== userId);
    return {
      peerLastReadAt: peer?.lastReadAt ?? null,
      peer: peer
        ? {
            id: peer.userId,
            ...this.presenceOf(peer.user.lastSeenAt),
            typing: this.isTyping(conversationId, peer.userId),
          }
        : null,
    };
  }

  async markRead(userId: string, conversationId: string) {
    await this.assertParticipant(conversationId, userId);
    await this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: new Date() },
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
          readingProgress: {
            take: 1,
            orderBy: { lastReadAt: 'desc' },
            include: {
              content: { select: { id: true, title: true, coverImageKey: true, language: true } },
            },
          },
        },
        take: 8,
      });
      return peers.map((p) => ({
        ...this.peerSummary(p),
        reading: p.readingProgress[0]?.content ?? null,
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
        readingProgress: {
          where: { contentId: { in: contentIds } },
          take: 1,
          orderBy: { lastReadAt: 'desc' },
          include: {
            content: { select: { id: true, title: true, coverImageKey: true, language: true } },
          },
        },
      },
      take: 12,
    });

    return peers.map((p) => ({
      ...this.peerSummary(p),
      reading: p.readingProgress[0]?.content ?? null,
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
          { displayName: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
        ],
      });
    }
    if (lang) {
      searchAnd.push({
        OR: [
          { nativeLanguage: lang as AppLanguage },
          { targetLanguages: { some: { targetLanguage: lang as AppLanguage } } },
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
        readingProgress: {
          take: 1,
          orderBy: { lastReadAt: 'desc' },
          include: {
            content: { select: { id: true, title: true, coverImageKey: true, language: true } },
          },
        },
      },
      take: 30,
      orderBy: { updatedAt: 'desc' },
    });

    return peers.map((p) => ({
      ...this.peerSummary(p),
      reading: p.readingProgress[0]?.content ?? null,
    }));
  }

  async peerProfile(userId: string, peerUserId: string) {
    await assertPeerVisible(this.prisma as unknown as GatePrisma, userId, peerUserId); // WL4-12
    const peer = await this.prisma.user.findFirst({
      where: { id: peerUserId, deletedAt: null },
      include: {
        targetLanguages: true,
        adminProfile: { select: { userId: true } },
        preferences: true,
        readingProgress: {
          take: 1,
          orderBy: { lastReadAt: 'desc' },
          include: {
            content: { select: { id: true, title: true, coverImageKey: true, language: true } },
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

    return {
      ...this.peerSummary(peer),
      createdAt: peer.createdAt,
      // P3b: lets the client show Block vs Unblock.
      blockedByMe: !!(await this.prisma.userBlock.findUnique({
        where: { blockerId_blockedId: { blockerId: userId, blockedId: peerUserId } },
      })),
      stats: { booksRead, wordsLearned, chats },
      currentlyReading: peer.readingProgress[0]
        ? {
            ...peer.readingProgress[0].content!,
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
      if (!user.emailVerifiedAt) continue;
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
