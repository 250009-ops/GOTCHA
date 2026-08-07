import { Injectable, NotFoundException } from '@nestjs/common';

import { isDevAuthEnabled } from '../../common/dev-auth/dev-auth.config';

import { DevAuthService } from '../../common/dev-auth/dev-auth.service';

import { PrismaService } from '../../prisma/prisma.service';

import { UpdatePreferencesDto, UpdateProfileDto } from './dto/users.dto';



@Injectable()

export class UsersService {

  constructor(

    private prisma: PrismaService,

    private devAuth: DevAuthService,

  ) {}



  async getProfile(userId: string) {

    if (isDevAuthEnabled() && this.devAuth.isDevUser(userId)) {

      const user = this.devAuth.getProfile(userId);

      return { ...user, subscriptions: [] };

    }



    if (!this.prisma.dbAvailable) {

      throw new NotFoundException('User not found');

    }



    const user = await this.prisma.user.findUnique({

      where: { id: userId },

      include: {

        targetLanguages: true,

        preferences: true,

        subscriptions: {

          include: { plan: true },

          orderBy: { createdAt: 'desc' },

          take: 1,

        },

      },

    });

    if (!user) throw new NotFoundException('User not found');



    const { passwordHash: _, ...safe } = user;

    return safe;

  }



  async getStats(userId: string) {

    if (isDevAuthEnabled() && this.devAuth.isDevUser(userId)) {

      return this.devAuth.getStats();

    }



    if (!this.prisma.dbAvailable) {

      return this.devAuth.getStats();

    }



    const HEATMAP_DAYS = 70;

    const historyStart = new Date();

    historyStart.setHours(0, 0, 0, 0);

    historyStart.setDate(historyStart.getDate() - (HEATMAP_DAYS - 1));



    const [vocabCount, masteredCount, progress, sessions, dueCount, recentSessions, recentVocab] = await Promise.all([

      this.prisma.userVocabulary.count({ where: { userId } }),

      this.prisma.userVocabulary.count({ where: { userId, mastered: true } }),

      this.prisma.readingProgress.findMany({ where: { userId } }),

      this.prisma.readingSession.aggregate({

        where: { userId },

        _sum: { durationSeconds: true, wordsSaved: true, wordsTapped: true },

      }),

      this.prisma.userVocabulary.count({

        where: { userId, mastered: false, dueAt: { lte: new Date() } },

      }),

      this.prisma.readingSession.findMany({

        where: { userId, startedAt: { gte: historyStart } },

        select: { startedAt: true, durationSeconds: true, wordsSaved: true },

      }),

      this.prisma.userVocabulary.findMany({

        where: { userId, createdAt: { gte: historyStart } },

        select: { createdAt: true },

      }),

    ]);



    const totalReadSeconds = progress.reduce((s, p) => s + p.totalReadSeconds, 0);

    const completedCount = progress.filter((p) => p.completedAt).length;

    const history = buildStatsHistory(recentSessions, recentVocab, HEATMAP_DAYS);



    return {

      vocabularyTotal: vocabCount,

      vocabularyMastered: masteredCount,

      vocabularyDue: dueCount,

      contentInProgress: progress.length,

      contentCompleted: completedCount,

      totalReadMinutes: Math.round((totalReadSeconds + (sessions._sum.durationSeconds ?? 0)) / 60),

      wordsSaved: sessions._sum.wordsSaved ?? 0,

      wordsTapped: sessions._sum.wordsTapped ?? 0,

      ...history,

    };

  }



  async updateProfile(userId: string, dto: UpdateProfileDto) {

    if (isDevAuthEnabled() && this.devAuth.isDevUser(userId)) {

      return this.devAuth.updateProfile(userId, dto);

    }

    return this.prisma.user.update({

      where: { id: userId },

      data: dto,

      select: {

        id: true,

        email: true,

        displayName: true,

        avatarUrl: true,

        uiLanguage: true,

        nativeLanguage: true,

        streakCount: true,

      },

    });

  }



  async updatePreferences(userId: string, dto: UpdatePreferencesDto) {

    if (isDevAuthEnabled() && this.devAuth.isDevUser(userId)) {

      return this.devAuth.updatePreferences(userId, dto);

    }



    return this.prisma.userPreferences.upsert({

      where: { userId },

      create: { userId, ...dto },

      update: dto,

    });

  }

}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isoWeekStart(d: Date): string {
  const copy = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = copy.getUTCDay() || 7;
  if (day !== 1) copy.setUTCDate(copy.getUTCDate() - (day - 1));
  return dateKey(copy);
}

/**
 * Buckets a user's real reading sessions and saved vocabulary into the
 * daily/weekly/heatmap series consumed by the Statistics page charts.
 */
export function buildStatsHistory(
  sessions: Array<{ startedAt: Date; durationSeconds: number | null; wordsSaved: number }>,
  vocab: Array<{ createdAt: Date }>,
  heatmapDays: number,
) {
  const dailyMinutes = new Map<string, number>();
  const dailyWordsSaved = new Map<string, number>();
  const dailySessionCount = new Map<string, number>();

  for (const s of sessions) {
    const key = dateKey(s.startedAt);
    dailyMinutes.set(key, (dailyMinutes.get(key) ?? 0) + Math.round((s.durationSeconds ?? 0) / 60));
    dailyWordsSaved.set(key, (dailyWordsSaved.get(key) ?? 0) + s.wordsSaved);
    dailySessionCount.set(key, (dailySessionCount.get(key) ?? 0) + 1);
  }

  const weeklyVocab = new Map<string, number>();
  for (const v of vocab) {
    const week = isoWeekStart(v.createdAt);
    weeklyVocab.set(week, (weeklyVocab.get(week) ?? 0) + 1);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const daily: Array<{ date: string; minutes: number; wordsSaved: number }> = [];
  const heatmap: Array<{ date: string; count: number }> = [];
  for (let i = heatmapDays - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = dateKey(d);
    heatmap.push({ date: key, count: dailySessionCount.get(key) ?? 0 });
    if (i < 30) {
      daily.push({ date: key, minutes: dailyMinutes.get(key) ?? 0, wordsSaved: dailyWordsSaved.get(key) ?? 0 });
    }
  }

  const weekly: Array<{ weekStart: string; wordsSaved: number }> = [];
  for (let w = 5; w >= 0; w--) {
    const d = new Date(today);
    d.setDate(d.getDate() - w * 7);
    const weekStart = isoWeekStart(d);
    if (!weekly.some((entry) => entry.weekStart === weekStart)) {
      weekly.push({ weekStart, wordsSaved: weeklyVocab.get(weekStart) ?? 0 });
    }
  }

  let bestStreak = 0;
  let current = 0;
  for (const entry of heatmap) {
    if (entry.count > 0) {
      current += 1;
      bestStreak = Math.max(bestStreak, current);
    } else {
      current = 0;
    }
  }

  return { history: { daily, weekly, heatmap }, bestStreak };
}


