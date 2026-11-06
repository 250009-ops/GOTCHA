import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { maskPhone, normalizePhone } from '../../common/phone';
import { PrismaService } from '../../prisma/prisma.service';
import { applyCustomEmoji, CODE_EMOJI_KEYS } from './custom-emoji';
import { botLocale, codeErrorText, loginCodeHtml, resendCooldownText, signupCodeText, type BotLocale } from './copy';
import { CODE_TTL_MS, MAX_CODE_ATTEMPTS, RESEND_COOLDOWN_MS, codeMatches, hashLoginCode, randomLinkToken, randomLoginCode } from './code-hash';
import { botDeepLink, GrammySender, learnerForgotUrl, miniAppUrl } from './telegram-api';
import { botButtons, loginConfirmHtml, notLinkedHtml, passwordMayBeKnownHtml, phoneTakenHtml } from './copy';
import { parseDevice } from './device';
import { validateInitData, type InitDataResult } from './init-data';

type ChallengePurpose = 'login' | 'reset';

/** Salt for the pending-signup code. Same hash as a login code, scoped to this Telegram user. */
function signupCodeId(telegramId: bigint): string {
  return `signup:${telegramId.toString()}`;
}

export interface CodeChallengeResult {
  step: 'telegram_code';
  challengeId: string;
  maskedPhone: string;
  purpose: ChallengePurpose;
}

@Injectable()
export class TelegramLoginService {
  constructor(
    private prisma: PrismaService,
    private sender: GrammySender,
  ) {}

  botToken(): string {
    return process.env.TELEGRAM_BOT_TOKEN?.trim() ?? '';
  }

  checkInitData(initData: string | undefined, now = Date.now()): Extract<InitDataResult, { ok: true }> {
    const result = validateInitData(initData, this.botToken(), now);
    if (!result.ok) {
      throw new UnauthorizedException({
        statusCode: 401,
        code: result.reason === 'expired' ? 'telegram_initdata_expired' : 'telegram_initdata_invalid',
        message: 'Telegram login data is not valid.',
      });
    }
    return result;
  }

  async userByTelegram(telegramId: bigint) {
    return this.prisma.user.findUnique({
      where: { telegramId },
      include: { targetLanguages: true },
    });
  }

  async pending(telegramId: bigint) {
    return this.prisma.telegramPendingSignup.findUnique({ where: { telegramId } });
  }

  async rememberVisitor(input: {
    telegramId: bigint;
    firstName: string;
    lastName: string;
    username?: string | null;
  }) {
    return this.prisma.telegramPendingSignup.upsert({
      where: { telegramId: input.telegramId },
      create: {
        telegramId: input.telegramId,
        firstName: input.firstName,
        lastName: input.lastName,
        username: input.username ?? null,
      },
      update: {
        firstName: input.firstName,
        lastName: input.lastName,
        username: input.username ?? null,
      },
    });
  }

  /** Linked accounts use the saved profile language. Everyone else is Uzbek until they tap the keyboard. */
  async botLocaleFor(telegramId: bigint): Promise<BotLocale> {
    const user = await this.prisma.user.findUnique({ where: { telegramId } });
    if (user && !user.deletedAt && user.uiLanguage) return botLocale(user.uiLanguage);
    const row = await this.pending(telegramId);
    return botLocale(row?.locale ?? 'uz');
  }

  /** Saves the choice on the Telegram id and on the linked account, so the bot and the mini app match. */
  async setBotLocale(telegramId: bigint, locale: BotLocale) {
    await this.prisma.telegramPendingSignup.upsert({
      where: { telegramId },
      create: { telegramId, locale, firstName: '', lastName: '' },
      update: { locale },
    });
    const user = await this.prisma.user.findUnique({ where: { telegramId } });
    if (user && !user.deletedAt) {
      await this.prisma.user.update({ where: { id: user.id }, data: { uiLanguage: locale } });
    }
  }

