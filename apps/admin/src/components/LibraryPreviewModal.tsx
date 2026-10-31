import { useEffect, useState } from 'react';
import { BookOpen, Grid3X3, List, X } from 'lucide-react';
import { resolveMediaUrl } from '../lib/media';
import { cn, languageFlag } from '../lib/utils';

export type LibraryPreviewItem = {
  id: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  author?: string | null;
  language: string;
  cefrLevel: string;
  contentType: string;
  wordCount: number;
  isFree: boolean;
  priceUzs?: number;
  priceUsd?: number;
  publishStatus: string;
  coverImageKey?: string | null;
};

const COVER_GRADIENTS = [
  'linear-gradient(148deg, #8e51ff 0%, #ad46ff 50%, #4f39f6 100%)',
  'linear-gradient(142deg, #00d492 0%, #00bba7 50%, #0092b8 100%)',
  'linear-gradient(142deg, #fb2c6b 0%, #f6339a 50%, #e60076 100%)',
  'linear-gradient(148deg, #2b7fff 0%, #6a5cff 50%, #4f39f6 100%)',
];

const cefrStyle: Record<string, string> = {
  a1: 'bg-emerald-100 text-emerald-700',
  a2: 'bg-teal-100 text-teal-700',
  b1: 'bg-blue-100 text-blue-700',
  b2: 'bg-indigo-100 text-indigo-700',
  c1: 'bg-violet-100 text-[#7008e7]',
  c2: 'bg-pink-100 text-pink-700',
};

const filterTabs = ['All', 'Fiction', 'News', 'Imports', 'A1–A2', 'B1–B2', 'C1–C2'] as const;

function gradientForId(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash + id.charCodeAt(i)) % COVER_GRADIENTS.length;
  return COVER_GRADIENTS[hash];
}

