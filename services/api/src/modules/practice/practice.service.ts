import { normalize } from '@gotcha/shared';
import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PracticeType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LimitsService } from '../../services/limits.service';
import { AiService } from '../ai/ai.service';
import { StartPracticeDto, SubmitPracticeDto } from './dto/practice.dto';
import { catalogAccessGranted, paidCatalogIds, requiresCatalogPayment } from '../content/catalog-access';

@Injectable()
export class PracticeService {
  constructor(
    private prisma: PrismaService,
    private ai: AiService,
    private limits: LimitsService,
  ) {}

  async startSession(userId: string, dto: StartPracticeDto) {
    // BUG-02: chapter sessions never had flashcard questions (0/0 → score null). Word review lives in the
    // daily engine now (GET /practice/daily); `mixed` is engine-only too.
    if (dto.practiceType === PracticeType.flashcard || dto.practiceType === PracticeType.mixed) {
      throw new BadRequestException({ message: 'Use GET /practice/daily for word review', code: 'use_daily_practice' });
    }
    await this.limits.assertQuizAllowed(userId);
    if (!dto.segmentId) {
      throw new BadRequestException('segmentId required for this practice type');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { nativeLanguage: true, uiLanguage: true },
    });

    let segmentText = '';
    let passageLang = user?.nativeLanguage ?? user?.uiLanguage ?? 'uz';
    if (dto.segmentId) {
      const segment = await this.prisma.contentSegment.findUnique({
        where: { id: dto.segmentId },
      });
      if (!segment) throw new NotFoundException('Segment not found');
      const item = await this.prisma.contentItem.findUnique({ where: { id: segment.contentId } });
      if (item && requiresCatalogPayment(item)) {
        const purchasedIds = await paidCatalogIds(this.prisma, userId, [item.id]);
        if (!catalogAccessGranted({ item, userId, purchasedIds })) {
          throw new ForbiddenException('Payment required to read this book');
        }
      }
      segmentText = segment.plainText;
      if (item?.language) passageLang = item.language;
    }

    const native = user?.nativeLanguage?.trim();
    const ui = user?.uiLanguage?.trim();
    const questionLang =
      native && native !== passageLang ? native : ui && ui !== passageLang ? ui : ui ?? native ?? 'uz';

    const questions = await this.ai.generateQuiz(segmentText, dto.practiceType, {
      questionLang,
      passageLang,
    });

    const session = await this.prisma.practiceSession.create({
      data: {
        userId,
        contentId: dto.contentId,
        segmentId: dto.segmentId,
        practiceType: dto.practiceType,
        questionCount: questions.length,
        questions: {
          create: questions.map((q, idx) => ({
            questionIndex: idx,
            prompt: q.prompt,
            options: q.options ?? undefined,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation,
          })),
        },
      },
      include: { questions: { orderBy: { questionIndex: 'asc' } } },
    });

    await this.limits.incrementQuizUsage(userId);

    return redactSession(session);
  }

  async submitAnswers(userId: string, sessionId: string, dto: SubmitPracticeDto) {
    const session = await this.prisma.practiceSession.findFirst({
      where: { id: sessionId, userId },
      include: { questions: true },
    });
    if (!session) throw new NotFoundException('Practice session not found');
    if (session.completedAt) throw new BadRequestException('Session already completed');
    if (session.questionCount === 0) throw new BadRequestException('Session has no questions');

    // BUG-01 / BUG-03: validate before grading anything. Unknown ids reject the whole submission (nothing is
    // completed or revealed); duplicate answers for one question are rejected rather than counted twice.
    const byId = new Map(session.questions.map((q) => [q.id, q]));
    const seen = new Set<string>();
    for (const answer of dto.answers) {
      if (!byId.has(answer.questionId)) throw new BadRequestException(`Unknown questionId: ${answer.questionId}`);
      if (seen.has(answer.questionId)) throw new BadRequestException(`Duplicate answer for questionId: ${answer.questionId}`);
      seen.add(answer.questionId);
    }

    let correctCount = 0;
    const results = [];

    for (const answer of dto.answers) {
      const question = byId.get(answer.questionId)!;

      const isCorrect =
        normalize(answer.userAnswer) === normalize(question.correctAnswer); // case/punctuation/ё=е/Uzbek apostrophes
      if (isCorrect) correctCount++;

      const saved = await this.prisma.practiceAnswer.create({
        data: {
          sessionId,
          questionId: question.id,
          userAnswer: answer.userAnswer,
          isCorrect,
        },
      });
      results.push({ ...saved, correctAnswer: question.correctAnswer, explanation: question.explanation });
    }

    const updated = await this.prisma.practiceSession.update({
      where: { id: sessionId },
      data: { correctCount, completedAt: new Date() },
    });

    // Unanswered questions count as wrong; score is always within [0, 1].
    return { session: updated, results, score: Math.min(1, correctCount / session.questionCount) };
  }

  async getSession(userId: string, sessionId: string) {
    const session = await this.prisma.practiceSession.findFirst({
      where: { id: sessionId, userId },
      include: { questions: { orderBy: { questionIndex: 'asc' } }, answers: true },
    });
    if (!session) throw new NotFoundException('Practice session not found'); // BUG-04: no 200 + empty body
    // Answers are only revealed once the session has been submitted.
    return session.completedAt ? session : redactSession(session);
  }
}

/**
 * Strip answer keys from questions before a session is graded. `correctAnswer` is kept as an
 * empty string (not removed) so already-released Android builds, whose model declares it
 * non-null, still deserialize. Graded results carry the real answer + explanation.
 */
function redactSession<T extends { questions: Array<{ correctAnswer: string; explanation: string | null }> }>(
  session: T,
): T {
  return {
    ...session,
    questions: session.questions.map((q) => ({ ...q, correctAnswer: '', explanation: null })),
  };
}
