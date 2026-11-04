import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from './ui/utils';
import { useLearnerCopy } from '../lib/learnerLocaleContext';
import { languageLabel } from '../lib/types';
import { CatalogLanguageFlag } from './CatalogLanguageFlag';

export type LanguageOption = {
  code: string;
  name: string;
  nativeName?: string;
  flagEmoji?: string;
};

function matchesQuery(lang: LanguageOption, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    lang.code.toLowerCase().includes(q) ||
    lang.name.toLowerCase().includes(q) ||
    (lang.nativeName ?? '').toLowerCase().includes(q)
  );
}

function display(lang?: LanguageOption, code?: string) {
  return {
    code: code ?? lang?.code ?? '',
    // WL4-06: a language is shown by its own name (Oʻzbekcha, Русский…), never only the English one.
    name: lang?.nativeName || lang?.name || languageLabel(code ?? lang?.code),
  };
}

export function LanguageSearchInput({
  options,
  value,
  onChange,
  exclude = [],
  multiple = true,
  placeholder,
  id,
  labelledBy,
}: {
  options: LanguageOption[];
  value: string[];
  onChange: (codes: string[]) => void;
  exclude?: string[];
  multiple?: boolean;
  placeholder?: string;
  id?: string;
  /** WL4-08: id of the visible label for this input. */
  labelledBy?: string;
}) {
  const copy = useLearnerCopy();
  const resolvedPlaceholder = placeholder ?? copy.languageInput.searchPlaceholder;
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => value.map((code) => options.find((l) => l.code === code) ?? { code, name: languageLabel(code) }),
    [options, value],
  );

  const suggestions = useMemo(() => {
    const used = new Set([...value, ...exclude]);
    return options.filter((l) => !used.has(l.code) && matchesQuery(l, query)).slice(0, 8);
  }, [exclude, options, query, value]);

  useEffect(() => {
    const onDoc = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    // W-17: pointerdown also covers touch, so a tap on "Create free account" closes the list first.
    document.addEventListener('pointerdown', onDoc);
    return () => document.removeEventListener('pointerdown', onDoc);
  }, []);

  useEffect(() => {
    setActive(0);
  }, [query, suggestions.length]);

  const add = (code: string) => {
    if (!code || value.includes(code) || exclude.includes(code)) return;
    onChange(multiple ? [...value, code] : [code]);
    setQuery('');
    // W-17: close after each pick. The open list sat over the submit button and intercepted the tap.
    // Typing (or ArrowDown) re-opens it to add another language.
    setOpen(false);
    if (multiple) inputRef.current?.focus();
  };

  const remove = (code: string) => {
    onChange(value.filter((c) => c !== code));
    inputRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !query && value.length > 0) {
      e.preventDefault();
      remove(value[value.length - 1]);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, Math.max(suggestions.length - 1, 0)));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === 'Enter') {
      if (!query.trim()) return;
      e.preventDefault();
      const pick = suggestions[active] ?? suggestions[0];
      if (pick) add(pick.code);
    }
    if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div
      ref={rootRef}
      className="relative"
      onBlur={(e) => {
        if (!rootRef.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <div
        className={cn(
          'min-h-11 w-full px-2.5 py-1.5 bg-[#f9fafb] border border-[#e5e7eb] rounded-[14px] flex flex-wrap items-center gap-1.5',
          'focus-within:ring-2 focus-within:ring-g-blue-700/20 focus-within:border-g-blue-700 focus-within:bg-white transition-all',
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {selected.map((lang) => {
          const { code, name } = display(lang, lang.code);
          return (
            <span
              key={lang.code}
              className="inline-flex items-center gap-1 max-w-full h-7 pl-1.5 pr-1 rounded-lg bg-g-blue-50 border border-g-blue-200 text-xs font-semibold text-g-blue-700"
            >
              <CatalogLanguageFlag code={code} />
              <span className="truncate">{name}</span>
              <button
                type="button"
                className="size-5 grid place-items-center rounded-md text-g-blue-700 hover:bg-white/80"
                aria-label={copy.languageInput.remove(name)}
                onClick={(e) => {
                  e.stopPropagation();
                  remove(lang.code);
                }}
              >
                <X className="size-3" />
              </button>
            </span>
          );
        })}
        <div className="flex-1 min-w-[8rem] flex items-center gap-1.5 px-1">
          {selected.length === 0 && <Search className="size-3.5 text-[#9ca3af] shrink-0" />}
          <input
            ref={inputRef}
            id={id}
            aria-labelledby={labelledBy}
            value={query}
            autoComplete="off"
            spellCheck={false}
            placeholder={
              selected.length === 0
                ? resolvedPlaceholder
                : multiple
                  ? copy.languageInput.addAnother
                  : resolvedPlaceholder
            }
            className="w-full min-w-0 h-8 bg-transparent text-sm text-[#101828] placeholder:text-[#9ca3af] outline-none"
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onClick={() => setOpen(true)}
            onKeyDown={onKeyDown}
          />
        </div>
      </div>
      {open && (
        <div className="absolute z-20 mt-1.5 w-full max-h-56 overflow-y-auto rounded-[14px] border border-[#e5e7eb] bg-white shadow-[0_12px_24px_rgba(15,23,42,0.12)]">
          {suggestions.length === 0 ? (
            <div className="px-3 py-2.5 text-sm text-[#9ca3af]">{copy.languageInput.noMatch}</div>
          ) : (
            suggestions.map((lang, idx) => {
              const { code, name } = display(lang, lang.code);
              return (
                <button
                  key={lang.code}
                  type="button"
                  className={cn(
                    'w-full px-3 py-2 flex items-center gap-2 text-left text-sm',
                    idx === active ? 'bg-g-blue-50 text-g-blue-700' : 'text-[#101828] hover:bg-[#f9fafb]',
                  )}
                  onMouseEnter={() => setActive(idx)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => add(lang.code)}
                >
                  <CatalogLanguageFlag code={code} />
                  <span className="font-medium">{name}</span>
                  {lang.name && lang.name !== name ? (
                    <span className="text-xs text-[#9ca3af] truncate">{lang.name}</span>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
