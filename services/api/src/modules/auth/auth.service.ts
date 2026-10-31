import { CONSENT_VERSION, consentRequired } from '../../common/safety/consent';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
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
import { assertEnabledLanguage } from '../../common/language-catalog';

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
const LOGIN_MAX_FAILURES = 8;
const LOGIN_LOCK_MS = 15 * 60 * 1000;
const TIMING_SAFE_HASH = bcrypt.hashSync('gotcha-timing-guard', 10);

type LoginGate = { failures: number; lockedUntil: number };
const loginGates = new Map<string, LoginGate>();

function loginGateKey(email: string) {
  return email.trim().toLowerCase();
}

function assertNotLocked(email: string) {
  const gate = loginGates.get(loginGateKey(email));
  if (gate && gate.lockedUntil > Date.now()) {
    throw new UnauthorizedException('Too many failed sign-in attempts. Try again in a few minutes.');
  }
}

function recordLoginFailure(email: string) {
  const key = loginGateKey(email);
  const gate = loginGates.get(key) ?? { failures: 0, lockedUntil: 0 };
  gate.failures += 1;
  if (gate.failures >= LOGIN_MAX_FAILURES) {
    gate.lockedUntil = Date.now() + LOGIN_LOCK_MS;
    gate.failures = 0;
  }
  loginGates.set(key, gate);
}

