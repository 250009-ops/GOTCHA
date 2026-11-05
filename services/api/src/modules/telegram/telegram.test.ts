import * as assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'crypto';
import { BadRequestException, ConflictException, HttpException, UnauthorizedException } from '@nestjs/common';
import { webhookSecretOk } from './telegram.controller';
import { notificationStartApp } from './copy';
import { registerTelegramWebhook } from './register-webhook';
import { handleTelegramUpdate } from './telegram-updates';
import { TelegramLoginService } from './telegram-login.service';
import { validateInitData } from './init-data';
import { welcomeHtml } from './copy';
import type { GrammySender } from './telegram-api';

process.env.TELEGRAM_BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || 'GotchaBot';

function memory() {
  const users: Array<Record<string, unknown>> = [];
  const challenges: Array<Record<string, unknown>> = [];
  const pending: Array<Record<string, unknown>> = [];
  const sent: Array<{ chatId: bigint; text: string; rows?: unknown }> = [];
  const match = (row: Record<string, unknown>, where: Record<string, unknown>) =>
    Object.entries(where).every(([key, value]) => row[key] === value);
  const prisma = {
    user: {
      findUnique: async ({ where }: { where: Record<string, unknown> }) =>
        users.find((row) => match(row, where)) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = users.find((item) => item.id === where.id);
        if (row) Object.assign(row, data);
        return row;
      },
    },
    telegramLoginChallenge: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: data.id ?? randomUUID(), attempts: 0, userId: null, status: 'pending', ...data };
        challenges.push(row);
        return row;
      },
      findUnique: async ({ where, include }: { where: Record<string, unknown>; include?: { user?: boolean } }) => {
        const row = challenges.find((item) => match(item, where));
        if (!row) return null;
        if (include?.user) row.user = users.find((user) => user.id === row.userId) ?? null;
        return row;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = challenges.find((item) => item.id === where.id);
        if (row) Object.assign(row, data);
        return row;
      },
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        let count = 0;
        for (const row of challenges) {
          if (!match(row, where)) continue;
          Object.assign(row, data);
          count += 1;
        }
        return { count };
      },
    },
    telegramPendingSignup: {
      findUnique: async ({ where }: { where: { telegramId: bigint } }) =>
        pending.find((row) => row.telegramId === where.telegramId) ?? null,
      upsert: async ({ where, create, update }: { where: { telegramId: bigint }; create: Record<string, unknown>; update: Record<string, unknown> }) => {
        const row = pending.find((item) => item.telegramId === where.telegramId);
        if (row) {
          Object.assign(row, update);
          return row;
        }
        pending.push({ ...create });
        return create;
      },
    },
  };
  const sender = {
    send: async (chatId: bigint, text: string, rows?: unknown) => {
      sent.push({ chatId, text, rows });
      return { status: 'ok' as const };
    },
  };
  return { prisma, users, challenges, pending, sent, sender };
}

function signInitData(fields: Record<string, string>, token: string) {
  const pairs = Object.entries(fields).map(([key, value]) => `${key}=${value}`).sort();
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  const hash = createHmac('sha256', secret).update(pairs.join('\n')).digest('hex');
  const params = new URLSearchParams({ ...fields, hash });
  return params.toString();
}

function codeFrom(text: string) {
  const shown = text.match(/<b>(\d{3}) (\d{3})<\/b>/);
  assert.ok(shown, 'login code was not sent');
  return `${shown[1]}${shown[2]}`;
}

function buttons(rows: unknown): string[] {
  return ((rows as Array<Array<{ text: string }>>) ?? []).flat().map((button) => button.text);
}

