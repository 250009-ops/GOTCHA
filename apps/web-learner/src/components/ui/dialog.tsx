import * as React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from './utils';

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  /** Visible title. Also names the dialog for assistive tech. */
  title?: string;
  /** Accessible name when there is no visible title. */
  label?: string;
  closeLabel?: string;
}

export function Dialog({ open, onOpenChange, children, title, label, closeLabel }: DialogProps) {
  const titleId = React.useId();
  const panelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const focusable = () =>
      [...(panel?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])].filter((el) => !el.hasAttribute('disabled') && el.tabIndex !== -1);
    const timer = window.setTimeout(() => {
      const list = focusable();
      const field = list.find((el) => el.matches('input, select, textarea'));
      (field ?? list[0])?.focus();
      if (!title && !label && panel && !panel.getAttribute('aria-label') && !panel.getAttribute('aria-labelledby')) {
        const heading = panel.querySelector('h1, h2');
        if (heading) {
          if (!heading.id) heading.id = titleId;
          panel.setAttribute('aria-labelledby', heading.id);
        }
      }
    }, 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onOpenChange(false);
        return;
      }
      if (e.key !== 'Tab') return;
      const list = focusable();
      if (!list.length) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onOpenChange, title, label, titleId]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : label}
        className="relative bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-auto animate-in fade-in-0 zoom-in-95"
      >
        {title ? (
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <h2 id={titleId} className="font-semibold text-gray-900 text-lg">{title}</h2>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label={closeLabel}
              className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        ) : null}
        {children}
      </div>
    </div>,
    document.body,
  );
}

interface DialogHeaderProps {
  children: React.ReactNode;
  onClose?: () => void;
  closeLabel?: string;
  className?: string;
}

export function DialogHeader({ children, onClose, closeLabel, className }: DialogHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between p-5 border-b border-gray-100', className)}>
      <div className="font-semibold text-gray-900 text-lg">{children}</div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}

interface DialogContentProps {
  children: React.ReactNode;
  className?: string;
}

export function DialogContent({ children, className }: DialogContentProps) {
  return <div className={cn('p-5', className)}>{children}</div>;
}

interface DialogFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function DialogFooter({ children, className }: DialogFooterProps) {
  return (
    <div className={cn('flex items-center justify-end gap-3 p-5 pt-0', className)}>
      {children}
    </div>
  );
}
