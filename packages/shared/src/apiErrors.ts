/**
 * BUG-10: API errors are English strings from NestJS. The learner UI must never show them raw in RU/UZ.
 * localizeApiError() maps known codes/messages to EN/RU/UZ; unknown messages fall back to a per-status generic
 * text in RU/UZ (EN keeps the server text, which is already user-facing English).
 */
export type ApiErrorLang = 'en' | 'ru' | 'uz';
type T3 = { en: string; ru: string; uz: string };

const BY_CODE: Record<string, T3> = {
  EMAIL_NOT_VERIFIED: { en: 'Please verify your email before signing in.', ru: 'Подтвердите email, прежде чем войти.', uz: 'Kirishdan oldin emailingizni tasdiqlang.' },
  use_daily_practice: { en: 'Word review now lives in Daily practice.', ru: 'Повторение слов теперь в ежедневной практике.', uz: 'So‘zlarni takrorlash endi kundalik mashqda.' },
  refund_requires_support: { en: 'This payment is complete. Contact support for a refund.', ru: 'Платёж уже проведён. Для возврата обратитесь в поддержку.', uz: 'To‘lov amalga oshirilgan. Pulni qaytarish uchun qo‘llab-quvvatlash xizmatiga yozing.' },
  payment_not_pending: { en: 'This payment can no longer be cancelled.', ru: 'Этот платёж уже нельзя отменить.', uz: 'Bu to‘lovni endi bekor qilib bo‘lmaydi.' },
};

const BY_MESSAGE: Record<string, T3> = {
  'Invalid credentials': { en: 'Wrong email or password.', ru: 'Неверный email или пароль.', uz: 'Email yoki parol noto‘g‘ri.' },
  'Please verify your email before signing in.': BY_CODE.EMAIL_NOT_VERIFIED,
  'Invalid or expired email verification token.': { en: 'This verification link is invalid or has expired.', ru: 'Ссылка подтверждения недействительна или устарела.', uz: 'Tasdiqlash havolasi yaroqsiz yoki muddati o‘tgan.' },
  'Verification token is required.': { en: 'The verification link is incomplete.', ru: 'Ссылка подтверждения неполная.', uz: 'Tasdiqlash havolasi to‘liq emas.' },
  'Invalid or expired password reset token.': { en: 'This reset link is invalid or has expired.', ru: 'Ссылка для сброса пароля недействительна или устарела.', uz: 'Parolni tiklash havolasi yaroqsiz yoki muddati o‘tgan.' },
  'Reset token is required.': { en: 'The reset link is incomplete.', ru: 'Ссылка для сброса неполная.', uz: 'Tiklash havolasi to‘liq emas.' },
  'Too many failed sign-in attempts. Try again in a few minutes.': { en: 'Too many failed sign-in attempts. Try again in a few minutes.', ru: 'Слишком много неудачных попыток входа. Попробуйте через несколько минут.', uz: 'Juda ko‘p muvaffaqiyatsiz urinish. Bir necha daqiqadan so‘ng qayta urining.' },
  'This account has been deleted or suspended.': { en: 'This account has been deleted or suspended.', ru: 'Этот аккаунт удалён или заблокирован.', uz: 'Bu hisob o‘chirilgan yoki bloklangan.' },
  'Current password is incorrect.': { en: 'Current password is incorrect.', ru: 'Текущий пароль неверен.', uz: 'Joriy parol noto‘g‘ri.' },
  'Password must be at least 8 characters.': { en: 'Password must be at least 8 characters.', ru: 'Пароль должен содержать не менее 8 символов.', uz: 'Parol kamida 8 belgidan iborat bo‘lishi kerak.' },
  'User not found': { en: 'Account not found.', ru: 'Аккаунт не найден.', uz: 'Hisob topilmadi.' },
  'Payment not found': { en: 'Payment not found.', ru: 'Платёж не найден.', uz: 'To‘lov topilmadi.' },
  'Payment is not completed yet': { en: 'The payment is not completed yet.', ru: 'Платёж ещё не завершён.', uz: 'To‘lov hali yakunlanmagan.' },
  'Payment is already completed': { en: 'The payment is already completed.', ru: 'Платёж уже завершён.', uz: 'To‘lov allaqachon yakunlangan.' },
  'Payment required to read this book': { en: 'Buy this book to read it.', ru: 'Купите книгу, чтобы читать её.', uz: 'O‘qish uchun kitobni sotib oling.' },
  'Card number must be 16–19 digits.': { en: 'Card number must be 16–19 digits.', ru: 'Номер карты должен содержать 16–19 цифр.', uz: 'Karta raqami 16–19 ta raqamdan iborat bo‘lishi kerak.' },
  'Card number must contain only digits.': { en: 'Card number must contain only digits.', ru: 'Номер карты должен содержать только цифры.', uz: 'Karta raqami faqat raqamlardan iborat bo‘lishi kerak.' },
  'OTP must be 4–8 digits.': { en: 'The code must be 4–8 digits.', ru: 'Код должен содержать 4–8 цифр.', uz: 'Kod 4–8 ta raqamdan iborat bo‘lishi kerak.' },
  'Only PDF and EPUB files are supported': { en: 'Only PDF and EPUB files are supported.', ru: 'Поддерживаются только файлы PDF и EPUB.', uz: 'Faqat PDF va EPUB fayllar qo‘llab-quvvatlanadi.' },
  'This PDF is password-protected. Remove the password and try again.': { en: 'This PDF is password-protected. Remove the password and try again.', ru: 'PDF защищён паролем. Снимите пароль и попробуйте снова.', uz: 'PDF parol bilan himoyalangan. Parolni olib tashlab, qayta urining.' },
  'Image must be 2 MB or smaller.': { en: 'Image must be 2 MB or smaller.', ru: 'Изображение должно быть не больше 2 МБ.', uz: 'Rasm hajmi 2 MB dan oshmasligi kerak.' },
  'Use a JPG, PNG, or WebP image.': { en: 'Use a JPG, PNG, or WebP image.', ru: 'Используйте изображение JPG, PNG или WebP.', uz: 'JPG, PNG yoki WebP rasmdan foydalaning.' },
  'Practice session not found': { en: 'Practice session not found.', ru: 'Сессия практики не найдена.', uz: 'Mashq sessiyasi topilmadi.' },
  'Session already completed': { en: 'This session is already finished.', ru: 'Эта сессия уже завершена.', uz: 'Bu sessiya allaqachon yakunlangan.' },
  'Request failed': { en: 'Something went wrong. Please try again.', ru: 'Что-то пошло не так. Попробуйте ещё раз.', uz: 'Nimadir xato ketdi. Qayta urinib ko‘ring.' },
};

