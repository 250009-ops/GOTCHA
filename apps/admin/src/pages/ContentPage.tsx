import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, DollarSign, Pencil, Plus, Trash2 } from 'lucide-react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Badge, Button, Card, DataTable, ErrorBlock, Input, LoadingBlock, PageHeader, Select, StatCard } from '../components/ui';
import { api } from '../lib/api';
import { APP_LANGUAGES, cn, formatMoney, formatNumber, levelBadgeClass } from '../lib/utils';

type Tab = 'all' | 'book' | 'article' | 'news' | 'user_imports' | 'pricing';

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
  salesCount: number;
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

interface PricingRules {
  contentType: string;
  basePriceUsd: number;
  perPageSurchargeUsd: number;
  volumeDiscountsEnabled: boolean;
  buy3PctOff: number;
  buy5PctOff: number;
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
  pricing: 'pricing',
};

const TAB_TO_PATH: Record<Tab, string> = {
  all: '/content',
  book: '/content/books',
  article: '/content/articles',
  news: '/content/news',
  user_imports: '/content/user-imports',
  pricing: '/content/pricing',
};

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'book', label: 'Books' },
  { id: 'article', label: 'Articles' },
  { id: 'news', label: 'News' },
  { id: 'user_imports', label: 'User Imports' },
  { id: 'pricing', label: 'Pricing' },
];

