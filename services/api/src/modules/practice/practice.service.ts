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
    if (dto.source === 'page_bank') return this.mashq.start(userId, dto);
    if (!dto.segmentId && dto.practiceType !== PracticeType.flashcard) {
      throw new BadRequestException('segmentId required for this practice type');
    }
    // Flashcards never count as a quiz (wlive behaviour).
    if (dto.practiceType === PracticeType.flashcard) return this.createQuizSession(userId, dto);
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
    const session = await this.prisma.practiceSession.findFirst({
      where: { id: sessionId, userId },
      include: { questions: true },
    });
    if (!session) throw new NotFoundException('Practice session not found');
    if (session.completedAt) throw new BadRequestException('Session already completed');

    let correctCount = 0;
    const results = [];

    for (const answer of dto.answers) {
      const question = session.questions.find((q) => q.id === answer.questionId);
      if (!question) continue;

      const isCorrect =
        session.practiceType === PracticeType.cloze
          ? gradeAnswer(answer.userAnswer, question.correctAnswer).correct
          : answer.userAnswer.trim().toLowerCase() === question.correctAnswer.trim().toLowerCase();
      if (isCorrect) correctCount++;

      const saved = await this.prisma.practiceAnswer.create({
        data: {
          sessionId,
          questionId: question.id,
          userAnswer: answer.userAnswer,
          isCorrect,
        },
      });
      // Revealed only now, after the server has graded the answer (W-24).
      results.push({ ...saved, correctAnswer: question.correctAnswer, explanation: question.explanation });
      if (question.pageQuestionId) {
        await this.prisma.pageQuestionSeen.updateMany({
          where: { userId, questionId: question.pageQuestionId },
          data: { correct: isCorrect },
        });
        if (isCorrect) {
          await this.prisma.pageQuestion.update({
            where: { id: question.pageQuestionId },
            data: { timesCorrect: { increment: 1 } },
          });
        }
      }
    }

    const updated = await this.prisma.practiceSession.update({
      where: { id: sessionId },
      data: { correctCount, completedAt: new Date() },
    });

    return {
      session: updated,
      results,
      score: session.questionCount > 0 ? correctCount / session.questionCount : 0,
    };
  }

  bankStatus(userId: string, segmentId: string) {
    return this.mashq.bankStatus(userId, segmentId);
  }

  async getSession(userId: string, sessionId: string) {
    const session = await this.prisma.practiceSession.findFirst({
      where: { id: sessionId, userId },
      include: { questions: true, answers: true },
    });
    return session ? redactSession(session) : session;
  }
}
