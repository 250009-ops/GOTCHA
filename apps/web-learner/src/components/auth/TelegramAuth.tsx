import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import type { SessionResponse } from '../../lib/auth';
import { telegramBotLink } from '../../lib/telegram';

/** Website ↔ Telegram sign-in strings (uz / ru / en). */
export const TX = {
  uz: {
    identifier: 'Email yoki telefon raqam',
    identifierPlaceholder: 'you@example.com yoki +998 …',
    continueWithBot: 'Telegram botdan davom etish',
    signupWithBot: 'Telegram bot orqali roʻyxatdan oʻtish',
    botHint: 'Telegramda raqamingiz bir bosishda tasdiqlanadi.',
    codeTitle: 'Telegramga kod yubordik',
    codeBody: (p: string) => `${p} raqamli hisobingiz Telegram orqali ochilgan. Gotcha botidagi 6 xonali kodni kiriting.`,
    digit: (n: number) => `${n}-raqam`,
    confirm: 'Tasdiqlash',
    openBot: 'Telegramda botni ochish',
    noCode: 'Kod kelmadimi?',
    resend: 'Qayta yuborish',
    resent: 'Kod qayta yuborildi',
    wrongCode: 'Kod notoʻgʻri',
    expired: 'Kod muddati tugadi — qayta yuboring',
    back: 'Orqaga',
    waitTitle: 'Telegramda tasdiqlang',
    waitBody: 'Botda “Tasdiqlash” tugmasini bosing. Bu sahifa oʻzi davom etadi.',
    reopen: 'Botni qayta ochish',
    cancel: 'Bekor qilish',
    denied: 'Kirish rad etildi.',
    linkExpired: 'Havola muddati tugadi. Qayta urinib koʻring.',
    unavailable: 'Telegram orqali kirish hozircha ishlamayapti.',
    phoneLoginFailTitle: 'Telefon raqam yoki parol notoʻgʻri.',
    phoneLoginFailBody: 'Telefon raqam bilan hisob faqat Telegram botimiz orqali ochiladi. Hali roʻyxatdan oʻtmagan boʻlsangiz, botda 1 daqiqada roʻyxatdan oʻting.',
  },
  ru: {
    identifier: 'Email или номер телефона',
    identifierPlaceholder: 'you@example.com или +998 …',
    continueWithBot: 'Продолжить через Telegram-бота',
    signupWithBot: 'Зарегистрироваться через Telegram-бота',
    botHint: 'В Telegram номер подтверждается в одно нажатие.',
    codeTitle: 'Мы отправили код в Telegram',
    codeBody: (p: string) => `Аккаунт с номером ${p} создан через Telegram. Введите 6-значный код из бота Gotcha.`,
    digit: (n: number) => `Цифра ${n}`,
    confirm: 'Подтвердить',
    openBot: 'Открыть бота в Telegram',
    noCode: 'Не пришёл код?',
    resend: 'Отправить ещё раз',
    resent: 'Код отправлен ещё раз',
    wrongCode: 'Неверный код',
    expired: 'Срок кода истёк — запросите новый',
    back: 'Назад',
    waitTitle: 'Подтвердите в Telegram',
    waitBody: 'Нажмите «Подтвердить» в боте. Эта страница продолжит сама.',
    reopen: 'Открыть бота снова',
    cancel: 'Отмена',
    denied: 'Вход отклонён.',
    linkExpired: 'Срок ссылки истёк. Попробуйте ещё раз.',
    unavailable: 'Вход через Telegram сейчас недоступен.',
    phoneLoginFailTitle: 'Неверный номер телефона или пароль.',
    phoneLoginFailBody: 'Аккаунт по номеру телефона создаётся только через нашего Telegram-бота. Если вы ещё не зарегистрированы, сделайте это в боте за 1 минуту.',
  },
  en: {
    identifier: 'Email or phone number',
    identifierPlaceholder: 'you@example.com or +998 …',
    continueWithBot: 'Continue with the Telegram bot',
    signupWithBot: 'Sign up with the Telegram bot',
    botHint: 'Telegram confirms your number in one tap.',
    codeTitle: 'We sent a code to Telegram',
    codeBody: (p: string) => `The account for ${p} was opened in Telegram. Enter the 6-digit code from the Gotcha bot.`,
    digit: (n: number) => `Digit ${n}`,
    confirm: 'Confirm',
    openBot: 'Open the bot in Telegram',
    noCode: 'No code?',
    resend: 'Resend',
    resent: 'Code sent again',
    wrongCode: 'Wrong code',
    expired: 'The code expired — request a new one',
    back: 'Back',
    waitTitle: 'Confirm in Telegram',
    waitBody: 'Tap “Confirm” in the bot. This page continues by itself.',
    reopen: 'Open the bot again',
    cancel: 'Cancel',
    denied: 'Sign-in was declined.',
    linkExpired: 'The link expired. Please try again.',
    unavailable: 'Telegram sign-in is not available right now.',
    phoneLoginFailTitle: 'Wrong phone number or password.',
    phoneLoginFailBody: 'Phone accounts are created only in our Telegram bot. If you haven’t signed up yet, do it in the bot in a minute.',
  },
};
export type TelegramAuthCopy = (typeof TX)['uz'];
export const telegramAuthCopy = (locale: string): TelegramAuthCopy => TX[locale === 'ru' || locale === 'en' ? locale : 'uz'];

