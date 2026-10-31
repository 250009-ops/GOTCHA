import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpen, Brain, ChevronRight, Flame, Grid3X3, List, Search, Upload } from 'lucide-react';
import { Button } from '../components/ui/button';
import { EmptyState } from '../components/EmptyState';
import { LibrarySkeleton } from '../components/LibrarySkeleton';
import { cn } from '../components/ui/utils';
import { api, getAccessToken } from '../lib/api';
import { useAuth } from '../lib/auth';
import { resolveMediaUrl } from '../lib/media';
import { formatUzs } from '../lib/importBilling';
import { useCatalogLanguages } from '../lib/catalogLanguages';
import { openReader } from '../lib/readerReturn';
import { useLearnerCopy } from '../lib/learnerLocaleContext';
import { type ContentItem } from '../lib/types';
import { BookCover, coverDisplayTitle } from '../components/cover/BookCover';

const cefrStyle: Record<string, string> = {
  a1: 'bg-emerald-100 text-emerald-700',
  a2: 'bg-teal-100 text-teal-700',
  b1: 'bg-blue-100 text-blue-700',
  b2: 'bg-indigo-100 text-indigo-700',
  c1: 'bg-violet-100 text-g-blue-700',
  c2: 'bg-pink-100 text-pink-700',
};
const staticFilterIds = ['Fiction', 'News', 'Imports', 'A1–A2', 'B1–B2', 'C1–C2'] as const;
type StaticFilterId = (typeof staticFilterIds)[number];
type FilterTab = 'All' | StaticFilterId | string;

function filterLabel(filter: FilterTab, copy: ReturnType<typeof useLearnerCopy>): string {
  switch (filter) {
    case 'All':
      return copy.library.filterAll;
    case 'Fiction':
      return copy.library.filterFiction;
    case 'News':
      return copy.library.filterNews;
    case 'Imports':
      return copy.library.filterImports;
    case 'A1–A2':
      return copy.library.filterA1A2;
    case 'B1–B2':
      return copy.library.filterB1B2;
    case 'C1–C2':
      return copy.library.filterC1C2;
    default:
      return filter;
  }
}

function SectionHeading({
  title,
  subtitle,
  onSeeAll,
}: {
  title: string;
  subtitle?: string;
  onSeeAll?: () => void;
}) {
  const copy = useLearnerCopy();
  return (
    <div className="flex items-start justify-between gap-3 mb-4 min-w-0">
      <div className="min-w-0 flex-1">
        <h2 className="text-gray-900 font-bold">{title}</h2>
        {subtitle ? <p className="text-gray-400 text-sm mt-0.5 leading-snug">{subtitle}</p> : null}
      </div>
      {onSeeAll ? (
        <button
          type="button"
          onClick={onSeeAll}
          className="flex items-center gap-0.5 text-xs font-semibold text-g-blue-700 hover:text-violet-800 hover:bg-violet-50 pl-2 pr-1.5 py-1.5 rounded-lg transition-colors shrink-0 whitespace-nowrap"
        >
          {copy.common.seeAll} <ChevronRight className="w-3.5 h-3.5" />
        </button>
      ) : null}
    </div>
  );
}

function itemSubtitle(item: ContentItem) {
  return item.subtitle ?? item.description ?? '';
}

function CoverArt({ item, className, variant = 'card' }: { item: ContentItem; className?: string; variant?: 'card' | 'thumb' }) {
  // Landing poster when this book has one; otherwise the stored cover image. Same 2:3 frame as the landing page.
  return <BookCover item={item} variant={variant} resolveUrl={resolveMediaUrl} className={cn('relative', className)} />;
}

function CefrBadge({ level }: { level: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold tracking-wide', cefrStyle[level] ?? 'bg-gray-100 text-gray-600')}>
      {level.toUpperCase()}
    </span>
  );
}

