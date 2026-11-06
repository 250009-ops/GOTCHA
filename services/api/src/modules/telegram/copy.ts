export type BotLocale = 'uz' | 'ru' | 'en';

export function botLocale(code?: string | null): BotLocale {
  const value = (code ?? '').trim().toLowerCase();
  if (value.startsWith('ru')) return 'ru';
  if (value.startsWith('en')) return 'en';
  return 'uz';
}

export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export interface BotButtons {
  signup: string;
  login: string;
  open: string;
  approve: string;
  deny: string;
  reset: string;
  read: string;
  continue: string;
  vocab: string;
  reply: string;
}

const BUTTONS: Record<BotLocale, BotButtons> = {
  uz: {
    signup: 'Roʻyxatdan oʻtish',
    login: 'Hisobim bor',
    open: 'Ochish',
    approve: 'Tasdiqlash',
    deny: 'Bu men emasman',
    reset: 'Parolni oʻzgartirish',
    read: 'Oʻqish',
    continue: 'Oʻqishni davom ettirish',
    vocab: 'Mashqni boshlash',
    reply: 'Javob berish',
  },
  ru: {
    signup: 'Регистрация',
    login: 'У меня есть аккаунт',
    open: 'Открыть',
    approve: 'Подтвердить',
    deny: 'Это не я',
    reset: 'Изменить пароль',
    read: 'Читать',
    continue: 'Продолжить чтение',
    vocab: 'Начать упражнение',
    reply: 'Ответить',
  },
  en: {
    signup: 'Sign up',
    login: 'I have an account',
    open: 'Open',
    approve: 'Confirm',
    deny: 'This is not me',
    reset: 'Change password',
    read: 'Read',
    continue: 'Continue reading',
    vocab: 'Start practice',
    reply: 'Reply',
  },
};

export function botButtons(locale: BotLocale): BotButtons {
  return BUTTONS[locale];
}

/** Screen 01. The name is the Telegram first name. Uzbek text is the design copy. */
export function welcomeHtml(locale: BotLocale, firstName: string): string {
  const name = escapeHtml(firstName.trim() || 'Gotcha');
  if (locale === 'ru') {
    return (
      `<b>Здравствуйте, ${name}!</b>\n` +
      'Gotcha — приложение, в котором язык учат, читая книги, статьи и новости. Нажмите на любое слово: перевод и пояснение появятся сразу.\n\n' +
      'Для регистрации достаточно имени, номера Telegram и пароля. С этим номером и паролем вы также войдёте на сайт <b>gotchaa.uz</b>.'
    );
  }
  if (locale === 'en') {
    return (
      `<b>Hello, ${name}!</b>\n` +
      'Gotcha is an app for learning a language by reading books, articles and news. Tap any word and the translation and explanation appear at once.\n\n' +
      'To sign up you only need your name, your Telegram number and a password. You can also sign in at <b>gotchaa.uz</b> with that number and password.'
    );
  }
  return (
    `<b>Assalomu alaykum, ${name}!</b>\n` +
    'Gotcha — kitob, maqola va yangiliklarni oʻqib til oʻrganish ilovasi. Istalgan soʻzga bosing: tarjima va izoh darhol chiqadi.\n\n' +
    'Roʻyxatdan oʻtish uchun ism, Telegram raqamingiz va parol kifoya. Shu raqam va parol bilan <b>gotchaa.uz</b> saytiga ham kirasiz.'
  );
}

export function formatLoginCode(code: string): string {
  const digits = code.replace(/\D/g, '').padStart(6, '0').slice(0, 6);
  return `${digits.slice(0, 3)} ${digits.slice(3)}`;
}

/** Mini-app sign-up code. Plain sentence (the bot still sends it as HTML). */
export function signupCodeText(locale: BotLocale, code: string): string {
  const shown = formatLoginCode(code);
  if (locale === 'ru') {
    return `Код регистрации Gotcha: ${shown} — действует 5 минут. Никому его не сообщайте.`;
  }
  if (locale === 'en') {
    return `Gotcha sign-up code: ${shown} — valid for 5 minutes. Do not share it with anyone.`;
  }
  return `Gotcha roʻyxatdan oʻtish kodi: ${shown} — 5 daqiqa amal qiladi. Uni hech kimga bermang.`;
}

/** Screen 05, first message. */
export function loginCodeHtml(locale: BotLocale, code: string): string {
  const shown = escapeHtml(formatLoginCode(code));
  if (locale === 'ru') {
    return (
      `<b>Код для входа на gotchaa.uz</b>\n\n` +
      `<b>${shown}</b>\n\n` +
      'Код действует 5 минут. Никому его не сообщайте — сотрудники Gotcha тоже его не спрашивают.'
    );
  }
  if (locale === 'en') {
    return (
      `<b>Sign-in code for gotchaa.uz</b>\n\n` +
      `<b>${shown}</b>\n\n` +
      'The code is valid for 5 minutes. Do not share it with anyone — Gotcha staff will never ask for it.'
    );
  }
  return (
    `<b>gotchaa.uz uchun kirish kodi</b>\n\n` +
    `<b>${shown}</b>\n\n` +
    'Kod 5 daqiqa amal qiladi. Uni hech kimga bermang — Gotcha xodimlari ham soʻramaydi.'
  );
}

