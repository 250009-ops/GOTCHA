/**
 * Settings fixes (SET-1 .. SET-23): preference DTO whitelist, profile allow-list,
 * logout revocation, and the shared defaults across DB, API client and Reader.
 */
import * as assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BadRequestException, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { localizeApiError, PAGE_QUIZ_BANKS_LIVE } from '@gotcha/shared';
import { UpdatePreferencesDto, UpdateProfileDto } from './dto/users.dto';
import { toPublicProfile } from './public-profile';
import { AuthService } from '../auth/auth.service';

const root = join(__dirname, '../../../../..');
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');

const pipe = new ValidationPipe({
  whitelist: true,
  transform: true,
  forbidNonWhitelisted: true,
});

async function accept(metatype: new () => object, value: object) {
  return pipe.transform(value, { type: 'body', metatype });
}

async function reject(metatype: new () => object, value: object) {
  try {
    await accept(metatype, value);
  } catch (e) {
    assert.ok(e instanceof BadRequestException, 'expected a 400');
    return e;
  }
  assert.fail(`expected 400 for ${JSON.stringify(value)}`);
}

async function main() {
  const fields: Array<[string, unknown]> = [
    ['readerFontScale', 1.2],
    ['readerTheme', 'sepia'],
    ['readerLineSpacing', 1.5],
    ['showKnownWords', false],
    ['ttsEnabled', true],
    ['dailyGoalMinutes', 15],
    ['dailyGoalXp', 60],
    ['dailyNewWords', 10],
    ['notificationsEnabled', true],
    ['appTheme', 'light'],
  ];
  for (const [key, value] of fields) {
    const out = await accept(UpdatePreferencesDto, { [key]: value }) as Record<string, unknown>;
    assert.equal(out[key], value, `${key} should pass whitelist`);
  }

  const unknown = await reject(UpdatePreferencesDto, { nope: 1 });
  assert.match(JSON.stringify(unknown.getResponse()), /should not exist/);
  assert.equal(
    localizeApiError('uz', { message: 'property dailyGoalXp should not exist', status: 400 }),
    'Kiritilgan maʼlumotlarni tekshiring.',
  );
  assert.equal(
    localizeApiError('ru', { message: 'dailyGoalXp must not be greater than 500', status: 400 }),
    'Проверьте введённые данные.',
  );

  await reject(UpdatePreferencesDto, { readerTheme: 'x' });
  await reject(UpdatePreferencesDto, { dailyGoalXp: 9 });
  await reject(UpdatePreferencesDto, { dailyGoalXp: 501 });
  await reject(UpdatePreferencesDto, { dailyNewWords: -1 });
  await reject(UpdatePreferencesDto, { dailyNewWords: 51 });
  await accept(UpdatePreferencesDto, { dailyGoalXp: 200, dailyNewWords: 0 });

  const trimmed = await accept(UpdateProfileDto, { displayName: '  Ada  ' }) as { displayName: string };
  assert.equal(trimmed.displayName, 'Ada');
  const cleared = await accept(UpdateProfileDto, { displayName: '   ' }) as { displayName: string | null };
  assert.equal(cleared.displayName, null);
  await reject(UpdateProfileDto, { displayName: 'a'.repeat(51) });
  await reject(UpdateProfileDto, { displayName: 'see https://example.com' });
  assert.equal(
    localizeApiError('ru', { message: 'Display name cannot contain links or control characters.', code: 'DISPLAY_NAME_INVALID', status: 400 }),
    'Имя не может содержать ссылки или служебные символы.',
  );

  const profile = toPublicProfile({
    id: 'u1',
    email: 'a@b.c',
    displayName: 'Ada',
    passwordHash: 'secret',
    consentIp: '1.1.1.1',
    emailVerificationToken: 'hash-1',
    emailVerificationExpires: new Date(),
    passwordResetToken: 'hash-2',
    passwordResetExpires: new Date(),
    emailVerifiedAt: null,
    preferences: { ttsEnabled: true, showKnownWords: false },
  });
  for (const secret of ['passwordHash', 'consentIp', 'emailVerificationToken', 'emailVerificationExpires', 'passwordResetToken', 'passwordResetExpires']) {
    assert.equal(secret in profile, false, secret);
  }
  assert.equal(profile.email, 'a@b.c');
  assert.equal(profile.emailVerifiedAt, null);

  const prevDev = process.env.DEV_AUTH_ANY_CREDENTIAL;
  delete process.env.DEV_AUTH_ANY_CREDENTIAL;
  try {
    const token = 'r'.repeat(48);
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const row = {
      id: 'rt1',
      tokenHash,
      revokedAt: null as Date | null,
      expiresAt: new Date(Date.now() + 86_400_000),
      userId: 'u1',
      user: { id: 'u1', email: 'a@b.c', deletedAt: null, emailVerifiedAt: new Date(), targetLanguages: [] },
    };
    const prisma = {
      dbAvailable: true,
      authRefreshToken: {
        updateMany: async ({ where, data }: { where: { tokenHash?: string; userId?: string; revokedAt: null }; data: { revokedAt: Date } }) => {
          const match = where.tokenHash ? where.tokenHash === row.tokenHash : where.userId === row.userId;
          if (match && row.revokedAt == null) {
            row.revokedAt = data.revokedAt;
            return { count: 1 };
          }
          return { count: 0 };
        },
        findUnique: async () => row,
      },
    };
    const svc = new AuthService(prisma as never, {} as never, { revokeRefresh() {}, revokeAll() {} } as never, {} as never, {} as never);
    await svc.logout(token);
    await assert.rejects(() => svc.refresh(token), (e: unknown) => e instanceof UnauthorizedException);
    row.revokedAt = null;
    await svc.logoutAll('u1');
    await assert.rejects(() => svc.refresh(token), (e: unknown) => e instanceof UnauthorizedException);
  } finally {
    if (prevDev === undefined) delete process.env.DEV_AUTH_ANY_CREDENTIAL;
    else process.env.DEV_AUTH_ANY_CREDENTIAL = prevDev;
  }

  const schema = read('services/api/prisma/schema.prisma');
  const prefs = schema.slice(schema.indexOf('model UserPreferences'), schema.indexOf('model AuthRefreshToken'));
  assert.match(prefs, /showKnownWords\s+Boolean @default\(false\)/);
  assert.match(prefs, /ttsEnabled\s+Boolean @default\(true\)/);
  assert.match(prefs, /dailyGoalXp\s+Int\s+@default\(60\)/);
  assert.match(prefs, /dailyNewWords\s+Int\s+@default\(10\)/);

  const auth = read('apps/web-learner/src/lib/auth.tsx');
  assert.match(auth, /showKnownWords:\s*false/);
  assert.match(auth, /ttsEnabled:\s*true/);
  assert.match(auth, /dailyGoalXp:\s*60/);
  assert.match(auth, /dailyNewWords:\s*10/);

  const settings = read('apps/web-learner/src/pages/SettingsPage.tsx');
  assert.match(settings, /showKnownWords \?\? false/);
  assert.match(settings, /ttsEnabled \?\? true/);
  assert.match(settings, /dailyGoalXp \?\? 60/);
  assert.match(settings, /dailyNewWords \?\? 10/);
  assert.doesNotMatch(settings, /The old lighthouse/);
  assert.doesNotMatch(settings, /['"]Plus['"]/);

  const reader = read('apps/web-learner/src/pages/ReaderPage.tsx');
  assert.match(reader, /ttsEnabled !== false/);
  assert.match(reader, /showKnownWords \?\? false/);

  const theme = read('apps/web-learner/src/lib/appTheme.ts');
  assert.match(theme, /return 'light'/);
  assert.doesNotMatch(theme, /prefers-color-scheme/);
  const html = read('apps/web-learner/index.html');
  assert.match(html, /dataset\.theme = 'light'/);
  assert.doesNotMatch(html, /prefers-color-scheme/);

  const migration = read('services/api/prisma/migrations/0040_tts_reset_on/migration.sql');
  assert.match(migration, /tts_enabled" = true/);

  const ai = read('apps/web-learner/src/components/safety/AiSwitch.tsx');
  assert.doesNotMatch(ai, /['"]Error['"]/);

  assert.equal(PAGE_QUIZ_BANKS_LIVE, false);

  console.log('settings-fixes.test: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
