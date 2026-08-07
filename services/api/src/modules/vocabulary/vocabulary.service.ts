import { Injectable, NotFoundException } from '@nestjs/common';
import { WordStatus } from '@prisma/client';
import { isDevAuthEnabled } from '../../common/dev-auth/dev-auth.config';
import { DevAuthService } from '../../common/dev-auth/dev-auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ReadingService } from '../reading/reading.service';
import { SaveVocabularyDto, ReviewVocabularyDto } from './dto/vocabulary.dto';
import { applySrsReview } from '../../utils/srs';

@Injectable()
export class VocabularyService {
  constructor(
    private prisma: PrismaService,
    private reading: ReadingService,
    private devAuth: DevAuthService,
  ) {}

  async list(userId: string, sort = 'recent') {
    if (isDevAuthEnabled() && (this.devAuth.isDevUser(userId) || !this.prisma.dbAvailable)) {
      return [];
    }
    const orderBy =
      sort === 'due'
        ? [{ dueAt: 'asc' as const }]
        : sort === 'alpha'
          ? [{ lemma: 'asc' as const }]
          : [{ createdAt: 'desc' as const }];

    return this.prisma.userVocabulary.findMany({
      where: { userId },
      orderBy,
      include: { content: { select: { id: true, title: true } } },
    });
  }

  async reviewQueue(userId: string, limit = 20) {
    if (isDevAuthEnabled() && (this.devAuth.isDevUser(userId) || !this.prisma.dbAvailable)) {
      return [];
    }

    return this.prisma.userVocabulary.findMany({
      where: {
        userId,
        mastered: false,
        dueAt: { lte: new Date() },
      },
      orderBy: { dueAt: 'asc' },
      take: limit,
    });
  }

  async save(userId: string, dto: SaveVocabularyDto) {
    await this.reading.markLemma(userId, dto.lemma, dto.sourceLang, WordStatus.learning);

    if (isDevAuthEnabled() && (this.devAuth.isDevUser(userId) || !this.prisma.dbAvailable)) {
      return {
        id: `dev-vocab-${dto.lemma.toLowerCase()}`,
        userId,
        lemma: dto.lemma.toLowerCase(),
        sourceLang: dto.sourceLang,
        targetLang: dto.targetLang,
        translation: dto.translation,
        contextSentence: dto.contextSentence ?? null,
        contextSegmentId: dto.contextSegmentId ?? null,
        contentId: dto.contentId ?? null,
        notes: dto.notes ?? null,
        mastered: false,
        dueAt: new Date(),
        intervalDays: 0,
        repetitions: 0,
      };
    }

    const vocab = await this.prisma.userVocabulary.upsert({
      where: {
        userId_lemma_sourceLang_targetLang: {
          userId,
          lemma: dto.lemma.toLowerCase(),
          sourceLang: dto.sourceLang,
          targetLang: dto.targetLang,
        },
      },
      create: {
        userId,
        lemma: dto.lemma.toLowerCase(),
        sourceLang: dto.sourceLang,
        targetLang: dto.targetLang,
        translation: dto.translation,
        contextSentence: dto.contextSentence,
        contextSegmentId: dto.contextSegmentId,
        contentId: dto.contentId,
        notes: dto.notes,
      },
      update: {
        translation: dto.translation,
        contextSentence: dto.contextSentence ?? undefined,
        notes: dto.notes ?? undefined,
      },
    });

    return vocab;
  }

  async review(userId: string, vocabId: string, dto: ReviewVocabularyDto) {
    const vocab = await this.prisma.userVocabulary.findFirst({
      where: { id: vocabId, userId },
    });
    if (!vocab) throw new NotFoundException('Vocabulary entry not found');

    const next = applySrsReview(vocab, dto.rating);

    const [updated] = await this.prisma.$transaction([
      this.prisma.userVocabulary.update({
        where: { id: vocabId },
        data: {
          easeFactor: next.easeFactor,
          intervalDays: next.intervalDays,
          repetitions: next.repetitions,
          dueAt: next.dueAt,
          mastered: next.mastered,
          lastReviewedAt: new Date(),
        },
      }),
      this.prisma.vocabularyReview.create({
        data: {
          vocabId,
          rating: dto.rating,
          intervalBefore: vocab.intervalDays,
          intervalAfter: next.intervalDays,
        },
      }),
    ]);

    return updated;
  }
}
