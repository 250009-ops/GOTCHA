import { Injectable, NotFoundException } from '@nestjs/common';
import { WordStatus } from '@prisma/client';
import { isDevAuthEnabled } from '../../common/dev-auth/dev-auth.config';
import { buildDevKnownWordStatuses } from '../../common/dev-auth/dev-content.data';
import { PrismaService } from '../../prisma/prisma.service';
import { StreakService } from '../../services/streak.service';
import { recordReadingActivity } from './reading-activity';
import { EndSessionDto, StartSessionDto, UpdateProgressDto } from './dto/reading.dto';

@Injectable()
export class ReadingService {
  /** In-memory lemma statuses when PostgreSQL is offline (dev auth). */
  private readonly memoryKnownWords = new Map<string, Map<string, WordStatus>>();

  constructor(
    private prisma: PrismaService,
    private streak: StreakService,
  ) {}

  private useMemory() {
    return isDevAuthEnabled() && !this.prisma.dbAvailable;
  }

  private ensureMemoryWords(userId: string) {
    let map = this.memoryKnownWords.get(userId);
    if (!map) {
      map = new Map();
      for (const row of buildDevKnownWordStatuses()) {
        map.set(row.lemma, row.status as WordStatus);
      }
      this.memoryKnownWords.set(userId, map);
    }
    return map;
  }

  startSession(userId: string, dto: StartSessionDto) {
    if (this.useMemory()) {
      return {
        id: `dev-session-${Date.now()}`,
        userId,
        contentId: dto.contentId,
        segmentId: dto.segmentId ?? null,
        startedAt: new Date(),
        endedAt: null,
        durationSeconds: 0,
        wordsTapped: 0,
        wordsSaved: 0,
      };
    }
    return this.prisma.readingSession.create({
      data: {
        userId,
        contentId: dto.contentId,
        segmentId: dto.segmentId,
      },
    });
  }

  async endSession(userId: string, sessionId: string, dto: EndSessionDto) {
    if (this.useMemory()) {
      return {
        id: sessionId,
        userId,
        endedAt: new Date(),
        durationSeconds: dto.durationSeconds ?? 0,
        wordsTapped: dto.wordsTapped ?? 0,
        wordsSaved: dto.wordsSaved ?? 0,
      };
    }

    const session = await this.prisma.readingSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) throw new NotFoundException('Reading session not found');

    const updated = await this.prisma.readingSession.update({
      where: { id: sessionId },
      data: {
        endedAt: new Date(),
        durationSeconds: dto.durationSeconds,
        wordsTapped: dto.wordsTapped ?? session.wordsTapped,
        wordsSaved: dto.wordsSaved ?? session.wordsSaved,
      },
    });

    if (dto.durationSeconds && dto.durationSeconds > 0) {
      await this.streak.recordActivity(userId, dto.durationSeconds ?? 0);
    }

    return updated;
  }

  getKnownWords(userId: string) {
    if (this.useMemory()) {
      const map = this.ensureMemoryWords(userId);
      return Array.from(map.entries()).map(([lemma, status]) => ({
        lemma,
        sourceLang: 'en',
        status,
      }));
    }
    return this.prisma.userKnownWord.findMany({
      where: { userId },
      select: { lemma: true, sourceLang: true, status: true },
    });
  }

  async markLemma(
    userId: string,
    lemma: string,
    sourceLang: string,
    status: WordStatus = WordStatus.learning,
  ) {
    const normalized = lemma.toLowerCase();
    if (this.useMemory()) {
      const map = this.ensureMemoryWords(userId);
      map.set(normalized, status);
      return { userId, lemma: normalized, sourceLang, status };
    }

    return this.prisma.userKnownWord.upsert({
      where: {
        userId_lemma_sourceLang: {
          userId,
          lemma: normalized,
          sourceLang: sourceLang as never,
        },
      },
      create: {
        userId,
        lemma: normalized,
        sourceLang: sourceLang as never,
        status,
      },
      update: { status },
    });
  }

  async updateProgress(userId: string, contentId: string, dto: UpdateProgressDto) {
    if (this.useMemory()) {
      return {
        userId,
        contentId,
        segmentId: dto.segmentId,
        charOffset: dto.charOffset ?? 0,
        progressPct: dto.progressPct ?? 0,
        lastReadAt: new Date(),
        totalReadSeconds: dto.readSeconds ?? 0,
        completedAt: dto.completed ? new Date() : null,
      };
    }

    const existing = await this.prisma.readingProgress.findUnique({
      where: { userId_contentId: { userId, contentId } },
    });

    const knownCount = await this.prisma.userKnownWord.count({
      where: { userId, status: { in: [WordStatus.known, WordStatus.learning] } },
    });
    const content = await this.prisma.contentItem.findUnique({ where: { id: contentId } });
    const knownWordRatio = content?.uniqueWordCount
      ? Math.min(1, knownCount / content.uniqueWordCount)
      : undefined;

    const data = {
      segmentId: dto.segmentId,
      charOffset: dto.charOffset,
      progressPct: dto.progressPct,
      knownWordRatio,
      lastReadAt: new Date(),
      totalReadSeconds: existing
        ? existing.totalReadSeconds + (dto.readSeconds ?? 0)
        : (dto.readSeconds ?? 0),
      completedAt: dto.completed ? new Date() : undefined,
    };

    if (dto.readSeconds && dto.readSeconds > 0) {
      await this.streak.recordActivity(userId, dto.readSeconds ?? 0);
      await recordReadingActivity(
        this.prisma,
        userId,
        contentId,
        dto.segmentId,
        dto.readSeconds,
      );
    }

    return this.prisma.readingProgress.upsert({
      where: { userId_contentId: { userId, contentId } },
      create: { userId, contentId, ...data, progressPct: dto.progressPct ?? 0 },
      update: data,
    });
  }
}
