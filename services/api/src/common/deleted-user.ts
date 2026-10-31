/** Privacy §8/§11: a self-deleted account keeps its (anonymised) row so its sent messages stay, shown as "Deleted user". */
export const DELETED_USER_NAME = 'Deleted user';
export const DELETED_EMAIL_DOMAIN = '@deleted.gotcha.app';

export function isDeletedAccount(user: { email?: string | null } | null | undefined): boolean {
  const e = user?.email?.toLowerCase() ?? '';
  return e.startsWith('deleted-') && e.endsWith(DELETED_EMAIL_DOMAIN);
}

export const USER_DELETED = 'USER_DELETED';

/** Localised display name for a deleted account (Privacy §11 uz/ru/en). */
export function deletedUserName(locale?: string | null): string {
  const l = (locale ?? '').toLowerCase();
  if (l.startsWith('uz')) return 'Oʻchirilgan foydalanuvchi';
  if (l.startsWith('ru')) return 'Удалённый пользователь';
  return DELETED_USER_NAME;
}

type UserLookup = { user: { findFirst(args: unknown): Promise<{ email: string } | null> } };

/**
 * Blocks new messages, conversations, friend requests and reports that target a self-deleted account.
 * 403 { code: 'USER_DELETED' }. Existing reports are untouched.
 */
export async function assertNotDeletedUser(p: UserLookup, userId: string): Promise<void> {
  const u = await p.user.findFirst({ where: { id: userId }, select: { email: true } });
  if (u && isDeletedAccount(u)) {
    // Lazy import keeps this file free of Nest for plain unit tests.
    const { ForbiddenException } = await import('@nestjs/common');
    throw new ForbiddenException({ statusCode: 403, code: USER_DELETED, message: 'This account has been deleted.' });
  }
}
