import { canReadUserImport } from '../content/user-import-privacy';
import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PracticeType } from '@prisma/client';
import { gradeAnswer } from '@gotcha/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { LimitsService } from '../../services/limits.service';
import { AiService } from '../ai/ai.service';
import { StartPracticeDto, SubmitPracticeDto } from './dto/practice.dto';
import { MashqService, quizEmptyException } from './mashq.service';
import { catalogAccessGranted, paidCatalogIds, requiresCatalogPayment } from '../content/catalog-access';
import { shuffleQuestionOptions } from './shuffle-options';
import { redactSession } from './practice-redact';

@Injectable()
export class PracticeService {
  constructor(
    private prisma: PrismaService,
    private ai: AiService,
    private limits: LimitsService,
    private mashq: MashqService,
  ) {}

  async startSession(userId: string, dto: StartPracticeDto) {
    if (dto.practiceType === PracticeType.flashcard || dto.practiceType === PracticeType.mixed) {
      throw new BadRequestException({ message: 'Use the daily practice.', code: 'use_daily_practice' });
    }
    if (dto.source === 'page_bank') return this.mashq.start(userId, dto);
    if (!dto.segmentId) {
      throw new BadRequestException('segmentId required for this practice type');
    }
    // PAY2-04: claim the quiz slot atomically up front; give it back if no quiz is delivered.
    await this.limits.reserveQuizSlot(userId);
    try {
      return await this.createQuizSession(userId, dto);
    } catch (e) {
      await this.limits.releaseQuizSlot(userId);
      throw e;
    }
  }

  private async createQuizSession(userId: string, dto: StartPracticeDto) {

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
      if (!item || !canReadUserImport(item, userId)) throw new NotFoundException('Segment not found');
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

    const questions =
      dto.practiceType === PracticeType.flashcard
        ? []
        : shuffleQuestionOptions(await this.ai.generateQuiz(segmentText, dto.practiceType, {
            questionLang,
            passageLang,
            userId,
          }));
    if (dto.practiceType !== PracticeType.flashcard && questions.length === 0) {
      throw quizEmptyException();
    }

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

    return redactSession(session);
  }
  async submitAnswers(userId: string, sessionId: string, dto: SubmitPracticeDto) {
    const ids = dto.answers.map((a) => a.questionId);
    if (new Set(ids).size !== ids.length) throw new BadRequestException('Duplicate answer');

    return this.prisma.$transaction(async (tx) => {
      const session = await tx.practiceSession.findFirst({
        where: { id: sessionId, userId },
        include: { questions: true },
      });
      if (!session) throw new NotFoundException('Practice session not found');
      for (const answer of dto.answers) {
        if (!session.questions.some((q) => q.id === answer.questionId)) throw new BadRequestException('Unknown questionId');
      }
      let correctCount = 0;
      const graded = dto.answers.map((answer) => {
        const question = session.questions.find((q) => q.id === answer.questionId)!;
        const loose = session.practiceType == null || session.practiceType === PracticeType.cloze || session.practiceType === PracticeType.comprehension;
        const isCorrect = loose
          ? gradeAnswer(answer.userAnswer, question.correctAnswer).verdict === 'correct'
          : answer.userAnswer.trim().toLowerCase() === question.correctAnswer.trim().toLowerCase();
        if (isCorrect) correctCount++;
        return { question, answer, isCorrect };
      });
      const claimed = await tx.practiceSession.updateMany({
        where: { id: sessionId, userId, completedAt: null },
        data: { completedAt: new Date(), correctCount },
      });
      if (claimed.count !== 1) throw new BadRequestException('Session already completed');
      const results = [];
      for (const row of graded) {
        const saved = await tx.practiceAnswer.create({
          data: { sessionId, questionId: row.question.id, userAnswer: row.answer.userAnswer, isCorrect: row.isCorrect },
        });
        results.push({ ...saved, correctAnswer: row.question.correctAnswer, explanation: row.question.explanation });
        if (row.question.pageQuestionId && tx.pageQuestionSeen?.updateMany) {
          await tx.pageQuestionSeen.updateMany({
            where: { userId, questionId: row.question.pageQuestionId },
            data: { correct: row.isCorrect },
          });
          if (row.isCorrect && tx.pageQuestion?.update) {
            await tx.pageQuestion.update({ where: { id: row.question.pageQuestionId }, data: { timesCorrect: { increment: 1 } } });
          }
        }
      }
      const updated = await tx.practiceSession.findUniqueOrThrow({ where: { id: sessionId } });
      return {
        session: updated,
        results,
        score: session.questionCount > 0 ? correctCount / session.questionCount : 0,
      };
    });
  }

  bankStatus(userId: string, segmentId: string) {
    return this.mashq.bankStatus(userId, segmentId);
  }

  async getSession(userId: string, sessionId: string) {
    const session = await this.prisma.practiceSession.findFirst({
      where: { id: sessionId, userId },
      include: { questions: true, answers: true },
    });
    if (!session) throw new NotFoundException('Practice session not found');
    return redactSession(session);
  }
}