  /**
   * Saves a shared contact only when contact.user_id is the sender.
   * Returns 'mismatch' without writing, or 'taken' when the number is already on a user.
   */
  async acceptContact(input: {
    fromId: number;
    contactUserId: number | undefined;
    phone: string;
    firstName: string;
    lastName: string;
    username?: string | null;
    locale: BotLocale;
  }): Promise<'saved' | 'mismatch' | 'taken' | 'invalid'> {
    if (input.contactUserId == null || input.contactUserId !== input.fromId) return 'mismatch';
    const phone = normalizePhone(input.phone);
    if (!phone) return 'invalid';
    const owner = await this.prisma.user.findUnique({ where: { phone }, select: { id: true } });
    if (owner) return 'taken';
    const telegramId = BigInt(input.fromId);
    await this.prisma.telegramPendingSignup.upsert({
      where: { telegramId },
      create: {
        telegramId,
        phone,
        phoneSharedAt: new Date(),
        firstName: input.firstName,
        lastName: input.lastName,
        username: input.username ?? null,
      },
      update: { phone, phoneSharedAt: new Date(), firstName: input.firstName, lastName: input.lastName },
    });
    return 'saved';
  }

  phoneTakenReply(locale: BotLocale) {
    return {
      text: phoneTakenHtml(locale),
      rows: [[{ text: botButtons(locale).login, webApp: miniAppUrl('/login', locale) }]],
    };
  }