export function TelegramGlyph({ className = 'w-[13px] h-[13px]' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M21.5 3.6L2.9 10.8c-1.3.5-1.3 1.2-.2 1.6l4.8 1.5 1.8 5.6c.2.6.4.8.9.8.4 0 .6-.2.9-.5l2.3-2.2 4.8 3.5c.9.5 1.5.2 1.7-.8l3.1-14.7c.3-1.3-.5-1.9-1.5-1.5zM8.6 13.5l9.6-6.1c.5-.3.9-.1.5.2l-8 7.2-.3 3.3z" />
    </svg>
  );
}

/** Secondary button in the Telegram style (same size as the primary button above it). */
export const telegramButtonCls =
  'w-full h-12 rounded-xl border border-[#cfe3f4] bg-[#f2f8fd] text-[#1d5f96] font-bold text-[15px] inline-flex items-center justify-center gap-2.5 hover:bg-[#e8f3fc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2481cc] disabled:opacity-60';

export function TelegramBadge() {
  return (
    <span className="size-6 rounded-full bg-[#2481cc] text-white grid place-items-center shrink-0">
      <TelegramGlyph />
    </span>
  );
}


/**
 * One box changed. Handles: a single digit; typing over a filled box (value becomes 2 chars);
 * paste / keyboard autofill of the whole code, including the bot's spaced format "126 799"
 * (the boxes have no maxLength, so nothing gets cut off before we strip the non-digits).
 */
export function applyDigitInput(digits: string[], i: number, raw: string): { next: string[]; focus: number } {
  let only = raw.replace(/\D/g, '');
  // A paste into a box that already had a digit arrives as that digit + the code: keep the last 6.
  if (only.length > 6) only = only.slice(-6);
  const next = [...digits];
  if (only.length <= 1) {
    next[i] = only;
    return { next, focus: only ? Math.min(i + 1, 5) : i };
  }
  if (only.length === 2 && digits[i]) {
    next[i] = only[0] === digits[i] ? only[1] : only[0];
    return { next, focus: Math.min(i + 1, 5) };
  }
  // Paste / autofill: a full code always fills from the first box.
  const start = only.length >= 6 ? 0 : i;
  const chars = only.slice(0, 6 - start).split('');
  chars.forEach((c, k) => {
    next[start + k] = c;
  });
  return { next, focus: Math.min(start + chars.length, 5) };
}

const RESEND_SECONDS = 60;

/** Screen 23: 6-digit code sent by the bot for phone (Telegram) accounts. */
export function TelegramCodeCard({
  t,
  challengeId,
  maskedPhone,
  onSession,
  onBack,
}: {
  t: TelegramAuthCopy;
  challengeId: string;
  maskedPhone: string;
  onSession: (s: SessionResponse) => Promise<void> | void;
  onBack: () => void;
}) {
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  const code = digits.join('');

  const submit = async (value = code) => {
    if (value.length !== 6 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<SessionResponse>('/auth/login/telegram-code', {
        method: 'POST',
        body: JSON.stringify({ challengeId, code: value }),
      });
      await onSession(res);
    } catch (err) {
      const c = (err as { code?: string }).code;
      setError(c === 'telegram_code_expired' ? t.expired : t.wrongCode);
      setDigits(['', '', '', '', '', '']);
      refs.current[0]?.focus();
    } finally {
      setBusy(false);
    }
  };

  const setAt = (i: number, raw: string) => {
    const { next, focus } = applyDigitInput(digits, i, raw);
    setDigits(next);
    refs.current[focus]?.focus();
    if (next.every(Boolean)) void submit(next.join(''));
  };

  const resend = async () => {
    try {
      await api('/auth/login/telegram-code/resend', { method: 'POST', body: JSON.stringify({ challengeId }) });
      setCooldown(RESEND_SECONDS);
      setError(null);
      toast.success(t.resent);
    } catch (err) {
      const e = err as Error & { code?: string };
      if (e.code === 'telegram_code_expired') setError(t.expired);
      else toast.error(e.message);
    }
  };

  const mm = `${Math.floor(cooldown / 60)}:${String(cooldown % 60).padStart(2, '0')}`;

  return (
    <div className="flex flex-col gap-5">
      <button type="button" onClick={onBack} className="self-start inline-flex items-center gap-1.5 min-h-10 text-sm font-medium text-[#4a5565] hover:text-[#101828]">
        <ArrowLeft className="w-4 h-4" />
        {t.back}
      </button>
      <span className="size-[52px] rounded-2xl bg-[#e9f3fb] text-[#2481cc] grid place-items-center">
        <TelegramGlyph className="w-[26px] h-[26px]" />
      </span>
      <div>
        <h2 className="text-[26px] font-extrabold tracking-tight text-[#101828] leading-8">{t.codeTitle}</h2>
        <p className="mt-2 text-sm leading-relaxed text-[#6b7280]">{t.codeBody(maskedPhone)}</p>
      </div>
      <div className="grid grid-cols-6 gap-2.5" onPaste={(e) => { e.preventDefault(); setAt(0, e.clipboardData.getData('text')); }}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => { refs.current[i] = el; }}
            inputMode="numeric"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            aria-label={t.digit(i + 1)}
            value={d}
            onChange={(e) => setAt(i, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus();
            }}
            className={`h-14 min-w-0 text-center rounded-xl border bg-white text-[22px] font-bold text-[#101828] outline-none focus:border-2 focus:border-[#2107AA] ${error ? 'border-[#fca5a5]' : 'border-[#dfe2ec]'}`}
          />
        ))}
      </div>
      {error && <p role="alert" className="-mt-2 text-sm font-medium text-[#dc2626]">{error}</p>}
      <div className="flex flex-col gap-2.5">
        <button
          type="button"
          disabled={busy || code.length !== 6}
          onClick={() => void submit()}
          className="w-full h-12 rounded-xl bg-g-blue-700 hover:bg-g-blue-800 text-white font-bold text-[15px] shadow-[0_10px_20px_-8px_rgba(33,7,170,0.45)] disabled:opacity-60 inline-flex items-center justify-center gap-2"
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          {t.confirm}
        </button>
        <a href={telegramBotLink()} target="_blank" rel="noopener noreferrer" className={telegramButtonCls}>
          {t.openBot}
        </a>
      </div>
      <p className="text-center text-[13.5px] text-[#6b7280]">
        {t.noCode}{' '}
        <button type="button" disabled={cooldown > 0} onClick={() => void resend()} className="font-semibold text-g-blue-700 disabled:text-[#9aa0ae]">
          {cooldown > 0 ? `${t.resend} · ${mm}` : t.resend}
        </button>
      </p>
    </div>
  );
}