function ContentCard({
  item,
  view = 'grid',
  highlighted = false,
  langFlags = {},
  libraryReturn,
}: {
  item: ContentItem;
  view?: 'grid' | 'list';
  compact?: boolean;
  highlighted?: boolean;
  langFlags?: Record<string, string>;
  /** When set (e.g. Browse Library), reader back returns here instead of library home. */
  libraryReturn?: string | null;
}) {
  const navigate = useNavigate();
  const copy = useLearnerCopy();
  const open = () => openReader(navigate, item.id, libraryReturn);
  const isProg = (item.progressPct ?? 0) > 0;
  const subtitle = itemSubtitle(item);
  const highlightClass = highlighted ? 'ring-2 ring-g-blue-700 ring-offset-2' : '';

  if (view === 'list') {
    return (
      <button
        type="button"
        id={`catalog-item-${item.id}`}
        onClick={open}
        className={cn(
          'w-full flex items-center gap-4 p-3 bg-white rounded-2xl border border-gray-100/80 hover:border-violet-200 hover:shadow-sm hover:shadow-violet-100 transition-all text-left group',
          highlightClass,
        )}
      >
        <CoverArt item={item} variant="thumb" className="w-[3.25rem] aspect-[2/3] rounded-lg shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-gray-900 text-sm truncate group-hover:text-g-blue-700 transition-colors">{item.title}</div>
              {subtitle && <div className="text-gray-400 text-xs mt-0.5 line-clamp-1">{subtitle}</div>}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <CefrBadge level={item.cefrLevel} />
              <span className="text-sm">{langFlags[item.language] ?? '🌐'}</span>
            </div>
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <BookOpen className="w-3 h-3" />
              {copy.common.words(item.wordCount)}
            </span>
            <span className="capitalize">{item.contentType.replace('_', ' ')}</span>
            {item.accessGranted === false && (item.priceUzs ?? 0) > 0 && (
              <span className="text-g-blue-700 font-semibold">{formatUzs(item.priceUzs ?? 0)}</span>
            )}
            {isProg && <span className="text-g-blue-700 font-medium">{copy.libraryPage.percentRead(Math.round(item.progressPct ?? 0))}</span>}
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
      id={`catalog-item-${item.id}`}
      onClick={open}
      className={cn(
        'bg-white rounded-2xl border border-gray-100/80 overflow-hidden hover:border-violet-200 hover:shadow-md hover:shadow-violet-100/60 transition-all text-left group flex flex-col w-full h-full',
        highlightClass,
      )}
    >
      <div className="relative shrink-0 w-full aspect-[2/3]">
        <CoverArt item={item} className="!absolute inset-0 w-full h-full" />
      </div>
      <div className="p-3 flex-1 flex flex-col min-h-0">
        <div className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2 group-hover:text-g-blue-700 transition-colors mb-1">{item.title}</div>
        {subtitle ? (
          <div className="text-gray-400 text-xs line-clamp-2 mb-auto">{subtitle}</div>
        ) : (
          <div className="mb-auto" />
        )}
        <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-50 text-xs text-gray-400">
          <span className="flex items-center gap-1.5 truncate min-w-0">
            <CefrBadge level={item.cefrLevel} />
            <BookOpen className="w-3 h-3 shrink-0" />
            {copy.common.words(item.wordCount)}
            {item.accessGranted === false && (item.priceUzs ?? 0) > 0 ? (
              <span className="text-g-blue-700 font-semibold">{formatUzs(item.priceUzs ?? 0)}</span>
            ) : null}
          </span>
            {item.accessGranted === false && (item.priceUzs ?? 0) > 0 ? (
              <span className="text-violet-500/70 shrink-0 font-medium">{copy.libraryPage.trySample}</span>
            ) : isProg ? (
              <span className="font-semibold text-g-blue-700 shrink-0">{Math.round(item.progressPct ?? 0)}%</span>
            ) : item.knownWordRatio != null && item.knownWordRatio > 0 ? (
              <span className="text-gray-400 shrink-0">{copy.libraryPage.percentKnown(Math.round(item.knownWordRatio * 100))}</span>
            ) : (
              <span className="text-violet-500/70 shrink-0 font-medium">{copy.libraryPage.newBadge}</span>
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
  const copy = useLearnerCopy();
  const open = () => openReader(navigate, item.id);
  const title = coverDisplayTitle(item);
  return (
    <div
      className="flex h-full min-h-[11rem] overflow-hidden rounded-2xl border border-gray-100/80 bg-white cursor-pointer group"
      data-testid="continue-reading-hero"
      onClick={open}
    >
      <div className="w-[7.5rem] sm:w-[9.5rem] shrink-0 self-stretch">
        <BookCover item={item} variant="hero" resolveUrl={resolveMediaUrl} className="h-full w-full" />
      </div>
      <div className="flex-1 min-w-0 p-4 sm:p-5 flex flex-col justify-end">
        <span className="text-[11px] font-semibold uppercase tracking-wider mb-2 text-gray-500">{copy.libraryPage.continueReading}</span>
        <div className="font-semibold text-gray-900 text-base leading-snug line-clamp-2 mb-3" lang={item.language}>{title}</div>
        <div className="flex items-center justify-between gap-3">
          {item.accessGranted === false && (item.priceUzs ?? 0) > 0 ? (
            <span className="text-g-blue-700 font-bold text-sm">{formatUzs(item.priceUzs ?? 0)}</span>
          ) : (
            <span className="text-gray-900 font-bold text-xl tabular-nums">{item.progressPct ?? 0}%</span>
          )}
          <Button
            size="sm"
            className="rounded-xl h-8 px-4 text-xs font-semibold"
            onClick={(e) => { e.stopPropagation(); open(); }}
          >
            {copy.libraryPage.resume} <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
        <div className="mt-3 h-1 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-violet-500 rounded-full" style={{ width: `${item.progressPct ?? 0}%` }} />
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
  myImports: ContentItem[];
  featuredCollections: FeaturedCollection[];
}

interface ContentListResponse {
  items: ContentItem[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

const BROWSE_PAGE_SIZE = 100;
const BROWSE_MAX_PAGES = 10;

function isUserImport(item: ContentItem) {
  return item.contentType === 'user_import' || item.contentSource === 'user_import';
}

function parseFilterParam(
  raw: string | null,
  languageTabs: string[],
  nativeLanguage?: string | null,
): FilterTab {
  if (!raw) return 'All';
  const normalized = raw.trim().toLowerCase().replace(/\s+/g, '').replace(/–/g, '-').replace(/—/g, '-');
  const native = nativeLanguage?.trim().toLowerCase() || null;
  if (native && normalized === native) return 'All';
  const aliases: Record<string, FilterTab> = {
    all: 'All',
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
    'c1-c2': 'C1–C2',
    c1c2: 'C1–C2',
  };
  if (aliases[normalized]) return aliases[normalized];
  const langTab = languageTabs.find((t) => t.toLowerCase() === raw.trim().toLowerCase());
  if (langTab) return langTab;
  const staticMatch = (['All', ...staticFilterIds] as const).find((t) => t.toLowerCase() === raw.trim().toLowerCase());
  return staticMatch ?? 'All';
}

function inferFilterFromCollection(
  collection: Pick<FeaturedCollection, 'slug' | 'title'>,
  languageTabs: string[],
): FilterTab | null {
  const hay = `${collection.slug} ${collection.title}`.toLowerCase();
  if (hay.includes('fiction')) return 'Fiction';
  if (hay.includes('news')) return 'News';
  for (const tab of languageTabs) {
    const code = tab.toLowerCase();
    if (new RegExp(`\\b${code}\\b`).test(hay)) return tab;
  }
  if (hay.includes('a1') || hay.includes('beginner')) return 'A1–A2';
  if (hay.includes('b1') || hay.includes('intermediate')) return 'B1–B2';
  return null;
}

function itemLanguage(item: ContentItem) {
  return (item.language ?? '').trim().toLowerCase();
}

function matchesSearch(item: ContentItem, query: string) {
  if (!query) return true;
  const hay = `${item.title} ${item.subtitle ?? ''} ${item.authorName ?? ''}`.toLowerCase();
  return hay.includes(query.toLowerCase());
}

function matchesFilter(item: ContentItem, activeFilter: FilterTab, languageTabs: string[]) {
  if (activeFilter === 'Imports') {
    return isUserImport(item);
  }
  if (isUserImport(item)) return false;
  if (activeFilter === 'All') return true;
  const langTab = languageTabs.find((t) => t.toLowerCase() === String(activeFilter).toLowerCase());
  if (langTab) return itemLanguage(item) === langTab.toLowerCase();
  if (/^[a-z]{2}$/i.test(String(activeFilter))) {
    return itemLanguage(item) === String(activeFilter).toLowerCase();
  }
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
  if (activeFilter === 'A1–A2') return item.cefrLevel === 'a1' || item.cefrLevel === 'a2';
  if (activeFilter === 'B1–B2') return item.cefrLevel === 'b1' || item.cefrLevel === 'b2';
  if (activeFilter === 'C1–C2') return item.cefrLevel === 'c1' || item.cefrLevel === 'c2';
  return false;
}

/** Scope by collection; prefill chip from rail title/slug when it maps cleanly. */
function browsePathForCollection(collection: FeaturedCollection, languageTabs: string[]) {
  const params = new URLSearchParams();
  params.set('collection', collection.slug);
  const inferred = inferFilterFromCollection(collection, languageTabs);
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
  const copy = useLearnerCopy();
  const { langs: catalogLangs } = useCatalogLanguages();
  const [feed, setFeed] = useState<FeedResponse | null>(null);
  const [catalogItems, setCatalogItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [view, setView] = useState<'grid' | 'list'>('grid');

  const nativeCode = (user?.nativeLanguage ?? '').trim().toLowerCase() || null;
  const targetScopeKey = (user?.targetLanguages ?? [])
    .map((t) => t.targetLanguage.toLowerCase())
    .sort()
    .join(',');

  const learnableLangCodes = useMemo(() => {
    return catalogLangs
      .map((l) => l.code.toLowerCase())
      .filter((code) => Boolean(code) && code !== nativeCode);
  }, [catalogLangs, nativeCode]);
  const languageTabs = useMemo(
    () => learnableLangCodes.map((code) => code.toUpperCase()),
    [learnableLangCodes],
  );
  const filterTabs = useMemo(
    () => ['All', ...languageTabs, ...staticFilterIds] as FilterTab[],
    [languageTabs],
  );
  const langFlags = useMemo(
    () => Object.fromEntries(catalogLangs.map((l) => [l.code, l.flagEmoji])),
    [catalogLangs],
  );

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
    if (!user || !getAccessToken()) return;
    let cancelled = false;
    setLoading(true);
    api<FeedResponse>('/content/feed')
      .then((data) => {
        if (!cancelled) setFeed(data);
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, nativeCode, targetScopeKey]);

  const initialFilter = useMemo(
    () => parseFilterParam(searchParams.get('filter') ?? searchParams.get('genre'), languageTabs, nativeCode),
    [searchParams, languageTabs, nativeCode],
  );

  const [search, setSearch] = useState(() => searchParams.get('q') ?? '');
  const [activeFilter, setActiveFilter] = useState<FilterTab>(initialFilter);

  useEffect(() => {
    const isStatic =
      activeFilter === 'All' || (staticFilterIds as readonly string[]).includes(activeFilter as StaticFilterId);
    const isNativeChip = Boolean(nativeCode && activeFilter.toLowerCase() === nativeCode);
    const isOrphanLang =
      /^[a-z]{2}$/i.test(activeFilter) && languageTabs.length > 0 && !languageTabs.includes(activeFilter);
    if (!isNativeChip && (isStatic || !isOrphanLang)) return;
    setActiveFilter('All');
    if (!isBrowse) return;
    const params = new URLSearchParams(searchParams);
    params.delete('filter');
    params.delete('genre');
    setSearchParams(params, { replace: true });
  }, [activeFilter, languageTabs, nativeCode, isBrowse, searchParams, setSearchParams]);

  useEffect(() => {
    if (!isBrowse) return;
    setSearch(searchParams.get('q') ?? '');
    setActiveFilter(initialFilter);
  }, [isBrowse, searchParams, initialFilter]);

  const collectionSlug = searchParams.get('collection');
  const activeCollection = useMemo(
    () => feed?.featuredCollections?.find((c) => c.slug === collectionSlug) ?? null,
    [feed, collectionSlug],
  );

  const catalogLangQuery = useMemo(() => {
    if (!languageTabs.includes(activeFilter)) return '';
    const code = activeFilter.toLowerCase();
    if (nativeCode && code === nativeCode) return '';
    return code;
  }, [activeFilter, languageTabs, nativeCode]);

  useEffect(() => {
    if (!isBrowse || !user || !getAccessToken() || collectionSlug) {
      if (!isBrowse) setCatalogItems([]);
      return;
    }
    let cancelled = false;
    setCatalogLoading(true);
    (async () => {
      const all: ContentItem[] = [];
      let page = 1;
      let hasMore = true;
      while (hasMore && page <= BROWSE_MAX_PAGES && !cancelled) {
        const qs = new URLSearchParams();
        qs.set('page', String(page));
        qs.set('pageSize', String(BROWSE_PAGE_SIZE));
        if (catalogLangQuery) qs.set('lang', catalogLangQuery);
        const data = await api<ContentListResponse>(`/content?${qs.toString()}`);
        all.push(...(data.items ?? []));
        hasMore = Boolean(data.hasMore);
        page += 1;
      }
      if (!cancelled) setCatalogItems(dedupeItems(all));
    })()
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setCatalogLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isBrowse, user, nativeCode, targetScopeKey, collectionSlug, catalogLangQuery]);

  const uniqueItems = useMemo(() => {
    if (!feed) return [];
    return dedupeItems([
      ...(feed.continueReading ?? []),
      ...(feed.recentlyPublished ?? []),
      ...(feed.myImports ?? []),
      ...(feed.featuredCollections?.flatMap((c) => c.items.map((i) => i.content).filter(Boolean)) ?? []),
    ]);
  }, [feed]);

  const highlightId = searchParams.get('item');
  const highlightedItem = useMemo(() => {
    if (!highlightId) return null;
    return uniqueItems.find((item) => item.id === highlightId) ?? null;
  }, [highlightId, uniqueItems]);

  useEffect(() => {
    if (!highlightedItem || isBrowse) return;
    const el = document.getElementById(`catalog-item-${highlightedItem.id}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightedItem, isBrowse]);

  const browseBaseItems = useMemo(() => {
    if (activeCollection) {
      return dedupeItems(activeCollection.items.map((i) => i.content).filter(Boolean));
    }
    if (isBrowse && activeFilter === 'Imports') {
      return feed?.myImports ?? [];
    }
    if (isBrowse) return catalogItems;
    return uniqueItems;
  }, [activeCollection, isBrowse, activeFilter, feed, catalogItems, uniqueItems]);

  const allowedLangs = useMemo(() => new Set(learnableLangCodes), [learnableLangCodes]);
  const filtered = browseBaseItems.filter((item) => {
    if (!isUserImport(item)) {
      const lang = itemLanguage(item);
      if (nativeCode && lang === nativeCode) return false;
      if (allowedLangs.size > 0 && !allowedLangs.has(lang)) return false;
    }
    return matchesSearch(item, search) && matchesFilter(item, activeFilter, languageTabs);
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
  const greetingText =
    hour < 12 ? copy.libraryPage.goodMorning : hour < 18 ? copy.libraryPage.goodAfternoon : copy.libraryPage.goodEvening;
  const firstName = (user?.displayName ?? copy.libraryPage.learnerFallback).split(' ')[0];
  const libraryEmpty =
    isBrowse
      ? !loading && !catalogLoading && browseBaseItems.length === 0
      : !loading && uniqueItems.length === 0;

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

  if (loading || (isBrowse && !activeCollection && catalogLoading && catalogItems.length === 0)) {
    return <LibrarySkeleton />;
  }

  if (isBrowse) {
    const browseReturnPath = `${location.pathname}${location.search}`;
    return (
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 lg:py-8 space-y-6 min-w-0">
        <div className="space-y-3">
          <nav className="flex items-center gap-1.5 text-sm text-gray-400">
            <button
              type="button"
              onClick={() => navigate('/app')}
              className="hover:text-g-blue-700 transition-colors font-medium"
            >
              {copy.library.title}
            </button>
            <ChevronRight className="w-3.5 h-3.5 shrink-0" />
            <span className="text-gray-600 font-medium truncate">
              {activeCollection?.title ?? copy.libraryPage.browseTitle}
            </span>
          </nav>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <button
                type="button"
                onClick={() => navigate('/app')}
                className="sm:hidden p-2 -ml-2 rounded-xl text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors"
                aria-label={copy.library.backToLibrary}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-2xl font-bold text-gray-900 truncate">{copy.libraryPage.browseTitle}</h1>
            </div>
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setBrowseSearch(e.target.value)}
                placeholder={copy.library.searchPlaceholder}
                className="w-full pl-8 pr-4 h-9 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-300"
              />
            </div>
            <div className="hidden sm:flex items-center gap-1 bg-gray-100 rounded-xl p-1">
              <button type="button" onClick={() => setView('grid')} className={cn('p-1.5 rounded-lg transition-colors', view === 'grid' ? 'bg-white shadow-sm text-gray-700' : 'text-gray-400 hover:text-gray-600')} aria-label={copy.library.gridView}>
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => setView('list')} className={cn('p-1.5 rounded-lg transition-colors', view === 'list' ? 'bg-white shadow-sm text-gray-700' : 'text-gray-400 hover:text-gray-600')} aria-label={copy.library.listView}>
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
                  activeFilter === f ? 'bg-g-blue-700 text-g-on-cta border-g-blue-700 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300',
                )}
              >
                {filterLabel(f, copy)}
              </button>
            ))}
          </div>
        )}

        {libraryEmpty ? (
          <EmptyState
            icon={BookOpen}
            title={copy.libraryPage.yourLibraryEmpty}
            description={copy.library.emptyDescription}
            actionLabel={copy.library.importAction}
            onAction={() => navigate('/app/import')}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Search}
            title={copy.libraryPage.noContentFound}
            description={copy.library.noResults}
            compact
          />
        ) : view === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 auto-rows-fr">
            {filtered.map((item) => (
              <ContentCard key={item.id} item={item} langFlags={langFlags} libraryReturn={browseReturnPath} />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((item) => (
              <ContentCard key={item.id} item={item} view="list" langFlags={langFlags} libraryReturn={browseReturnPath} />
            ))}
          </div>
        )}
      </div>
    );
  }

  const streakCount = stats?.streakCount ?? 0;
  const dailyGoalMinutes = stats?.dailyGoalMinutes ?? 15;
  // Don't claim a streak that doesn't exist — see docs/E2E_AUDIT_REPORT.md's
  // always-positive-streak-greeting finding.
  const streakSubtitle =
    streakCount === 0
      ? copy.libraryPage.streakStartToday(dailyGoalMinutes)
      : streakCount === 1
        ? copy.libraryPage.streakDayOne
        : copy.libraryPage.streakKeepAlive;

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 lg:py-8 space-y-8 min-w-0">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 lg:gap-6 min-w-0">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">{greetingText}, {firstName} 👋</h1>
          <p className="text-gray-500 mt-0.5 text-sm">{streakSubtitle}</p>
        </div>
        <div className="flex gap-3 min-w-0 w-full lg:w-auto">
          {[
            { icon: Flame, value: copy.libraryPage.days(streakCount), label: copy.libraryPage.streak, color: 'text-[#e17100] bg-[#fffbeb] border-[#fee685]' },
            { icon: Brain, value: `${stats?.wordsLearned ?? 0}`, label: copy.libraryPage.words, color: 'text-[#155dfc] bg-g-learning-bg border-[#bedbff]' },
          ].map((s) => (
            <div key={s.label} className={cn('flex items-center gap-2 border rounded-xl px-3 py-2.5 min-w-0 flex-1 lg:flex-none lg:min-w-[7.5rem]', s.color)}>
              <s.icon className="w-4 h-4 shrink-0" />
              <div>
                <div className="font-bold text-sm leading-none">{s.value}</div>
                <div className="text-xs opacity-70 mt-0.5">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {highlightedItem && (
        <section className="space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-g-blue-700">{copy.libraryPage.newMaterialLabel}</p>
            <h2 className="text-gray-900 font-bold mt-0.5">{highlightedItem.title}</h2>
            <p className="text-gray-400 text-sm">{copy.libraryPage.newMaterialHint}</p>
          </div>
          <div className="max-w-[10.5rem] sm:max-w-[12rem]">
            <ContentCard item={highlightedItem} highlighted langFlags={langFlags} />
          </div>
        </section>
      )}

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
                <ContentCard key={item.id} item={item} compact langFlags={langFlags} />
              ))}
            </div>
          )}
        </div>
      )}

      {(feed?.recentlyPublished?.length ?? 0) > 0 && (
        <section>
          <SectionHeading
            title={copy.libraryPage.newInLibrary}
            onSeeAll={() => navigate('/app/browse')}
          />
          <div className="flex gap-4 overflow-x-auto pb-3 -mx-3 px-3 sm:mx-0 sm:px-0 scrollbar-hide snap-x snap-mandatory lg:grid lg:grid-cols-4 xl:grid-cols-5 lg:overflow-visible lg:pb-0 lg:gap-4 lg:snap-none">
            {feed!.recentlyPublished.slice(0, 10).map((item) => (
              <div key={item.id} className="snap-start shrink-0 w-[8.5rem] sm:w-40 lg:w-auto lg:shrink">
                <ContentCard item={item} compact highlighted={item.id === highlightId} />
              </div>
            ))}
            <div className="shrink-0 w-1 lg:hidden" aria-hidden />
          </div>
        </section>
      )}

      {(feed?.myImports?.length ?? 0) > 0 && (
        <section>
          <SectionHeading
            title={copy.libraryPage.yourImports}
            onSeeAll={() => navigate('/app/browse?filter=Imports')}
          />
          <div className="flex gap-4 overflow-x-auto pb-3 -mx-3 px-3 sm:mx-0 sm:px-0 scrollbar-hide snap-x snap-mandatory lg:grid lg:grid-cols-4 xl:grid-cols-5 lg:overflow-visible lg:pb-0 lg:gap-4 lg:snap-none">
            {feed!.myImports.slice(0, 10).map((item) => (
              <div key={item.id} className="snap-start shrink-0 w-[8.5rem] sm:w-40 lg:w-auto lg:shrink">
                <ContentCard item={item} compact />
              </div>
            ))}
            <div className="shrink-0 w-1 lg:hidden" aria-hidden />
          </div>
        </section>
      )}

      {feed?.featuredCollections?.map((collection) => {
        const items = collection.items.map((i) => i.content).filter(Boolean);
        if (!items.length) return null;
        return (
          <section key={collection.slug}>
            <SectionHeading
              title={collection.title}
              subtitle={collection.description}
              onSeeAll={() => navigate(browsePathForCollection(collection, languageTabs))}
            />
            <div className="flex gap-4 overflow-x-auto pb-3 -mx-3 px-3 sm:mx-0 sm:px-0 scrollbar-hide snap-x snap-mandatory lg:grid lg:grid-cols-4 xl:grid-cols-5 lg:overflow-visible lg:pb-0 lg:gap-4 lg:snap-none">
              {items.map((item) => (
                <div key={item.id} className="snap-start shrink-0 w-[8.5rem] sm:w-40 lg:w-auto lg:shrink">
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
            title={copy.libraryPage.yourLibraryEmpty}
            description={copy.library.emptyDescription}
            actionLabel={copy.library.importAction}
            onAction={() => navigate('/app/import')}
          />
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => navigate('/app/import')}
              className="inline-flex items-center gap-2 text-sm text-g-blue-700 hover:text-violet-800 font-medium"
            >
              <Upload className="w-4 h-4" />
              {copy.library.importAction}
            </button>
          </div>
        </div>
      )}

      {!libraryEmpty && (!feed?.featuredCollections?.length || feed.featuredCollections.every((c) => !c.items.length)) && !(feed?.recentlyPublished?.length) && (
        <section>
          <SectionHeading
            title={copy.libraryPage.browseTitle}
            subtitle={copy.library.allContent}
            onSeeAll={() => navigate('/app/browse')}
          />
        </section>
      )}
    </div>
  );
}
