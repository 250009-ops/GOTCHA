import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AppLanguage } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto, RegisterDto } from '../../modules/auth/dto/auth.dto';

export interface DevUserRecord {
  id: string;
  email: string;
  displayName: string | null;
  nativeLanguage: AppLanguage;
  uiLanguage: AppLanguage;
  streakCount: number;
  targetLanguages: Array<{
    userId: string;
    targetLanguage: AppLanguage;
    isPrimary: boolean;
  }>;
  preferences: {
    userId: string;
    readerFontScale: number;
    readerTheme: string;
    readerLineSpacing: number;
    showKnownWords: boolean;
    ttsEnabled: boolean;
    dailyGoalMinutes: number;
    notificationsEnabled: boolean;
  };
}

interface StoredRefreshToken {
  userId: string;
  email: string;
  deviceName?: string;
  expiresAt: Date;
}

@Injectable()
export class DevAuthService {
  private readonly usersByEmail = new Map<string, DevUserRecord>();
  private readonly usersById = new Map<string, DevUserRecord>();
  private readonly refreshTokens = new Map<string, StoredRefreshToken>();

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  isDevUser(userId: string): boolean {
    return this.usersById.has(userId);
  }

  getDevUser(userId: string): DevUserRecord | undefined {
    return this.usersById.get(userId);
  }

  userIdFromEmail(email: string): string {
    const normalized = email.trim().toLowerCase();
    const hash = createHash('sha256').update(`gotcha-dev:${normalized}`).digest('hex');
    return [
      hash.slice(0, 8),
      hash.slice(8, 12),
      `4${hash.slice(13, 16)}`,
      `${((parseInt(hash.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0')}${hash.slice(18, 20)}`,
      hash.slice(20, 32),
    ].join('-');
  }

  async login(dto: LoginDto) {
    const dbUser = await this.tryFindDbUser(dto.email);
    if (dbUser) {
      if (dbUser.passwordHash) {
        const bcrypt = await import('bcryptjs');
        const valid = await bcrypt.compare(dto.password, dbUser.passwordHash);
        if (!valid) throw new UnauthorizedException('Invalid credentials');
      }
      const tokens = await this.issueTokensForUser(dbUser.id, dbUser.email, dto.deviceName);
      return { user: this.sanitizeUser(dbUser), ...tokens };
    }

    const user = this.getOrCreateMemoryUser(dto.email);
    const tokens = await this.issueDevTokens(user.id, user.email, dto.deviceName);
    return { user: this.sanitizeUser(user), ...tokens };
  }