/** Screen 05, second message. */
export function loginConfirmHtml(locale: BotLocale, accountName: string, device: string): string {
  const name = escapeHtml(accountName.trim() || '—');
  const where = escapeHtml(device);
  if (locale === 'ru') {
    return (
      `<b>Вход на gotchaa.uz</b>\n` +
      `Аккаунт: <b>${name}</b>\n` +
      `Устройство: <b>${where}</b>\n\n` +
      'Если это вы, подтвердите.'
    );
  }
  if (locale === 'en') {
    return (
      `<b>Sign in to gotchaa.uz</b>\n` +
      `Account: <b>${name}</b>\n` +
      `Device: <b>${where}</b>\n\n` +
      'If this is you, confirm.'
    );
  }
  return (
    `<b>gotchaa.uz saytiga kirish</b>\n` +
    `Hisob: <b>${name}</b>\n` +
    `Qurilma: <b>${where}</b>\n\n` +
    'Agar bu siz boʻlsangiz, tasdiqlang.'
  );
}

export function notLinkedHtml(locale: BotLocale): string {
  if (locale === 'ru') return 'Этот аккаунт Telegram ещё не привязан к аккаунту Gotcha.';
  if (locale === 'en') return 'This Telegram account is not linked to a Gotcha account yet.';
  return 'Bu Telegram hisobi hali Gotcha hisobiga ulanmagan.';
}

export function phoneTakenHtml(locale: BotLocale): string {
  if (locale === 'ru') return 'Этот номер уже зарегистрирован.';
  if (locale === 'en') return 'This number is already registered.';
  return 'Bu raqam allaqachon roʻyxatdan oʻtgan.';
}

/** Sent after "Bu men emasman". */
export function passwordMayBeKnownHtml(locale: BotLocale): string {
  if (locale === 'ru') return 'Возможно, ваш пароль известен кому-то ещё.';
  if (locale === 'en') return 'Someone else may know your password.';
  return 'Parolingiz boshqa odamga maʼlum boʻlishi mumkin.';
}

export function confirmedHtml(locale: BotLocale): string {
  if (locale === 'ru') return 'Подтверждено. Вернитесь на сайт.';
  if (locale === 'en') return 'Confirmed. Go back to the website.';
  return 'Tasdiqlandi. Saytga qayting.';
}

export function linkStaleHtml(locale: BotLocale): string {
  if (locale === 'ru') return 'Эта ссылка устарела или недействительна.';
  if (locale === 'en') return 'This link has expired or is not valid.';
  return 'Bu havola eskirgan yoki yaroqsiz.';
}

export function codeErrorText(locale: BotLocale, kind: 'invalid' | 'expired'): string {
  if (kind === 'expired') {
    if (locale === 'ru') return 'Срок кода истёк — отправьте ещё раз';
    if (locale === 'en') return 'The code has expired — send a new one';
    return 'Kod muddati tugadi — qayta yuboring';
  }
  if (locale === 'ru') return 'Неверный код';
  if (locale === 'en') return 'Wrong code';
  return 'Kod notoʻgʻri';
}

export function resendCooldownText(locale: BotLocale): string {
  if (locale === 'ru') return 'Подождите минуту, прежде чем отправить код ещё раз.';
  if (locale === 'en') return 'Wait a minute before sending the code again.';
  return 'Kodni qayta yuborish uchun bir daqiqa kuting.';
}

export const NOTIFICATION_KINDS = ['content', 'goal', 'vocab', 'message', 'streak'] as const;
export type BotNotificationKind = (typeof NOTIFICATION_KINDS)[number];

export function notificationButton(locale: BotLocale, kind: string): { text: string; startapp: string } | null {
  const labels = BUTTONS[locale];
  switch (kind) {
    case 'content':
      return { text: labels.read, startapp: 'book' };
    case 'goal':
    case 'streak':
      return { text: labels.continue, startapp: 'read' };
    case 'vocab':
      return { text: labels.vocab, startapp: 'mashq' };
    case 'message':
      return { text: labels.reply, startapp: 'chat' };
    default:
      return null;
  }
}

/**
 * startapp values the mini app will read in Phase 2:
 * book_<id> → /tg/read/<id>, read → last book, mashq → /tg/practice, chat_<id> → /tg/messages?c=<id>.
 */
export function notificationStartApp(kind: string, refId?: string | null): string {
  if (kind === 'content' && refId) return `book_${refId}`;
  if (kind === 'message' && refId) return `chat_${refId}`;
  if (kind === 'goal' || kind === 'streak') return 'read';
  if (kind === 'vocab') return 'mashq';
  return kind;
}
