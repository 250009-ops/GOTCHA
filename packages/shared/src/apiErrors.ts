/**
 * BUG-10: API errors are English strings from NestJS. The learner UI must never show them raw in RU/UZ.
 * localizeApiError() maps known codes/messages to EN/RU/UZ; unknown messages fall back to a per-status generic
 * text in RU/UZ (EN keeps the server text, which is already user-facing English).
 */
export type ApiErrorLang = 'en' | 'ru' | 'uz';
type T3 = { en: string; ru: string; uz: string };

const BY_CODE: Record<string, T3> = {
  EMAIL_NOT_VERIFIED: { en: 'Please verify your email before signing in.', ru: 'Подтвердите email, прежде чем войти.', uz: 'Kirishdan oldin emailingizni tasdiqlang.' },
  use_daily_practice: { en: 'Word review now lives in Daily practice.', ru: 'Повторение слов теперь в ежедневной практике.', uz: 'Soʻzlarni takrorlash endi kundalik mashqda.' },
  refund_requires_support: { en: 'This payment is complete. Contact support for a refund.', ru: 'Платёж уже проведён. Для возврата обратитесь в поддержку.', uz: 'Toʻlov amalga oshirilgan. Pulni qaytarish uchun qoʻllab-quvvatlash xizmatiga yozing.' },
  payment_not_pending: { en: 'This payment can no longer be cancelled.', ru: 'Этот платёж уже нельзя отменить.', uz: 'Bu toʻlovni endi bekor qilib boʻlmaydi.' },
};

Object.assign(BY_CODE, {
  promo_invalid: { en: 'This promo code is not valid.', ru: 'Промокод недействителен.', uz: 'Promokod yaroqsiz.' },
  promo_not_applicable: { en: 'This promo code does not apply here.', ru: 'Этот промокод здесь не действует.', uz: 'Bu promokod bu yerda amal qilmaydi.' },
  promo_expired: { en: 'This promo code has expired.', ru: 'Срок действия промокода истёк.', uz: 'Promokod muddati tugagan.' },
  promo_exhausted: { en: 'This promo code has been used up.', ru: 'Промокод больше недоступен.', uz: 'Promokod limiti tugagan.' },
  promo_used: { en: 'You have already used this promo code.', ru: 'Вы уже использовали этот промокод.', uz: 'Siz bu promokoddan foydalangansiz.' },
  payment_not_paid: { en: 'This payment cannot be refunded.', ru: 'Этот платёж нельзя вернуть.', uz: 'Bu toʻlovni qaytarib boʻlmaydi.' },
  item_answered: { en: 'This exercise was already answered.', ru: 'На это задание уже ответили.', uz: 'Bu mashqqa allaqachon javob berilgan.' },
  item_not_issued: { en: 'This exercise is no longer available. Start a new session.', ru: 'Задание недоступно. Начните новую сессию.', uz: 'Mashq mavjud emas. Yangi sessiyani boshlang.' },
  session_completed: { en: 'This session is already finished.', ru: 'Эта сессия уже завершена.', uz: 'Bu sessiya allaqachon yakunlangan.' },
});

// Launch safety (Kai 31 Oct): AI off switch + moderation fails closed.
Object.assign(BY_CODE, {
  AI_MODERATION_UNAVAILABLE: { en: 'This answer could not be checked right now. Please try again.', ru: 'Сейчас не удалось проверить ответ. Попробуйте ещё раз.', uz: 'Hozir javobni tekshirib boʻlmadi. Qayta urinib koʻring.' },
  AVATAR_UNDER13: { en: 'Profile photos are not available for this account.', ru: 'Фото профиля недоступно для этого аккаунта.', uz: 'Bu hisob uchun profil surati mavjud emas.' },
  AI_OFF_BY_USER: { en: 'You turned AI features off. Turn them back on in Settings.', ru: 'Вы отключили функции ИИ. Включить их можно в настройках.', uz: 'Siz AI funksiyalarini oʻchirgansiz. Ularni Sozlamalarda qayta yoqishingiz mumkin.' },
  AI_DISABLED: { en: 'AI features are turned off for this account. Contact support@gotchaa.uz to turn them back on.', ru: 'Функции ИИ отключены для этого аккаунта. Чтобы включить их, напишите на support@gotchaa.uz.', uz: 'Bu hisob uchun AI funksiyalari oʻchirilgan. Qayta yoqish uchun support@gotchaa.uz manziliga yozing.' },
  AI_DISABLED_BY_SUPPORT: { en: 'AI features were turned off by support. Contact support@gotchaa.uz to turn them back on.', ru: 'Функции ИИ отключила поддержка. Чтобы включить их, напишите на support@gotchaa.uz.', uz: 'AI funksiyalarini qoʻllab-quvvatlash xizmati oʻchirgan. Qayta yoqish uchun support@gotchaa.uz manziliga yozing.' },
  TARGET_SAME_AS_NATIVE: { en: 'Target language cannot be the same as your native language.', ru: 'Целевой язык не может совпадать с родным.', uz: 'Maqsad til ona til bilan bir xil boʻla olmaydi.' },
  KEEP_ONE_TARGET: { en: 'You must keep at least one target language.', ru: 'Нужен хотя бы один целевой язык.', uz: 'Kamida bitta maqsad til kerak.' },
  DISPLAY_NAME_INVALID: { en: 'Display name cannot contain links or control characters.', ru: 'Имя не может содержать ссылки или служебные символы.', uz: 'Ismda havola yoki maxsus belgilar boʻlmasligi kerak.' },
});