  /**
   * Sends a 6-digit sign-up code to this Telegram user.
   * The phone must already be on the pending row. A second call inside 60s is refused.
   */
  async sendSignupCode(initData: string): Promise<{ sent: true; resendIn: 60 }> {
    const checked = this.checkInitData(initData);
    const telegramId = BigInt(checked.user.id);
    const pending = await this.pending(telegramId);
    if (!pending?.phone || !pending.phoneSharedAt) {
      throw new BadRequestException({ code: 'telegram_phone_required', message: 'share phone first' });
    }
    const takenPhone = await this.prisma.user.findUnique({ where: { phone: pending.phone }, select: { id: true } });
    if (takenPhone) {
      throw new ConflictException({ statusCode: 409, code: 'PHONE_ALREADY_REGISTERED', message: 'This phone number is already registered.' });
    }
    const locale = await this.botLocaleFor(telegramId);
    if (pending.codeSentAt && Date.now() - pending.codeSentAt.getTime() < RESEND_COOLDOWN_MS) {
      throw new HttpException(
        { statusCode: 429, code: 'telegram_code_resend_cooldown', message: resendCooldownText(locale) },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const code = randomLoginCode();
    const now = new Date();
    await this.prisma.telegramPendingSignup.update({
      where: { telegramId },
      data: {
        codeHash: hashLoginCode(code, signupCodeId(telegramId)),
        codeExpiresAt: new Date(now.getTime() + CODE_TTL_MS),
        codeAttempts: 0,
        codeSentAt: now,
      },
    });
    const signup = applyCustomEmoji(signupCodeText(locale, code), CODE_EMOJI_KEYS);
    await this.sender.send(telegramId, signup.text, undefined, undefined, signup.entities);
    return { sent: true, resendIn: 60 };
  }

  /** Checks the sign-up code. Does not clear it; register clears it after the user exists. */
  async verifySignupCode(telegramId: bigint, code: string | undefined | null) {
    const digits = (code ?? '').replace(/\D/g, '');
    if (digits.length !== 6) {
      throw new BadRequestException({ code: 'telegram_code_invalid', message: codeErrorText('uz', 'invalid') });
    }
    const row = await this.pending(telegramId);
    const attempts = row?.codeAttempts ?? 0;
    if (!row?.codeHash || !row.codeExpiresAt || row.codeExpiresAt.getTime() <= Date.now() || attempts >= MAX_CODE_ATTEMPTS) {
      throw new BadRequestException({ code: 'telegram_code_expired', message: codeErrorText('uz', 'expired') });
    }
    if (!codeMatches(digits, signupCodeId(telegramId), row.codeHash)) {
      const next = attempts + 1;
      await this.prisma.telegramPendingSignup.update({
        where: { telegramId },
        data: { codeAttempts: next },
      });
      if (next >= MAX_CODE_ATTEMPTS) {
        throw new BadRequestException({ code: 'telegram_code_expired', message: codeErrorText('uz', 'expired') });
      }
      throw new BadRequestException({ code: 'telegram_code_invalid', message: codeErrorText('uz', 'invalid') });
    }
  }

  async clearSignupCode(telegramId: bigint) {
    await this.prisma.telegramPendingSignup.update({
      where: { telegramId },
      data: { codeHash: null, codeExpiresAt: null, codeAttempts: 0, codeSentAt: null },
    }).catch((error: { code?: string }) => {
      if (error?.code !== 'P2025') throw error;
    });
  }

  async createCodeChallenge(input: {
    userId: string;
    phone: string;
    purpose: ChallengePurpose;
    userAgent?: string;
    ip?: string;
    locale?: BotLocale;
    telegramId: bigint;
  }): Promise<CodeChallengeResult> {
    const id = randomUUID();
    const code = randomLoginCode();
    const now = new Date();
    await this.prisma.telegramLoginChallenge.create({
      data: {
        id,
        userId: input.userId,
        kind: 'code',
        purpose: input.purpose,
        codeHash: hashLoginCode(code, id),
        status: 'pending',
        attempts: 0,
        userAgent: input.userAgent?.slice(0, 512) ?? null,
        ip: input.ip?.slice(0, 64) ?? null,
        expiresAt: new Date(now.getTime() + CODE_TTL_MS),
        lastSentAt: now,
      },
    });
    const locale = input.locale ?? 'uz';
    const labels = botButtons(locale);
    const loginCode = applyCustomEmoji(loginCodeHtml(locale, code), CODE_EMOJI_KEYS);
    const sent = await this.sender.send(
      input.telegramId,
      loginCode.text,
      [[{ text: labels.deny, callback: `no:${id}` }]],
      undefined,
      loginCode.entities,
    );
    if (sent.status === 'blocked') await this.markBlocked(input.userId);
    const masked = maskPhone(input.phone);
    if (!masked) throw new BadRequestException('Phone number is not valid.');
    return { step: 'telegram_code', challengeId: id, maskedPhone: masked, purpose: input.purpose };
  }

  async resendCode(challengeId: string, locale: BotLocale = 'uz') {
    const row = await this.prisma.telegramLoginChallenge.findUnique({ where: { id: challengeId }, include: { user: true } });
    if (!row || row.kind !== 'code' || !row.user) {
      throw new BadRequestException({ code: 'telegram_code_expired', message: codeErrorText(locale, 'expired') });
    }
    if (row.status !== 'pending' || row.expiresAt.getTime() <= Date.now()) {
      await this.expire(row.id);
      throw new BadRequestException({ code: 'telegram_code_expired', message: codeErrorText(locale, 'expired') });
    }
    if (row.lastSentAt && Date.now() - row.lastSentAt.getTime() < RESEND_COOLDOWN_MS) {
      throw new HttpException(
        { statusCode: 429, code: 'telegram_code_resend_cooldown', message: resendCooldownText(locale) },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (!row.user.telegramId) {
      throw new BadRequestException({ code: 'telegram_code_expired', message: codeErrorText(locale, 'expired') });
    }
    const code = randomLoginCode();
    const now = new Date();
    await this.prisma.telegramLoginChallenge.update({
      where: { id: row.id },
      data: {
        codeHash: hashLoginCode(code, row.id),
        attempts: 0,
        expiresAt: new Date(now.getTime() + CODE_TTL_MS),
        lastSentAt: now,
      },
    });
    const userLocale = botLocale(row.user.uiLanguage);
    const resent = applyCustomEmoji(loginCodeHtml(userLocale, code), CODE_EMOJI_KEYS);
    const sent = await this.sender.send(
      row.user.telegramId,
      resent.text,
      [[{ text: botButtons(userLocale).deny, callback: `no:${row.id}` }]],
      undefined,
      resent.entities,
    );
    if (sent.status === 'blocked') await this.markBlocked(row.user.id);
    return { sent: true, challengeId: row.id };
  }

  async verifyCode(challengeId: string, code: string, purpose: ChallengePurpose) {
    const row = await this.prisma.telegramLoginChallenge.findUnique({ where: { id: challengeId } });
    if (!row || row.kind !== 'code' || !row.userId) {
      throw new BadRequestException({ code: 'telegram_code_expired', message: codeErrorText('uz', 'expired') });
    }
    if (row.purpose !== purpose) {
      throw new BadRequestException({ code: 'telegram_code_invalid', message: codeErrorText('uz', 'invalid') });
    }
    if (row.status === 'denied') {
      throw new UnauthorizedException({ code: 'telegram_code_denied', message: codeErrorText('uz', 'invalid') });
    }
    if (row.status !== 'pending' || row.expiresAt.getTime() <= Date.now() || row.attempts >= MAX_CODE_ATTEMPTS) {
      await this.expire(row.id);
      throw new BadRequestException({ code: 'telegram_code_expired', message: codeErrorText('uz', 'expired') });
    }
    const normalized = code.replace(/\D/g, '');
    if (!codeMatches(normalized, row.id, row.codeHash)) {
      const attempts = row.attempts + 1;
      await this.prisma.telegramLoginChallenge.update({
        where: { id: row.id },
        data: attempts >= MAX_CODE_ATTEMPTS ? { attempts, status: 'expired' } : { attempts },
      });
      if (attempts >= MAX_CODE_ATTEMPTS) {
        throw new BadRequestException({ code: 'telegram_code_expired', message: codeErrorText('uz', 'expired') });
      }
      throw new UnauthorizedException({ code: 'telegram_code_invalid', message: codeErrorText('uz', 'invalid') });
    }
    const claimed = await this.prisma.telegramLoginChallenge.updateMany({
      where: { id: row.id, status: 'pending' },
      data: { status: 'used' },
    });
    if (claimed.count !== 1) {
      throw new BadRequestException({ code: 'telegram_code_expired', message: codeErrorText('uz', 'expired') });
    }
    return { userId: row.userId, purpose };
  }

  async createLinkChallenge(input: { userAgent?: string; ip?: string }) {
    const token = randomLinkToken();
    const now = new Date();
    await this.prisma.telegramLoginChallenge.create({
      data: {
        kind: 'link',
        purpose: 'login',
        token,
        status: 'pending',
        userAgent: input.userAgent?.slice(0, 512) ?? null,
        ip: input.ip?.slice(0, 64) ?? null,
        expiresAt: new Date(now.getTime() + CODE_TTL_MS),
        lastSentAt: now,
      },
    });
    return { token, deepLink: botDeepLink(`login_${token}`) };
  }

  async pollLink(token: string): Promise<{ status: 'pending' | 'approved' | 'denied' | 'expired' }> {
    const row = await this.prisma.telegramLoginChallenge.findUnique({ where: { token } });
    if (!row || row.kind !== 'link') return { status: 'expired' };
    if (row.status === 'used' || row.status === 'approved') return { status: 'approved' };
    if (row.status === 'denied') return { status: 'denied' };
    if (row.status === 'expired' || row.expiresAt.getTime() <= Date.now()) {
      await this.expire(row.id);
      return { status: 'expired' };
    }
    return { status: 'pending' };
  }

  /** Marks an approved link used. A second call fails. */
  async consumeLink(token: string): Promise<string> {
    const row = await this.prisma.telegramLoginChallenge.findUnique({ where: { token } });
    if (!row || row.kind !== 'link') {
      throw new BadRequestException({ code: 'telegram_link_expired', message: 'This sign-in link has expired.' });
    }
    if (row.expiresAt.getTime() <= Date.now() && row.status === 'pending') {
      await this.expire(row.id);
      throw new BadRequestException({ code: 'telegram_link_expired', message: 'This sign-in link has expired.' });
    }
    if (row.status === 'denied') {
      throw new UnauthorizedException({ code: 'telegram_link_denied', message: 'This sign-in was declined.' });
    }
    if (row.status === 'expired' || row.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException({ code: 'telegram_link_expired', message: 'This sign-in link has expired.' });
    }
    if (row.status === 'used') {
      throw new ConflictException({ code: 'telegram_link_used', message: 'This sign-in link was already used.' });
    }
    if (row.status !== 'approved' || !row.userId) {
      throw new BadRequestException({ code: 'telegram_link_pending', message: 'Confirm the sign-in in Telegram first.' });
    }
    const claimed = await this.prisma.telegramLoginChallenge.updateMany({
      where: { id: row.id, status: 'approved' },
      data: { status: 'used' },
    });
    if (claimed.count !== 1) {
      throw new ConflictException({ code: 'telegram_link_used', message: 'This sign-in link was already used.' });
    }
    return row.userId;
  }

  async approve(challengeId: string, telegramId: bigint): Promise<'approved' | 'unlinked' | 'stale'> {
    const row = await this.loadOpen(challengeId);
    if (!row || row.kind !== 'link') return 'stale';
    const user = await this.userByTelegram(telegramId);
    if (!user || user.deletedAt) return 'unlinked';
    const claimed = await this.prisma.telegramLoginChallenge.updateMany({
      where: { id: row.id, status: 'pending' },
      data: { status: 'approved', userId: user.id },
    });
    return claimed.count === 1 ? 'approved' : 'stale';
  }

  async deny(challengeId: string, telegramId: bigint): Promise<'denied' | 'stale' | 'forbidden'> {
    const row = await this.loadOpen(challengeId);
    if (!row) return 'stale';
    if (row.kind === 'code') {
      if (!row.userId) return 'stale';
      const owner = await this.prisma.user.findUnique({ where: { id: row.userId }, select: { telegramId: true } });
      if (!owner?.telegramId || owner.telegramId !== telegramId) return 'forbidden';
    }
    const claimed = await this.prisma.telegramLoginChallenge.updateMany({
      where: { id: row.id, status: 'pending' },
      data: { status: 'denied' },
    });
    return claimed.count === 1 ? 'denied' : 'stale';
  }

  async challengeForToken(token: string) {
    return this.prisma.telegramLoginChallenge.findUnique({ where: { token }, include: { user: true } });
  }

  confirmCard(locale: BotLocale, accountName: string, userAgent: string | null, challengeId: string) {
    const labels = botButtons(locale);
    return {
      text: loginConfirmHtml(locale, accountName, parseDevice(userAgent)),
      rows: [[
        { text: labels.approve, callback: `ok:${challengeId}` },
        { text: labels.deny, callback: `no:${challengeId}` },
      ]],
    };
  }

  notLinkedCard(locale: BotLocale) {
    return {
      text: notLinkedHtml(locale),
      rows: [[{ text: botButtons(locale).signup, webApp: miniAppUrl('/signup', locale) }]],
    };
  }

  deniedCard(locale: BotLocale) {
    return {
      text: passwordMayBeKnownHtml(locale),
      rows: [[{ text: botButtons(locale).reset, url: learnerForgotUrl() }]],
    };
  }

  async clearBlocked(userId: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { telegramBotBlockedAt: null } });
  }

  async markBlocked(userId: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { telegramBotBlockedAt: new Date() } });
  }

  async deletePending(telegramId: bigint) {
    await this.prisma.telegramPendingSignup.delete({ where: { telegramId } }).catch((error: { code?: string }) => {
      if (error?.code !== 'P2025') throw error;
    });
  }

  private async loadOpen(id: string) {
    const row = await this.prisma.telegramLoginChallenge.findUnique({ where: { id } });
    if (!row || row.status !== 'pending') return null;
    if (row.expiresAt.getTime() <= Date.now()) {
      await this.expire(row.id);
      return null;
    }
    return row;
  }

  private async expire(id: string) {
    await this.prisma.telegramLoginChallenge.updateMany({
      where: { id, status: 'pending' },
      data: { status: 'expired' },
    });
  }
}

export type ChallengeRow = Prisma.TelegramLoginChallengeGetPayload<{ include: { user: true } }>;
