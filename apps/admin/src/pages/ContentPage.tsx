import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, Eye, Pencil, Plus, Trash2 } from 'lucide-react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { catalogListHref, saveContentLibraryReturn } from '../lib/contentLibraryNav';
import { AdminReaderPreview } from '../components/AdminReaderPreview';
import { Badge, Button, Card, DataTable, ErrorBlock, Input, LoadingBlock, PageHeader, Select, StatCard, TablePagination } from '../components/ui';
import { api } from '../lib/api';
import { APP_LANGUAGES, LANGUAGE_META, cn, formatMoney, formatNumber, levelBadgeClass } from '../lib/utils';

type Tab = 'all' | 'book' | 'article' | 'news' | 'user_imports';

interface CurriculumItem {
  id: string;
  title: string;
  language: string;
  cefrLevel: string;
  contentType: string;
  wordCount: number;
  activeReads: number;
  completion: number;
  publishStatus: string;
  isFree: boolean;
  priceUsd: number;
  priceUzs?: number;
  salesCount: number;
  author?: string | null;
  subtitle?: string | null;
  description?: string | null;
  coverImageKey?: string | null;
}

interface LicenseRow {
  id: string;
  rightsHolder: string;
  status: string;
  attributionText: string;
}

interface ModerationRow {
  id: string;
  reason: string;
  status: string;
}

interface IngestionRow {
  id: string;
  sourceType: string;
  status: string;
  attempts: number;
  errorMessage?: string | null;
}

const DIRECTORY_TO_TAB: Record<string, Tab> = {
  all: 'all',
  books: 'book',
  book: 'book',
  articles: 'article',
  article: 'article',
  news: 'news',
  'user-imports': 'user_imports',
  user_imports: 'user_imports',
  pricing: 'all',
};

const TAB_TO_PATH: Record<Tab, string> = {
  all: '/content',
  book: '/content/books',
  article: '/content/articles',
  news: '/content/news',
  user_imports: '/content/user-imports',
};

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'book', label: 'Books' },
  { id: 'article', label: 'Articles' },
  { id: 'news', label: 'News' },
  { id: 'user_imports', label: 'User Imports' },
];

const PAGE_SIZE = 15;

const langBadge: Record<string, string> = {
  fr: 'bg-violet-50 text-g-blue-700',
  en: 'bg-sky-50 text-sky-700',
  ru: 'bg-amber-50 text-amber-700',
  uz: 'bg-fuchsia-50 text-fuchsia-700',
  es: 'bg-orange-50 text-orange-700',
  de: 'bg-yellow-50 text-yellow-800',
  ja: 'bg-rose-50 text-rose-700',
  ko: 'bg-teal-50 text-teal-700',
  pt: 'bg-lime-50 text-lime-700',
};

const statusBadge: Record<string, string> = {
  published: 'bg-emerald-50 text-emerald-700',
  draft: 'bg-slate-100 text-slate-600',
  review: 'bg-orange-50 text-orange-700',
  archived: 'bg-slate-200 text-slate-500',
};

function statusLabel(status: string) {
  if (status === 'published') return 'Active';
  if (status === 'review') return 'Review';
  return status[0].toUpperCase() + status.slice(1);
}