const langBadge: Record<string, string> = {
  fr: 'bg-violet-50 text-[#6c1d95]',
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
  const { directory } = useParams();
  const [params] = useSearchParams();
  const tabFromPath = directory ? DIRECTORY_TO_TAB[directory] : undefined;
  const tab = tabFromPath || (params.get('tab') as Tab) || 'all';
  const [stats, setStats] = useState({
    total: 847,
    published: 723,
    draft: 89,
    review: 35,
    archived: 0,
    activeSalesMonthly: 12450,
    freeItems: 34,
  });
  const [items, setItems] = useState<CurriculumItem[] | null>(null);
  const [q, setQ] = useState(() => params.get('q') ?? '');
  const [langFilter, setLangFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');
  const [licenses, setLicenses] = useState<LicenseRow[]>([]);
  const [moderation, setModeration] = useState<ModerationRow[]>([]);
  const [ingestion, setIngestion] = useState<IngestionRow[]>([]);
  const [rightsHolder, setRightsHolder] = useState('');
  const [attributionText, setAttributionText] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pricingRules, setPricingRules] = useState<PricingRules | null>(null);
  const [pricingSaving, setPricingSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Moderator-role admins can only reach /admin/moderation — the catalog endpoints below
  // 403 for them. Track that separately so the moderation queue still renders instead of
  // the whole page getting stuck on a permissions error.
  const [catalogForbidden, setCatalogForbidden] = useState(false);

  const loadCurriculum = useCallback(async () => {
    setError(null);
    try {
      const type = tab === 'all' || tab === 'pricing' ? 'all' : tab === 'user_imports' ? 'user_imports' : tab;
      const [list, s] = await Promise.all([
        api<CurriculumItem[]>(`/admin/content/curriculum?type=${type}`),
        api<typeof stats>('/admin/content/stats'),
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
  }, [tab]);

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

  async function loadPricingRules() {
    setPricingRules(await api<PricingRules>('/admin/content/pricing-rules'));
  }

  useEffect(() => {
    void loadCurriculum();
  }, [loadCurriculum]);

  useEffect(() => {
    const fromUrl = params.get('q');
    if (fromUrl != null) setQ(fromUrl);
  }, [params]);

  useEffect(() => {
    if (tab === 'user_imports') loadOps().catch(console.error);
  }, [tab]);

  useEffect(() => {
    if (tab === 'pricing' || tab !== 'user_imports') loadPricingRules().catch(console.error);
  }, [tab]);

  useEffect(() => {
    if (tab === 'pricing') {
      document.getElementById('pricing-rules')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [tab, pricingRules]);

  const filtered = useMemo(() => {
    return (items ?? []).filter((item) => {
      if (langFilter !== 'all' && item.language !== langFilter) return false;
      if (levelFilter !== 'all' && item.cefrLevel !== levelFilter) return false;
      if (q && !item.title.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [items, langFilter, levelFilter, q]);

  async function publish(id: string) {
    setBusyId(id);
    try {
      await api(`/admin/content/${id}/publish`, { method: 'PATCH' });
      await loadCurriculum();
    } finally {
      setBusyId(null);
    }
  }

  async function archive(id: string) {
    setBusyId(id);
    try {
      await api(`/admin/content/${id}/archive`, { method: 'PATCH' });
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

  function setTab(next: Tab) {
    const path = TAB_TO_PATH[next];
    const qParam = q ? `?q=${encodeURIComponent(q)}` : '';
    navigate(`${path}${qParam}`);
  }

  async function savePricingRules(e: React.FormEvent) {
    e.preventDefault();
    if (!pricingRules) return;
    setPricingSaving(true);
    try {
      setPricingRules(await api<PricingRules>('/admin/content/pricing-rules', {
        method: 'PATCH',
        body: JSON.stringify(pricingRules),
      }));
    } finally {
      setPricingSaving(false);
    }
  }

  if (error && !items) return <ErrorBlock message={error} onRetry={() => void loadCurriculum()} />;
  if (!items) return <LoadingBlock />;

  const showCatalog = tab !== 'user_imports' && !catalogForbidden;
  const showPricing = (tab === 'pricing' || tab !== 'user_imports') && !catalogForbidden;

  return (
    <div>
      <PageHeader
        title="Content & Reading Store"
        subtitle={
          catalogForbidden
            ? 'Review user-submitted imports awaiting approval.'
            : 'Manage learning content, set product pricing, and track sales performance.'
        }
        actions={
          catalogForbidden ? undefined : (
            <div className="flex flex-wrap gap-2">
              <Select value={langFilter} onChange={(e) => setLangFilter(e.target.value)} className="w-36">
                <option value="all">Language: All</option>
                {APP_LANGUAGES.map((l) => (
                  <option key={l} value={l}>{l.toUpperCase()}</option>
                ))}
              </Select>
              <Select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)} className="w-36">
                <option value="all">Level: A1-C2</option>
                {['a1', 'a2', 'b1', 'b2', 'c1', 'c2'].map((l) => (
                  <option key={l} value={l}>{l.toUpperCase()}</option>
                ))}
              </Select>
              <Button onClick={() => navigate('/content/new')}>
                <Plus className="size-4" /> Add Product
              </Button>
            </div>
          )
        }
      />

      {!catalogForbidden && (
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Items" value={formatNumber(stats.total)} icon={<BookOpen className="size-5" />} />
        <StatCard label="Published" value={formatNumber(stats.published)} accent="bg-emerald-50 text-emerald-700" />
        <StatCard
          label="Active Sales"
          value={`${formatMoney(stats.activeSalesMonthly, 'USD')}/mo`}
          accent="bg-slate-100 text-slate-700"
          icon={<DollarSign className="size-5" />}
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
                    ? 'border-[#6c1d95] text-[#6c1d95]'
                    : 'border-transparent text-slate-500 hover:text-slate-800',
                )}
              >
                {t.label}
              </Link>
            ))}
          </div>
          {showCatalog && (
            <Input
              className="max-w-xs mb-2"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search curriculum..."
            />
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
                    <td className="px-4 py-3"><Badge className="bg-violet-50 text-[#6c1d95]">{item.status}</Badge></td>
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
          <DataTable headers={['Curriculum Item', 'Language', 'Level', 'Type', 'Word Count', 'Active Reads', 'Completion', 'Status', 'Price (USD)', 'Sales', 'Actions']}>
            {filtered.map((item) => (
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
                  {item.isFree || item.priceUsd <= 0 ? 'Free' : formatMoney(item.priceUsd, 'USD')}
                </td>
                <td className="px-4 py-3 text-sm">{formatNumber(item.salesCount)}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className="size-8 rounded-lg grid place-items-center text-slate-500 hover:bg-violet-50 hover:text-[#6c1d95]"
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
                    {item.publishStatus !== 'archived' && (
                      <button
                        type="button"
                        className="size-8 rounded-lg grid place-items-center text-slate-400 hover:text-rose-500 disabled:opacity-40"
                        aria-label="Archive"
                        disabled={busyId === item.id}
                        onClick={() => {
                          if (window.confirm(`Archive “${item.title}”?`)) void archive(item.id);
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        ) : null}
      </Card>

      {showPricing && pricingRules && (
        <Card id="pricing-rules" className="p-5">
          <div className="mb-4">
            <div className="text-lg font-semibold">Pricing Rules</div>
            <div className="text-sm text-slate-500">Automate catalog price calculations and define standard incentives.</div>
          </div>
          <form className="grid gap-6 lg:grid-cols-2" onSubmit={savePricingRules}>
            <div>
              <div className="font-semibold mb-3">Bulk Price Generation</div>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="text-sm space-y-1.5 block">
                  <span className="text-slate-600">Content Type</span>
                  <Select
                    value={pricingRules.contentType}
                    onChange={(e) => setPricingRules({ ...pricingRules, contentType: e.target.value })}
                  >
                    <option value="book">Book</option>
                    <option value="article">Article</option>
                    <option value="news">News</option>
                  </Select>
                </label>
                <label className="text-sm space-y-1.5 block">
                  <span className="text-slate-600">Base Price (USD)</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={pricingRules.basePriceUsd}
                    onChange={(e) => setPricingRules({ ...pricingRules, basePriceUsd: Number(e.target.value) })}
                  />
                </label>
                <label className="text-sm space-y-1.5 block">
                  <span className="text-slate-600">Per-Page Surcharge</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={pricingRules.perPageSurchargeUsd}
                    onChange={(e) => setPricingRules({ ...pricingRules, perPageSurchargeUsd: Number(e.target.value) })}
                  />
                </label>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="font-semibold">Volume Discounts</div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={pricingRules.volumeDiscountsEnabled}
                  onClick={() =>
                    setPricingRules({
                      ...pricingRules,
                      volumeDiscountsEnabled: !pricingRules.volumeDiscountsEnabled,
                    })
                  }
                  className={cn(
                    'relative h-6 w-11 rounded-full transition',
                    pricingRules.volumeDiscountsEnabled ? 'bg-[#6c1d95]' : 'bg-slate-300',
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-0.5 size-5 rounded-full bg-white transition',
                      pricingRules.volumeDiscountsEnabled ? 'left-[22px]' : 'left-0.5',
                    )}
                  />
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm space-y-1.5 block">
                  <span className="text-slate-600">Buy 3+ Items</span>
                  <Input
                    type="number"
                    min="0"
                    value={pricingRules.buy3PctOff}
                    onChange={(e) => setPricingRules({ ...pricingRules, buy3PctOff: Number(e.target.value) })}
                    disabled={!pricingRules.volumeDiscountsEnabled}
                  />
                </label>
                <label className="text-sm space-y-1.5 block">
                  <span className="text-slate-600">Buy 5+ Items</span>
                  <Input
                    type="number"
                    min="0"
                    value={pricingRules.buy5PctOff}
                    onChange={(e) => setPricingRules({ ...pricingRules, buy5PctOff: Number(e.target.value) })}
                    disabled={!pricingRules.volumeDiscountsEnabled}
                  />
                </label>
              </div>
            </div>
            <div className="lg:col-span-2">
              <Button type="submit" disabled={pricingSaving}>
                {pricingSaving ? 'Saving…' : 'Save pricing rules'}
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
