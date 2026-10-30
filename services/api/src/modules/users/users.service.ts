import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { mkdir, rm, writeFile } from 'fs/promises';
import { join } from 'path';

import * as bcrypt from 'bcryptjs';

import { isDevAuthEnabled } from '../../common/dev-auth/dev-auth.config';

import { DevAuthService } from '../../common/dev-auth/dev-auth.service';

import { PrismaService } from '../../prisma/prisma.service';

import { calendarDateKey, effectiveStreakCount, STREAK_TIMEZONE } from '../../services/streak.service';

import { assertEnabledLanguage } from '../../common/language-catalog';
import { assertJpegPngOrWebp } from '../../common/upload-magic';
import {
  AddTargetLanguageDto,
  ChangePasswordDto,
  DeleteAccountDto,
  UpdatePreferencesDto,
  UpdateProfileDto,
  UpdateTargetLanguageDto,
} from './dto/users.dto';



@Injectable()

export class UsersService {

  constructor(

    private prisma: PrismaService,

    private devAuth: DevAuthService,

  ) {}

  /** Target languages must never equal native — drop conflicts and fix primary if needed. */
  private async removeNativeFromTargets(userId: string, nativeLanguage: string) {
    const conflicts = await this.prisma.userTargetLanguage.findMany({
      where: { userId, targetLanguage: nativeLanguage as never },
    });
    if (!conflicts.length) return;

    const removedPrimary = conflicts.some((row) => row.isPrimary);
    await this.prisma.userTargetLanguage.deleteMany({
      where: { userId, targetLanguage: nativeLanguage as never },
    });

    if (removedPrimary) {
      const next = await this.prisma.userTargetLanguage.findFirst({
        where: { userId },
        orderBy: { targetLanguage: 'asc' },
      });
      if (next) {
        await this.prisma.userTargetLanguage.update({
          where: {
            userId_targetLanguage: { userId, targetLanguage: next.targetLanguage },
          },
          data: { isPrimary: true },
        });
      }
    }
  }

  /** After a native-language change, the previous native becomes a language to learn. */
  private async addPreviousNativeAsTarget(userId: string, previousNative: string) {
    try {
      await assertEnabledLanguage(this.prisma, previousNative, 'Language');
    } catch {
      return;
    }
    const remaining = await this.prisma.userTargetLanguage.count({ where: { userId } });
    await this.prisma.userTargetLanguage.upsert({
      where: {
        userId_targetLanguage: { userId, targetLanguage: previousNative as never },
      },
      create: {
        userId,
        targetLanguage: previousNative as never,
        cefrLevel: 'a1',
        isPrimary: remaining === 0,
      },
      update: {},
    });
  }

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

    await this.removeNativeFromTargets(userId, user.nativeLanguage);