export default function ContentPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { directory } = useParams();
  const [params] = useSearchParams();
  const tabFromPath = directory ? DIRECTORY_TO_TAB[directory] : undefined;
  const tab = tabFromPath || (params.get('tab') as Tab) || 'all';
  const [stats, setStats] = useState({
    total: 0,
    published: 0,
    draft: 0,
    review: 0,
    archived: 0,
    activeSalesMonthly: 0,
    freeItems: 0,
  });
  const [items, setItems] = useState<CurriculumItem[] | null>(null);
  const [q, setQ] = useState(() => params.get('q') ?? '');
  const [langFilter, setLangFilter] = useState(() => params.get('lang') ?? 'all');
  const [levelFilter, setLevelFilter] = useState(() => params.get('level') ?? 'all');
  const [page, setPage] = useState(() => Math.max(1, Number(params.get('page') ?? 1) || 1));
  const [licenses, setLicenses] = useState<LicenseRow[]>([]);
  const [moderation, setModeration] = useState<ModerationRow[]>([]);
  const [ingestion, setIngestion] = useState<IngestionRow[]>([]);
  const [rightsHolder, setRightsHolder] = useState('');
  const [attributionText, setAttributionText] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Moderator-role admins can only reach /admin/moderation — the catalog endpoints below
  // 403 for them. Track that separately so the moderation queue still renders instead of
  // the whole page getting stuck on a permissions error.
  const [catalogForbidden, setCatalogForbidden] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const loadCurriculum = useCallback(async () => {
    setError(null);
    try {
      const type = tab === 'user_imports' ? 'user_imports' : tab === 'all' ? 'all' : tab;
      const qs = new URLSearchParams();
      qs.set('type', type);
      if (langFilter !== 'all') qs.set('language', langFilter);
      if (levelFilter !== 'all') qs.set('level', levelFilter);
      if (q.trim()) qs.set('q', q.trim());
      const statsQs = new URLSearchParams();
      if (langFilter !== 'all') statsQs.set('language', langFilter);
      if (levelFilter !== 'all') statsQs.set('level', levelFilter);
      const [list, s] = await Promise.all([
        api<CurriculumItem[]>(`/admin/content/curriculum?${qs}`),
        api<typeof stats>(`/admin/content/stats${statsQs.toString() ? `?${statsQs}` : ''}`),
      ]);
      setItems(list);
      setStats(s);
      setCatalogForbidden(false);
    } catch (e) {
      const status = (e as { status?: number })?.status;
      if (status === 403) {
        setCatalogForbidden(true);
        setItems([]);
      } else {
        setError(e instanceof Error ? e.message : 'Failed to load content');
      }
    }
  }, [tab, langFilter, levelFilter, q]);

  async function loadOps() {
    const [lic, mod, ing] = await Promise.allSettled([
      api<LicenseRow[]>('/admin/licenses'),
      api<ModerationRow[]>('/admin/moderation?status=pending'),
      api<IngestionRow[]>('/admin/ingestion'),
    ]);
    setLicenses(lic.status === 'fulfilled' ? lic.value : []);
    setModeration(mod.status === 'fulfilled' ? mod.value : []);
    setIngestion(ing.status === 'fulfilled' ? ing.value : []);
    if (mod.status === 'rejected') throw mod.reason;
  }

  useEffect(() => {
    void loadCurriculum();
  }, [loadCurriculum]);

  useEffect(() => {
    saveContentLibraryReturn(`${location.pathname}${location.search}`);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const fromUrl = params.get('q');
    if (fromUrl != null && fromUrl !== q) setQ(fromUrl);
    const fromLang = params.get('lang') ?? 'all';
    if (fromLang !== langFilter) setLangFilter(fromLang);
    const fromLevel = params.get('level') ?? 'all';
    if (fromLevel !== levelFilter) setLevelFilter(fromLevel);
    const fromPage = Math.max(1, Number(params.get('page') ?? 1) || 1);
    if (fromPage !== page) setPage(fromPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const filtered = useMemo(() => items ?? [], [items]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, safePage]);

  useEffect(() => {
    if (tab === 'user_imports') loadOps().catch(console.error);
  }, [tab]);

  function setTab(next: Tab) {
    setPage(1);
    navigate(`${TAB_TO_PATH[next]}${catalogQuery({ page: 1 })}`);
  }

  async function publish(id: string) {
    setBusyId(id);
    try {
      await api(`/admin/content/${id}/publish`, { method: 'PATCH' });
      await loadCurriculum();
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    setBusyId(id);
    try {
      await api(`/admin/content/${id}`, { method: 'DELETE' });
      await loadCurriculum();
    } finally {
      setBusyId(null);
    }
  }

  async function createLicense(e: React.FormEvent) {
    e.preventDefault();
    await api('/admin/licenses', {
      method: 'POST',
      body: JSON.stringify({ rightsHolder, attributionText, status: 'cleared' }),
    });
    setRightsHolder('');
    setAttributionText('');
    await loadOps();
  }

  async function review(id: string, status: string) {
    await api(`/admin/moderation/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
    await loadOps();
  }

  function catalogQuery(next?: { lang?: string; level?: string; q?: string; page?: number }) {
    const qs = new URLSearchParams();
    const lang = next?.lang ?? langFilter;
    const level = next?.level ?? levelFilter;
    const query = next?.q ?? q;
    const pageNum = next?.page ?? page;
    if (query.trim()) qs.set('q', query.trim());
    if (lang !== 'all') qs.set('lang', lang);
    if (level !== 'all') qs.set('level', level);
    if (pageNum > 1) qs.set('page', String(pageNum));
    const s = qs.toString();
    return s ? `?${s}` : '';
  }

  function setLang(next: string) {
    setLangFilter(next);
    setPage(1);
    navigate(`${TAB_TO_PATH[tab]}${catalogQuery({ lang: next, page: 1 })}`, { replace: true });
  }

  function setLevel(next: string) {
    setLevelFilter(next);
    setPage(1);
    navigate(`${TAB_TO_PATH[tab]}${catalogQuery({ level: next, page: 1 })}`, { replace: true });
  }

  function setSearch(next: string) {
    setQ(next);
    setPage(1);
    navigate(`${TAB_TO_PATH[tab]}${catalogQuery({ q: next, page: 1 })}`, { replace: true });
  }

  function setCatalogPage(next: number) {
    const clamped = Math.max(1, Math.min(next, totalPages));
    setPage(clamped);
    navigate(`${TAB_TO_PATH[tab]}${catalogQuery({ page: clamped })}`, { replace: true });
  }

  if (error && !items) return <ErrorBlock message={error} onRetry={() => void loadCurriculum()} />;
  if (!items) return <LoadingBlock />;

  const showCatalog = tab !== 'user_imports' && !catalogForbidden;

  return (
    <div>
      <PageHeader
        title="Content & Reading Store"
        subtitle={
          catalogForbidden
            ? 'Review user-submitted imports awaiting approval.'
            : 'Manage the reading catalog. Import charges are pay as you go in UZS via Atmos.'
        }
        actions={
          catalogForbidden ? undefined : (
            <Button onClick={() => navigate('/content/new')}>
              <Plus className="size-4" /> Add Product
            </Button>
          )
        }
      />

      {!catalogForbidden && (
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Items" value={formatNumber(stats.total)} icon={<BookOpen className="size-5" />} />
        <StatCard label="Published" value={formatNumber(stats.published)} accent="bg-emerald-50 text-emerald-700" />
        <StatCard
          label="Active Sales"
          value={`${formatMoney(stats.activeSalesMonthly, 'UZS')}/mo`}
          accent="bg-slate-100 text-slate-700"
        />
        <StatCard label="Free Items" value={formatNumber(stats.freeItems)} accent="bg-amber-50 text-amber-700" />
      </div>
      )}

      <Card className="p-0 overflow-hidden mb-4 [overflow-anchor:none]">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-3 border-b border-slate-100">
          <div className="flex gap-1 flex-wrap">
            {(catalogForbidden ? TABS.filter((t) => t.id === 'user_imports') : TABS).map((t) => (
              <Link
                key={t.id}
                to={TAB_TO_PATH[t.id]}
                onClick={(e) => {
                  e.preventDefault();
                  setTab(t.id);
                }}
                className={cn(
                  'px-3 py-2.5 text-sm font-semibold border-b-2 -mb-px transition',
                  tab === t.id
                    ? 'border-g-blue-700 text-g-blue-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800',
                )}
              >
                {t.label}
              </Link>
            ))}
          </div>
          {showCatalog && (
            <div className="flex flex-wrap items-center justify-end gap-2 mb-2 ml-auto">
              <Select value={langFilter} onChange={(e) => setLang(e.target.value)} className="w-40" aria-label="Filter by language">
                <option value="all">All languages</option>
                {APP_LANGUAGES.map((l) => (
                  <option key={l} value={l}>
                    {LANGUAGE_META[l].flag} {LANGUAGE_META[l].label}
                  </option>
                ))}
              </Select>
              <Select value={levelFilter} onChange={(e) => setLevel(e.target.value)} className="w-32" aria-label="Filter by CEFR level">
                <option value="all">All levels</option>
                {['a1', 'a2', 'b1', 'b2', 'c1', 'c2'].map((l) => (
                  <option key={l} value={l}>{l.toUpperCase()}</option>
                ))}
              </Select>
              <Input
                className="w-52"
                value={q}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search curriculum..."
              />
            </div>
          )}
        </div>

        {tab === 'user_imports' ? (
          <div className="p-4 space-y-6">
            <section>
              <div className="font-semibold mb-1">Moderation queue</div>
              <div className="text-sm text-slate-500 mb-3">Review user imports awaiting approval.</div>
              {moderation.length === 0 ? (
                <Card className="p-6 text-center text-sm text-slate-500">No pending moderation items.</Card>
              ) : (
                <div className="space-y-3">
                  {moderation.map((item) => (
                    <Card key={item.id} className="p-4 flex items-center justify-between gap-3">
                      <div className="text-sm font-medium">{item.reason}</div>
                      <div className="flex gap-2">
                        <Button onClick={() => review(item.id, 'approved')}>Approve</Button>
                        <Button variant="danger" onClick={() => review(item.id, 'rejected')}>Reject</Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </section>

            <section>
              <div className="font-semibold mb-1">Ingestion jobs</div>
              <div className="text-sm text-slate-500 mb-3">Background processing for imports and feeds.</div>
              <DataTable headers={['Type', 'Status', 'Attempts', 'Error']}>
                {ingestion.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 text-sm">{item.sourceType}</td>
                    <td className="px-4 py-3 text-sm capitalize">{item.status}</td>
                    <td className="px-4 py-3 text-sm">{item.attempts}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{item.errorMessage ?? '—'}</td>
                  </tr>
                ))}
              </DataTable>
              {ingestion.length === 0 && (
                <div className="px-4 py-6 text-sm text-slate-500">No ingestion jobs yet.</div>
              )}
            </section>

            <section>
              <div className="font-semibold mb-1">Licenses</div>
              <div className="text-sm text-slate-500 mb-3">Rights registry for curated / licensed curriculum.</div>
              <Card className="p-4 mb-3">
                <form className="grid gap-3 md:grid-cols-[1fr_1fr_auto]" onSubmit={createLicense}>
                  <Input value={rightsHolder} onChange={(e) => setRightsHolder(e.target.value)} placeholder="Rights holder" required />
                  <Input value={attributionText} onChange={(e) => setAttributionText(e.target.value)} placeholder="Attribution text" required />
                  <Button type="submit">Add license</Button>
                </form>
              </Card>
              <DataTable headers={['Holder', 'Status', 'Attribution']}>
                {licenses.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 text-sm font-medium">{item.rightsHolder}</td>
                    <td className="px-4 py-3"><Badge className="bg-violet-50 text-g-blue-700">{item.status}</Badge></td>
                    <td className="px-4 py-3 text-sm text-slate-500">{item.attributionText}</td>
                  </tr>
                ))}
              </DataTable>
            </section>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-sm">Need import costs & free allowances?</div>
                <div className="text-sm text-slate-500">Configure them in Import & Pricing.</div>
              </div>
              <Button variant="secondary" onClick={() => navigate('/import-pricing')}>Open Import & Pricing</Button>
            </div>
          </div>
        ) : showCatalog ? (
          <>
          <DataTable headers={['Curriculum Item', 'Language', 'Level', 'Type', 'Word Count', 'Active Reads', 'Completion', 'Status', 'Price (UZS)', 'Sales', 'Actions']}>
            {paginated.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3 text-sm font-semibold max-w-[240px] truncate">{item.title}</td>
                <td className="px-4 py-3">
                  <Badge className={langBadge[item.language] ?? 'bg-slate-100 text-slate-600'}>
                    {item.language.toUpperCase()}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge className={levelBadgeClass(item.cefrLevel)}>{item.cefrLevel.toUpperCase()}</Badge>
                </td>
                <td className="px-4 py-3 text-sm capitalize">{item.contentType.replace('_', ' ')}</td>
                <td className="px-4 py-3 text-sm">{formatNumber(item.wordCount)}</td>
                <td className="px-4 py-3 text-sm">{formatNumber(item.activeReads)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 min-w-[110px]">
                    <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full bg-sky-600" style={{ width: `${item.completion}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-slate-600">{item.completion}%</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge className={statusBadge[item.publishStatus] ?? statusBadge.draft}>
                    {statusLabel(item.publishStatus)}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-sm font-medium">
                  {item.isFree || (item.priceUzs ?? item.priceUsd) <= 0
                    ? 'Free'
                    : formatMoney(item.priceUzs ?? item.priceUsd, 'UZS')}
                </td>
                <td className="px-4 py-3 text-sm">{formatNumber(item.salesCount)}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className="size-8 rounded-lg grid place-items-center text-slate-500 hover:bg-violet-50 hover:text-g-blue-700"
                      aria-label="Preview reading screen"
                      title="Preview reading screen"
                      onClick={() => setPreviewId(item.id)}
                    >
                      <Eye className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      className="size-8 rounded-lg grid place-items-center text-slate-500 hover:bg-violet-50 hover:text-g-blue-700"
                      aria-label="Edit"
                      onClick={() => navigate(`/content/${item.id}/edit`)}
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    {item.publishStatus !== 'published' && item.publishStatus !== 'archived' && (
                      <Button variant="ghost" disabled={busyId === item.id} onClick={() => publish(item.id)}>
                        Publish
                      </Button>
                    )}
                    <button
                      type="button"
                      className="size-8 rounded-lg grid place-items-center text-slate-400 hover:text-rose-500 disabled:opacity-40"
                      aria-label="Delete permanently"
                      disabled={busyId === item.id}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Permanently delete “${item.title}”? This cannot be undone.`,
                          )
                        ) {
                          void remove(item.id);
                        }
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {paginated.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-10 text-sm text-slate-500 text-center">
                  No catalog items match these filters.
                </td>
              </tr>
            )}
          </DataTable>
          <TablePagination
            page={safePage}
            pageSize={PAGE_SIZE}
            total={filtered.length}
            onPageChange={setCatalogPage}
          />
          </>
        ) : null}
      </Card>

      {showCatalog && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-semibold text-sm">Pay as you go import prices</div>
            <div className="text-sm text-slate-500">Atmos charges are in UZS. Set page tiers on Import & Pricing — not catalog list prices.</div>
          </div>
          <Button variant="secondary" onClick={() => navigate('/import-pricing')}>Open Import & Pricing</Button>
        </div>
      )}

      {previewId ? (
        <AdminReaderPreview contentId={previewId} onClose={() => setPreviewId(null)} />
      ) : null}
    </div>
  );
}
