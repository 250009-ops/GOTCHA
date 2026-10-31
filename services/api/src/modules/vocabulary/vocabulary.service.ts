import { Injectable, NotFoundException } from '@nestjs/common';
import { AppLanguage, WordStatus } from '@prisma/client';
import { isDevAuthEnabled } from '../../common/dev-auth/dev-auth.config';
import { DevAuthService } from '../../common/dev-auth/dev-auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ReadingService } from '../reading/reading.service';
import { SaveVocabularyDto, ReviewVocabularyDto, UpdateVocabularyDto } from './dto/vocabulary.dto';
import { applySrsReview } from '../../utils/srs';
import type { SrsRating } from '@gotcha/shared';

type MemoryVocab = {
  id: string;
  userId: string;
  lemma: string;
  sourceLang: AppLanguage;
  targetLang: AppLanguage;
  translation: string;
  contextSentence: string | null;
  contextSegmentId: string | null;
  contentId: string | null;
  notes: string | null;
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  dueAt: Date;
  lastReviewedAt: Date | null;
  mastered: boolean;
  createdAt: Date;
  content?: { id: string; title: string } | null;
};

@Injectable()
export class VocabularyService {
  /** Per-user vocab when DB is offline or the caller is a pure in-memory dev user. */
  private readonly memoryByUser = new Map<string, Map<string, MemoryVocab>>();

  constructor(
    private prisma: PrismaService,
    private reading: ReadingService,
    private devAuth: DevAuthService,
  ) {}

  private useMemory(userId: string) {
    return isDevAuthEnabled() && (this.devAuth.isDevUser(userId) || !this.prisma.dbAvailable);
  }

  private memoryStore(userId: string) {
    let map = this.memoryByUser.get(userId);
    if (!map) {
      map = new Map();
      this.memoryByUser.set(userId, map);
    }
    return map;
  }

  private memoryKey(lemma: string, sourceLang: string, targetLang: string) {
    return `${lemma.toLowerCase()}|${sourceLang}|${targetLang}`;
  }

  async list(userId: string, sort = 'recent') {
    if (this.useMemory(userId)) {
      const items = Array.from(this.memoryStore(userId).values());
      if (sort === 'due') {
        items.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
      } else if (sort === 'alpha') {
        items.sort((a, b) => a.lemma.localeCompare(b.lemma));
      } else {
        items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      }
      return items;
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
    if (this.useMemory(userId)) {
      const now = Date.now();
      return Array.from(this.memoryStore(userId).values())
        .filter((v) => !v.mastered && v.dueAt.getTime() <= now)
        .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())
        .slice(0, limit);
    }

    return this.prisma.userVocabulary.findMany({
      where: {
        userId,
        mastered: false,
        dueAt: { lte: new Date() },
      },
      orderBy: { dueAt: 'asc' },
      take: limit,
      include: { content: { select: { id: true, title: true } } },
    });
  }

