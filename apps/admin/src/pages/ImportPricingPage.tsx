import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { LookupLimitsCard, canEditAiLimits } from '../components/LookupLimitsCard';
import { Badge, Button, Card, Input, LoadingBlock, PageHeader, Select, StatCard } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { cn, formatMoney, formatNumber } from '../lib/utils';

type Section = 'overview' | 'limits' | 'tiers' | 'lookups';

interface PageTier {
  id: string;
  label: string;
  minPages: number;
  maxPages: number | null;
  /** Amount in UZS (soʻm) — NOTE: column is named priceUsd in DB but stores UZS. */
  priceUzs: number;
  sortOrder: number;
}

interface FreeLimits {
  dailyFreeImportsPerUser: number;
  monthlyFreePageLimit: number;
  allowedFormats: string[];
  resetCycle: string;
  allowRollover: boolean;
}

interface ImportPricingData {
  range: string;
  currency?: string;
  atmosConfigured?: boolean;
  paymentGatewayEnabled?: boolean;
  /** Atmos minimum charge in UZS (soʻm) — prices below this cannot be saved. */
  atmosMinAmountSom?: number;
  stats: {
    totalImportsToday: number;
    importsGrowthPct: number;
    revenueFromImports: number;
    revenueGrowthPct: number;
    freeImportsUsed: number;
    freeImportsPool: number;
    freeUsedPct: number;
    conversionPct: number;
    conversionGrowthPct: number;
    paidImportsThisMonth?: number;
    paidImportsInRange?: number;
    priorRevenueFromImports?: number;
  };
  tiers: PageTier[];
  pageTierGaps?: string[];
  freeLimits: FreeLimits;
}

const SECTIONS: Array<{ id: Section; label: string; path: string }> = [
  { id: 'overview', label: 'Overview', path: '/import-pricing' },
  { id: 'limits', label: 'Free Limits', path: '/import-pricing/limits' },
  { id: 'lookups', label: 'Lookups', path: '/import-pricing/lookups' },
  { id: 'tiers', label: 'Page Tiers', path: '/import-pricing/tiers' },
];

const FORMAT_OPTIONS = [
  { id: 'article', label: 'Articles (paste & URL)' },
  { id: 'news', label: 'News' },
  { id: 'ebook', label: 'Books (PDF, EPUB, Gutenberg)' },
  { id: 'research', label: 'Research Papers' },
  { id: 'custom', label: 'Custom uploads' },
];

function resolveSection(directory?: string): Section {
  if (directory === 'limits' || directory === 'free-limits') return 'limits';
  if (directory === 'lookups' || directory === 'lookup-limits') return 'lookups';
  if (directory === 'tiers' || directory === 'page-tiers') return 'tiers';
  return 'overview';
}

function suggestNextRange(tiers: PageTier[]) {
  if (!tiers.length) return { minPages: 1, maxPages: 10 as number | null };
  const high = Math.max(0, ...tiers.map((t) => t.maxPages ?? t.minPages));
  return { minPages: Math.max(1, high + 1), maxPages: null as number | null };
}

