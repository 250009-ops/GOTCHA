import * as assert from 'node:assert/strict';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { TelegramLoginService } from '../telegram/telegram-login.service';
import type { GrammySender } from '../telegram/telegram-api';

delete process.env.DEV_AUTH_ANY_CREDENTIAL;

function store() {
  const users: Array<Record<string, unknown>> = [];
  const challenges: Array<Record<string, unknown>> = [];
  const refresh: Array<Record<string, unknown>> = [];
  const match = (row: Record<string, unknown>, where: Record<string, unknown>) =>
    Object.entries(where).every(([key, value]) => row[key] === value);
  const prisma = {
    user: {
      findUnique: async ({ where }: { where: Record<string, unknown> }) =>
        users.find((row) => match(row, where)) ?? null,
    },
    adminUser: { findUnique: async () => null },
    authRefreshToken: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        refresh.push(data);
        return data;
      },
    },
    telegramLoginChallenge: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: data.id ?? randomUUID(), attempts: 0, status: 'pending', ...data };
        challenges.push(row);
        return row;
      },
    },
  };
  const sender = {
    send: async () => ({ status: 'ok' as const }),
  };
  return { prisma, users, refresh, challenges, sender };
}

async function main() {
  const bag = store();
  const passwordHash = await bcrypt.hash('correct-horse', 4);
  bag.users.push({
    id: 'email-user',
    email: 'ada@gotcha.test',
    passwordHash,
    emailVerifiedAt: new Date(),
    phoneVerifiedAt: null,
    deletedAt: null,
    phone: '+998901110011',
    telegramId: 7n,
    targetLanguages: [],
  });
  bag.users.push({
    id: 'phone-user',
    email: null,
    phone: '+998901234567',
    passwordHash,
    emailVerifiedAt: null,
    phoneVerifiedAt: new Date(),
    deletedAt: null,
    telegramId: 42n,
    uiLanguage: 'uz',
    targetLanguages: [],
  });
  const telegram = new TelegramLoginService(bag.prisma as never, bag.sender as unknown as GrammySender);
  const auth = new AuthService(
    bag.prisma as never,
    { signAsync: async () => 'access-token' } as never,
    {} as never,
    {} as never,
    { get: () => undefined } as never,
    telegram,
  );

  const byEmail = await auth.login({ email: 'ada@gotcha.test', password: 'correct-horse' });
  assert.equal(byEmail.accessToken, 'access-token');
  assert.equal('step' in byEmail, false);
  const byIdentifier = await auth.login({ identifier: 'Ada@gotcha.test', password: 'correct-horse' });
  assert.equal(byIdentifier.accessToken, 'access-token');
  assert.equal(bag.refresh.length, 2);

  await assert.rejects(
    () => auth.login({ email: 'ada@gotcha.test', password: 'wrong-password' }),
    (error: unknown) => error instanceof UnauthorizedException && error.message === 'Invalid credentials',
  );
  await assert.rejects(
    () => auth.login({ identifier: '+998900000000', password: 'correct-horse' }),
    (error: unknown) => error instanceof UnauthorizedException && error.message === 'Invalid credentials',
  );

  const before = bag.refresh.length;
  const phone = await auth.login({ identifier: '+998 90 123-45-67', password: 'correct-horse' });
  assert.equal(phone.step, 'telegram_code');
  assert.equal(phone.maskedPhone, '+998 90 *** ** 67');
  assert.equal(bag.refresh.length, before);

  bag.users.push({
    id: 'phone-without-telegram',
    email: null,
    phone: '+998909998877',
    passwordHash,
    emailVerifiedAt: null,
    phoneVerifiedAt: new Date(),
    deletedAt: null,
    telegramId: null,
    uiLanguage: 'uz',
    targetLanguages: [],
  });
  const challengesBefore = bag.challenges.length;
  await assert.rejects(
    () => auth.login({ identifier: '998 90 999-88-77', password: 'correct-horse' }),
    (error: unknown) => error instanceof UnauthorizedException && error.message === 'Invalid credentials',
  );
  assert.equal(bag.refresh.length, before);
  assert.equal(bag.challenges.length, challengesBefore);
  console.log('phoneAccountWithoutTelegramIdIsRefused ok');

  console.log('auth-telegram.test.ts ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
