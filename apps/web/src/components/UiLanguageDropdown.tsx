import { useEffect, useRef, useState } from 'react';
import { UI_LANGUAGE_PICKER, UI_LANGUAGES, type UiLanguage } from '@gotcha/shared';
import { UiLanguageFlag } from './UiLanguageFlag';

type PickerLanguage = UiLanguage;

export interface UiLanguageDropdownProps {
  value: PickerLanguage;
  onChange: (code: PickerLanguage) => void;
  ariaLabel: string;
  className?: string;
  /** Open upward from sticky headers so the menu does not cover page content below. */
  menuPlacement?: 'bottom' | 'top';
}

export function UiLanguageDropdown({
  value,
  onChange,
  ariaLabel,
  className = '',
  menuPlacement = 'bottom',
}: UiLanguageDropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = UI_LANGUAGE_PICKER[value];

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`relative shrink-0 ${className}`}>
      <button
        type="button"
        aria-label={`${ariaLabel}: ${current.nativeName}`}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 items-center gap-2 rounded-full border border-[#c7d2fe] bg-white px-3 text-sm font-semibold text-[#364153] transition-colors hover:border-[#a5b4fc] hover:bg-[#fafaff] touch-manipulation"
      >
        <UiLanguageFlag lang={value} />
        <span className="truncate sm:hidden">{current.shortName}</span>
        <span className="hidden max-w-[5.75rem] truncate sm:inline">{current.nativeName}</span>
        <svg
          className={`h-3.5 w-3.5 shrink-0 opacity-60 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={ariaLabel}
          className={`absolute right-0 z-[120] min-w-[10.5rem] overflow-hidden rounded-xl border border-[#e5e7eb] bg-white py-1 shadow-lg shadow-slate-900/10 ${
            menuPlacement === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          }`}
        >
          {UI_LANGUAGES.map((code) => {
            const item = UI_LANGUAGE_PICKER[code];
            const selected = code === value;
            return (
              <li key={code} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  aria-label={item.nativeName}
                  onClick={() => {
                    onChange(code);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${
                    selected ? 'bg-[#155dfc] text-white' : 'text-[#101828] hover:bg-[#eff6ff]'
                  }`}
                >
                  <UiLanguageFlag lang={code} />
                  <span className="truncate font-medium sm:hidden">{item.shortName}</span>
                  <span className="hidden truncate font-medium sm:inline">{item.nativeName}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
