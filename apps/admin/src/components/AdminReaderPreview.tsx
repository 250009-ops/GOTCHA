import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react';
import { api } from '../lib/api';
import { cn } from '../lib/utils';

type ReaderOutline = {
  id: string;
  segmentIndex: number;
  chapterIndex: number;
  chapterTitle: string | null;
  pageIndex: number;
  title: string | null;
  wordCount: number;
};

type ReaderBook = {
  id: string;
  title: string;
  author?: string | null;
  language: string;
  cefrLevel: string;
  wordCount: number;
  publishStatus: string;
  segments: ReaderOutline[];
};

type ReaderPage = ReaderOutline & { plainText: string };

function displayChapterTitle(title: string | undefined | null, fallbackIndex: number) {
  const raw = title?.trim().replace(/^#+\s*/, '') ?? '';
  if (!raw) return `Chapter ${fallbackIndex + 1}`;
  return raw;
}

export function AdminReaderPreview({
  contentId,
  onClose,
}: {
  contentId: string;
  onClose: () => void;
}) {
  const [book, setBook] = useState<ReaderBook | null>(null);
  const [page, setPage] = useState<ReaderPage | null>(null);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const pages = book?.segments ?? [];
  const current = pages[index];

  const chapterGroups = useMemo(() => {
    const groups: Array<{ key: number; title: string; firstIndex: number; pageCount: number }> = [];
    pages.forEach((seg, i) => {
      const key = typeof seg.chapterIndex === 'number' ? seg.chapterIndex : i;
      const last = groups[groups.length - 1];
      if (last && last.key === key) {
        last.pageCount += 1;
        return;
      }
      groups.push({
        key,
        title: displayChapterTitle(seg.chapterTitle || seg.title, groups.length),
        firstIndex: i,
        pageCount: 1,
      });
    });
    return groups;
  }, [pages]);

  const loadPage = useCallback(async (segmentIndex: number) => {
    const row = await api<ReaderPage>(`/admin/content/${contentId}/reader/page?from=${segmentIndex}`);
    setPage(row);
  }, [contentId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api<ReaderBook>(`/admin/content/${contentId}/reader`)
      .then(async (item) => {
        if (cancelled) return;
        setBook(item);
        const first = item.segments[0];
        if (first) {
          await loadPage(first.segmentIndex);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || 'Could not load reading preview.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [contentId, loadPage]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, Math.max(pages.length - 1, 0)));
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0));
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, pages.length]);

  useEffect(() => {
    if (!current) return;
    void loadPage(current.segmentIndex);
  }, [current, loadPage]);

  const go = (next: number) => {
    if (next < 0 || next >= pages.length) return;
    setIndex(next);
  };

  const chapterLabel = displayChapterTitle(
    page?.chapterTitle || page?.title || current?.chapterTitle || current?.title,
    index,
  );

  return (
    <div className="fixed inset-0 z-[80] flex items-stretch justify-center p-3 sm:p-6">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close preview" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-reader-title"
        className="relative z-10 flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-[#FDFCFF] shadow-2xl"
      >
        <header className="h-12 shrink-0 flex items-center gap-3 border-b border-[#e5e7eb] bg-white px-4">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#7008e7]">Reading preview</p>
            <h2 id="admin-reader-title" className="text-sm font-bold text-gray-900 truncate">
              {book?.title ?? 'Loading…'}
            </h2>
          </div>
          {book ? (
            <span className="hidden sm:inline text-xs text-[#99a1af] shrink-0">
              {book.cefrLevel.toUpperCase()} · {book.language.toUpperCase()} · learner trial uses the first chapter
            </span>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="size-8 rounded-lg grid place-items-center text-gray-500 hover:bg-gray-100"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </header>

        {loading ? (
          <div className="flex-1 grid place-items-center">
            <Loader2 className="size-7 text-[#7f22fe] animate-spin" />
          </div>
        ) : error ? (
          <div className="flex-1 grid place-items-center p-6 text-sm text-rose-600">{error}</div>
        ) : !pages.length ? (
          <div className="flex-1 grid place-items-center p-6 text-sm text-[#99a1af]">
            <BookOpen className="size-10 mb-3 opacity-30" />
            No reading pages yet. Analyze or ingest the book first.
          </div>
        ) : (
          <div className="flex min-h-0 flex-1">
            <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-[#e5e7eb] bg-white overflow-y-auto">
              <div className="px-4 py-3 border-b border-[#f3f4f6] text-xs font-semibold text-[#99a1af] uppercase tracking-[0.6px]">
                Chapters
              </div>
              {chapterGroups.map((group) => {
                const active = index >= group.firstIndex && index < group.firstIndex + group.pageCount;
                return (
                  <button
                    key={group.key}
                    type="button"
                    onClick={() => go(group.firstIndex)}
                    className={cn(
                      'w-full text-left px-4 py-2.5',
                      active ? 'bg-[#f5f3ff] border-r-[1.6px] border-[#7f22fe]' : 'hover:bg-gray-50',
                    )}
                  >
                    <div className={cn('text-sm font-medium truncate', active ? 'text-[#4d179a]' : 'text-[#4a5565]')}>
                      {group.title}
                    </div>
                    {group.pageCount > 1 ? (
                      <div className={cn('text-xs mt-0.5', active ? 'text-[#7008e7]' : 'text-[#99a1af]')}>
                        {group.pageCount} pages
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </aside>

            <div className="min-w-0 flex-1 flex flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="max-w-[68ch] mx-auto px-5 py-8">
                  <div className="text-xs font-semibold text-[#8e51ff] uppercase tracking-[1.2px] mb-1">
                    {index + 1} of {pages.length}
                  </div>
                  <h3 className="text-2xl font-bold text-[#101828] font-serif leading-8 mb-8">{chapterLabel}</h3>
                  <div className="text-[#1e2939] leading-[1.9] font-serif whitespace-pre-wrap">
                    {page?.plainText ?? 'Loading page…'}
                  </div>
                </div>
              </div>
              <div className="shrink-0 border-t border-[#e5e7eb] bg-white px-4 py-2.5">
                <div className="max-w-[68ch] mx-auto flex items-center justify-between gap-3">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => go(index - 1)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 disabled:opacity-40"
                  >
                    <ChevronLeft className="size-4" /> Previous
                  </button>
                  <span className="text-xs text-[#99a1af] tabular-nums">{index + 1} / {pages.length}</span>
                  <button
                    type="button"
                    disabled={index >= pages.length - 1}
                    onClick={() => go(index + 1)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#7f22fe] px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
                  >
                    Next <ChevronRight className="size-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
