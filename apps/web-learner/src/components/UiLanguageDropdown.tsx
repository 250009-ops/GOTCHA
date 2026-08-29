import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { UI_LANGUAGE_PICKER, UI_LANGUAGES, type UiLanguage } from '@gotcha/shared';
import { cn } from './ui/utils';

export interface UiLanguageDropdownProps {
  value: UiLanguage;
  onChange: (code: UiLanguage) => void;
  ariaLabel: string;
  className?: string;
  /** Purple auth panel — light text on translucent background */
  variant?: 'default' | 'light';
  compact?: boolean;
}

export function UiLanguageDropdown({
  value,
  onChange,
  ariaLabel,
  className,
  variant = 'default',
  compact = false,
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

  const isLight = variant === 'light';

  return (
    <div ref={rootRef} className={cn('relative shrink-0', className)}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border font-semibold transition-colors touch-manipulation',
          compact ? 'h-8 px-2.5 text-xs' : 'h-9 px-3 text-sm',
          isLight
            ? 'border-white/25 bg-white/10 text-white hover:bg-white/15'
            : 'border-[#c7d2fe] bg-white text-[#364153] hover:border-[#a5b4fc] hover:bg-[#fafaff]',
        )}
      >
        <span className={cn('leading-none', compact ? 'text-sm' : 'text-base')} aria-hidden>
          {current.flag}
        </span>
        <span
          className={cn(
            'font-bold tracking-wide',
            compact ? 'text-[10px]' : 'text-[11px]',
            isLight ? 'text-white/85' : 'text-[#6366f1]',
          )}
        >
          {current.shortCode}
        </span>
        <span className={cn('truncate', compact ? 'max-w-[4.5rem]' : 'max-w-[5.75rem]')}>
          {current.nativeName}
        </span>
        <ChevronDown
          className={cn(
            'shrink-0 opacity-60 transition-transform',
            compact ? 'w-3 h-3' : 'w-3.5 h-3.5',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={ariaLabel}
          className={cn(
            'absolute right-0 z-[120] mt-1.5 min-w-[11rem] overflow-hidden rounded-xl border bg-white py-1 shadow-lg shadow-slate-900/10',
            isLight ? 'border-white/20' : 'border-[#e5e7eb]',
          )}
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
                  onClick={() => {
                    onChange(code);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium transition-colors',
                    selected
                      ? 'bg-[#155dfc] text-white'
                      : 'text-[#101828] hover:bg-[#eff6ff]',
                  )}
                >
                  <span className="text-base leading-none" aria-hidden>
                    {item.flag}
                  </span>
                  <span
                    className={cn(
                      'min-w-[1.75rem] text-[11px] font-bold tracking-wide',
                      selected ? 'text-white/90' : 'text-[#6366f1]',
                    )}
                  >
                    {item.shortCode}
                  </span>
                  <span className="truncate">{item.nativeName}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