const BY_MESSAGE: Record<string, T3> = {
  'Invalid credentials': { en: 'Wrong email or password.', ru: 'Неверный email или пароль.', uz: 'Email yoki parol notoʻgʻri.' },
  'Please verify your email before signing in.': BY_CODE.EMAIL_NOT_VERIFIED,
  'Invalid or expired email verification token.': { en: 'This verification link is invalid or has expired.', ru: 'Ссылка подтверждения недействительна или устарела.', uz: 'Tasdiqlash havolasi yaroqsiz yoki muddati oʻtgan.' },
  'Verification token is required.': { en: 'The verification link is incomplete.', ru: 'Ссылка подтверждения неполная.', uz: 'Tasdiqlash havolasi toʻliq emas.' },
  'Invalid or expired password reset token.': { en: 'This reset link is invalid or has expired.', ru: 'Ссылка для сброса пароля недействительна или устарела.', uz: 'Parolni tiklash havolasi yaroqsiz yoki muddati oʻtgan.' },
  'Reset token is required.': { en: 'The reset link is incomplete.', ru: 'Ссылка для сброса неполная.', uz: 'Tiklash havolasi toʻliq emas.' },
  'Too many failed sign-in attempts. Try again in a few minutes.': { en: 'Too many failed sign-in attempts. Try again in a few minutes.', ru: 'Слишком много неудачных попыток входа. Попробуйте через несколько минут.', uz: 'Juda koʻp muvaffaqiyatsiz urinish. Bir necha daqiqadan soʻng qayta urining.' },
  'This account has been deleted or suspended.': { en: 'This account has been deleted or suspended.', ru: 'Этот аккаунт удалён или заблокирован.', uz: 'Bu hisob oʻchirilgan yoki bloklangan.' },
  'Current password is incorrect.': { en: 'Current password is incorrect.', ru: 'Текущий пароль неверен.', uz: 'Joriy parol notoʻgʻri.' },
  'Password must be at least 8 characters.': { en: 'Password must be at least 8 characters.', ru: 'Пароль должен содержать не менее 8 символов.', uz: 'Parol kamida 8 belgidan iborat boʻlishi kerak.' },
  'User not found': { en: 'Account not found.', ru: 'Аккаунт не найден.', uz: 'Hisob topilmadi.' },
  'Payment not found': { en: 'Payment not found.', ru: 'Платёж не найден.', uz: 'Toʻlov topilmadi.' },
  'Payment is not completed yet': { en: 'The payment is not completed yet.', ru: 'Платёж ещё не завершён.', uz: 'Toʻlov hali yakunlanmagan.' },
  'Payment is already completed': { en: 'The payment is already completed.', ru: 'Платёж уже завершён.', uz: 'Toʻlov allaqachon yakunlangan.' },
  'Payment required to read this book': { en: 'Buy this book to read it.', ru: 'Купите книгу, чтобы читать её.', uz: 'Oʻqish uchun kitobni sotib oling.' },
  'Card number must be 16–19 digits.': { en: 'Card number must be 16–19 digits.', ru: 'Номер карты должен содержать 16–19 цифр.', uz: 'Karta raqami 16–19 ta raqamdan iborat boʻlishi kerak.' },
  'Card number must contain only digits.': { en: 'Card number must contain only digits.', ru: 'Номер карты должен содержать только цифры.', uz: 'Karta raqami faqat raqamlardan iborat boʻlishi kerak.' },
  'OTP must be 4–8 digits.': { en: 'The code must be 4–8 digits.', ru: 'Код должен содержать 4–8 цифр.', uz: 'Kod 4–8 ta raqamdan iborat boʻlishi kerak.' },
  'Only PDF and EPUB files are supported': { en: 'Only PDF and EPUB files are supported.', ru: 'Поддерживаются только файлы PDF и EPUB.', uz: 'Faqat PDF va EPUB fayllar qoʻllab-quvvatlanadi.' },
  'This PDF is password-protected. Remove the password and try again.': { en: 'This PDF is password-protected. Remove the password and try again.', ru: 'PDF защищён паролем. Снимите пароль и попробуйте снова.', uz: 'PDF parol bilan himoyalangan. Parolni olib tashlab, qayta urining.' },
  'Image must be 2 MB or smaller.': { en: 'Image must be 2 MB or smaller.', ru: 'Изображение должно быть не больше 2 МБ.', uz: 'Rasm hajmi 2 MB dan oshmasligi kerak.' },
  'Use a JPG, PNG, or WebP image.': { en: 'Use a JPG, PNG, or WebP image.', ru: 'Используйте изображение JPG, PNG или WebP.', uz: 'JPG, PNG yoki WebP rasmdan foydalaning.' },
  'Practice session not found': { en: 'Practice session not found.', ru: 'Сессия практики не найдена.', uz: 'Mashq sessiyasi topilmadi.' },
  'Session already completed': { en: 'This session is already finished.', ru: 'Эта сессия уже завершена.', uz: 'Bu sessiya allaqachon yakunlangan.' },
  'Request failed': { en: 'Something went wrong. Please try again.', ru: 'Что-то пошло не так. Попробуйте ещё раз.', uz: 'Nimadir xato ketdi. Qayta urinib koʻring.' },
  'Target language cannot be the same as your native language.': BY_CODE.TARGET_SAME_AS_NATIVE,
  'You must keep at least one target language.': BY_CODE.KEEP_ONE_TARGET,
  'Display name cannot contain links or control characters.': BY_CODE.DISPLAY_NAME_INVALID,
};

