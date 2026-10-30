import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { CatalogLanguageFlag } from './CatalogLanguageFlag';
import { cn } from './ui/utils';

export type CatalogLanguageOption = {
  code: string;
  name: string;
  nativeName?: string;
};

const MENU_MIN_WIDTH = 168;
const MENU_GAP_PX = 6;

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
  children: React.ReactNode;
}) {
  const [pos, setPos] = useState<{ top: number; left: number; minWidth: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) {
      setPos(null);
      return;
    }
    const update = () => {
      const rect = anchorRef.current!.getBoundingClientRect();
      setPos({
        top: rect.bottom + MENU_GAP_PX,
        left: rect.left,
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
        role="listbox"
        aria-label={ariaLabel}
        style={{ top: pos.top, left: pos.left, minWidth: pos.minWidth }}
        className="fixed z-[110] overflow-hidden rounded-xl border border-[#e5e7eb] bg-white py-1 shadow-lg shadow-slate-900/10"
      >
        {children}
      </ul>
    </>,
    document.body,
  );
}

export function CatalogLanguageDropdown({
  value,
  onChange,
  options,
  ariaLabel,
  disabled,
  className,
}: {
  value: string;
  onChange: (code: string) => void;
  options: CatalogLanguageOption[];
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const current = options.find((o) => o.code === value) ?? options[0];

  const menuItems = options.map((item) => {
    const selected = item.code === value;
    return (
      <li key={item.code} role="presentation">
        <button
          type="button"
          role="option"
          aria-selected={selected}
          aria-label={item.name}
          onClick={() => {
            onChange(item.code);
            setOpen(false);
          }}
          className={cn(
            'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors',
            selected ? 'bg-[#155dfc] text-white' : 'text-[#101828] hover:bg-[#eff6ff]',
          )}
        >
          <CatalogLanguageFlag code={item.code} />
          <span className="truncate font-medium lg:hidden">{item.code.toUpperCase()}</span>
          <span className="hidden truncate font-medium lg:inline">{item.name}</span>
        </button>
      </li>
    );
  });

  return (
    <div className={cn('relative min-w-0 max-w-full', className)}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-label={`${ariaLabel}: ${current?.name ?? value}`}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => !disabled && setOpen((v) => !v)}
        className={cn(
          'inline-flex h-8 w-full min-w-0 max-w-full items-center gap-1.5 rounded-full border border-[#c7d2fe] bg-white px-2 text-xs font-semibold text-[#364153] transition-colors hover:border-[#a5b4fc] hover:bg-[#fafaff] touch-manipulation lg:h-9 lg:gap-2 lg:px-3 lg:text-sm',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        {current && <CatalogLanguageFlag code={current.code} />}
        <span className="min-w-0 flex-1 truncate text-left lg:hidden">{current?.code.toUpperCase()}</span>
        <span className="hidden min-w-0 flex-1 truncate text-left lg:inline">{current?.name}</span>
        <ChevronDown
          className={cn('h-3.5 w-3.5 shrink-0 opacity-60 transition-transform lg:h-3.5 lg:w-3.5', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      <MenuPortal open={open} onClose={() => setOpen(false)} anchorRef={triggerRef} ariaLabel={ariaLabel}>
        {menuItems}
      </MenuPortal>
    </div>
  );
}
