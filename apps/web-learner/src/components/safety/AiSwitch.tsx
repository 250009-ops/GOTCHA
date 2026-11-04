import { useState } from 'react';
import { api } from '../../lib/api';

/** Learner AI-off switch (Kai 31 Oct). Same per-account flag support uses; a support lock can't be undone here. */
const T = {
  en: { title: 'AI features', privacyTitle: 'Privacy & AI', hint: 'Word lookups, translations, quizzes and pronunciation use AI. Turn this off to stop all AI features for your account.', on: 'On', off: 'Off', locked: 'Turned off by support. Contact support@gotchaa.uz to turn them back on.', saveFailed: 'Couldn’t save' },
  ru: { title: 'Функции ИИ', privacyTitle: 'Конфиденциальность и ИИ', hint: 'Поиск слов, переводы, тесты и произношение работают с помощью ИИ. Выключите, чтобы отключить все функции ИИ для вашего аккаунта.', on: 'Вкл.', off: 'Выкл.', locked: 'Отключено поддержкой. Чтобы включить, напишите на support@gotchaa.uz.', saveFailed: 'Не удалось сохранить' },
  uz: { title: 'AI funksiyalari', privacyTitle: 'Maxfiylik va AI', hint: 'Soʻz qidirish, tarjima, testlar va talaffuz AI yordamida ishlaydi. Hisobingiz uchun barcha AI funksiyalarini oʻchirish uchun buni oʻchiring.', on: 'Yoqilgan', off: 'Oʻchirilgan', locked: 'Qoʻllab-quvvatlash xizmati oʻchirgan. Qayta yoqish uchun support@gotchaa.uz manziliga yozing.', saveFailed: 'Saqlab boʻlmadi' },
};
export const aiSwitchText = (lang?: string | null) => T[lang === 'ru' || lang === 'uz' ? lang : 'en'];

export function AiSwitch({ lang, aiDisabled, aiDisabledBy, onChanged }: {
  lang?: string | null; aiDisabled?: boolean; aiDisabledBy?: string | null; onChanged: () => Promise<void> | void;
}) {
  const t = aiSwitchText(lang);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const enabled = !aiDisabled;
  const locked = !!aiDisabled && aiDisabledBy === 'admin';
  return (
    <div className="flex items-center gap-4 px-4 sm:px-5 py-3.5 min-w-0 min-h-[60px]">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[#101828]">{t.title}</p>
        <p className="text-[12.5px] text-[#6b7080] mt-0.5 leading-snug">{locked ? t.locked : t.hint}</p>
        {err && <p className="text-xs text-red-600 mt-1">{err}</p>}
      </div>
      <span aria-hidden className={`hidden sm:inline text-[12.5px] font-semibold shrink-0 ${enabled ? 'text-[#047857]' : 'text-[#6b7080]'}`}>{enabled ? t.on : t.off}</span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={t.title}
        disabled={busy || locked}
        onClick={async () => {
          setBusy(true); setErr(null);
          try {
            await api('/users/me/ai', { method: 'PATCH', body: JSON.stringify({ aiDisabled: enabled }) });
            await onChanged();
          } catch (e) {
            const code = (e as { code?: string }).code;
            setErr(code === 'AI_DISABLED_BY_SUPPORT' || code === 'AI_DISABLED' ? t.locked : (e instanceof Error ? e.message : t.saveFailed));
          } finally { setBusy(false); }
        }}
        className="relative inline-flex h-11 w-12 shrink-0 items-center justify-end rounded-full disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-g-blue-700"
      >
        <span className={`relative inline-flex h-6 w-[42px] items-center rounded-full transition-colors ${enabled ? 'bg-g-blue-700' : 'bg-[#d8dbe5]'}`}>
          <span className={`inline-block h-[18px] w-[18px] rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-[21px]' : 'translate-x-[3px]'}`} />
        </span>
      </button>
    </div>
  );
}
