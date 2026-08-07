import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpen, Brain, ChevronRight, Flame, Grid3X3, List, Search, Upload } from 'lucide-react';
import { Button } from '../components/ui/button';
import { EmptyState } from '../components/EmptyState';
import { LibrarySkeleton } from '../components/LibrarySkeleton';
import { cn } from '../components/ui/utils';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { type ContentItem, gradientForId } from '../lib/types';

const cefrStyle: Record<string, string> = {
  a1: 'bg-emerald-100 text-emerald-700',
  a2: 'bg-teal-100 text-teal-700',
  b1: 'bg-blue-100 text-blue-700',
  b2: 'bg-indigo-100 text-indigo-700',
  c1: 'bg-violet-100 text-[#7008e7]',
  c2: 'bg-pink-100 text-pink-700',
};
const langFlag: Record<string, string> = { en: '🇬🇧', ru: '🇷🇺', uz: '🇺🇿' };
const filterTabs = ['All', 'EN', 'RU', 'UZ', 'Fiction', 'News', 'Imports', 'A1–A2', 'B1–B2'] as const;
type FilterTab = (typeof filterTabs)[number];

function formatWordCount(count: number) {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k words`;
  return `${count} words`;
}

function itemSubtitle(item: ContentItem) {
  return item.subtitle ?? item.description ?? '';
}

function CoverArt({ item, className }: { item: ContentItem; className?: string }) {
  return (
    <div
      className={cn('flex items-center justify-center overflow-hidden', className)}
      style={{ backgroundImage: gradientForId(item.id) }}
    >
      <BookOpen className="text-white/60 w-8 h-8 sm:w-10 sm:h-10" />
    </div>
  );
}

function CefrBadge({ level }: { level: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold tracking-wide', cefrStyle[level] ?? 'bg-gray-100 text-gray-600')}>
      {level.toUpperCase()}
    </span>
  );
}

function ContentCard({ item, view = 'grid', compact = false }: { item: ContentItem; view?: 'grid' | 'list'; compact?: boolean }) {
  const navigate = useNavigate();
  const isProg = (item.progressPct ?? 0) > 0;
  const subtitle = itemSubtitle(item);

  if (view === 'list') {
    return (
      <button
        type="button"
        onClick={() => navigate(`/app/read/${item.id}`)}
        className="w-full flex items-center gap-4 p-3 bg-white rounded-2xl border border-gray-100/80 hover:border-violet-200 hover:shadow-sm hover:shadow-violet-100 transition-all text-left group"
      >
        <CoverArt item={item} className="w-16 h-16 rounded-xl shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-gray-900 text-sm truncate group-hover:text-[#7008e7] transition-colors">{item.title}</div>
              {subtitle && <div className="text-gray-400 text-xs mt-0.5 line-clamp-1">{subtitle}</div>}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <CefrBadge level={item.cefrLevel} />
              <span className="text-sm">{langFlag[item.language] ?? '🌐'}</span>
            </div>
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <BookOpen className="w-3 h-3" />
              {formatWordCount(item.wordCount)}
            </span>
            <span className="capitalize">{item.contentType.replace('_', ' ')}</span>
            {isProg && <span className="text-[#7f22fe] font-medium">{Math.round(item.progressPct ?? 0)}% read</span>}
          </div>
          {isProg && (
            <div className="mt-2 h-1 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${Math.min(100, item.progressPct ?? 0)}%` }} />
            </div>
          )}
        </div>
        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-violet-400 shrink-0 transition-colors" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => navigate(`/app/read/${item.id}`)}
      className={cn(
        'bg-white rounded-2xl border border-gray-100/80 overflow-hidden hover:border-violet-200 hover:shadow-md hover:shadow-violet-100/60 transition-all text-left group flex flex-col w-full h-full',
        compact ? 'min-h-[220px]' : 'min-h-[240px]',
      )}
    >
      <div className="relative shrink-0">
        <CoverArt item={item} className={cn('w-full', compact ? 'h-28' : 'h-36')} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
        <div className="absolute bottom-2 left-2 flex flex-wrap gap-1.5 max-w-[calc(100%-2rem)]">
          <CefrBadge level={item.cefrLevel} />
          <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium bg-white/20 backdrop-blur text-white capitalize truncate max-w-[5rem]">
            {item.contentType.replace('_', ' ')}
          </span>
        </div>
        <div className="absolute top-2 right-2 text-lg leading-none drop-shadow">{langFlag[item.language] ?? '🌐'}</div>
      </div>
      <div className="p-3 flex-1 flex flex-col min-h-0">
        <div className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2 group-hover:text-[#7008e7] transition-colors mb-1">{item.title}</div>
        {subtitle ? (
          <div className="text-gray-400 text-xs line-clamp-2 mb-auto">{subtitle}</div>
        ) : (
          <div className="mb-auto" />
        )}
        <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-50 text-xs text-gray-400">
          <span className="flex items-center gap-1 truncate">
            <BookOpen className="w-3 h-3 shrink-0" />
            {formatWordCount(item.wordCount)}
          </span>
          {isProg ? (
            <span className="font-semibold text-[#7f22fe] shrink-0">{Math.round(item.progressPct ?? 0)}%</span>
          ) : item.knownWordRatio != null && item.knownWordRatio > 0 ? (
            <span className="text-gray-400 shrink-0">{Math.round(item.knownWordRatio * 100)}% known</span>
          ) : (
            <span className="text-violet-500/70 shrink-0 font-medium">New</span>
          )}
        </div>
        {isProg && (
          <div className="mt-1.5 h-1 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${Math.min(100, item.progressPct ?? 0)}%` }} />
          </div>
        )}
      </div>
    </button>
  );
}