    const refreshed = await this.prisma.user.findUnique({
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
    if (!refreshed) throw new NotFoundException('User not found');

    const { passwordHash: _, ...safe } = refreshed;

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



    const [vocabCount, masteredCount, allProgress, recentProgress, sessions, dueCount, recentSessions, recentVocab, userStreak] =
      await Promise.all([

      this.prisma.userVocabulary.count({ where: { userId } }),

      this.prisma.userVocabulary.count({ where: { userId, mastered: true } }),

      this.prisma.readingProgress.findMany({
        where: { userId },
        select: { totalReadSeconds: true, completedAt: true },
      }),

      this.prisma.readingProgress.findMany({
        where: {
          userId,
          OR: [
            { lastReadAt: { gte: historyStart } },
            { completedAt: { gte: historyStart } },
          ],
        },
        select: { contentId: true, completedAt: true, lastReadAt: true },
      }),

      this.prisma.readingSession.aggregate({

        where: { userId },

        _sum: { durationSeconds: true, wordsSaved: true, wordsTapped: true },

      }),

      this.prisma.userVocabulary.count({

        where: { userId, mastered: false, dueAt: { lte: new Date() } },

      }),

      this.prisma.readingSession.findMany({

        where: { userId, startedAt: { gte: historyStart } },

        select: { startedAt: true, durationSeconds: true, wordsSaved: true, contentId: true },

      }),

      this.prisma.userVocabulary.findMany({

        where: { userId, createdAt: { gte: historyStart } },

        select: { createdAt: true },

      }),

      this.prisma.user.findUnique({
        where: { id: userId },
        select: { streakCount: true, streakLastDate: true, bestStreak: true },
      }),

    ]);



    const totalReadSeconds = allProgress.reduce((s, p) => s + p.totalReadSeconds, 0);

    const completedCount = allProgress.filter((p) => p.completedAt).length;
    const inProgressCount = allProgress.filter((p) => !p.completedAt).length;

    const historyResult = buildStatsHistory(recentSessions, recentVocab, recentProgress, HEATMAP_DAYS);
    const streakCount = effectiveStreakCount(
      userStreak?.streakCount ?? 0,
      userStreak?.streakLastDate,
    );
    const bestStreak = Math.max(userStreak?.bestStreak ?? 0, streakCount);

    const todayKey = calendarDateKey(new Date());
    const todaySessions = recentSessions.filter((s) => calendarDateKey(s.startedAt) === todayKey);
    const todayReadMinutes =
      historyResult.history.daily.find((d) => d.date === todayKey)?.minutes ??
      Math.round(todaySessions.reduce((s, row) => s + (row.durationSeconds ?? 0), 0) / 60);
    const todayWordsSaved = todaySessions.reduce((s, row) => s + row.wordsSaved, 0);

    return {

      vocabularyTotal: vocabCount,

      vocabularyMastered: masteredCount,

      vocabularyDue: dueCount,

      contentInProgress: inProgressCount,

      contentCompleted: completedCount,

      totalReadMinutes: Math.round((totalReadSeconds + (sessions._sum.durationSeconds ?? 0)) / 60),

      todayReadMinutes,

      todayWordsSaved,

      wordsSaved: sessions._sum.wordsSaved ?? 0,

      wordsTapped: sessions._sum.wordsTapped ?? 0,

      streakCount,

      bestStreak,

      history: historyResult.history,

    };

  }



  async updateProfile(userId: string, dto: UpdateProfileDto) {

    if (isDevAuthEnabled() && this.devAuth.isDevUser(userId)) {

      return this.devAuth.updateProfile(userId, dto);

    }

    if (dto.nativeLanguage) {
      await assertEnabledLanguage(this.prisma, dto.nativeLanguage, 'Native language');
    }
    if (dto.uiLanguage) {
      await assertEnabledLanguage(this.prisma, dto.uiLanguage, 'UI language');
    }

    if (dto.nativeLanguage) {
      const current = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { nativeLanguage: true },
      });
      const previousNative = current?.nativeLanguage;
      await this.removeNativeFromTargets(userId, dto.nativeLanguage);
      if (previousNative && previousNative !== dto.nativeLanguage) {
        await this.addPreviousNativeAsTarget(userId, previousNative);
      }
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
        targetLanguages: true,
      },
    });

  }

  async uploadAvatar(userId: string, file: Express.Multer.File) {
    if (isDevAuthEnabled() && this.devAuth.isDevUser(userId)) {
      throw new BadRequestException('Photo upload is not available for demo accounts.');
    }

    const extByMime: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    };
    const ext = extByMime[file.mimetype];
    if (!ext) throw new BadRequestException('Use a JPG, PNG, or WebP image.');
    assertJpegPngOrWebp(file, 'Image');
    if (file.size > 2 * 1024 * 1024) {
      throw new BadRequestException('Image must be 2 MB or smaller.');
    }

    const root = process.env.UPLOADS_DIR ?? join(process.cwd(), 'uploads');
    const dir = join(root, 'avatars');
    await mkdir(dir, { recursive: true });
    for (const oldExt of ['jpg', 'jpeg', 'png', 'webp']) {
      await rm(join(dir, `${userId}.${oldExt}`), { force: true });
    }
    const fileName = `${userId}.${ext}`;
    await writeFile(join(dir, fileName), file.buffer);
    const avatarUrl = `/uploads/avatars/${fileName}?v=${Date.now()}`;

    return this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
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

  /** Authenticated change-password — does not depend on SMTP, unlike the forgot/reset-password email flow. */
  async changePassword(userId: string, dto: ChangePasswordDto) {
    if (isDevAuthEnabled() && this.devAuth.isDevUser(userId)) {
      throw new BadRequestException('Password change is not supported for dev/demo accounts.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.passwordHash) throw new NotFoundException('User not found');

    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Current password is incorrect.');

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
      // Invalidate existing sessions after a password change, matching resetPassword's behavior.
      this.prisma.authRefreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return { changed: true, message: 'Password updated.' };
  }

  async addTargetLanguage(userId: string, dto: AddTargetLanguageDto) {
    await assertEnabledLanguage(this.prisma, dto.targetLanguage, 'Target language');
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { nativeLanguage: true },
    });
    if (user?.nativeLanguage === dto.targetLanguage) {
      throw new BadRequestException('Target language cannot be the same as your native language.');
    }
    const existingCount = await this.prisma.userTargetLanguage.count({ where: { userId } });
    if (dto.isPrimary || existingCount === 0) {
      await this.prisma.userTargetLanguage.updateMany({
        where: { userId },
        data: { isPrimary: false },
      });
    }

    return this.prisma.userTargetLanguage.upsert({
      where: { userId_targetLanguage: { userId, targetLanguage: dto.targetLanguage } },
      create: {
        userId,
        targetLanguage: dto.targetLanguage,
        cefrLevel: dto.cefrLevel ?? 'a1',
        isPrimary: dto.isPrimary ?? existingCount === 0,
      },
      update: {
        cefrLevel: dto.cefrLevel ?? undefined,
        isPrimary: dto.isPrimary ?? existingCount === 0,
      },
    });
  }

  async updateTargetLanguage(userId: string, targetLanguage: string, dto: UpdateTargetLanguageDto) {
    const existing = await this.prisma.userTargetLanguage.findUnique({
      where: { userId_targetLanguage: { userId, targetLanguage: targetLanguage as never } },
    });
    if (!existing) throw new NotFoundException('Target language not found');

    if (dto.isPrimary) {
      await this.prisma.userTargetLanguage.updateMany({
        where: { userId },
        data: { isPrimary: false },
      });
    }

    return this.prisma.userTargetLanguage.update({
      where: { userId_targetLanguage: { userId, targetLanguage: targetLanguage as never } },
      data: {
        cefrLevel: dto.cefrLevel ?? undefined,
        isPrimary: dto.isPrimary ?? undefined,
      },
    });
  }

  async removeTargetLanguage(userId: string, targetLanguage: string) {
    const total = await this.prisma.userTargetLanguage.count({ where: { userId } });
    if (total <= 1) {
      throw new BadRequestException('You must keep at least one target language.');
    }

    const existing = await this.prisma.userTargetLanguage.findUnique({
      where: { userId_targetLanguage: { userId, targetLanguage: targetLanguage as never } },
    });
    if (!existing) throw new NotFoundException('Target language not found');

    await this.prisma.userTargetLanguage.delete({
      where: { userId_targetLanguage: { userId, targetLanguage: targetLanguage as never } },
    });

    if (existing.isPrimary) {
      const next = await this.prisma.userTargetLanguage.findFirst({ where: { userId } });
      if (next) {
        await this.prisma.userTargetLanguage.update({
          where: { userId_targetLanguage: { userId, targetLanguage: next.targetLanguage } },
          data: { isPrimary: true },
        });
      }
    }

    return { ok: true };
  }

  /** Reasonable-scope self-service data export: own profile, preferences, vocabulary, reading progress, imports. */
  async exportData(userId: string) {
    if (isDevAuthEnabled() && this.devAuth.isDevUser(userId)) {
      throw new BadRequestException('Data export is not supported for dev/demo accounts.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { targetLanguages: true, preferences: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const [vocabulary, readingProgress, imports, subscriptions] = await Promise.all([
      this.prisma.userVocabulary.findMany({ where: { userId } }),
      this.prisma.readingProgress.findMany({ where: { userId } }),
      this.prisma.userImport.findMany({
        where: { userId },
        select: {
          id: true,
          title: true,
          importType: true,
          sourceUrl: true,
          language: true,
          ingestionStatus: true,
          createdAt: true,
        },
      }),
      this.prisma.userSubscription.findMany({ where: { userId }, include: { plan: true } }),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      profile: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        nativeLanguage: user.nativeLanguage,
        uiLanguage: user.uiLanguage,
        timezone: user.timezone,
        streakCount: user.streakCount,
        streakLastDate: user.streakLastDate,
        createdAt: user.createdAt,
      },
      targetLanguages: user.targetLanguages,
      preferences: user.preferences,
      vocabulary,
      readingProgress,
      imports,
      subscriptions,
    };
  }

  /**
   * Self-service account deletion. Prefers a safe soft-delete over a hard cascade delete:
   * the Prisma schema cascades most User-owned rows on hard delete, but ContentItem.createdBy
   * and other cross-user references make a hard delete of active accounts risky. Soft-delete
   * anonymizes PII, blocks login (auth.service.ts checks `deletedAt`), and revokes sessions —
   * matching the `deletedAt` semantics admin.service.ts already uses for suspending users.
   */
  async deleteAccount(userId: string, dto: DeleteAccountDto) {
    if (isDevAuthEnabled() && this.devAuth.isDevUser(userId)) {
      throw new BadRequestException('Account deletion is not supported for dev/demo accounts.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.passwordHash) throw new NotFoundException('User not found');

    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Current password is incorrect.');

    if (user.email.startsWith('deleted-')) {
      throw new ConflictException('Account already deleted.');
    }

    const anonymizedEmail = `deleted-${userId}@deleted.gotcha.app`;

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          email: anonymizedEmail,
          displayName: 'Deleted user',
          avatarUrl: null,
          passwordHash: null,
          deletedAt: new Date(),
          emailVerificationToken: null,
          passwordResetToken: null,
        },
      }),
      this.prisma.authRefreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return { deleted: true };
  }

}