  async register(dto: RegisterDto) {
    const existing = await this.tryFindDbUser(dto.email);
    if (existing) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message: 'Account already exists. Sign in, or resend verification if you never confirmed your email.',
        code: 'EMAIL_ALREADY_REGISTERED',
        email: existing.email,
      });
    }
    if (this.usersByEmail.has(dto.email.trim().toLowerCase())) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message: 'Account already exists. Sign in, or resend verification if you never confirmed your email.',
        code: 'EMAIL_ALREADY_REGISTERED',
        email: dto.email.trim().toLowerCase(),
      });
    }

    const dbUser = await this.tryCreateDbUser(dto);
    if (dbUser) {
      const tokens = await this.issueTokensForUser(dbUser.id, dbUser.email);
      return { user: this.sanitizeUser(dbUser), ...tokens };
    }

    const user = this.createMemoryUser(dto);
    const tokens = await this.issueDevTokens(user.id, user.email);
    return { user: this.sanitizeUser(user), ...tokens };
  }

  async refresh(refreshToken: string) {
    const dbResult = await this.tryRefreshFromDb(refreshToken);
    if (dbResult) return dbResult;

    const tokenHash = this.hashToken(refreshToken);
    const stored = this.refreshTokens.get(tokenHash);
    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    this.refreshTokens.delete(tokenHash);
    const user = this.usersById.get(stored.userId);
    if (!user) throw new UnauthorizedException('Invalid refresh token');

    const tokens = await this.issueDevTokens(user.id, user.email, stored.deviceName);
    return { user: this.sanitizeUser(user), ...tokens };
  }

  getProfile(userId: string): DevUserRecord {
    const user = this.usersById.get(userId);
    if (!user) throw new UnauthorizedException('Dev user not found');
    return user;
  }

  getStats() {
    return {
      vocabularyTotal: 0,
      vocabularyMastered: 0,
      vocabularyDue: 0,
      contentInProgress: 0,
      contentCompleted: 0,
      totalReadMinutes: 0,
      wordsSaved: 0,
      wordsTapped: 0,
      streakCount: 0,
      bestStreak: 0,
      history: { daily: [], weekly: [], heatmap: [] },
    };
  }

  updatePreferences(userId: string, patch: Partial<DevUserRecord['preferences']>) {
    const user = this.usersById.get(userId);
    if (!user) throw new UnauthorizedException('Dev user not found');
    user.preferences = { ...user.preferences, ...patch };
    return user.preferences;
  }

  updateProfile(
    userId: string,
    patch: Partial<Pick<DevUserRecord, 'displayName' | 'uiLanguage' | 'nativeLanguage'>>,
  ) {
    const user = this.usersById.get(userId);
    if (!user) throw new UnauthorizedException('Dev user not found');
    Object.assign(user, patch);
    return user;
  }

  sanitizeUser(user: {
    id: string;
    email: string;
    displayName: string | null;
    nativeLanguage: AppLanguage;
    uiLanguage: AppLanguage;
    streakCount: number;
    targetLanguages?: DevUserRecord['targetLanguages'];
  }) {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      nativeLanguage: user.nativeLanguage,
      uiLanguage: user.uiLanguage,
      streakCount: user.streakCount,
      targetLanguages: user.targetLanguages ?? [],
    };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private getOrCreateMemoryUser(email: string): DevUserRecord {
    const normalized = email.trim().toLowerCase();
    const existing = this.usersByEmail.get(normalized);
    if (existing) return existing;

    return this.createMemoryUser({
      email: normalized,
      password: 'dev',
      nativeLanguage: AppLanguage.en,
      targetLanguages: [AppLanguage.en],
    });
  }

  private createMemoryUser(dto: RegisterDto): DevUserRecord {
    const normalized = dto.email.trim().toLowerCase();
    const id = this.userIdFromEmail(normalized);
    const primaryTarget = dto.targetLanguages[0] ?? AppLanguage.en;

    const user: DevUserRecord = {
      id,
      email: normalized,
      displayName: dto.displayName ?? normalized.split('@')[0],
      nativeLanguage: dto.nativeLanguage,
      uiLanguage: AppLanguage.en,
      streakCount: 0,
      targetLanguages: dto.targetLanguages.map((lang, idx) => ({
        userId: id,
        targetLanguage: lang,
        isPrimary: lang === primaryTarget || idx === 0,
      })),
      preferences: {
        userId: id,
        readerFontScale: 1,
        readerTheme: 'light',
        readerLineSpacing: 1.5,
        showKnownWords: true,
        ttsEnabled: false,
        dailyGoalMinutes: 15,
        notificationsEnabled: true,
      },
    };

    this.usersByEmail.set(normalized, user);
    this.usersById.set(id, user);
    return user;
  }

  private async issueDevTokens(userId: string, email: string, deviceName?: string) {
    const payload = { sub: userId, email, isAdmin: false };
    const accessToken = await this.jwt.signAsync(payload);
    const refreshToken = randomBytes(48).toString('hex');
    const refreshHash = this.hashToken(refreshToken);

    const expiresDays = Number(process.env.JWT_REFRESH_EXPIRES_DAYS ?? 30);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresDays);

    this.refreshTokens.set(refreshHash, { userId, email, deviceName, expiresAt });
    return { accessToken, refreshToken, isAdmin: false, adminRole: null as string | null };
  }

  private async issueTokensForUser(userId: string, email: string, deviceName?: string) {
    if (!this.prisma.dbAvailable) {
      return this.issueDevTokens(userId, email, deviceName);
    }

    try {
      const admin = await this.prisma.adminUser.findUnique({ where: { userId } });
      const payload = {
        sub: userId,
        email,
        isAdmin: !!admin,
        adminRole: admin?.role,
      };

      const accessToken = await this.jwt.signAsync(payload);
      const refreshToken = randomBytes(48).toString('hex');
      const refreshHash = this.hashToken(refreshToken);

      const expiresDays = Number(process.env.JWT_REFRESH_EXPIRES_DAYS ?? 30);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresDays);

      await this.prisma.authRefreshToken.create({
        data: { userId, tokenHash: refreshHash, deviceName, expiresAt },
      });

      return { accessToken, refreshToken, isAdmin: !!admin, adminRole: admin?.role ?? null };
    } catch {
      return this.issueDevTokens(userId, email, deviceName);
    }
  }

  private async tryFindDbUser(email: string) {
    if (!this.prisma.dbAvailable) return null;

    try {
      return await this.prisma.user.findUnique({
        where: { email: email.trim().toLowerCase() },
        include: { targetLanguages: true },
      });
    } catch {
      return null;
    }
  }

  private async tryCreateDbUser(dto: RegisterDto) {
    if (!this.prisma.dbAvailable) return null;

    try {
      const bcrypt = await import('bcryptjs');
      const passwordHash = await bcrypt.hash(dto.password, 12);
      const primaryTarget = dto.targetLanguages[0];

      const user = await this.prisma.user.create({
        data: {
          email: dto.email.trim().toLowerCase(),
          passwordHash,
          displayName: dto.displayName ?? dto.email.split('@')[0],
          nativeLanguage: dto.nativeLanguage,
          preferences: { create: {} },
          targetLanguages: {
            create: dto.targetLanguages.map((lang, idx) => ({
              targetLanguage: lang,
              isPrimary: lang === primaryTarget || idx === 0,
            })),
          },
        },
        include: { targetLanguages: true },
      });

      const freePlan = await this.prisma.subscriptionPlan.findUnique({ where: { tier: 'free' } });
      if (freePlan) {
        await this.prisma.userSubscription.create({
          data: { userId: user.id, planId: freePlan.id, status: 'active' },
        });
      }

      return user;
    } catch {
      return null;
    }
  }

  private async tryRefreshFromDb(refreshToken: string) {
    if (!this.prisma.dbAvailable) return null;

    try {
      const tokenHash = this.hashToken(refreshToken);
      const stored = await this.prisma.authRefreshToken.findUnique({
        where: { tokenHash },
        include: { user: { include: { targetLanguages: true } } },
      });

      if (!stored || stored.revokedAt || stored.expiresAt < new Date()) return null;

      await this.prisma.authRefreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      });

      const tokens = await this.issueTokensForUser(
        stored.user.id,
        stored.user.email,
        stored.deviceName ?? undefined,
      );
      return { user: this.sanitizeUser(stored.user), ...tokens };
    } catch {
      return null;
    }
  }
}