function ContinueReadingCard({ item }: { item: ContentItem }) {
  const navigate = useNavigate();
  return (
    <div
      className="relative overflow-hidden rounded-2xl cursor-pointer group h-full min-h-[11rem]"
      style={{ backgroundImage: gradientForId(item.id) }}
      onClick={() => navigate(`/app/read/${item.id}`)}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
      <div className="relative p-5 sm:p-6 min-h-[11rem] h-full flex flex-col justify-end">
        <span className="text-[11px] font-semibold text-white/70 uppercase tracking-wider mb-2">Continue reading</span>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex-1 min-w-0">
            <div className="text-white font-bold text-lg sm:text-xl leading-tight line-clamp-2 mb-0.5">{item.title}</div>
            {itemSubtitle(item) && <div className="text-white/60 text-sm line-clamp-1">{itemSubtitle(item)}</div>}
          </div>
          <div className="flex items-center justify-between gap-3 sm:ml-4 sm:flex-col sm:items-end sm:gap-2 shrink-0">
            <span className="text-white/90 font-bold text-xl sm:text-2xl tabular-nums">{item.progressPct ?? 0}%</span>
            <Button
              size="sm"
              className="bg-white text-gray-900 hover:bg-white/90 rounded-xl h-8 px-4 text-xs font-semibold shadow-lg"
              onClick={(e) => { e.stopPropagation(); navigate(`/app/read/${item.id}`); }}
            >
              Resume <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
        </div>
        <div className="mt-3 h-1 bg-white/20 rounded-full overflow-hidden">
          <div className="h-full bg-white rounded-full" style={{ width: `${item.progressPct ?? 0}%` }} />
        </div>
      </div>
    </div>
  );
}

interface FeaturedCollection {
  slug: string;
  title: string;
  description?: string;
  isFeatured: boolean;
  items: Array<{ content: ContentItem }>;
}

interface FeedResponse {
  continueReading: ContentItem[];
  recentlyPublished: ContentItem[];
  featuredCollections: FeaturedCollection[];
}

function parseFilterParam(raw: string | null): FilterTab {
  if (!raw) return 'All';
  const normalized = raw.trim().toLowerCase().replace(/\s+/g, '').replace(/–/g, '-').replace(/—/g, '-');
  const aliases: Record<string, FilterTab> = {
    all: 'All',
    en: 'EN',
    english: 'EN',
    ru: 'RU',
    russian: 'RU',
    uz: 'UZ',
    uzbek: 'UZ',
    fiction: 'Fiction',
    news: 'News',
    imports: 'Imports',
    import: 'Imports',
    'user-imports': 'Imports',
    user_import: 'Imports',
    'a1-a2': 'A1–A2',
    a1a2: 'A1–A2',
    'b1-b2': 'B1–B2',
    b1b2: 'B1–B2',
  };
  if (aliases[normalized]) return aliases[normalized];
  const exact = filterTabs.find((t) => t.toLowerCase() === raw.trim().toLowerCase());
  return exact ?? 'All';
}

