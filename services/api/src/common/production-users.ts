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

/** Figma messaging mock names — never show these as live learners. */
export const FIGMA_SAMPLE_DISPLAY_NAMES = [
  'John Doe',
  'Yuki T.',
  'Yuki T',
  'Marc L.',
  'Marc L',
  'Elena R.',
  'Elena R',
  'Elena Read',
] as const;

export function isFigmaSampleDisplayName(name: string | null | undefined): boolean {
  const value = name?.trim().toLowerCase() ?? '';
  if (!value) return false;
  return FIGMA_SAMPLE_DISPLAY_NAMES.some((n) => n.toLowerCase() === value);
}

/** Learners who may appear in messaging lists, suggestions, and search. */
export function liveMessagingPeerWhere(): Prisma.UserWhereInput {
  return {
    deletedAt: null,
    adminProfile: { is: null },
    NOT: {
      OR: [
        ...(syntheticUserEmailWhere().OR ?? []),
        ...FIGMA_SAMPLE_DISPLAY_NAMES.map((name) => ({
          displayName: { equals: name, mode: 'insensitive' as const },
        })),
        // Privacy §7/§12: minors (known under-18) are never listed in the learner directory or suggestions.
        ...minorUserWhere(),
      ],
    },
  };
}

/** Known minors (under 18). Unknown age is listed unless AGE_UNKNOWN_BAND=under13 (then hidden too). */
export function minorUserWhere(): Prisma.UserWhereInput[] {
  const y = new Date().getUTCFullYear();
  const terms: Prisma.UserWhereInput[] = [{ birthYear: { gte: y - 18 } }];
  if ((process.env.AGE_UNKNOWN_BAND ?? 'teen') === 'under13') terms.push({ birthYear: null });
  return terms;
}

/** Prisma OR-terms matching under-13 accounts (age uses the younger bound of birth_year). */
export function under13UserWhere(): Prisma.UserWhereInput[] {
  const y = new Date().getUTCFullYear();
  const terms: Prisma.UserWhereInput[] = [{ birthYear: { gte: y - 13 } }];
  if ((process.env.AGE_UNKNOWN_BAND ?? 'teen') === 'under13') terms.push({ birthYear: null });
  return terms;
}
