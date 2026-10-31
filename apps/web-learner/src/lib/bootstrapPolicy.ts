/** WL4-02 (W-16): only a real 401 (after the refresh attempt) ends the session at bootstrap. */
export function shouldLogoutOnBootstrapError(err: unknown): boolean {
  const status = (err as { status?: number } | null)?.status;
  return status === 401;
}

export const BOOTSTRAP_RETRY_COPY: Record<string, { title: string; body: string; retry: string }> = {
  uz: { title: 'Ulanib boʻlmadi', body: 'Server hozir javob bermayapti. Hisobingizdan chiqmadingiz.', retry: 'Qayta urinish' },
  ru: { title: 'Не удалось подключиться', body: 'Сервер сейчас не отвечает. Вы не вышли из аккаунта.', retry: 'Повторить' },
  en: { title: 'Couldn’t connect', body: 'The server isn’t responding right now. You’re still signed in.', retry: 'Try again' },
};
export const bootstrapRetryCopy = (lang: string) => BOOTSTRAP_RETRY_COPY[lang?.slice(0, 2)] ?? BOOTSTRAP_RETRY_COPY.en;
/** A refresh call that the server REJECTED (bad/expired/revoked token), as opposed to a 5xx outage. */
export const refreshRejected = (status: number) => status === 400 || status === 401 || status === 403;