function inferFilterFromCollection(collection: Pick<FeaturedCollection, 'slug' | 'title'>): FilterTab | null {
  const hay = `${collection.slug} ${collection.title}`.toLowerCase();
  if (hay.includes('fiction')) return 'Fiction';
  if (hay.includes('news')) return 'News';
  if (/\ben\b|english/.test(hay)) return 'EN';
  if (/\bru\b|russian/.test(hay)) return 'RU';
  if (/\buz\b|uzbek/.test(hay)) return 'UZ';
  if (hay.includes('a1') || hay.includes('beginner')) return 'A1–A2';
  if (hay.includes('b1') || hay.includes('intermediate')) return 'B1–B2';
  return null;
}

function matchesFilter(item: ContentItem, activeFilter: FilterTab) {
  if (activeFilter === 'All') return true;
  if (activeFilter === 'EN') return item.language === 'en';
  if (activeFilter === 'RU') return item.language === 'ru';
  if (activeFilter === 'UZ') return item.language === 'uz';
  if (activeFilter === 'Fiction') {
    const g = (item.genre ?? '').toLowerCase();
    return (
      g === 'fiction' ||
      g === 'folk tales' ||
      g === 'culture' ||
      g === 'classic' ||
      item.contentType === 'story' ||
      item.contentType === 'book'
    );
  }
  if (activeFilter === 'News') return item.contentType === 'news' || item.contentType === 'article';
  if (activeFilter === 'Imports') {
    return item.contentType === 'user_import' || item.contentSource === 'user_import';
  }
  if (activeFilter === 'A1–A2') return item.cefrLevel === 'a1' || item.cefrLevel === 'a2';
  if (activeFilter === 'B1–B2') return item.cefrLevel === 'b1' || item.cefrLevel === 'b2';
  return true;
}

/** Scope by collection; prefill chip from rail title/slug when it maps cleanly. */
function browsePathForCollection(collection: FeaturedCollection) {
  const params = new URLSearchParams();
  params.set('collection', collection.slug);
  const inferred = inferFilterFromCollection(collection);
  if (inferred) params.set('filter', inferred);
  return `/app/browse?${params.toString()}`;
}

function dedupeItems(items: ContentItem[]) {
  return Array.from(new Map(items.map((i) => [i.id, i])).values());
}

