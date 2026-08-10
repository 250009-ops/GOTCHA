import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { isDevAuthEnabled } from '../../common/dev-auth/dev-auth.config';
import { DevAuthService } from '../../common/dev-auth/dev-auth.service';
import { MailService } from '../../common/mail/mail.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private devAuth: DevAuthService,
    private mail: MailService,
    private config: ConfigService,
  ) {}

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private learnerAppUrl(): string {
    return (
      this.config.get<string>('LEARNER_APP_URL')?.trim() ||
      this.config.get<string>('VITE_LEARNER_APP_URL')?.trim() ||
      'https://gotchaa.uz/learn'
    ).replace(/\/$/, '');
  }

  private async createVerificationToken(userId: string) {
    const rawToken = randomBytes(32).toString('hex');
    const emailVerificationToken = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        emailVerificationToken,
        emailVerificationExpires: expiresAt,
      },
    });

    return rawToken;
  }

  private async sendVerification(user: { id: string; email: string; displayName: string | null }) {
    const rawToken = await this.createVerificationToken(user.id);
    const verifyUrl = `${this.learnerAppUrl()}/verify-email?token=${rawToken}`;
    const name = user.displayName?.trim() || user.email.split('@')[0];

    void this.mail.sendEmailVerificationEmail(user.email, name, verifyUrl).catch((err) => {
      console.error('Failed to send verification email', err);
    });

    return verifyUrl;
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

    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const primaryTarget = dto.targetLanguages[0];

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        displayName: dto.displayName ?? email.split('@')[0],
        nativeLanguage: dto.nativeLanguage,
        emailVerifiedAt: null,
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

    await this.sendVerification(user);

    return {
      requiresEmailVerification: true,
      email: user.email,
      message: 'Verify your email to finish sign-up. Check your inbox for the verification link.',
    };
  }

  async login(dto: LoginDto) {
    if (isDevAuthEnabled()) {
      return this.devAuth.login(dto);
    }

    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { targetLanguages: true },
    });

    if (!user?.passwordHash) throw new UnauthorizedException('Invalid credentials');
    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    if (!user.emailVerifiedAt) {
      throw new UnauthorizedException({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Please verify your email before signing in.',
        code: 'EMAIL_NOT_VERIFIED',
        email: user.email,
      });
    }

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

    if (!stored.user.emailVerifiedAt) {
      throw new UnauthorizedException('Please verify your email before signing in.');
    }

    await this.prisma.authRefreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const tokens = await this.issueTokens(
      stored.user.id,
      stored.user.email,
      stored.deviceName ?? undefined,
    );
    return { user: this.sanitizeUser(stored.user), ...tokens };
  }

  async verifyEmail(token: string) {
    const raw = token?.trim();
    if (!raw) throw new BadRequestException('Verification token is required.');

    const emailVerificationToken = this.hashToken(raw);
    const user = await this.prisma.user.findFirst({
      where: {
        emailVerificationToken,
        emailVerificationExpires: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired email verification token.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        emailVerificationToken: null,
        emailVerificationExpires: null,
      },
    });

    return { verified: true, email: user.email };
  }

  async resendEmailVerification(emailRaw: string) {
    const email = emailRaw.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    // Avoid account enumeration
    if (!user || user.emailVerifiedAt) {
      return {
        sent: true,
        message: user ? 'Email already verified.' : 'If the email exists, we sent a new link.',
      };
    }

    await this.sendVerification(user);
    return { sent: true, message: 'Verification email sent.' };
  }

  sanitizeUser(user: {
    id: string;
    email: string;
    displayName: string | null;
    nativeLanguage: string;
    uiLanguage: string;
    streakCount: number;
    emailVerifiedAt?: Date | null;
    targetLanguages?: unknown[];
  }) {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      nativeLanguage: user.nativeLanguage,
      uiLanguage: user.uiLanguage,
      streakCount: user.streakCount,
      emailVerified: !!user.emailVerifiedAt,
      targetLanguages: user.targetLanguages ?? [],
    };
  }
}
