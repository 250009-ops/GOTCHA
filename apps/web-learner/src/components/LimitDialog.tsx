import { useEffect, useState } from 'react';
import { LIMIT_COPY, limitLang, type LimitNotice } from '@gotcha/shared';
import { LIMIT_EVENT } from '../lib/limits';

/** final-5 B5: limit screen. Resets are always 00:00 Asia/Tashkent (monthly pages: the 1st). */
export function LimitDialog({ lang }: { lang: string }) {
  const [notice, setNotice] = useState<LimitNotice | null>(null);
  useEffect(() => {
    const on = (ev: Event) => setNotice((ev as CustomEvent<LimitNotice>).detail);
    window.addEventListener(LIMIT_EVENT, on);
    return () => window.removeEventListener(LIMIT_EVENT, on);
  }, []);
  if (!notice) return null;
  return (
    <div role="dialog" aria-modal="true" data-testid="limit-screen" className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-[14px] bg-white p-5 shadow-xl">
        <h2 className="text-lg font-bold text-[#101828]">{notice.title}</h2>
        <p className="mt-2 text-sm text-[#4a5565]">{notice.body}</p>
        <p className="mt-2 text-sm font-semibold text-g-blue-700" data-testid="limit-reset">{notice.reset}</p>
        <button type="button" onClick={() => setNotice(null)} className="mt-4 h-10 w-full rounded-[14px] bg-g-blue-600 text-sm font-semibold text-white">
          {LIMIT_COPY[limitLang(lang)].ok}
        </button>
      </div>
    </div>
  );
}
