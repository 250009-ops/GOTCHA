import * as assert from 'node:assert/strict';
import { createHmac } from 'crypto';
import { ConflictException, HttpException } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { TelegramRegisterDto } from '../auth/dto/auth.dto';
import { CODE_TTL_MS, hashLoginCode } from './code-hash';
import { CUSTOM_EMOJI_FALLBACK } from './custom-emoji';
import { TelegramLoginService } from './telegram-login.service';
import type { GrammySender } from './telegram-api';

delete process.env.DEV_AUTH_ANY_CREDENTIAL;
delete process.env.TELEGRAM_CUSTOM_EMOJI_IDS;
process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_ID = 42n;

function signInitData(fields: Record<string, string>, token: string) {
  const pairs = Object.entries(fields).map(([key, value]) => `${key}=${value}`).sort();
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  const hash = createHmac('sha256', secret).update(pairs.join('\n')).digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
}

function initData(language?: string) {
  const user: Record<string, unknown> = { id: 42, first_name: 'Dilnoza', last_name: 'Karimova' };
  if (language) user.language_code = language;
  return signInitData({
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify(user),
  }, TOKEN);
}

function codeFrom(text: string) {
  const shown = text.match(/(\d{3}) (\d{3})/);
  assert.ok(shown, 'sign-up code was not sent');
  return `${shown[1]}${shown[2]}`;
}

async function expectHttp(run: () => Promise<unknown>, status: number, code: string) {
  await assert.rejects(run, (error: unknown) => {
    assert.ok(error instanceof HttpException);
    assert.equal(error.getStatus(), status);
    const body = error.getResponse() as { code?: string };
    assert.equal(body.code, code);
    return true;
  });
}

function world() {
  const users: Array<Record<string, unknown>> = [];
  const pending: Array<Record<string, unknown>> = [];
  const refresh: Array<Record<string, unknown>> = [];
  const sent: Array<{ chatId: bigint; text: string }> = [];
  const match = (row: Record<string, unknown>, where: Record<string, unknown>) =>
    Object.entries(where).every(([key, value]) => row[key] === value);
  const prisma = {
    user: {
      findUnique: async ({ where }: { where: Record<string, unknown> }) =>
        users.find((row) => match(row, where)) ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const targets = (data.targetLanguages as { create?: unknown[] } | undefined)?.create ?? [];
        const row = {
          id: 'signed-up',
          email: null,
          streakCount: 0,
          emailVerifiedAt: null,
          avatarUrl: null,
          deletedAt: null,
          ...data,
          targetLanguages: targets,
        };
        users.push(row);
        return row;
      },
    },
    adminUser: { findUnique: async () => null },
    authRefreshToken: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        refresh.push(data);
        return data;
      },
    },
    auditLog: { create: async () => ({}) },
    subscriptionPlan: { findUnique: async () => null },
    languageCatalog: {
      upsert: async () => ({ code: 'uz' }),
      updateMany: async () => ({ count: 0 }),
      findMany: async () => [{ code: 'uz' }, { code: 'en' }],
    },
    platformSetting: {
      findUnique: async () => ({ key: 'ready' }),
      upsert: async () => ({}),
    },
    telegramPendingSignup: {
      findUnique: async ({ where }: { where: { telegramId: bigint } }) =>
        pending.find((row) => row.telegramId === where.telegramId) ?? null,
      update: async ({ where, data }: { where: { telegramId: bigint }; data: Record<string, unknown> }) => {
        const row = pending.find((item) => item.telegramId === where.telegramId);
        if (!row) {
          const error = new Error('missing') as Error & { code?: string };
          error.code = 'P2025';
          throw error;
        }
        Object.assign(row, data);
        return row;
      },
      delete: async ({ where }: { where: { telegramId: bigint } }) => {
        const index = pending.findIndex((row) => row.telegramId === where.telegramId);
        if (index < 0) {
          const error = new Error('missing') as Error & { code?: string };
          error.code = 'P2025';
          throw error;
        }
        return pending.splice(index, 1)[0];
      },
    },
  };
  const sender = {
    send: async (chatId: bigint, text: string) => {
      sent.push({ chatId, text });
      return { status: 'ok' as const };
    },
  };
  return { prisma, users, pending, refresh, sent, sender };
}

function seedPending(bag: ReturnType<typeof world>) {
  bag.pending.push({
    telegramId: TELEGRAM_ID,
    phone: '+998901112233',
    phoneSharedAt: new Date(),
    firstName: 'Dilnoza',
    lastName: 'Karimova',
    username: 'dilnoza',
    codeHash: null,
    codeExpiresAt: null,
    codeAttempts: 0,
    codeSentAt: null,
  });
}

function services(bag: ReturnType<typeof world>) {
  const telegram = new TelegramLoginService(bag.prisma as never, bag.sender as unknown as GrammySender);
  const auth = new AuthService(
    bag.prisma as never,
    { signAsync: async () => 'access-token' } as never,
    {} as never,
    {} as never,
    { get: () => undefined } as never,
    telegram,
  );
  return { telegram, auth };
}

function registerDto(code?: string): TelegramRegisterDto {
  return {
    initData: initData('uz'),
    fullName: 'Dilnoza Karimova',
    password: 'correct-horse',
    code,
    nativeLanguage: 'uz',
    targetLanguages: ['en'],
    acceptTerms: true,
    acceptAi: true,
  } as TelegramRegisterDto;
}