function clearLoginFailures(email: string) {
  loginGates.delete(loginGateKey(email));
}

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

  /** Recognises mobile vs web auth email requests. */
  private normalizeClientPlatform(value?: string): 'android' | 'web' | undefined {
    const normalized = value?.trim().toLowerCase();
    if (normalized === 'android' || normalized === 'web') return normalized;
    return undefined;
  }

  /** HTTPS learner links for all auth emails — clickable in Gmail; Android opens the app via App Links / web handoff. */
  private authActionUrl(
    path: 'verify-email' | 'reset-password',
    token: string,
    adminQuery: string,
    clientPlatform?: string,
  ): string {
    const encodedToken = encodeURIComponent(token);
    const platformQuery =
      this.normalizeClientPlatform(clientPlatform) === 'android' ? '&client=android' : '';
    return `${this.learnerAppUrl()}/${path}?token=${encodedToken}${platformQuery}${adminQuery}`;
  }

  private adminAppUrl(): string {
    return (
      this.config.get<string>('ADMIN_APP_URL')?.trim() ||
      this.config.get<string>('VITE_ADMIN_APP_URL')?.trim()?.split(',')?.[0]?.trim() ||
      // WLF-09: dev-only default; production refuses to boot without ADMIN_APP_URL (assertProductionUrlConfig).
      (process.env.NODE_ENV === 'production' ? 'https://gotchaa.uz/admin' : 'http://localhost:5173/')
    ).replace(/\/?$/, '/');
  }

  /** Append admin returnUrl so verify/reset pages can hand off back to the admin console. */
  private async adminReturnQuery(userId: string): Promise<string> {
    const admin = await this.prisma.adminUser.findUnique({ where: { userId } });
    if (!admin) return '';
    return `&returnUrl=${encodeURIComponent(this.adminAppUrl())}`;
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

  private async sendVerification(
    user: { id: string; email: string; displayName: string | null },
    clientPlatform?: string,
  ) {
    const rawToken = await this.createVerificationToken(user.id);
    const adminQuery = await this.adminReturnQuery(user.id);
    const verifyUrl = this.authActionUrl('verify-email', rawToken, adminQuery, clientPlatform);
    const name = user.displayName?.trim() || user.email.split('@')[0];

    void this.mail.sendEmailVerificationEmail(user.email, name, verifyUrl).catch((err) => {
      console.error('Failed to send verification email', err);
    });

    return verifyUrl;
  }

  /**
   * JWT still carries `isAdmin` / `adminRole` for the client. Admin API routes
   * re-check `AdminUser` in RolesGuard on every request, so a revoked admin
   * loses access immediately even if their token has not expired.
   */
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

  async register(dto: RegisterDto, clientPlatformHeader?: string, ip?: string, browserOrigin?: string) {
    const clientPlatform = dto.clientPlatform ?? clientPlatformHeader;
    // S3: web sign-ups must tick the single consent box (Terms + Privacy + OpenAI transfer).
    if (consentRequired(clientPlatform, browserOrigin) && dto.acceptTerms !== true) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Please accept the Terms of Use and the Privacy Policy to create an account.',
        code: 'CONSENT_REQUIRED',
      });
    }
    if (isDevAuthEnabled()) {
      return this.devAuth.register(dto);
    }

    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      if (!existing.emailVerifiedAt) {
        await this.sendVerification(existing, clientPlatform);
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          message:
            'Account already exists but is not verified. We sent a new verification email — check your inbox or open Resend.',
          code: 'EMAIL_EXISTS_UNVERIFIED',
        });
      }
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message: 'Account already exists. Sign in, or resend verification if you never confirmed your email.',
        code: 'EMAIL_ALREADY_REGISTERED',
      });
    }

    await assertEnabledLanguage(this.prisma, dto.nativeLanguage, 'Native language');
    for (const lang of dto.targetLanguages) {
      await assertEnabledLanguage(this.prisma, lang, 'Target language');
      if (lang === dto.nativeLanguage) {
        throw new BadRequestException('Target languages cannot include your native language.');
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const primaryTarget = dto.targetLanguages[0];

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        displayName: dto.displayName ?? email.split('@')[0],
        nativeLanguage: dto.nativeLanguage,
        birthYear: dto.birthYear ?? null,
        // W-12: asked at sign-up, so no later one-time prompt.
        agePromptedAt: new Date(),
        ...(dto.acceptTerms === true
          ? { consentVersion: CONSENT_VERSION, consentAt: new Date(), consentIp: ip?.slice(0, 64) ?? null }
          : {}),
        uiLanguage: dto.uiLanguage && (['en', 'ru', 'uz'] as const).includes(dto.uiLanguage) ? dto.uiLanguage : 'uz',
        emailVerifiedAt: null,
        preferences: { create: { dailyGoalMinutes: 15 } },
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

    await this.sendVerification(user, clientPlatform);

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
    assertNotLocked(email);

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { targetLanguages: true },
    });

    const valid = await bcrypt.compare(dto.password, user?.passwordHash ?? TIMING_SAFE_HASH);
    if (!user?.passwordHash || !valid) {
      recordLoginFailure(email);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.deletedAt) {
      throw new UnauthorizedException('This account has been deleted or suspended.');
    }

    if (!user.emailVerifiedAt) {
      throw new UnauthorizedException({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Please verify your email before signing in.',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }

    clearLoginFailures(email);
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

    if (stored.user.deletedAt) {
      throw new UnauthorizedException('This account has been deleted or suspended.');
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

  /** Send (or re-send) the verification email for a user id — used after admin email change. */
  async sendVerificationEmail(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    await this.sendVerification(user);
    return {
      sent: true,
      email: user.email,
      message: 'Verification email sent.',
    };
  }

  async resendEmailVerification(emailRaw: string, clientPlatform?: string) {
    const email = emailRaw.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    // Avoid account enumeration
    if (!user || user.emailVerifiedAt) {
      return {
        sent: true,
        message: 'If the email exists and still needs verification, we sent a new link.',
      };
    }

    await this.sendVerification(user, clientPlatform);
    return {
      sent: true,
      message: 'If the email exists and still needs verification, we sent a new link.',
    };
  }

  private async createPasswordResetToken(userId: string) {
    const rawToken = randomBytes(32).toString('hex');
    const passwordResetToken = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordResetToken,
        passwordResetExpires: expiresAt,
      },
    });

    return rawToken;
  }

  private async sendPasswordReset(
    user: { id: string; email: string; displayName: string | null },
    clientPlatform?: string,
  ) {
    const rawToken = await this.createPasswordResetToken(user.id);
    const adminQuery = await this.adminReturnQuery(user.id);
    const resetUrl = this.authActionUrl('reset-password', rawToken, adminQuery, clientPlatform);
    const name = user.displayName?.trim() || user.email.split('@')[0];

    void this.mail.sendPasswordResetEmail(user.email, name, resetUrl).catch((err) => {
      console.error('Failed to send password reset email', err);
    });

    return resetUrl;
  }

  async forgotPassword(emailRaw: string, clientPlatform?: string) {
    const email = emailRaw.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    // Always return the same generic success (no account enumeration).
    if (user?.passwordHash) {
      await this.sendPasswordReset(user, clientPlatform);
    }

    return {
      sent: true,
      message: 'If an account exists for that email, we sent a password reset link.',
    };
  }

  /** Admin-triggered reset email (same token/mail path as forgotPassword). */
  async adminTriggerPasswordReset(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (!user.passwordHash) {
      throw new BadRequestException('User has no password login to reset.');
    }
    await this.sendPasswordReset(user);
    return {
      sent: true,
      email: user.email,
      message: 'Password reset email sent.',
    };
  }

  async resetPassword(token: string, newPassword: string) {
    const raw = token?.trim();
    if (!raw) throw new BadRequestException('Reset token is required.');
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters.');
    }

    const passwordResetToken = this.hashToken(raw);
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken,
        passwordResetExpires: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired password reset token.');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          passwordResetToken: null,
          passwordResetExpires: null,
          // Completing reset implies mailbox access — mark verified if still pending.
          emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
          emailVerificationToken: null,
          emailVerificationExpires: null,
        },
      }),
      // Invalidate existing sessions after a password change.
      this.prisma.authRefreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return {
      reset: true,
      email: user.email,
      message: 'Password updated. You can sign in with your new password.',
    };
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
