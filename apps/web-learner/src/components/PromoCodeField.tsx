import { useState } from 'react';
import { promoCopyFor } from '@gotcha/shared';
import { useLearnerLocale } from '../lib/learnerLocaleContext';

/** Collapsible promo code input for paywalls. Validation happens server-side (quote/checkout). */
export function PromoCodeField({
  applied,
  onApply,
  onRemove,
  busy,
}: {
  applied: string | null;
  onApply: (code: string) => void | Promise<void>;
  onRemove: () => void;
  busy?: boolean;
}) {
  const { locale } = useLearnerLocale();
  const t = promoCopyFor(locale);
  const [value, setValue] = useState('');
  const [open, setOpen] = useState(false);
  if (applied) {
    return (
      <div className="w-full flex items-center justify-between rounded-xl bg-g-ok-bg px-3 py-2 text-sm">
        <span className="font-semibold text-g-ok">{t.applied(applied)}</span>
        <button type="button" className="text-xs font-semibold text-g-text-2 underline" onClick={onRemove}>{t.remove}</button>
      </div>
    );
  }
  if (!open) {
    return (
      <button type="button" className="text-sm font-semibold text-g-accent underline-offset-2 hover:underline" onClick={() => setOpen(true)}>
        {t.label}
      </button>
    );
  }
  return (
    <form
      className="w-full flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim().length >= 3) void onApply(value.trim().toUpperCase());
      }}
    >
      <input
        aria-label={t.label}
        value={value}
        onChange={(e) => setValue(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 32))}
        placeholder={t.placeholder}
        autoCapitalize="characters"
        className="flex-1 h-11 px-3 rounded-[12px] bg-g-input border border-g-line-input text-sm font-mono tracking-wide text-g-text outline-none focus:ring-2 focus:ring-g-accent/20 focus:border-g-accent"
      />
      <button type="submit" disabled={busy || value.trim().length < 3} className="h-11 px-4 rounded-[12px] bg-g-cta text-white text-sm font-bold disabled:opacity-50">
        {t.apply}
      </button>
    </form>
  );
}