  async save(userId: string, dto: SaveVocabularyDto) {
    const lemma = dto.lemma.toLowerCase().trim();
    await this.reading.markLemma(userId, lemma, dto.sourceLang, WordStatus.learning);

    if (this.useMemory(userId)) {
      const store = this.memoryStore(userId);
      const key = this.memoryKey(lemma, dto.sourceLang, dto.targetLang);
      const existing = store.get(key);
      const now = new Date();
      const vocab: MemoryVocab = existing
        ? {
            ...existing,
            translation: dto.translation,
            contextSentence: dto.contextSentence ?? existing.contextSentence,
            contextSegmentId: dto.contextSegmentId ?? existing.contextSegmentId,
            contentId: dto.contentId ?? existing.contentId,
            notes: dto.notes ?? existing.notes,
          }
        : {
            id: `dev-vocab-${key}`,
            userId,
            lemma,
            sourceLang: dto.sourceLang,
            targetLang: dto.targetLang,
            translation: dto.translation,
            contextSentence: dto.contextSentence ?? null,
            contextSegmentId: dto.contextSegmentId ?? null,
            contentId: dto.contentId ?? null,
            notes: dto.notes ?? null,
            easeFactor: 2.5,
            intervalDays: 0,
            repetitions: 0,
            dueAt: now,
            lastReviewedAt: null,
            mastered: false,
            createdAt: now,
            content: null,
          };
      store.set(key, vocab);
      return vocab;
    }

    const vocab = await this.prisma.userVocabulary.upsert({
      where: {
        userId_lemma_sourceLang_targetLang: {
          userId,
          lemma,
          sourceLang: dto.sourceLang,
          targetLang: dto.targetLang,
        },
      },
      create: {
        userId,
        lemma,
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

  async update(userId: string, vocabId: string, dto: UpdateVocabularyDto) {
    if (this.useMemory(userId)) {
      const store = this.memoryStore(userId);
      const entry = Array.from(store.values()).find((v) => v.id === vocabId);
      if (!entry) throw new NotFoundException('Vocabulary entry not found');
      if (dto.mastered !== undefined) {
        entry.mastered = dto.mastered;
        if (dto.mastered) {
          entry.dueAt = new Date(Date.now() + 30 * 86400000);
          entry.intervalDays = Math.max(entry.intervalDays, 21);
          entry.repetitions = Math.max(entry.repetitions, 5);
        }
      }
      if (dto.notes !== undefined) entry.notes = dto.notes;
      store.set(this.memoryKey(entry.lemma, entry.sourceLang, entry.targetLang), entry);
      await this.reading.markLemma(
        userId,
        entry.lemma,
        entry.sourceLang,
        entry.mastered ? WordStatus.known : WordStatus.learning,
      );
      return entry;
    }

    const vocab = await this.prisma.userVocabulary.findFirst({
      where: { id: vocabId, userId },
    });
    if (!vocab) throw new NotFoundException('Vocabulary entry not found');

    const updated = await this.prisma.userVocabulary.update({
      where: { id: vocabId },
      data: {
        mastered: dto.mastered,
        notes: dto.notes,
        ...(dto.mastered === true
          ? {
              intervalDays: Math.max(vocab.intervalDays, 21),
              repetitions: Math.max(vocab.repetitions, 5),
              dueAt: new Date(Date.now() + 30 * 86400000),
            }
          : {}),
      },
    });

    if (dto.mastered !== undefined) {
      await this.reading.markLemma(
        userId,
        updated.lemma,
        updated.sourceLang,
        dto.mastered ? WordStatus.known : WordStatus.learning,
      );
    }

    return updated;
  }

  async remove(userId: string, vocabId: string) {
    if (this.useMemory(userId)) {
      const store = this.memoryStore(userId);
      const entry = Array.from(store.values()).find((v) => v.id === vocabId);
      if (!entry) throw new NotFoundException('Vocabulary entry not found');
      store.delete(this.memoryKey(entry.lemma, entry.sourceLang, entry.targetLang));
      await this.reading.markLemma(userId, entry.lemma, entry.sourceLang, WordStatus.ignored);
      return { ok: true };
    }

    const vocab = await this.prisma.userVocabulary.findFirst({
      where: { id: vocabId, userId },
    });
    if (!vocab) throw new NotFoundException('Vocabulary entry not found');

    await this.prisma.userVocabulary.delete({ where: { id: vocabId } });
    await this.reading.markLemma(userId, vocab.lemma, vocab.sourceLang, WordStatus.ignored);
    return { ok: true };
  }

  async review(userId: string, vocabId: string, dto: ReviewVocabularyDto) {
    if (this.useMemory(userId)) {
      const store = this.memoryStore(userId);
      const entry = Array.from(store.values()).find((v) => v.id === vocabId);
      if (!entry) throw new NotFoundException('Vocabulary entry not found');

      const next = applySrsReview(entry, dto.rating as SrsRating);
      const updated: MemoryVocab = {
        ...entry,
        easeFactor: next.easeFactor,
        intervalDays: next.intervalDays,
        repetitions: next.repetitions,
        dueAt: next.dueAt,
        mastered: next.mastered,
        lastReviewedAt: new Date(),
      };
      store.set(this.memoryKey(entry.lemma, entry.sourceLang, entry.targetLang), updated);
      if (updated.mastered) {
        await this.reading.markLemma(userId, updated.lemma, updated.sourceLang, WordStatus.known);
      }
      return updated;
    }

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

    if (updated.mastered) {
      await this.reading.markLemma(userId, updated.lemma, updated.sourceLang, WordStatus.known);
    }

    return updated;
  }
}