export default function LibraryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, stats } = useAuth();
  const [feed, setFeed] = useState<FeedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'grid' | 'list'>('grid');

  const isBrowse = location.pathname.replace(/\/$/, '').endsWith('/browse');

  // Legacy `/app?q=` deep-links → browse directory
  useEffect(() => {
    if (isBrowse) return;
    const q = searchParams.get('q');
    if (q == null || q === '') return;
    const next = new URLSearchParams();
    next.set('q', q);
    navigate(`/app/browse?${next.toString()}`, { replace: true });
  }, [isBrowse, navigate, searchParams]);

  useEffect(() => {
    api<FeedResponse>('/content/feed')
      .then(setFeed)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const collectionSlug = searchParams.get('collection');
  const activeCollection = useMemo(
    () => feed?.featuredCollections?.find((c) => c.slug === collectionSlug) ?? null,
    [feed, collectionSlug],
  );

  const initialFilter = useMemo(
    () => parseFilterParam(searchParams.get('filter') ?? searchParams.get('genre')),
    [searchParams],
  );

  const [search, setSearch] = useState(() => searchParams.get('q') ?? '');
  const [activeFilter, setActiveFilter] = useState<FilterTab>(initialFilter);

  useEffect(() => {
    if (!isBrowse) return;
    setSearch(searchParams.get('q') ?? '');
    setActiveFilter(initialFilter);
  }, [isBrowse, searchParams, initialFilter]);

  const uniqueItems = useMemo(() => {
    if (!feed) return [];
    return dedupeItems([
      ...(feed.continueReading ?? []),
      ...(feed.recentlyPublished ?? []),
      ...(feed.featuredCollections?.flatMap((c) => c.items.map((i) => i.content).filter(Boolean)) ?? []),
    ]);
  }, [feed]);

  const browseBaseItems = useMemo(() => {
    if (!activeCollection) return uniqueItems;
    return dedupeItems(activeCollection.items.map((i) => i.content).filter(Boolean));
  }, [activeCollection, uniqueItems]);

  const filtered = browseBaseItems.filter((item) => {
    if (search) return item.title.toLowerCase().includes(search.toLowerCase());
    return matchesFilter(item, activeFilter);
  });

  const hero = feed?.continueReading?.[0];
  // `??` does not fall through empty arrays — fill from recently published when continue-reading has ≤1 item
  const heroSideItems = useMemo(() => {
    const continued = feed?.continueReading?.slice(1, 4) ?? [];
    if (continued.length > 0) return continued;
    const heroId = feed?.continueReading?.[0]?.id;
    return (feed?.recentlyPublished ?? [])
      .filter((item) => item.id !== heroId)
      .slice(0, 3);
  }, [feed]);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  const firstName = (user?.displayName ?? 'Learner').split(' ')[0];
  const libraryEmpty = !loading && uniqueItems.length === 0;

  const setFilter = (next: FilterTab) => {
    setActiveFilter(next);
    if (!isBrowse) return;
    const params = new URLSearchParams(searchParams);
    if (next === 'All') params.delete('filter');
    else params.set('filter', next);
    params.delete('genre');
    setSearchParams(params, { replace: true });
  };

  const setBrowseSearch = (value: string) => {
    setSearch(value);
    if (!isBrowse) return;
    const params = new URLSearchParams(searchParams);
    if (value) params.set('q', value);
    else params.delete('q');
    setSearchParams(params, { replace: true });
  };

  if (loading) return <LibrarySkeleton />;

  if (isBrowse) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 lg:py-8 space-y-6">
        <div className="space-y-3">
          <nav className="flex items-center gap-1.5 text-sm text-gray-400">
            <button
              type="button"
              onClick={() => navigate('/app')}
              className="hover:text-[#7f22fe] transition-colors font-medium"
            >
              Library
            </button>
            <ChevronRight className="w-3.5 h-3.5 shrink-0" />
            <span className="text-gray-600 font-medium truncate">
              {activeCollection?.title ?? 'Browse Library'}
            </span>
          </nav>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <button
                type="button"
                onClick={() => navigate('/app')}
                className="sm:hidden p-2 -ml-2 rounded-xl text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors"
                aria-label="Back to Library"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-2xl font-bold text-gray-900 truncate">Browse Library</h1>
            </div>
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setBrowseSearch(e.target.value)}
                placeholder="Search…"
                className="w-full pl-8 pr-4 h-9 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-300"
              />
            </div>
            <div className="hidden sm:flex items-center gap-1 bg-gray-100 rounded-xl p-1">
              <button type="button" onClick={() => setView('grid')} className={cn('p-1.5 rounded-lg transition-colors', view === 'grid' ? 'bg-white shadow-sm text-gray-700' : 'text-gray-400 hover:text-gray-600')} aria-label="Grid view">
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => setView('list')} className={cn('p-1.5 rounded-lg transition-colors', view === 'list' ? 'bg-white shadow-sm text-gray-700' : 'text-gray-400 hover:text-gray-600')} aria-label="List view">
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>

          {activeCollection?.description && !search && (
            <p className="text-gray-400 text-sm -mt-1">{activeCollection.description}</p>
          )}
        </div>

        {!search && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {filterTabs.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={cn(
                  'shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all',
                  activeFilter === f ? 'bg-[#7f22fe] text-white border-[#7f22fe] shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300',
                )}
              >
                {f}
              </button>
            ))}
          </div>
        )}

        {libraryEmpty ? (
          <EmptyState
            icon={BookOpen}
            title="Your library is empty"
            description="Import your own text or explore featured collections once content is available."
            actionLabel="Import content"
            onAction={() => navigate('/app/import')}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No content found"
            description="Try a different search or filter to find something to read."
            compact
          />
        ) : view === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 auto-rows-fr">
            {filtered.map((item) => (
              <ContentCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((item) => (
              <ContentCard key={item.id} item={item} view="list" />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 lg:py-8 space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Good {greeting}, {firstName} 👋</h1>
          <p className="text-gray-500 mt-0.5 text-sm">Keep your streak alive — you&apos;re on a roll.</p>
        </div>
        <div className="flex gap-3 shrink-0">
          {[
            { icon: Flame, value: `${stats?.streakCount ?? 0} days`, label: 'Streak', color: 'text-[#e17100] bg-[#fffbeb] border-[#fee685]' },
            { icon: Brain, value: `${stats?.wordsLearned ?? 0}`, label: 'Words', color: 'text-[#155dfc] bg-[#eff6ff] border-[#bedbff]' },
          ].map((s) => (
            <div key={s.label} className={cn('flex items-center gap-2 border rounded-xl px-3.5 py-2.5 min-w-[7.5rem]', s.color)}>
              <s.icon className="w-4 h-4 shrink-0" />
              <div>
                <div className="font-bold text-sm leading-none">{s.value}</div>
                <div className="text-xs opacity-70 mt-0.5">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {hero && (
        <div
          className={cn(
            'grid gap-5 items-stretch',
            heroSideItems.length > 0 && 'lg:grid-cols-3',
          )}
        >
          <div className={cn('min-h-[11rem]', heroSideItems.length > 0 && 'lg:col-span-1')}>
            <ContinueReadingCard item={hero} />
          </div>
          {heroSideItems.length > 0 && (
            <div
              className={cn(
                'lg:col-span-2 grid gap-3 lg:gap-4 auto-rows-fr',
                heroSideItems.length === 1 && 'grid-cols-1 max-w-xs sm:max-w-sm',
                heroSideItems.length === 2 && 'grid-cols-2',
                heroSideItems.length >= 3 && 'grid-cols-2 md:grid-cols-3',
              )}
            >
              {heroSideItems.map((item) => (
                <ContentCard key={item.id} item={item} compact />
              ))}
            </div>
          )}
        </div>
      )}

      {feed?.featuredCollections?.map((collection) => {
        const items = collection.items.map((i) => i.content).filter(Boolean);
        if (!items.length) return null;
        return (
          <section key={collection.slug}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-gray-900 font-bold">{collection.title}</h2>
                <p className="text-gray-400 text-sm">{collection.description}</p>
              </div>
              <button
                type="button"
                onClick={() => navigate(browsePathForCollection(collection))}
                className="flex items-center gap-1 text-xs font-semibold text-[#7f22fe] hover:text-violet-800 hover:bg-violet-50 px-2.5 py-1.5 rounded-lg transition-colors"
              >
                See all <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-3 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide snap-x snap-mandatory lg:grid lg:grid-cols-4 xl:grid-cols-5 lg:overflow-visible lg:pb-0 lg:gap-4 lg:snap-none">
              {items.map((item) => (
                <div key={item.id} className="snap-start shrink-0 w-[11rem] sm:w-48 lg:w-auto lg:shrink">
                  <ContentCard item={item} compact />
                </div>
              ))}
              <div className="shrink-0 w-1 lg:hidden" aria-hidden />
            </div>
          </section>
        );
      })}

      {libraryEmpty && (
        <div className="space-y-4">
          <EmptyState
            icon={BookOpen}
            title="Your library is empty"
            description="Import your own text or explore featured collections once content is available."
            actionLabel="Import content"
            onAction={() => navigate('/app/import')}
          />
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => navigate('/app/import')}
              className="inline-flex items-center gap-2 text-sm text-[#7f22fe] hover:text-violet-800 font-medium"
            >
              <Upload className="w-4 h-4" />
              Or import your first article
            </button>
          </div>
        </div>
      )}

      {!libraryEmpty && (!feed?.featuredCollections?.length || feed.featuredCollections.every((c) => !c.items.length)) && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-gray-900 font-bold">Browse Library</h2>
              <p className="text-gray-400 text-sm">Explore all available reading content</p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/app/browse')}
              className="flex items-center gap-1 text-xs font-semibold text-[#7f22fe] hover:text-violet-800 hover:bg-violet-50 px-2.5 py-1.5 rounded-lg transition-colors"
            >
              See all <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
