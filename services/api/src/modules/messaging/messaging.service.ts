import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppLanguage } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SendMessageDto, StartConversationDto } from './dto/messaging.dto';

type PeerUser = {
  id: string;
  displayName: string | null;
  email: string;
  avatarUrl: string | null;
  nativeLanguage: AppLanguage;
  targetLanguages: Array<{ targetLanguage: AppLanguage; isPrimary: boolean; cefrLevel: string }>;
};

@Injectable()
export class MessagingService {
  constructor(private prisma: PrismaService) {}

  private pairKey(a: string, b: string) {
    return [a, b].sort().join(':');
  }

  private peerSummary(user: PeerUser) {
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
      targetLanguages: user.targetLanguages.map((t) => ({
        language: t.targetLanguage,
        cefrLevel: t.cefrLevel,
        isPrimary: t.isPrimary,
      })),
    };
  }

  private async assertParticipant(conversationId: string, userId: string) {
    const row = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!row) throw new ForbiddenException('Not a participant');
    return row;
  }

  async listConversations(userId: string, q?: string) {
    const rows = await this.prisma.conversation.findMany({
      where: {
        participants: { some: { userId } },
      },
      include: {
        participants: {
          include: {
            user: {
              include: {
                targetLanguages: true,
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
    const withUnread = await Promise.all(
      rows.map(async (c) => {
        const peerPart = c.participants.find((p) => p.userId !== userId);
        const me = c.participants.find((p) => p.userId === userId);
        const peer = peerPart ? this.peerSummary(peerPart.user) : null;
        const last = c.messages[0] ?? null;
        const unreadCount = await this.prisma.message.count({
          where: {
            conversationId: c.id,
            senderId: { not: userId },
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
                body: last.body,
                translation: last.translation,
                senderId: last.senderId,
                createdAt: last.createdAt,
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
          include: {
            sender: { select: { id: true, displayName: true, avatarUrl: true } },
          },
        },
      },
    });
    if (!c) throw new NotFoundException('Conversation not found');

    const peerPart = c.participants.find((p) => p.userId !== userId);
    return {
      id: c.id,
      language: c.language,
      content: c.content,
      peer: peerPart ? this.peerSummary(peerPart.user) : null,
      messages: c.messages.map((m) => ({
        id: m.id,
        body: m.body,
        translation: m.translation,
        bodyLang: m.bodyLang,
        senderId: m.senderId,
        sender: m.sender,
        mine: m.senderId === userId,
        createdAt: m.createdAt,
      })),
      lastMessageAt: c.lastMessageAt,
    };
  }

  async startConversation(userId: string, dto: StartConversationDto) {
    if (dto.peerUserId === userId) {
      throw new BadRequestException('Cannot message yourself');
    }
    const peer = await this.prisma.user.findFirst({
      where: { id: dto.peerUserId, deletedAt: null },
      include: { targetLanguages: true },
    });
    if (!peer) throw new NotFoundException('User not found');

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
    const body = dto.body.trim();
    if (!body) throw new BadRequestException('Message body required');

    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId: userId,
        body,
        translation: dto.translation?.trim() || null,
        bodyLang: dto.bodyLang,
      },
      include: {
        sender: { select: { id: true, displayName: true, avatarUrl: true } },
      },
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

    return {
      id: message.id,
      body: message.body,
      translation: message.translation,
      bodyLang: message.bodyLang,
      senderId: message.senderId,
      sender: message.sender,
      mine: true,
      createdAt: message.createdAt,
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
          id: { not: userId },
          deletedAt: null,
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
        id: { not: userId },
        deletedAt: null,
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

    const peers = await this.prisma.user.findMany({
      where: {
        id: { not: userId },
        deletedAt: null,
        ...(query
          ? {
              OR: [
                { displayName: { contains: query, mode: 'insensitive' } },
                { email: { contains: query, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(lang
          ? {
              OR: [
                { nativeLanguage: lang as AppLanguage },
                { targetLanguages: { some: { targetLanguage: lang as AppLanguage } } },
              ],
            }
          : {}),
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
    const peer = await this.prisma.user.findFirst({
      where: { id: peerUserId, deletedAt: null },
      include: {
        targetLanguages: true,
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
    if (!peer) throw new NotFoundException('User not found');

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
}