/** "Telegram botdan davom etish": opens the bot, waits for the tap on “Tasdiqlash”, then exchanges the link for a session. */
export function TelegramLinkWait({
  t,
  token,
  deepLink,
  onSession,
  onCancel,
}: {
  t: TelegramAuthCopy;
  token: string;
  deepLink: string;
  onSession: (s: SessionResponse) => Promise<void> | void;
  onCancel: () => void;
}) {
  const done = useRef(false);

  useEffect(() => {
    const id = window.setInterval(async () => {
      if (done.current) return;
      try {
        const r = await api<{ status: 'pending' | 'approved' | 'denied' | 'expired' }>(`/auth/telegram/login-link/${encodeURIComponent(token)}`);
        if (r.status === 'pending') return;
        done.current = true;
        window.clearInterval(id);
        if (r.status === 'approved') {
          const s = await api<SessionResponse>(`/auth/telegram/login-link/${encodeURIComponent(token)}/exchange`, { method: 'POST' });
          await onSession(s);
          return;
        }
        toast.error(r.status === 'denied' ? t.denied : t.linkExpired);
        onCancel();
      } catch {
        /* transient — keep polling until the link expires */
      }
    }, 2000);
    return () => window.clearInterval(id);
  }, [token, onSession, onCancel, t]);

  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      <span className="size-14 rounded-2xl bg-[#e9f3fb] text-[#2481cc] grid place-items-center">
        <TelegramGlyph className="w-7 h-7" />
      </span>
      <h2 className="text-[22px] font-extrabold tracking-tight text-[#101828]">{t.waitTitle}</h2>
      <p className="max-w-[320px] text-sm leading-relaxed text-[#6b7280]">{t.waitBody}</p>
      <Loader2 className="w-6 h-6 animate-spin text-g-blue-700" aria-hidden />
      <div className="w-full flex flex-col gap-2.5 pt-2">
        <a href={deepLink} target="_blank" rel="noopener noreferrer" className={telegramButtonCls}>
          {t.reopen}
        </a>
        <button type="button" onClick={onCancel} className="h-11 text-sm font-semibold text-[#4a5565] hover:text-[#101828]">
          {t.cancel}
        </button>
      </div>
    </div>
  );
}

/** Six single-digit boxes with auto-advance, backspace and paste. Calls onComplete when all 6 are filled. */
export function CodeInput({
  value,
  onChange,
  onComplete,
  label,
  invalid,
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  label: (n: number) => string;
  invalid?: boolean;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? '');
  const put = (i: number, raw: string) => {
    const r = applyDigitInput(digits, i, raw);
    const next = r.next.join('');
    refs.current[r.focus]?.focus();
    onChange(next);
    if (r.next.every(Boolean)) onComplete?.(next);
  };
  return (
    <div className="grid grid-cols-6 gap-2" onPaste={(e) => { e.preventDefault(); put(0, e.clipboardData.getData('text')); }}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          aria-label={label(i + 1)}
          value={d}
          onChange={(e) => put(i, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus();
          }}
          className={`h-[52px] min-w-0 text-center rounded-xl border bg-white text-[21px] font-bold text-[#101828] outline-none focus:border-2 focus:border-[#2107AA] ${invalid ? 'border-[#fca5a5]' : 'border-[#dfe2ec]'}`}
        />
      ))}
    </div>
  );
}
