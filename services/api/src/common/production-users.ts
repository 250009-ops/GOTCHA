import { Prisma } from '@prisma/client';

/** Figma / QA accounts that must never appear in production user counts. */
export const SYNTHETIC_USER_EMAILS = [
  'soren@existential.dk',
  'yuki.t@tokyo.jp',
  'elena@rostov.ru',
  'm.andre@quebec.ca',
  'hans@gotcha.app',
  'carlos@gotcha.app',
  'aisha@gotcha.app',
  'david@gotcha.app',
] as const;

const SYNTHETIC_EMAIL_PREFIXES = [
  'androidqa',
  'smoke.',
  'smtp.verify',
  'gotcha.verify.test',
  'verifytest',
] as const;

const SYNTHETIC_EMAIL_SUFFIXES = ['@gotcha.test', '@example.com', '@mailinator.com'] as const;

export function isSyntheticUserEmail(email: string | null | undefined): boolean {
  const value = email?.trim().toLowerCase() ?? '';
  if (!value) return false;
  if ((SYNTHETIC_USER_EMAILS as readonly string[]).includes(value)) return true;
  if (SYNTHETIC_EMAIL_SUFFIXES.some((suffix) => value.endsWith(suffix))) return true;
  return SYNTHETIC_EMAIL_PREFIXES.some((prefix) => value.startsWith(prefix));
}

/** Prisma filter: hide QA / seed accounts from live admin lists and KPIs. */
export function syntheticUserEmailWhere(): Prisma.UserWhereInput {
  return {
    OR: [
      { email: { in: [...SYNTHETIC_USER_EMAILS] } },
      ...SYNTHETIC_EMAIL_SUFFIXES.map((suffix) => ({ email: { endsWith: suffix } })),
      ...SYNTHETIC_EMAIL_PREFIXES.map((prefix) => ({ email: { startsWith: prefix } })),
    ],
  };
}

export function liveLearnerWhere(): Prisma.UserWhereInput {
  return {
    deletedAt: null,
    adminProfile: { is: null },
    NOT: syntheticUserEmailWhere(),
  };
}
