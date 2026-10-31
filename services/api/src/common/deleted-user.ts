/** Privacy §8/§11: a self-deleted account keeps its (anonymised) row so its sent messages stay, shown as "Deleted user". */
export const DELETED_USER_NAME = 'Deleted user';
export const DELETED_EMAIL_DOMAIN = '@deleted.gotcha.app';

export function isDeletedAccount(user: { email?: string | null } | null | undefined): boolean {
  const e = user?.email?.toLowerCase() ?? '';
  return e.startsWith('deleted-') && e.endsWith(DELETED_EMAIL_DOMAIN);
}
