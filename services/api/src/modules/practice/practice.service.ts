import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PracticeType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LimitsService } from '../../services/limits.service';
import { AiService } from '../ai/ai.service';
import { StartPracticeDto, SubmitPracticeDto } from './dto/practice.dto';

@Injectable()
export class PracticeService {
  constructor(
    private prisma: PrismaService,
    private ai: AiService,
    private limits: LimitsService,
  ) {}

  async startSession(userId: string, dto: StartPracticeDto) {
    if (dto.practiceType !== PracticeType.flashcard) {
      await this.limits.assertQuizAllowed(userId);
    }
    if (!dto.segmentId && dto.practiceType !== PracticeType.flashcard) {
      throw new BadRequestException('segmentId required for this practice type');
    }

    let segmentText = '';
    if (dto.segmentId) {
      const segment = await this.prisma.contentSegment.findUnique({
        where: { id: dto.segmentId },
      });
      if (!segment) throw new NotFoundException('Segment not found');
      segmentText = segment.plainText;
    }

    const questions =
      dto.practiceType === PracticeType.flashcard
        ? []
        : await this.ai.generateQuiz(segmentText, dto.practiceType);

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

    if (dto.practiceType !== PracticeType.flashcard) {
      await this.limits.incrementQuizUsage(userId);
    }

    return session;
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
        answer.userAnswer.trim().toLowerCase() === question.correctAnswer.trim().toLowerCase();
      if (isCorrect) correctCount++;

      const saved = await this.prisma.practiceAnswer.create({
        data: {
          sessionId,
          questionId: question.id,
          userAnswer: answer.userAnswer,
          isCorrect,
        },
      });
      results.push({ ...saved, explanation: question.explanation });
    }

    const updated = await this.prisma.practiceSession.update({
      where: { id: sessionId },
      data: { correctCount, completedAt: new Date() },
    });

    return { session: updated, results, score: correctCount / session.questionCount };
  }

  getSession(userId: string, sessionId: string) {
    return this.prisma.practiceSession.findFirst({
      where: { id: sessionId, userId },
      include: { questions: true, answers: true },
    });
  }
}