async function main() {
  assert.equal(webhookSecretOk('top-secret', 'top-secret'), true);
  assert.equal(webhookSecretOk('nope', 'top-secret'), false);
  assert.equal(webhookSecretOk(undefined, 'top-secret'), false);
  assert.equal(webhookSecretOk('top-secret', ''), false);
  assert.equal(webhookSecretOk('', ''), false);

  const welcome = welcomeHtml('uz', 'Dilnoza');
  assert.match(welcome, /Assalomu alaykum, Dilnoza!/);
  assert.match(welcome, /Gotcha — kitob, maqola va yangiliklarni oʻqib til oʻrganish ilovasi/);
  assert.match(welcome, /Roʻyxatdan oʻtish uchun ism, Telegram raqamingiz va parol kifoya/);

  const token = 'test-bot-token';
  const now = Date.now();
  const valid = signInitData({
    auth_date: String(Math.floor(now / 1000)),
    user: JSON.stringify({ id: 7, first_name: 'Dilnoza' }),
  }, token);
  const parsed = validateInitData(valid, token, now);
  assert.equal(parsed.ok, true);
  if (parsed.ok) assert.equal(parsed.user.id, 7);
  const tampered = valid.replace(/hash=[0-9a-f]+/i, 'hash=ab');
  assert.equal(validateInitData(tampered, token, now).ok, false);
  assert.equal(validateInitData(tampered, token, now).ok === false && validateInitData(tampered, token, now).reason, 'tampered');
  const stale = signInitData({
    auth_date: String(Math.floor(now / 1000) - 25 * 60 * 60),
    user: JSON.stringify({ id: 7, first_name: 'Dilnoza' }),
  }, token);
  const expired = validateInitData(stale, token, now);
  assert.equal(expired.ok, false);
  if (!expired.ok) assert.equal(expired.reason, 'expired');

  const bag = memory();
  const login = new TelegramLoginService(bag.prisma as never, bag.sender as unknown as GrammySender);
  const mismatch = await login.acceptContact({
    fromId: 11,
    contactUserId: 99,
    phone: '+998901112233',
    firstName: 'Ali',
    lastName: '',
    locale: 'uz',
  });
  assert.equal(mismatch, 'mismatch');
  assert.equal(bag.pending.length, 0);

  bag.users.push({ id: 'owner', phone: '+998901112233' });
  const taken = await login.acceptContact({
    fromId: 11,
    contactUserId: 11,
    phone: '+998 90 111-22-33',
    firstName: 'Ali',
    lastName: '',
    locale: 'uz',
  });
  assert.equal(taken, 'taken');
  assert.equal(bag.pending.length, 0);

  const replies: Array<{ text: string; rows?: unknown }> = [];
  const send = async (message: { text: string; rows?: unknown }) => {
    replies.push(message);
  };
  bag.users.push({
    id: 'linked',
    displayName: 'Dilnoza Karimova',
    uiLanguage: 'uz',
    telegramId: 11n,
    deletedAt: null,
    phone: '+998907770011',
  });
  const link = await login.createLinkChallenge({ userAgent: 'Mozilla/5.0 Chrome/120 Windows' });
  await handleTelegramUpdate({
    message: { text: `/start login_${link.token}`, from: { id: 11, first_name: 'Dilnoza', language_code: 'uz' } },
  }, login, send);
  assert.equal(replies.length, 1);
  assert.match(replies[0].text, /Hisob: <b>Dilnoza Karimova<\/b>/);
  assert.match(replies[0].text, /Qurilma: <b>Chrome · Windows<\/b>/);
  assert.deepEqual(buttons(replies[0].rows), ['Tasdiqlash', 'Bu men emasman']);

  const challengeId = (bag.challenges.find((row) => row.token === link.token)?.id) as string;
  await handleTelegramUpdate({
    callback_query: { data: `ok:${challengeId}`, from: { id: 11, language_code: 'uz' } },
  }, login, send);
  assert.equal(bag.challenges.find((row) => row.id === challengeId)?.status, 'approved');
  assert.match(replies.at(-1)?.text ?? '', /Tasdiqlandi/);
  const polled = await login.pollLink(link.token);
  assert.equal(polled.status, 'approved');
  assert.equal(await login.consumeLink(link.token), 'linked');
  await assert.rejects(() => login.consumeLink(link.token), (error: unknown) => error instanceof ConflictException);

  const denied = await login.createLinkChallenge({ userAgent: 'Mozilla/5.0 Chrome/120 Windows' });
  const before = replies.length;
  await handleTelegramUpdate({
    message: { text: `/start login_${denied.token}`, from: { id: 11, first_name: 'Dilnoza', language_code: 'uz' } },
  }, login, send);
  const denyId = bag.challenges.find((row) => row.token === denied.token)?.id as string;
  await handleTelegramUpdate({
    callback_query: { data: `no:${denyId}`, from: { id: 11, language_code: 'uz' } },
  }, login, send);
  assert.equal(bag.challenges.find((row) => row.id === denyId)?.status, 'denied');
  assert.match(replies.at(-1)?.text ?? '', /Parolingiz boshqa odamga/);
  assert.deepEqual(buttons(replies.at(-1)?.rows), ['Parolni oʻzgartirish']);
  assert.equal((await login.pollLink(denied.token)).status, 'denied');
  assert.ok(replies.length > before);

  const unlinked = await login.createLinkChallenge({});
  const unlinkedReplies: Array<{ text: string; rows?: unknown }> = [];
  await handleTelegramUpdate({
    message: { text: `/start login_${unlinked.token}`, from: { id: 404, first_name: 'Yangi', language_code: 'uz' } },
  }, login, async (message) => { unlinkedReplies.push(message); });
  assert.match(unlinkedReplies[0].text, /ulanmagan/);
  assert.deepEqual(buttons(unlinkedReplies[0].rows), ['Roʻyxatdan oʻtish']);

  const expiring = await login.createLinkChallenge({});
  const expiringRow = bag.challenges.find((row) => row.token === expiring.token);
  assert.ok(expiringRow);
  expiringRow.expiresAt = new Date(Date.now() - 1000);
  assert.equal((await login.pollLink(expiring.token)).status, 'expired');

  const codeBag = memory();
  const codes = new TelegramLoginService(codeBag.prisma as never, codeBag.sender as unknown as GrammySender);
  codeBag.users.push({
    id: 'phone-user',
    telegramId: 55n,
    uiLanguage: 'uz',
    phone: '+998901234567',
    deletedAt: null,
  });
  const created = await codes.createCodeChallenge({
    userId: 'phone-user',
    phone: '+998901234567',
    purpose: 'login',
    telegramId: 55n,
    locale: 'uz',
  });
  assert.equal(created.step, 'telegram_code');
  assert.equal(created.maskedPhone, '+998 90 *** ** 67');
  const good = codeFrom(codeBag.sent[0].text);
  assert.deepEqual(buttons(codeBag.sent[0].rows), ['Bu men emasman']);
  const verified = await codes.verifyCode(created.challengeId, `${good.slice(0, 3)} ${good.slice(3)}`, 'login');
  assert.equal(verified.userId, 'phone-user');
  assert.equal(codeBag.challenges[0].status, 'used');

  const wrong = memory();
  const wrongLogin = new TelegramLoginService(wrong.prisma as never, wrong.sender as unknown as GrammySender);
  wrong.users.push({ id: 'phone-user', telegramId: 55n, uiLanguage: 'uz' });
  const wrongChallenge = await wrongLogin.createCodeChallenge({
    userId: 'phone-user', phone: '+998901234567', purpose: 'login', telegramId: 55n,
  });
  const real = codeFrom(wrong.sent[0].text);
  const bad = real === '000000' ? '111111' : '000000';
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    await assert.rejects(
      () => wrongLogin.verifyCode(wrongChallenge.challengeId, bad, 'login'),
      (error: unknown) => error instanceof UnauthorizedException,
    );
  }
  await assert.rejects(
    () => wrongLogin.verifyCode(wrongChallenge.challengeId, bad, 'login'),
    (error: unknown) => error instanceof BadRequestException,
  );
  assert.equal(wrong.challenges[0].status, 'expired');
  await assert.rejects(
    () => wrongLogin.verifyCode(wrongChallenge.challengeId, real, 'login'),
    (error: unknown) => error instanceof BadRequestException,
  );

  const aged = memory();
  const agedLogin = new TelegramLoginService(aged.prisma as never, aged.sender as unknown as GrammySender);
  aged.users.push({ id: 'phone-user', telegramId: 55n, uiLanguage: 'uz' });
  const agedChallenge = await agedLogin.createCodeChallenge({
    userId: 'phone-user', phone: '+998901234567', purpose: 'login', telegramId: 55n,
  });
  aged.challenges[0].expiresAt = new Date(Date.now() - 1000);
  await assert.rejects(
    () => agedLogin.verifyCode(agedChallenge.challengeId, '123456', 'login'),
    (error: unknown) => error instanceof BadRequestException,
  );

  const resend = memory();
  const resendLogin = new TelegramLoginService(resend.prisma as never, resend.sender as unknown as GrammySender);
  resend.users.push({ id: 'phone-user', telegramId: 55n, uiLanguage: 'uz' });
  const resendChallenge = await resendLogin.createCodeChallenge({
    userId: 'phone-user', phone: '+998901234567', purpose: 'login', telegramId: 55n,
  });
  await assert.rejects(
    () => resendLogin.resendCode(resendChallenge.challengeId),
    (error: unknown) => error instanceof HttpException && error.getStatus() === 429,
  );
  resend.challenges[0].lastSentAt = new Date(Date.now() - 61_000);
  const again = await resendLogin.resendCode(resendChallenge.challengeId);
  assert.equal(again.sent, true);
  assert.equal(resend.sent.length, 2);
  assert.equal(resend.challenges[0].attempts, 0);

  assert.equal(notificationStartApp('content', 'book-1'), 'book_book-1');
  assert.equal(notificationStartApp('goal'), 'read');
  assert.equal(notificationStartApp('streak'), 'read');
  assert.equal(notificationStartApp('vocab'), 'mashq');
  assert.equal(notificationStartApp('message', 'chat-9'), 'chat_chat-9');

  const calls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request) => {
    calls.push(String(input));
    return { ok: true } as Response;
  }) as typeof fetch;
  const savedFlag = process.env.TELEGRAM_MENU_BUTTON_ENABLED;
  try {
    delete process.env.TELEGRAM_MENU_BUTTON_ENABLED;
    const off = await registerTelegramWebhook({
      TELEGRAM_BOT_TOKEN: 'test-token',
      TELEGRAM_WEBHOOK_SECRET: 'test-secret',
      TELEGRAM_WEBHOOK_URL: 'https://gotchaa.uz/api/v1/telegram/webhook',
      TELEGRAM_MINI_APP_URL: 'https://gotchaa.uz/tg',
    });
    assert.equal(off, 'registered');
    assert.equal(calls.some((url) => url.includes('setWebhook')), true);
    assert.equal(calls.some((url) => url.includes('setChatMenuButton')), false);
    calls.length = 0;
    const on = await registerTelegramWebhook({
      TELEGRAM_BOT_TOKEN: 'test-token',
      TELEGRAM_WEBHOOK_SECRET: 'test-secret',
      TELEGRAM_WEBHOOK_URL: 'https://gotchaa.uz/api/v1/telegram/webhook',
      TELEGRAM_MINI_APP_URL: 'https://gotchaa.uz/tg',
      TELEGRAM_MENU_BUTTON_ENABLED: 'true',
    });
    assert.equal(on, 'registered');
    assert.equal(calls.some((url) => url.includes('setChatMenuButton')), true);
  } finally {
    globalThis.fetch = originalFetch;
    if (savedFlag === undefined) delete process.env.TELEGRAM_MENU_BUTTON_ENABLED;
    else process.env.TELEGRAM_MENU_BUTTON_ENABLED = savedFlag;
  }

  console.log('telegram.test.ts ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
