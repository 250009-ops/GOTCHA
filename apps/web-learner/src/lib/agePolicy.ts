/** LG4-05: under-13 accounts cannot upload a profile photo (server enforces 403 AVATAR_UNDER13 too). */
export const isUnder13 = (u: unknown): boolean => (u as { ageBand?: string } | null)?.ageBand === 'under13';
export const AVATAR_UNDER13_NOTE = {
  en: 'Profile photos are not available for this account.',
  ru: 'Фото профиля недоступно для этого аккаунта.',
  uz: 'Bu hisob uchun profil surati mavjud emas.',
} as const;