export default function ImportPricingPage() {
  const { directory } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const section = resolveSection(directory);
  const [data, setData] = useState<ImportPricingData | null>(null);
  const [range, setRange] = useState('12m');
  const [limits, setLimits] = useState<FreeLimits | null>(null);
  const [lookupQuota, setLookupQuota] = useState(50);
  const [lookupDailyLimit, setLookupDailyLimit] = useState(0);
  const [lookupUsersAtQuota, setLookupUsersAtQuota] = useState(0);
  const [lookupTodayUsed, setLookupTodayUsed] = useState(0);
  const [editingTier, setEditingTier] = useState<PageTier | null>(null);
  const [addingTier, setAddingTier] = useState(false);
  const [tierLabel, setTierLabel] = useState('');
  const [tierMinPages, setTierMinPages] = useState('');
  const [tierMaxPages, setTierMaxPages] = useState('');
  const [tierPrice, setTierPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const [limitsSaved, setLimitsSaved] = useState(false);
  const [pricingError, setPricingError] = useState<string | null>(null);

  const atmosMinSom = data?.atmosMinAmountSom ?? 500;

  function validateAtmosMin(price: number, fieldLabel: string): string | null {
    if (price > 0 && price < atmosMinSom) {
      return `${fieldLabel} must be at least ${formatMoney(atmosMinSom)} (Atmos minimum). Current value: ${formatMoney(price)}.`;
    }
    return null;
  }

  async function load(nextRange = range) {
    const [res, ai] = await Promise.all([
      api<ImportPricingData>(`/admin/import-pricing?range=${encodeURIComponent(nextRange)}`),
      api<{
        settings?: { dailyLimit: number; defaultUserQuota: number };
        today?: { lookups: number; usersAtQuota?: number; rateLimitedUsers?: number; todayPlatformUsed?: number };
      }>('/admin/ai-usage?range=today').catch(() => null),
    ]);
    setData(res);
    setLimits(res.freeLimits);
    if (ai) {
      setLookupQuota(ai.settings?.defaultUserQuota ?? 50);
      setLookupDailyLimit(ai.settings?.dailyLimit ?? 0);
      setLookupUsersAtQuota(ai.today?.usersAtQuota ?? ai.today?.rateLimitedUsers ?? 0);
      setLookupTodayUsed(ai.today?.todayPlatformUsed ?? ai.today?.lookups ?? 0);
    }
  }

  useEffect(() => {
    load(range).catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  useEffect(() => {
    const id =
      section === 'limits' ? 'section-limits'
        : section === 'lookups' ? 'section-lookups'
          : section === 'tiers' ? 'section-tiers'
            : null;
    if (id) document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [section, data]);

  async function saveLimits() {
    if (!limits) return;
    setSaving(true);
    setLimitsSaved(false);
    setPricingError(null);
    try {
      const next = await api<FreeLimits>('/admin/import-pricing/limits', {
        method: 'PATCH',
        body: JSON.stringify(limits),
      });
      setLimits(next);
      setLimitsSaved(true);
      await load();
    } catch (e) {
      setPricingError(e instanceof Error ? e.message : 'Could not save free import limits');
    } finally {
      setSaving(false);
    }
  }

  function beginEditTier(tier: PageTier) {
    setPricingError(null);
    setAddingTier(false);
    setEditingTier(tier);
    setTierLabel(tier.label);
    setTierMinPages(String(tier.minPages));
    setTierMaxPages(tier.maxPages == null ? '' : String(tier.maxPages));
    setTierPrice(String(tier.priceUzs));
  }

  function beginAddTier() {
    if (!data) return;
    const next = suggestNextRange(data.tiers);
    setPricingError(null);
    setEditingTier(null);
    setAddingTier(true);
    setTierLabel('');
    setTierMinPages(String(next.minPages));
    setTierMaxPages(next.maxPages == null ? '' : String(next.maxPages));
    setTierPrice(String(atmosMinSom));
  }

  function cancelTierForm() {
    setAddingTier(false);
    setEditingTier(null);
    setPricingError(null);
  }

  function readTierForm() {
    const price = Number(tierPrice);
    const minPages = Math.floor(Number(tierMinPages));
    const maxRaw = tierMaxPages.trim();
    const maxPages = maxRaw === '' ? null : Math.floor(Number(maxRaw));
    if (!Number.isFinite(minPages) || minPages < 1) {
      setPricingError('Each tier needs a minimum of at least 1 page.');
      return null;
    }
    if (maxPages != null && (!Number.isFinite(maxPages) || maxPages < minPages)) {
      setPricingError('Max pages must be empty (unlimited) or ≥ min pages.');
      return null;
    }
    const label = tierLabel.trim() || (maxPages == null ? `${minPages}+ pages` : `${minPages} - ${maxPages} pages`);
    const err = validateAtmosMin(price, `Page tier "${label}"`);
    if (err) {
      setPricingError(err);
      return null;
    }
    return { label, minPages, maxPages, priceUzs: price };
  }

  async function saveTier() {
    const payload = readTierForm();
    if (!payload) return;
    if (!addingTier && !editingTier) return;
    setPricingError(null);
    setSaving(true);
    try {
      if (addingTier) {
        await api('/admin/import-pricing/tiers', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      } else if (editingTier) {
        await api(`/admin/import-pricing/tiers/${editingTier.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      }
      setAddingTier(false);
      setEditingTier(null);
      await load();
    } catch (e) {
      setPricingError(e instanceof Error ? e.message : 'Could not save page tier');
    } finally {
      setSaving(false);
    }
  }

  async function deleteTier(tier: PageTier) {
    if (
      !window.confirm(
        `Delete “${tier.label}” (${tier.minPages}–${tier.maxPages ?? '∞'} pages)? Paid imports in this range cannot be priced until you add a replacement.`,
      )
    ) {
      return;
    }
    setPricingError(null);
    setSaving(true);
    try {
      await api(`/admin/import-pricing/tiers/${tier.id}`, { method: 'DELETE' });
      if (editingTier?.id === tier.id) setEditingTier(null);
      await load();
    } catch (e) {
      setPricingError(e instanceof Error ? e.message : 'Could not delete page tier');
    } finally {
      setSaving(false);
    }
  }

  function renderTierForm(maxHint: string) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="text-xs text-slate-500 sm:col-span-2">
          Label
          <Input
            className="mt-1"
            value={tierLabel}
            placeholder="e.g. 1 - 10 pages"
            onChange={(e) => setTierLabel(e.target.value)}
          />
        </label>
        <label className="text-xs text-slate-500">
          Min pages
          <Input
            type="number"
            min="1"
            className="mt-1"
            value={tierMinPages}
            onChange={(e) => setTierMinPages(e.target.value)}
          />
        </label>
        <label className="text-xs text-slate-500">
          Max pages (blank = {maxHint}+)
          <Input
            type="number"
            min="1"
            className="mt-1"
            value={tierMaxPages}
            onChange={(e) => setTierMaxPages(e.target.value)}
          />
        </label>
        <label className="text-xs text-slate-500 sm:col-span-2">
          Price (UZS)
          <Input
            type="number"
            step="100"
            min="0"
            className="mt-1"
            value={tierPrice}
            onChange={(e) => setTierPrice(e.target.value)}
          />
        </label>
        <div className="flex items-center gap-2 sm:col-span-2">
          <Button onClick={() => void saveTier()} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          <Button variant="secondary" onClick={cancelTierForm}>Cancel</Button>
        </div>
      </div>
    );
  }

  if (!data || !limits) return <LoadingBlock />;

  return (
    <div>
      <PageHeader
        title="Import & Pricing Controls"
        subtitle="Atmos charges page-tier prices in UZS. Free import limits and lookup caps apply per learner immediately."
        actions={
          <Select value={range} onChange={(e) => setRange(e.target.value)} className="w-44">
            <option value="12m">Last 12 Months</option>
            <option value="6m">Last 6 Months</option>
            <option value="3m">Last 3 Months</option>
          </Select>
        }
      />

      <div className="flex flex-wrap gap-2 mb-6">
        {SECTIONS.map((s) => (
          <Link
            key={s.id}
            to={s.path}
            onClick={(e) => {
              e.preventDefault();
              navigate(s.path);
            }}
            className={cn(
              'rounded-lg px-3 py-2 text-sm font-semibold border transition',
              section === s.id
                ? 'bg-g-blue-700 text-white border-g-blue-700'
                : 'bg-white text-slate-600 border-slate-200 hover:border-g-blue-700/40',
            )}
          >
            {s.label}
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <Badge className={data.atmosConfigured ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}>
          Atmos: {data.atmosConfigured ? 'configured' : 'not configured'}
        </Badge>
        <Badge className={data.paymentGatewayEnabled ? 'bg-violet-50 text-g-blue-700' : 'bg-amber-50 text-amber-800'}>
          Gateway: {data.paymentGatewayEnabled ? 'enabled' : 'disabled (imports unlimited)'}
        </Badge>
        <Badge className="bg-slate-50 text-slate-600">Currency: {data.currency || 'UZS'}</Badge>
        <Badge className="bg-slate-50 text-slate-600">Atmos minimum: {formatMoney(atmosMinSom)}</Badge>
      </div>

      {pricingError && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {pricingError}
        </div>
      )}

      {(data.pageTierGaps?.length ?? 0) > 0 && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <div className="font-semibold mb-1">Page-tier gaps</div>
          <p className="mb-2">
            These page counts have no matching price (or tiers overlap). Edit min/max on Page Tiers so every length is covered.
          </p>
          <ul className="list-disc pl-5 space-y-1">
            {data.pageTierGaps!.map((gap) => (
              <li key={gap}>{gap}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total Imports Today"
          value={formatNumber(data.stats.totalImportsToday)}
          hint={<span className="text-slate-500">Learner submissions started today</span>}
        />
        <StatCard
          label="Revenue from Imports"
          value={formatMoney(data.stats.revenueFromImports)}
          hint={
            <span className="text-slate-500">
              Paid Atmos imports
              {data.stats.paidImportsInRange != null ? ` · ${data.stats.paidImportsInRange} in range` : ''}
              {data.stats.paidImportsThisMonth != null ? ` · ${data.stats.paidImportsThisMonth} this month` : ''}
              {data.stats.priorRevenueFromImports
                ? ` · ${data.stats.revenueGrowthPct > 0 ? '+' : ''}${data.stats.revenueGrowthPct}% vs prior`
                : ''}
            </span>
          }
          accent="bg-emerald-50 text-emerald-700"
        />
        <StatCard
          label="Free Imports This Month"
          value={formatNumber(data.stats.freeImportsUsed)}
          hint={
            <span className="text-slate-500">
              {limits.dailyFreeImportsPerUser} free / learner / day · {formatNumber(limits.monthlyFreePageLimit)} free pages / {limits.resetCycle}
            </span>
          }
        />
        <StatCard
          label="Paid Imports This Month"
          value={formatNumber(data.stats.paidImportsThisMonth ?? 0)}
          hint={<span className="text-slate-500">Completed Atmos payments</span>}
          accent="bg-amber-50 text-amber-700"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-4">
        <Card id="section-limits" className="p-5">
          <div className="mb-4">
            <div className="font-semibold">Free Usage Limits</div>
            <div className="text-sm text-slate-500">
              Applied at quote time: daily free imports, page cap, and allowed formats. Unused credits do not roll over.
              Check every format learners actually import — unchecked formats always require payment, which looks like a coverage gap.
              0 daily imports or 0 pages means no free pool (unlike lookup caps, where 0 = unlimited).
            </div>
          </div>
          <div className="space-y-4">
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>Daily free imports per user</span>
              <Input
                type="number"
                min="0"
                className="w-20"
                value={limits.dailyFreeImportsPerUser}
                onChange={(e) => setLimits({ ...limits, dailyFreeImportsPerUser: Number(e.target.value) })}
              />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>Monthly free page limit</span>
              <Input
                type="number"
                min="0"
                className="w-28"
                value={limits.monthlyFreePageLimit}
                onChange={(e) => setLimits({ ...limits, monthlyFreePageLimit: Number(e.target.value) })}
              />
            </label>
            <div>
              <div className="text-sm font-medium mb-2">Allowed Formats</div>
              <div className="space-y-2">
                {FORMAT_OPTIONS.map((fmt) => {
                  const checked = limits.allowedFormats.includes(fmt.id);
                  return (
                    <label key={fmt.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const allowed = e.target.checked
                            ? [...limits.allowedFormats, fmt.id]
                            : limits.allowedFormats.filter((f) => f !== fmt.id);
                          setLimits({ ...limits, allowedFormats: allowed });
                        }}
                      />
                      {fmt.label}
                    </label>
                  );
                })}
              </div>
            </div>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>Reset cycle</span>
              <Select
                className="w-28"
                value={limits.resetCycle}
                onChange={(e) => setLimits({ ...limits, resetCycle: e.target.value })}
              >
                <option value="daily">Daily</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </Select>
            </label>
            <div className="flex items-center gap-3">
              <Button onClick={saveLimits} disabled={saving}>{saving ? 'Saving…' : 'Save limits'}</Button>
              {limitsSaved && <span className="text-sm text-emerald-700">Free import limits saved.</span>}
            </div>
          </div>
        </Card>

        <Card id="section-tiers" className="p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <div className="font-semibold">Page-Based Pricing Tiers (UZS)</div>
              <div className="text-sm text-slate-500">
                Atmos charges these amounts by estimated page count (soʻm). Keep ranges flush (1–10, then 11–50, …) with no holes. Add or delete bands as you change pricing.
              </div>
            </div>
            <Button variant="secondary" className="shrink-0" onClick={beginAddTier} disabled={saving || addingTier}>
              <Plus className="size-3.5 mr-1.5" />
              Add range
            </Button>
          </div>
          <div className="space-y-2">
            {data.tiers.map((tier, idx) => (
              <div key={tier.id} className="rounded-xl border border-slate-100 px-3 py-3">
                {editingTier?.id === tier.id ? (
                  renderTierForm(String(tier.minPages))
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-6 rounded-full bg-violet-50 text-g-blue-700 text-xs font-bold grid place-items-center shrink-0">
                        {idx + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{tier.label}</div>
                        <div className="text-xs text-slate-500">
                          Pages {tier.minPages}–{tier.maxPages ?? '∞'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-sm font-semibold mr-1">{formatMoney(tier.priceUzs)}</span>
                      <button
                        type="button"
                        className="size-8 rounded-lg grid place-items-center text-slate-500 hover:bg-violet-50 hover:text-g-blue-700"
                        aria-label={`Edit ${tier.label}`}
                        onClick={() => beginEditTier(tier)}
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        className="size-8 rounded-lg grid place-items-center text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        aria-label={`Delete ${tier.label}`}
                        disabled={saving}
                        onClick={() => void deleteTier(tier)}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {addingTier && (
              <div className="rounded-xl border border-dashed border-g-blue-700/30 bg-violet-50/40 px-3 py-3">
                <div className="text-xs font-semibold text-g-blue-700 mb-2">New range</div>
                {renderTierForm(tierMinPages || 'min')}
              </div>
            )}
            {data.tiers.length === 0 && !addingTier && (
              <p className="text-sm text-slate-500 py-4 text-center">
                No page tiers yet. Add a range so paid imports can be priced.
              </p>
            )}
          </div>
        </Card>
      </div>

      <div id="section-lookups" className="mt-4">
        <LookupLimitsCard
          defaultUserQuota={lookupQuota}
          dailyLimit={lookupDailyLimit}
          usersAtQuota={lookupUsersAtQuota}
          todayPlatformUsed={lookupTodayUsed}
          canEdit={canEditAiLimits(user?.role)}
          showImportPricingLink={false}
          onSaved={() => void load()}
        />
      </div>
    </div>
  );
}