function formatWordCount(count: number) {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k words`;
  return `${count} words`;
}

function formatUzs(amount: number) {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(amount)) + " soʻm";
}

function CoverArt({ item }: { item: LibraryPreviewItem }) {
  const raw = item.coverImageKey?.trim() ?? '';
  const src =
    raw.startsWith('blob:') || raw.startsWith('data:')
      ? raw
      : resolveMediaUrl(item.coverImageKey);
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;
  return (
    <div
      className="relative flex items-center justify-center overflow-hidden w-full h-full"
      style={showImage ? undefined : { backgroundImage: gradientForId(item.id) }}
    >
      {showImage ? (
        <img
          src={src ?? ''}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <BookOpen className="text-white/60 w-8 h-8 sm:w-10 sm:h-10" />
      )}
    </div>
  );
}

function LearnerCard({
  item,
  view,
  locked,
}: {
  item: LibraryPreviewItem;
  view: 'grid' | 'list';
  locked: boolean;
}) {
  const subtitle = item.subtitle ?? item.description ?? item.author ?? '';
  const price = item.priceUzs ?? item.priceUsd ?? 0;
  const showPrice = locked && !item.isFree && price > 0;

  if (view === 'list') {
    return (
      <div className="w-full flex items-center gap-4 p-3 bg-white rounded-2xl border border-gray-100/80 text-left">
        <div className="w-[3.25rem] aspect-[3/4] rounded-lg shrink-0 overflow-hidden">
          <CoverArt item={item} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-gray-900 text-sm truncate">{item.title}</div>
              {subtitle ? <div className="text-gray-400 text-xs mt-0.5 line-clamp-1">{subtitle}</div> : null}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className={cn('inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold tracking-wide', cefrStyle[item.cefrLevel] ?? 'bg-gray-100 text-gray-600')}>
                {item.cefrLevel.toUpperCase()}
              </span>
              <span className="text-sm">{languageFlag(item.language)}</span>
            </div>
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <BookOpen className="w-3 h-3" />
              {formatWordCount(item.wordCount)}
            </span>
            <span className="capitalize">{item.contentType.replace('_', ' ')}</span>
            {showPrice ? <span className="text-[#7008e7] font-semibold">{formatUzs(price)}</span> : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100/80 overflow-hidden text-left flex flex-col w-full h-full ring-2 ring-[#7008e7] ring-offset-2">
      <div className="relative shrink-0 w-full aspect-[3/4]">
        <CoverArt item={item} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
        <div className="absolute bottom-2 left-2 flex flex-wrap gap-1.5 max-w-[calc(100%-2rem)]">
          <span className={cn('inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold tracking-wide', cefrStyle[item.cefrLevel] ?? 'bg-gray-100 text-gray-600')}>
            {item.cefrLevel.toUpperCase()}
          </span>
          <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium bg-white/20 backdrop-blur text-white capitalize truncate max-w-[5rem]">
            {item.contentType.replace('_', ' ')}
          </span>
        </div>
        <div className="absolute top-2 right-2 flex items-center gap-1">
          {showPrice ? (
            <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold bg-white/90 text-[#7008e7] shadow-sm">
              {formatUzs(price)}
            </span>
          ) : null}
          <span className="text-lg leading-none drop-shadow">{languageFlag(item.language)}</span>
        </div>
      </div>
      <div className="p-3 flex-1 flex flex-col min-h-0">
        <div className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2 mb-1">{item.title}</div>
        {subtitle ? <div className="text-gray-400 text-xs line-clamp-2 mb-auto">{subtitle}</div> : <div className="mb-auto" />}
        <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-50 text-xs text-gray-400">
          <span className="flex items-center gap-1 truncate">
            <BookOpen className="w-3 h-3 shrink-0" />
            {formatWordCount(item.wordCount)}
          </span>
          <span className="text-violet-500/70 shrink-0 font-medium">{locked ? 'New' : 'Owned'}</span>
        </div>
      </div>
    </div>
  );
}

export function LibraryPreviewModal({
  item,
  onClose,
}: {
  item: LibraryPreviewItem;
  onClose: () => void;
}) {
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [locked, setLocked] = useState(!item.isFree && (item.priceUzs ?? item.priceUsd ?? 0) > 0);
  const isDraft = item.publishStatus !== 'published';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[80] flex items-stretch justify-center p-3 sm:p-6">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close preview" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="library-preview-title"
        className="relative z-10 flex w-full max-w-5xl max-h-full flex-col overflow-hidden rounded-2xl bg-[#F5F3FF] shadow-2xl"
      >
        <header className="shrink-0 flex flex-wrap items-center gap-3 border-b border-gray-200/80 bg-white px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#7008e7]">Learner library</p>
            <h2 id="library-preview-title" className="text-sm font-bold text-gray-900 truncate">
              Preview: {item.title}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-gray-200 bg-white p-0.5">
              <button
                type="button"
                className={cn('rounded-md px-2.5 py-1 text-xs font-semibold', locked ? 'bg-[#7f22fe] text-white' : 'text-gray-600')}
                onClick={() => setLocked(true)}
              >
                Locked
              </button>
              <button
                type="button"
                className={cn('rounded-md px-2.5 py-1 text-xs font-semibold', !locked ? 'bg-[#7f22fe] text-white' : 'text-gray-600')}
                onClick={() => setLocked(false)}
              >
                Owned
              </button>
            </div>
            <div className="flex rounded-lg border border-gray-200 bg-white p-0.5">
              <button
                type="button"
                aria-label="Grid view"
                className={cn('size-8 grid place-items-center rounded-md', view === 'grid' ? 'bg-[#f4efff] text-[#7f22fe]' : 'text-gray-500')}
                onClick={() => setView('grid')}
              >
                <Grid3X3 className="size-3.5" />
              </button>
              <button
                type="button"
                aria-label="List view"
                className={cn('size-8 grid place-items-center rounded-md', view === 'list' ? 'bg-[#f4efff] text-[#7f22fe]' : 'text-gray-500')}
                onClick={() => setView('list')}
              >
                <List className="size-3.5" />
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="size-8 rounded-lg grid place-items-center text-gray-500 hover:bg-gray-100"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {isDraft ? (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
              This item is {item.publishStatus}. Learners will not see it in the library until it is published.
            </div>
          ) : null}

          <div className="mb-5">
            <h3 className="text-2xl font-extrabold text-gray-900 tracking-tight">Library</h3>
            <p className="text-sm text-gray-400 mt-0.5">How this title appears on the learner dashboard</p>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-4 mb-2">
            {filterTabs.map((f) => (
              <span
                key={f}
                className={cn(
                  'shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium border',
                  f === 'All' ? 'bg-[#7f22fe] text-white border-[#7f22fe]' : 'bg-white text-gray-600 border-gray-200',
                )}
              >
                {f}
              </span>
            ))}
          </div>

          <section>
            <div className="mb-4">
              <h4 className="text-gray-900 font-bold">New in the library</h4>
              <p className="text-gray-400 text-sm">Admin catalog — A4 covers, not personal imports</p>
            </div>
            {view === 'grid' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 max-w-[11rem] sm:max-w-none">
                <div className="sm:max-w-[10.5rem]">
                  <LearnerCard item={item} view="grid" locked={locked} />
                </div>
              </div>
            ) : (
              <div className="max-w-xl">
                <LearnerCard item={item} view="list" locked={locked} />
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
