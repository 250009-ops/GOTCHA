import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { mashqCopy } from '@gotcha/shared';
import { useLearnerLocale } from '../../lib/learnerLocaleContext';

export function MashqSheet({
  open,
  remaining,
  missedToday,
  starting,
  onClose,
  onStart,
}: {
  open: boolean;
  remaining: number | null;
  missedToday: number;
  starting: boolean;
  onClose: () => void;
  onStart: (count: number, repeatMissed: boolean) => void;
}) {
  const { locale } = useLearnerLocale();
  const copy = mashqCopy(locale);
  const choices = useMemo(() => {
    const all = [3, 5, 10, 15, 20];
    if (remaining == null) return all;
    return all.filter((n) => n <= remaining);
  }, [remaining]);
  const [count, setCount] = useState(5);
  const picked = choices.includes(count) ? count : (choices[0] ?? 0);
  if (!open) return null;
  const blocked = remaining === 0;
  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/30" onClick={onClose}>
      <div
        role="dialog"
        aria-label={copy.cardTitle}
        className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-[#101828]">{copy.cardTitle}</h2>
        <p className="text-sm text-[#4a5565] mt-1">{blocked ? copy.limitBody : copy.cardBody}</p>
        {blocked ? (
          <div className="mt-4">
            <div className="text-sm font-semibold text-[#101828] mb-3">{copy.limitTitle}</div>
            <Link to="/app/plus" className="inline-flex h-11 items-center justify-center rounded-xl bg-g-blue-700 px-4 text-sm font-semibold text-white">
              {copy.seePlus}
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-4 text-xs font-semibold text-[#6b7280]">{copy.howMany}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {choices.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCount(n)}
                  className={`h-11 min-w-11 px-3 rounded-xl border text-sm font-semibold ${picked === n ? 'border-g-blue-700 bg-g-blue-50 text-g-blue-700' : 'border-[#e5e7eb] text-[#4a5565]'}`}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={starting || picked < 3}
                onClick={() => onStart(picked, false)}
                className="h-11 px-4 rounded-xl bg-g-blue-700 text-white text-sm font-semibold disabled:opacity-50"
              >
                {copy.start}
              </button>
              {missedToday > 0 ? (
                <button
                  type="button"
                  disabled={starting}
                  onClick={() => onStart(Math.min(picked, missedToday), true)}
                  className="h-11 px-4 rounded-xl border border-[#e5e7eb] text-sm font-semibold text-[#1e2939]"
                >
                  {copy.repeat}
                </button>
              ) : null}
              <button type="button" onClick={onClose} className="h-11 px-4 rounded-xl text-sm font-semibold text-[#6b7280]">
                {copy.later}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