async function main() {
  const fresh = world();
  const noPhone = services(fresh);
  fresh.pending.push({ telegramId: TELEGRAM_ID, phone: null, phoneSharedAt: null, codeAttempts: 0 });
  await expectHttp(() => noPhone.telegram.sendSignupCode(initData('uz')), 400, 'telegram_phone_required');
  await assert.rejects(
    () => noPhone.telegram.sendSignupCode(initData('uz')),
    (error: unknown) => {
      assert.ok(error instanceof HttpException);
      assert.equal((error.getResponse() as { message?: string }).message, 'share phone first');
      return true;
    },
  );

  const taken = world();
  seedPending(taken);
  taken.users.push({ id: 'owner', phone: '+998901112233' });
  await expectHttp(() => services(taken).telegram.sendSignupCode(initData('uz')), 409, 'PHONE_ALREADY_REGISTERED');
  await assert.rejects(
    () => services(taken).telegram.sendSignupCode(initData('uz')),
    (error: unknown) => error instanceof ConflictException,
  );

  const bag = world();
  seedPending(bag);
  const { telegram, auth } = services(bag);
  const sent = await telegram.sendSignupCode(initData());
  assert.deepEqual(sent, { sent: true, resendIn: 60 });
  assert.equal(bag.sent.length, 1);
  assert.equal(bag.sent[0].chatId, TELEGRAM_ID);
  const good = codeFrom(bag.sent[0].text);
  assert.equal(
    bag.sent[0].text,
    `${CUSTOM_EMOJI_FALLBACK.key} Gotcha roʻyxatdan oʻtish kodi: ${good.slice(0, 3)} ${good.slice(3)} — 5 daqiqa amal qiladi. Uni hech kimga bermang.`,
  );
  const row = bag.pending[0];
  assert.equal(row.codeHash, hashLoginCode(good, `signup:${TELEGRAM_ID.toString()}`));
  assert.notEqual(row.codeHash, good);
  assert.equal(row.codeAttempts, 0);
  assert.ok(row.codeExpiresAt instanceof Date);
  const expiresIn = (row.codeExpiresAt as Date).getTime() - Date.now();
  assert.ok(expiresIn > CODE_TTL_MS - 5_000 && expiresIn <= CODE_TTL_MS);

  await expectHttp(() => telegram.sendSignupCode(initData()), 429, 'telegram_code_resend_cooldown');
  assert.equal(bag.sent.length, 1);

  row.codeSentAt = new Date(Date.now() - 61_000);
  row.codeAttempts = 3;
  const again = await telegram.sendSignupCode(initData('ru'));
  assert.deepEqual(again, { sent: true, resendIn: 60 });
  assert.equal(bag.sent.length, 2);
  assert.match(bag.sent[1].text, new RegExp(`^${CUSTOM_EMOJI_FALLBACK.key} Код регистрации Gotcha: \\d{3} \\d{3} — действует 5 минут\\. Никому его не сообщайте\\.$`));
  assert.equal(row.codeAttempts, 0);
  const resent = codeFrom(bag.sent[1].text);

  const wrong = resent === '000000' ? '111111' : '000000';
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    await expectHttp(() => auth.registerTelegram(registerDto(wrong)), 400, 'telegram_code_invalid');
    assert.equal(bag.users.length, 0);
    assert.equal(row.codeAttempts, attempt);
  }
  await expectHttp(() => auth.registerTelegram(registerDto(wrong)), 400, 'telegram_code_expired');
  assert.equal(row.codeAttempts, 5);
  await expectHttp(() => auth.registerTelegram(registerDto(resent)), 400, 'telegram_code_expired');
  assert.equal(bag.users.length, 0);

  const aged = world();
  seedPending(aged);
  const agedServices = services(aged);
  await agedServices.telegram.sendSignupCode(initData('en'));
  assert.match(aged.sent[0].text, new RegExp(`^${CUSTOM_EMOJI_FALLBACK.key} Gotcha sign-up code: \\d{3} \\d{3} — valid for 5 minutes\\. Do not share it with anyone\\.$`));
  const agedCode = codeFrom(aged.sent[0].text);
  aged.pending[0].codeExpiresAt = new Date(Date.now() - 1000);
  await expectHttp(() => agedServices.auth.registerTelegram(registerDto(agedCode)), 400, 'telegram_code_expired');
  assert.equal(aged.users.length, 0);

  const ok = world();
  seedPending(ok);
  const okServices = services(ok);
  await okServices.telegram.sendSignupCode(initData('uz'));
  const okCode = codeFrom(ok.sent[0].text);
  const session = await okServices.auth.registerTelegram(registerDto(okCode));
  assert.equal(session.accessToken, 'access-token');
  assert.equal(ok.users.length, 1);
  assert.equal(ok.users[0].phone, '+998901112233');
  assert.equal(ok.users[0].telegramId, TELEGRAM_ID);
  assert.equal(ok.pending.length, 0);
  assert.equal(ok.refresh.length, 1);
  await expectHttp(() => okServices.auth.registerTelegram(registerDto(okCode)), 400, 'telegram_phone_required');
  assert.equal(ok.users.length, 1);

  const bare = world();
  seedPending(bare);
  const bareServices = services(bare);
  await bareServices.telegram.sendSignupCode(initData('uz'));
  await expectHttp(() => bareServices.auth.registerTelegram(registerDto(undefined)), 400, 'telegram_code_invalid');
  assert.equal(bare.users.length, 0);
  assert.equal(bare.pending.length, 1);

  console.log('telegram-signup-code.test.ts ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
