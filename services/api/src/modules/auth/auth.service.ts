import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { isDevAuthEnabled } from '../../common/dev-auth/dev-auth.config';
import { DevAuthService } from '../../common/dev-auth/dev-auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private devAuth: DevAuthService,
  ) {}

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private async issueTokens(userId: string, email: string, deviceName?: string) {
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
      data: {
        userId,
        tokenHash: refreshHash,
        deviceName,
        expiresAt,
      },
    });

    return { accessToken, refreshToken, isAdmin: !!admin, adminRole: admin?.role ?? null };
  }

  async register(dto: RegisterDto) {
    if (isDevAuthEnabled()) {
      return this.devAuth.register(dto);
    }

    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const primaryTarget = dto.targetLanguages[0];

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
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
        data: {
          userId: user.id,
          planId: freePlan.id,
          status: 'active',
        },
      });
    }

    const tokens = await this.issueTokens(user.id, user.email);
    return { user: this.sanitizeUser(user), ...tokens };
  }

  async login(dto: LoginDto) {
    if (isDevAuthEnabled()) {
      return this.devAuth.login(dto);
    }

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { targetLanguages: true },
    });

    if (!user?.passwordHash) throw new UnauthorizedException('Invalid credentials');
    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const tokens = await this.issueTokens(user.id, user.email, dto.deviceName);
    return { user: this.sanitizeUser(user), ...tokens };
  }

  async refresh(refreshToken: string) {
    if (isDevAuthEnabled()) {
      return this.devAuth.refresh(refreshToken);
    }

    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.authRefreshToken.findUnique({
      where: { tokenHash },
      include: { user: { include: { targetLanguages: true } } },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.authRefreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const tokens = await this.issueTokens(stored.user.id, stored.user.email, stored.deviceName ?? undefined);
    return { user: this.sanitizeUser(stored.user), ...tokens };
  }

  sanitizeUser(user: {
    id: string;
    email: string;
    displayName: string | null;
    nativeLanguage: string;
    uiLanguage: string;
    streakCount: number;
    targetLanguages?: unknown[];
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
}
