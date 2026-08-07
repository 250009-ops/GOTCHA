import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Brain, Loader2, Search } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { ContentItem, VocabItem } from '../lib/types';
import { cn } from './ui/utils';

interface ContentListResponse {
  items: ContentItem[];
  total: number;
}

type ResultItem =
  | { kind: 'content'; item: ContentItem }
  | { kind: 'vocab'; item: VocabItem };

const MAX_PER_SECTION = 5;

export function GlobalSearch() {
  const navigate = useNavigate();
  const { vocabItems } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [contentHits, setContentHits] = useState<ContentItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);

  const vocabHits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return vocabItems
      .filter(
        (v) =>
          v.lemma.toLowerCase().includes(q) ||
          v.translation.toLowerCase().includes(q),
      )
      .slice(0, MAX_PER_SECTION);
  }, [query, vocabItems]);

  const results = useMemo<ResultItem[]>(() => {
    const content = contentHits.slice(0, MAX_PER_SECTION).map((item) => ({ kind: 'content' as const, item }));
    const vocab = vocabHits.map((item) => ({ kind: 'vocab' as const, item }));
    return [...content, ...vocab];
  }, [contentHits, vocabHits]);

  const updateCoords = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = Math.min(Math.max(rect.width, 280), window.innerWidth - 16);
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
    setCoords({ top: rect.bottom + 8, left, width });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
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
    if (!q) {
      setContentHits([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      api<ContentListResponse>(`/content?q=${encodeURIComponent(q)}&pageSize=${MAX_PER_SECTION}`)
        .then((res) => {
          if (!cancelled) setContentHits(res.items ?? []);
        })
        .catch(() => {
          if (!cancelled) setContentHits([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, contentHits, vocabHits]);

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
    (result: ResultItem) => {
      setOpen(false);
      setQuery('');
      if (result.kind === 'content') {
        navigate(`/app/read/${result.item.id}`);
      } else {
        navigate(`/app/vocabulary?q=${encodeURIComponent(result.item.lemma)}`);
      }
    },
    [navigate],
  );

  return (
    <div className="relative w-full">
      <label className="relative w-full group block">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-violet-500 pointer-events-none" />
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
          placeholder="Search library, vocabulary…"
          className="w-full h-9 pl-9 pr-3 sm:pr-4 bg-[#f9fafb] border border-[#e5e7eb] rounded-[14px] text-sm text-gray-900 placeholder:text-[#99a1af] outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-300 focus:bg-white"
        />
      </label>

      {showPanel &&
        coords &&
        createPortal(
          <div
            ref={panelRef}
            id={listId}
            role="listbox"
            className="fixed z-[100] max-h-[min(420px,70vh)] overflow-y-auto rounded-[14px] border border-[#e5e7eb] bg-white p-2 shadow-[0_10px_24px_rgba(0,0,0,0.08)]"
            style={{ top: coords.top, left: coords.left, width: coords.width }}
          >
            {loading && results.length === 0 ? (
              <div className="flex items-center gap-2 px-3 py-4 text-sm text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin text-violet-500" />
                Searching…
              </div>
            ) : results.length === 0 ? (
              <div className="px-3 py-4 text-sm text-gray-500">No results for “{query.trim()}”</div>
            ) : (
              <div className="space-y-2">
                {contentHits.length > 0 && (
                  <section>
                    <div className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                      Library
                    </div>
                    <ul className="space-y-0.5">
                      {contentHits.slice(0, MAX_PER_SECTION).map((item, i) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={activeIndex === i}
                            onMouseEnter={() => setActiveIndex(i)}
                            onClick={() => selectResult({ kind: 'content', item })}
                            className={cn(
                              'w-full flex items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors',
                              activeIndex === i ? 'bg-violet-50' : 'hover:bg-gray-50',
                            )}
                          >
                            <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                              <BookOpen className="w-4 h-4 text-[#7f22fe]" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium text-gray-900 truncate">{item.title}</div>
                              <div className="text-xs text-gray-400 truncate capitalize">
                                {item.cefrLevel.toUpperCase()} · {item.contentType.replace('_', ' ')}
                              </div>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {vocabHits.length > 0 && (
                  <section>
                    <div className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                      Vocabulary
                    </div>
                    <ul className="space-y-0.5">
                      {vocabHits.map((item, i) => {
                        const index = contentHits.slice(0, MAX_PER_SECTION).length + i;
                        return (
                          <li key={item.id}>
                            <button
                              type="button"
                              role="option"
                              aria-selected={activeIndex === index}
                              onMouseEnter={() => setActiveIndex(index)}
                              onClick={() => selectResult({ kind: 'vocab', item })}
                              className={cn(
                                'w-full flex items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors',
                                activeIndex === index ? 'bg-violet-50' : 'hover:bg-gray-50',
                              )}
                            >
                              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                                <Brain className="w-4 h-4 text-amber-600" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium text-gray-900 truncate">{item.lemma}</div>
                                <div className="text-xs text-gray-400 truncate">{item.translation}</div>
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                )}
              </div>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
