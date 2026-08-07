import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, BookOpen, Brain, ChevronRight, Clock, Flame, Grid3X3, List, Search, Upload } from 'lucide-react';
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
const filterTabs = ['All', 'EN', 'RU', 'UZ', 'Fiction', 'News', 'A1–A2', 'B1–B2'];

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
      className="relative overflow-hidden rounded-2xl cursor-pointer group"
      style={{ backgroundImage: gradientForId(item.id) }}
      onClick={() => navigate(`/app/read/${item.id}`)}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
      <div className="relative p-6 h-44 flex flex-col justify-end">
        <span className="text-[11px] font-semibold text-white/70 uppercase tracking-wider mb-2">Continue reading</span>
        <div className="flex items-end justify-between">
          <div className="flex-1 min-w-0">
            <div className="text-white font-bold text-xl leading-tight truncate mb-0.5">{item.title}</div>
            {itemSubtitle(item) && <div className="text-white/60 text-sm truncate">{itemSubtitle(item)}</div>}
          </div>
          <div className="ml-4 flex flex-col items-end gap-2 shrink-0">
            <span className="text-white/90 font-bold text-2xl tabular-nums">{item.progressPct ?? 0}%</span>
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

interface FeedResponse {
  continueReading: ContentItem[];
  recentlyPublished: ContentItem[];
  featuredCollections: Array<{
    slug: string;
    title: string;
    description?: string;
    isFeatured: boolean;
    items: Array<{ content: ContentItem }>;
  }>;
}

export default function LibraryPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, stats, preferences } = useAuth();
  const [feed, setFeed] = useState<FeedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState(() => searchParams.get('q') ?? '');
  const [activeFilter, setActiveFilter] = useState('All');

  useEffect(() => {
    api<FeedResponse>('/content/feed')
      .then(setFeed)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const q = searchParams.get('q');
    if (q != null) {
      setSearch(q);
      requestAnimationFrame(() => document.getElementById('browse-all')?.scrollIntoView({ behavior: 'smooth' }));
    }
  }, [searchParams]);

  const allItems = feed
    ? [...(feed.continueReading ?? []), ...(feed.recentlyPublished ?? []), ...(feed.featuredCollections?.flatMap((c) => c.items.map((i) => i.content).filter(Boolean)) ?? [])]
    : [];
  const uniqueItems = Array.from(new Map(allItems.map((i) => [i.id, i])).values());

  const filtered = uniqueItems.filter((item) => {
    if (search) return item.title.toLowerCase().includes(search.toLowerCase());
    if (activeFilter === 'All') return true;
    if (activeFilter === 'EN') return item.language === 'en';
    if (activeFilter === 'RU') return item.language === 'ru';
    if (activeFilter === 'UZ') return item.language === 'uz';
    if (activeFilter === 'Fiction') return item.genre === 'fiction' || item.genre === 'Folk Tales';
    if (activeFilter === 'News') return item.contentType === 'news' || item.contentType === 'article';
    if (activeFilter === 'A1–A2') return item.cefrLevel === 'a1' || item.cefrLevel === 'a2';
    if (activeFilter === 'B1–B2') return item.cefrLevel === 'b1' || item.cefrLevel === 'b2';
    return true;
  });

  const hero = feed?.continueReading?.[0];
  const heroSideItems = feed?.continueReading?.slice(1, 4) ?? feed?.recentlyPublished?.slice(0, 3) ?? [];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  const firstName = (user?.displayName ?? 'Learner').split(' ')[0];
  const dailyGoal = preferences?.dailyGoalMinutes ?? 15;
  const todayMinutes = stats?.todayMinutes ?? 0;
  const todayPct = Math.min(100, Math.round((todayMinutes / dailyGoal) * 100));
  const libraryEmpty = !loading && uniqueItems.length === 0;

  if (loading) return <LibrarySkeleton />;

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
            { icon: Clock, value: `${todayMinutes}/${dailyGoal}m`, label: 'Today', color: todayPct >= 100 ? 'text-[#007a55] bg-[#ecfdf5] border-[#a4f4cf]' : 'text-[#7f22fe] bg-[#f5f3ff] border-[#ddd6ff]' },
            { icon: Brain, value: `${stats?.wordsLearned ?? 0}`, label: 'Words', color: 'text-[#155dfc] bg-[#eff6ff] border-[#bedbff]' },
          ].map((s) => (
            <div key={s.label} className={cn('flex items-center gap-2 border rounded-xl px-3 py-2.5', s.color)}>
              <s.icon className="w-4 h-4" />
              <div>
                <div className="font-bold text-sm leading-none">{s.value}</div>
                <div className="text-xs opacity-70 mt-0.5">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {hero && (
        <div className="grid lg:grid-cols-3 gap-5 items-stretch">
          <div className="lg:col-span-1 min-h-[11rem]">
            <ContinueReadingCard item={hero} />
          </div>
          {heroSideItems.length > 0 && (
            <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-3 gap-3 lg:gap-4 auto-rows-fr">
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
                onClick={() => { setSearch(''); setActiveFilter('All'); document.getElementById('browse-all')?.scrollIntoView({ behavior: 'smooth' }); }}
                className="flex items-center gap-1 text-xs font-semibold text-[#7f22fe] hover:text-violet-800 hover:bg-violet-50 px-2.5 py-1.5 rounded-lg transition-colors"
              >
                See all <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-hide snap-x snap-mandatory">
              {items.map((item) => (
                <div key={item.id} className="snap-start shrink-0 w-[11rem] sm:w-48">
                  <ContentCard item={item} compact />
                </div>
              ))}
              <div className="shrink-0 w-1" aria-hidden />
            </div>
          </section>
        );
      })}

      <section id="browse-all">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <h2 className="text-gray-900 font-bold flex-1">Browse Library</h2>
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="w-full pl-8 pr-4 h-9 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-300"
            />
          </div>
          <div className="hidden sm:flex items-center gap-1 bg-gray-100 rounded-xl p-1">
            <button type="button" onClick={() => setView('grid')} className={cn('p-1.5 rounded-lg transition-colors', view === 'grid' ? 'bg-white shadow-sm text-gray-700' : 'text-gray-400 hover:text-gray-600')}>
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => setView('list')} className={cn('p-1.5 rounded-lg transition-colors', view === 'list' ? 'bg-white shadow-sm text-gray-700' : 'text-gray-400 hover:text-gray-600')}>
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {!search && (
          <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide mb-4">
            {filterTabs.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setActiveFilter(f)}
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
      </section>

      {libraryEmpty && (
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
      )}
    </div>
  );
}
