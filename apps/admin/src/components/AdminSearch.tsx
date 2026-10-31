import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  CreditCard,
  Globe2,
  Loader2,
  Search,
  Ticket,
  Users,
  Bell,
} from 'lucide-react';
import { api } from '../lib/api';
import { cn } from '../lib/utils';

export interface SearchHit {
  id: string;
  type: 'user' | 'content' | 'ticket' | 'campaign' | 'language' | 'subscription';
  title: string;
  subtitle: string;
  href: string;
}

interface SearchResponse {
  q: string;
  results: SearchHit[];
}

const typeIcon = {
  user: Users,
  content: BookOpen,
  ticket: Ticket,
  campaign: Bell,
  language: Globe2,
  subscription: CreditCard,
} as const;

const typeLabel = {
  user: 'Users',
  content: 'Content',
  ticket: 'Support',
  campaign: 'Campaigns',
  language: 'Languages',
  subscription: 'Import & Pricing',
} as const;

export function AdminSearch({ className }: { className?: string }) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchHit[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);

  const updateCoords = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setCoords({ top: rect.bottom + 8, left: rect.left, width: Math.max(rect.width, 360) });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing =
        tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
        return;
      }
      if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 1) {
      setResults([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      api<SearchResponse>(`/admin/search?q=${encodeURIComponent(q)}`)
        .then((res) => {
          if (!cancelled) setResults(res.results ?? []);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, results]);

  const showPanel = open && query.trim().length > 0;

  useLayoutEffect(() => {
    if (!showPanel) return;
    updateCoords();
    const onReposition = () => updateCoords();
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [showPanel, query, updateCoords]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      const t = e.target as Node;
      if (inputRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [open]);

  const selectResult = useCallback(
    (hit: SearchHit) => {
      setOpen(false);
      setQuery('');
      navigate(hit.href);
    },
    [navigate],
  );

  const grouped = results.reduce<Record<string, SearchHit[]>>((acc, hit) => {
    (acc[hit.type] ??= []).push(hit);
    return acc;
  }, {});

  return (
    <div className={cn('relative w-[260px]', className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-expanded={showPanel}
        aria-controls={listId}
        aria-autocomplete="list"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setOpen(false);
            inputRef.current?.blur();
            return;
          }
          if (!showPanel || results.length === 0) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex((i) => (i + 1) % results.length);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex((i) => (i - 1 + results.length) % results.length);
          } else if (e.key === 'Enter') {
            e.preventDefault();
            const hit = results[activeIndex];
            if (hit) selectResult(hit);
          }
        }}
        placeholder="Search user, language, billing..."
        className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-12 py-2 text-sm outline-none focus:border-[#6c1d95]"
      />
      <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 hidden sm:inline text-[10px] font-semibold text-slate-400 border border-slate-200 rounded px-1.5 py-0.5 bg-slate-50">
        /
      </kbd>

      {showPanel &&
        coords &&
        createPortal(
          <div
            ref={panelRef}
            id={listId}
            role="listbox"
            className="fixed z-[100] max-h-[min(420px,70vh)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-[0_12px_28px_rgba(15,23,42,0.12)]"
            style={{ top: coords.top, left: coords.left, width: coords.width }}
          >
            {loading && results.length === 0 ? (
              <div className="flex items-center gap-2 px-3 py-4 text-sm text-slate-500">
                <Loader2 className="size-4 animate-spin text-[#6c1d95]" />
                Searching…
              </div>
            ) : results.length === 0 ? (
              <div className="px-3 py-4 text-sm text-slate-500">No results for “{query.trim()}”</div>
            ) : (
              <div className="space-y-2">
                {(Object.keys(grouped) as Array<SearchHit['type']>).map((type) => (
                  <section key={type}>
                    <div className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      {typeLabel[type]}
                    </div>
                    <ul className="space-y-0.5">
                      {grouped[type].map((hit) => {
                        const index = results.indexOf(hit);
                        const Icon = typeIcon[hit.type];
                        return (
                          <li key={`${hit.type}-${hit.id}`}>
                            <button
                              type="button"
                              role="option"
                              aria-selected={activeIndex === index}
                              onMouseEnter={() => setActiveIndex(index)}
                              onClick={() => selectResult(hit)}
                              className={cn(
                                'w-full flex items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors',
                                activeIndex === index ? 'bg-violet-50' : 'hover:bg-slate-50',
                              )}
                            >
                              <div className="size-8 rounded-lg bg-violet-100 grid place-items-center shrink-0">
                                <Icon className="size-4 text-[#6c1d95]" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium text-slate-900 truncate">{hit.title}</div>
                                <div className="text-xs text-slate-400 truncate">{hit.subtitle}</div>
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
