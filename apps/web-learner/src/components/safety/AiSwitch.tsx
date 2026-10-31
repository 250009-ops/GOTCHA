import { useState } from 'react';
import { api } from '../../lib/api';

/** Learner AI-off switch (Kai 31 Oct). Same per-account flag support uses; a support lock can't be undone here. */
const T = {
  en: { title: 'AI features', hint: 'Word lookups, translations, quizzes and pronunciation use AI. Turn this off to stop all AI features for your account.', on: 'On', off: 'Off', locked: 'Turned off by support. Contact support@gotchaa.uz to turn them back on.' },
  ru: { title: 'Функции ИИ', hint: 'Поиск слов, переводы, тесты и произношение работают с помощью ИИ. Выключите, чтобы отключить все функции ИИ для вашего аккаунта.', on: 'Вкл.', off: 'Выкл.', locked: 'Отключено поддержкой. Чтобы включить, напишите на support@gotchaa.uz.' },
  uz: { title: 'AI funksiyalari', hint: 'Soʻz qidirish, tarjima, testlar va talaffuz AI yordamida ishlaydi. Hisobingiz uchun barcha AI funksiyalarini oʻchirish uchun buni oʻchiring.', on: 'Yoqilgan', off: 'Oʻchirilgan', locked: 'Qoʻllab-quvvatlash xizmati oʻchirgan. Qayta yoqish uchun support@gotchaa.uz manziliga yozing.' },
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
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-4 sm:px-5 py-4 min-w-0">
      <div className="min-w-0 sm:flex-1">
        <p className="text-sm font-medium text-[#0a0a0a]">{t.title}</p>
        <p className="text-xs text-[#99a1af] mt-0.5">{locked ? t.locked : t.hint}</p>
        {err && <p className="text-xs text-red-600 mt-1">{err}</p>}
      </div>
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
          } catch (e) { setErr(e instanceof Error ? e.message : 'Error'); } finally { setBusy(false); }
        }}
        className={`h-8 px-3 rounded-full text-sm font-medium shrink-0 disabled:opacity-60 ${enabled ? 'bg-g-blue-700 text-white' : 'bg-gray-200 text-gray-700'}`}
      >
        {enabled ? t.on : t.off}
      </button>
    </div>
  );
}
