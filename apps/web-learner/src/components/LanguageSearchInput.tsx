import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from './ui/utils';
import { languageFlag, languageLabel } from '../lib/types';

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
    flag: lang?.flagEmoji ?? languageFlag(code ?? lang?.code),
    name: lang?.name ?? languageLabel(code ?? lang?.code),
  };
}

export function LanguageSearchInput({
  options,
  value,
  onChange,
  exclude = [],
  multiple = true,
  placeholder = 'Search languages...',
  id,
}: {
  options: LanguageOption[];
  value: string[];
  onChange: (codes: string[]) => void;
  exclude?: string[];
  multiple?: boolean;
  placeholder?: string;
  id?: string;
}) {
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
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    setActive(0);
  }, [query, suggestions.length]);

  const add = (code: string) => {
    if (!code || value.includes(code) || exclude.includes(code)) return;
    onChange(multiple ? [...value, code] : [code]);
    setQuery('');
    setOpen(multiple);
    if (multiple) inputRef.current?.focus();
    else setOpen(false);
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
    <div ref={rootRef} className="relative">
      <div
        className={cn(
          'min-h-11 w-full px-2.5 py-1.5 bg-[#f9fafb] border border-[#e5e7eb] rounded-[14px] flex flex-wrap items-center gap-1.5',
          'focus-within:ring-2 focus-within:ring-[#7f22fe]/20 focus-within:border-[#7f22fe] focus-within:bg-white transition-all',
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {selected.map((lang) => {
          const { flag, name } = display(lang, lang.code);
          return (
            <span
              key={lang.code}
              className="inline-flex items-center gap-1 max-w-full h-7 pl-1.5 pr-1 rounded-lg bg-[#f5f3ff] border border-[#ddd6fe] text-xs font-semibold text-[#7008e7]"
            >
              <span className="leading-none">{flag}</span>
              <span className="truncate">{name}</span>
              {multiple || selected.length > 1 ? (
                <button
                  type="button"
                  className="size-5 grid place-items-center rounded-md text-[#7f22fe] hover:bg-white/80"
                  aria-label={`Remove ${name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(lang.code);
                  }}
                >
                  <X className="size-3" />
                </button>
              ) : null}
            </span>
          );
        })}
        <div className="flex-1 min-w-[8rem] flex items-center gap-1.5 px-1">
          {selected.length === 0 && <Search className="size-3.5 text-[#9ca3af] shrink-0" />}
          <input
            ref={inputRef}
            id={id}
            value={query}
            autoComplete="off"
            spellCheck={false}
            placeholder={selected.length === 0 ? placeholder : multiple ? 'Add another…' : placeholder}
            className="w-full min-w-0 h-8 bg-transparent text-sm text-[#101828] placeholder:text-[#9ca3af] outline-none"
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
          />
        </div>
      </div>
      {open && (
        <div className="absolute z-20 mt-1.5 w-full max-h-56 overflow-y-auto rounded-[14px] border border-[#e5e7eb] bg-white shadow-[0_12px_24px_rgba(15,23,42,0.12)]">
          {suggestions.length === 0 ? (
            <div className="px-3 py-2.5 text-sm text-[#9ca3af]">No matching language</div>
          ) : (
            suggestions.map((lang, idx) => {
              const { flag, name } = display(lang, lang.code);
              return (
                <button
                  key={lang.code}
                  type="button"
                  className={cn(
                    'w-full px-3 py-2 flex items-center gap-2 text-left text-sm',
                    idx === active ? 'bg-[#f5f3ff] text-[#7008e7]' : 'text-[#101828] hover:bg-[#f9fafb]',
                  )}
                  onMouseEnter={() => setActive(idx)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => add(lang.code)}
                >
                  <span className="text-base leading-none">{flag}</span>
                  <span className="font-medium">{name}</span>
                  {lang.nativeName && lang.nativeName !== name ? (
                    <span className="text-xs text-[#9ca3af] truncate">{lang.nativeName}</span>
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