const BY_STATUS: Record<string, T3> = {
  network: { en: 'No connection to the server. Check your internet.', ru: 'Нет связи с сервером. Проверьте интернет.', uz: 'Server bilan aloqa yo‘q. Internetni tekshiring.' },
  '400': { en: 'Please check the entered data.', ru: 'Проверьте введённые данные.', uz: 'Kiritilgan ma’lumotlarni tekshiring.' },
  '401': { en: 'Please sign in again.', ru: 'Войдите снова.', uz: 'Qaytadan kiring.' },
  '403': { en: 'You don’t have access to this.', ru: 'Нет доступа.', uz: 'Bunga ruxsatingiz yo‘q.' },
  '404': { en: 'Not found.', ru: 'Не найдено.', uz: 'Topilmadi.' },
  '409': { en: 'This action conflicts with the current state. Refresh and try again.', ru: 'Действие невозможно в текущем состоянии. Обновите страницу.', uz: 'Joriy holatda amalni bajarib bo‘lmaydi. Sahifani yangilang.' },
  '429': { en: 'Too many requests. Try again in a moment.', ru: 'Слишком много запросов. Попробуйте чуть позже.', uz: 'So‘rovlar juda ko‘p. Birozdan so‘ng urining.' },
  '5xx': { en: 'Server error. Please try again later.', ru: 'Ошибка сервера. Попробуйте позже.', uz: 'Server xatosi. Keyinroq urinib ko‘ring.' },
};

export function localizeApiError(
  lang: string | null | undefined,
  err: { message?: string | string[] | null; code?: string | null; status?: number | null },
): string {
  const l: ApiErrorLang = lang === 'ru' || lang === 'uz' ? lang : 'en';
  const raw = Array.isArray(err.message) ? err.message.join(', ') : (err.message ?? '').trim();
  const hit = (err.code && BY_CODE[err.code]) || BY_MESSAGE[raw] || BY_MESSAGE[raw.replace(/\.$/, '')];
  if (hit) return hit[l];
  if (l === 'en' && raw && !Array.isArray(err.message)) return raw;
  const s = err.status ?? 0;
  const key = s >= 500 ? '5xx' : s === 0 ? 'network' : String(s);
  return (BY_STATUS[key] ?? BY_MESSAGE['Request failed'])[l];
}