const BY_STATUS: Record<string, T3> = {
  network: { en: 'No connection to the server. Check your internet.', ru: 'Нет связи с сервером. Проверьте интернет.', uz: 'Server bilan aloqa yoʻq. Internetni tekshiring.' },
  '400': { en: 'Please check the entered data.', ru: 'Проверьте введённые данные.', uz: 'Kiritilgan maʼlumotlarni tekshiring.' },
  '401': { en: 'Please sign in again.', ru: 'Войдите снова.', uz: 'Qaytadan kiring.' },
  '403': { en: 'You don’t have access to this.', ru: 'Нет доступа.', uz: 'Bunga ruxsatingiz yoʻq.' },
  '404': { en: 'Not found.', ru: 'Не найдено.', uz: 'Topilmadi.' },
  '409': { en: 'This action conflicts with the current state. Refresh and try again.', ru: 'Действие невозможно в текущем состоянии. Обновите страницу.', uz: 'Joriy holatda amalni bajarib boʻlmaydi. Sahifani yangilang.' },
  '429': { en: 'Too many requests. Try again in a moment.', ru: 'Слишком много запросов. Попробуйте чуть позже.', uz: 'Soʻrovlar juda koʻp. Birozdan soʻng urining.' },
  '5xx': { en: 'Server error. Please try again later.', ru: 'Ошибка сервера. Попробуйте позже.', uz: 'Server xatosi. Keyinroq urinib koʻring.' },
};

export function localizeApiError(
  lang: string | null | undefined,
  err: { message?: string | string[] | null; code?: string | null; status?: number | null },
): string {
  const l: ApiErrorLang = lang === 'ru' || lang === 'uz' ? lang : 'en';
  const raw = Array.isArray(err.message) ? err.message.join(', ') : (err.message ?? '').trim();
  const hit = (err.code && BY_CODE[err.code]) || BY_MESSAGE[raw] || BY_MESSAGE[raw.replace(/\.$/, '')];
  if (hit) return hit[l];
  // class-validator / whitelist noise ("property dailyGoalXp should not exist", "must not be greater than 500").
  if (/should not exist|must not be|must be an |must be shorter|must be longer|must be a /i.test(raw)) {
    return BY_STATUS['400'][l];
  }
  if (l === 'en' && raw && !Array.isArray(err.message)) return raw;
  const s = err.status ?? 0;
  const key = s >= 500 ? '5xx' : s === 0 ? 'network' : String(s);
  return (BY_STATUS[key] ?? BY_MESSAGE['Request failed'])[l];
}