function dayKey(d: Date): string {
  return calendarDateKey(d, STREAK_TIMEZONE);
}

function isoWeekStart(d: Date): string {
  const copy = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = copy.getUTCDay() || 7;
  if (day !== 1) copy.setUTCDate(copy.getUTCDate() - (day - 1));
  return dayKey(copy);
}

export type StatsHeatmapDay = { date: string; count: number; finished: number };

/**
 * Buckets reading sessions and progress into daily/weekly/heatmap series for Statistics.
 * Heatmap count = distinct contents read per day; finished = contents completed that day.
 */
export function buildStatsHistory(
  sessions: Array<{ startedAt: Date; durationSeconds: number | null; contentId: string }>,
  vocab: Array<{ createdAt: Date }>,
  progress: Array<{ contentId: string; completedAt: Date | null; lastReadAt: Date }>,
  heatmapDays: number,
  now: Date = new Date(),
) {
  const dailyMinutes = new Map<string, number>();
  const dailyWordsSaved = new Map<string, number>();
  const dailyContents = new Map<string, Set<string>>();
  const dailyFinished = new Map<string, number>();

  for (const s of sessions) {
    const key = dayKey(s.startedAt);
    dailyMinutes.set(key, (dailyMinutes.get(key) ?? 0) + Math.round((s.durationSeconds ?? 0) / 60));
    if (!dailyContents.has(key)) dailyContents.set(key, new Set());
    dailyContents.get(key)!.add(s.contentId);
  }

  for (const row of progress) {
    if (row.lastReadAt) {
      const key = dayKey(row.lastReadAt);
      if (!dailyContents.has(key)) dailyContents.set(key, new Set());
      dailyContents.get(key)!.add(row.contentId);
    }
    if (row.completedAt) {
      const key = dayKey(row.completedAt);
      dailyFinished.set(key, (dailyFinished.get(key) ?? 0) + 1);
      if (!dailyContents.has(key)) dailyContents.set(key, new Set());
      dailyContents.get(key)!.add(row.contentId);
    }
  }

  const weeklyVocab = new Map<string, number>();
  for (const v of vocab) {
    const dayKeyVal = dayKey(v.createdAt);
    dailyWordsSaved.set(dayKeyVal, (dailyWordsSaved.get(dayKeyVal) ?? 0) + 1);
    const week = isoWeekStart(v.createdAt);
    weeklyVocab.set(week, (weeklyVocab.get(week) ?? 0) + 1);
  }

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const daily: Array<{ date: string; minutes: number; wordsSaved: number }> = [];
  const heatmap: StatsHeatmapDay[] = [];
  for (let i = heatmapDays - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = dayKey(d);
    const minutes = dailyMinutes.get(key) ?? 0;
    const wordsSaved = dailyWordsSaved.get(key) ?? 0;
    const count = dailyContents.get(key)?.size ?? 0;
    heatmap.push({
      date: key,
      count,
      finished: dailyFinished.get(key) ?? 0,
    });
    if (i < 30) {
      daily.push({ date: key, minutes, wordsSaved });
    }
  }

  const weekly: Array<{ weekStart: string; wordsSaved: number }> = [];
  for (let w = 5; w >= 0; w -= 1) {
    const d = new Date(today);
    d.setDate(d.getDate() - w * 7);
    const weekStart = isoWeekStart(d);
    if (!weekly.some((entry) => entry.weekStart === weekStart)) {
      weekly.push({ weekStart, wordsSaved: weeklyVocab.get(weekStart) ?? 0 });
    }
  }

  return { history: { daily, weekly, heatmap } };
}


