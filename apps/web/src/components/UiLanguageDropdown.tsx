import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { UI_LANGUAGE_PICKER, UI_LANGUAGES, type UiLanguage } from '@gotcha/shared';
import { UiLanguageFlag } from './UiLanguageFlag';

type PickerLanguage = UiLanguage;

const MENU_MIN_WIDTH = 168;
const MENU_GAP_PX = 6;

export interface UiLanguageDropdownProps {
  value: PickerLanguage;
  onChange: (code: PickerLanguage) => void;
  ariaLabel: string;
  className?: string;
}

function MenuPortal({
  open,
  onClose,
  anchorRef,
  ariaLabel,
  children,
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  ariaLabel: string;
  children: ReactNode;
}) {
  const menuRef = useRef<HTMLUListElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number; minWidth: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) {
      setPos(null);
      return;
    }
    const update = () => {
      const rect = anchorRef.current!.getBoundingClientRect();
      setPos({
        top: rect.bottom + MENU_GAP_PX,
        right: window.innerWidth - rect.right,
        minWidth: Math.max(rect.width, MENU_MIN_WIDTH),
      });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !pos) return null;

  return createPortal(
    <>
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close language menu"
        className="fixed inset-0 z-[100] cursor-default bg-transparent"
        onClick={onClose}
      />
      <ul
        ref={menuRef}
        role="listbox"
        aria-label={ariaLabel}
        style={{ top: pos.top, right: pos.right, minWidth: pos.minWidth }}
        className="fixed z-[110] overflow-hidden rounded-xl border border-[#e5e7eb] bg-white py-1 shadow-lg shadow-slate-900/10"
      >
        {children}
      </ul>
    </>,
    document.body,
  );
}

export function UiLanguageDropdown({
  value,
  onChange,
  ariaLabel,
  className = '',
}: UiLanguageDropdownProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const current = UI_LANGUAGE_PICKER[value];

  const menuItems = UI_LANGUAGES.map((code) => {
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
            selected ? 'bg-[#155dfc] text-white' : 'text-[#101828] hover:bg-g-learning-bg'
          }`}
        >
          <UiLanguageFlag lang={code} />
          <span className="truncate font-medium lg:hidden">{item.shortName}</span>
          <span className="hidden truncate font-medium lg:inline">{item.nativeName}</span>
        </button>
      </li>
    );
  });

  return (
    <div className={`relative shrink-0 ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={`${ariaLabel}: ${current.nativeName}`}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#c7d2fe] bg-white px-2 text-xs font-semibold text-[#364153] transition-colors hover:border-[#a5b4fc] hover:bg-[#fafaff] touch-manipulation lg:h-9 lg:gap-2 lg:px-3 lg:text-sm"
      >
        <UiLanguageFlag lang={value} />
        <span className="truncate lg:hidden">{current.shortName}</span>
        <span className="hidden max-w-[5.75rem] truncate lg:inline">{current.nativeName}</span>
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

      <MenuPortal open={open} onClose={() => setOpen(false)} anchorRef={triggerRef} ariaLabel={ariaLabel}>
        {menuItems}
      </MenuPortal>
    </div>
  );
}
