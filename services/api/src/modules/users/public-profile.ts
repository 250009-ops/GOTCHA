/** Fields a learner may see on GET /users/me. Token hashes and other internals stay off the wire. */
export const PUBLIC_USER_KEYS = [
  'id',
  'email',
  'displayName',
  'avatarUrl',
  'nativeLanguage',
  'uiLanguage',
  'timezone',
  'streakCount',
  'bestStreak',
  'xpTotal',
  'xpToday',
  'xpDate',
  'streakFreezes',
  'streakLastDate',
  'emailVerifiedAt',
  'lastSeenAt',
  'createdAt',
  'birthYear',
  'aiDisabled',
  'aiDisabledBy',
  'targetLanguages',
  'preferences',
  'subscriptions',
] as const;

export function toPublicProfile(
  user: object,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  const src = user as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of PUBLIC_USER_KEYS) {
    if (key in src) out[key] = src[key];
  }
  return { ...out, ...extra };
}
