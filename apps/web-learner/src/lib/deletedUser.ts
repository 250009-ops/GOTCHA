/**
 * Privacy §11: a deleted account's messages stay, shown as from "Deleted user". The API sends `deleted: true`
 * on the peer / sender and keeps the English name; the learner localises it from the flag, never from the string.
 */
export type DeletedLocale = 'en' | 'ru' | 'uz';

export const DELETED_USER_NAME: Record<DeletedLocale, string> = {
  en: 'Deleted user',
  ru: 'Удалённый пользователь',
  uz: 'Oʻchirilgan foydalanuvchi',
};

export const DELETED_ACCOUNT_LINE: Record<DeletedLocale, string> = {
  en: 'This account has been deleted.',
  ru: 'Этот аккаунт удалён.',
  uz: 'Bu hisob oʻchirilgan.',
};

const norm = (l?: string | null): DeletedLocale => (l === 'ru' || l === 'uz' ? l : 'en');

export function deletedUserName(locale?: string | null): string {
  return DELETED_USER_NAME[norm(locale)];
}

export function deletedAccountLine(locale?: string | null): string {
  return DELETED_ACCOUNT_LINE[norm(locale)];
}

/** Display name for a peer/sender: localised "Deleted user" when the API flags it, else the given name. */
export function shownName(p: { deleted?: boolean; displayName?: string | null } | null | undefined, locale?: string | null, fallback?: string): string | undefined {
  if (p?.deleted) return deletedUserName(locale);
  return p?.displayName ?? fallback;
}

/** True when the API refused because the other account is deleted (403 USER_DELETED). */
export function isUserDeletedError(e: unknown): boolean {
  const x = e as { code?: string; status?: number; body?: { code?: string }; data?: { code?: string }; message?: string } | null;
  return !!x && (x.code === 'USER_DELETED' || x.body?.code === 'USER_DELETED' || x.data?.code === 'USER_DELETED');
}
