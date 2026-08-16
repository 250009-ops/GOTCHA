import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { Badge, Button, Card, Input, LoadingBlock, PageHeader, Select, StatCard } from '../components/ui';
import { api } from '../lib/api';
import { cn, formatMoney, formatNumber } from '../lib/utils';

type Section = 'overview' | 'limits' | 'tiers';

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
  freeLimits: FreeLimits;
}

const SECTIONS: Array<{ id: Section; label: string; path: string }> = [
  { id: 'overview', label: 'Overview', path: '/import-pricing' },
  { id: 'limits', label: 'Free Limits', path: '/import-pricing/limits' },
  { id: 'tiers', label: 'Page Tiers', path: '/import-pricing/tiers' },
];

const FORMAT_OPTIONS = [
  { id: 'article', label: 'Articles' },
  { id: 'news', label: 'News' },
  { id: 'ebook', label: 'Books' },
  { id: 'research', label: 'Research Papers' },
];

function resolveSection(directory?: string): Section {
  if (directory === 'limits' || directory === 'free-limits') return 'limits';
  if (directory === 'tiers' || directory === 'page-tiers') return 'tiers';
  return 'overview';
}

export default function ImportPricingPage() {
  const { directory } = useParams();
  const navigate = useNavigate();
  const section = resolveSection(directory);
  const [data, setData] = useState<ImportPricingData | null>(null);
  const [range, setRange] = useState('12m');
  const [limits, setLimits] = useState<FreeLimits | null>(null);
  const [editingTier, setEditingTier] = useState<PageTier | null>(null);
  const [tierPrice, setTierPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const [pricingError, setPricingError] = useState<string | null>(null);

  const atmosMinSom = data?.atmosMinAmountSom ?? 500;

  function validateAtmosMin(price: number, fieldLabel: string): string | null {
    if (price > 0 && price < atmosMinSom) {
      return `${fieldLabel} must be at least ${formatMoney(atmosMinSom)} (Atmos minimum). Current value: ${formatMoney(price)}.`;
    }
    return null;
  }

  async function load(nextRange = range) {
    const res = await api<ImportPricingData>(`/admin/import-pricing?range=${encodeURIComponent(nextRange)}`);
    setData(res);
    setLimits(res.freeLimits);
  }

  useEffect(() => {
    load(range).catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  useEffect(() => {
    const id =
      section === 'limits' ? 'section-limits'
        : section === 'tiers' ? 'section-tiers'
          : null;
    if (id) document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [section, data]);

  async function saveLimits() {
    if (!limits) return;
    setSaving(true);
    try {
      const next = await api<FreeLimits>('/admin/import-pricing/limits', {
        method: 'PATCH',
        body: JSON.stringify(limits),
      });
      setLimits(next);
    } finally {
      setSaving(false);
    }
  }

  async function saveTier() {
    if (!editingTier) return;
    const price = Number(tierPrice);
    const err = validateAtmosMin(price, `Page tier "${editingTier.label}"`);
    if (err) {
      setPricingError(err);
      return;
    }
    setPricingError(null);
    setSaving(true);
    try {
      await api(`/admin/import-pricing/tiers/${editingTier.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ priceUzs: price }),
      });
      setEditingTier(null);
      await load();
    } catch (e) {
      setPricingError(e instanceof Error ? e.message : 'Could not save tier price');
    } finally {
      setSaving(false);
    }
  }

  if (!data || !limits) return <LoadingBlock />;

  return (
    <div>
      <PageHeader
        title="Import & Pricing Controls"
        subtitle="Atmos charges page-tier prices in UZS. Free limits apply per learner before payment."
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
                ? 'bg-[#6c1d95] text-white border-[#6c1d95]'
                : 'bg-white text-slate-600 border-slate-200 hover:border-[#6c1d95]/40',
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
        <Badge className={data.paymentGatewayEnabled ? 'bg-violet-50 text-[#6c1d95]' : 'bg-amber-50 text-amber-800'}>
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
            <Button onClick={saveLimits} disabled={saving}>{saving ? 'Saving…' : 'Save limits'}</Button>
          </div>
        </Card>

        <Card id="section-tiers" className="p-5">
          <div className="mb-4">
            <div className="font-semibold">Page-Based Pricing Tiers (UZS)</div>
            <div className="text-sm text-slate-500">Atmos charges these amounts by estimated page count (soʻm).</div>
          </div>
          <div className="space-y-2">
            {data.tiers.map((tier, idx) => (
              <div key={tier.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-3">
                <div className="flex items-center gap-3">
                  <div className="size-6 rounded-full bg-violet-50 text-[#6c1d95] text-xs font-bold grid place-items-center">
                    {idx + 1}
                  </div>
                  <div className="text-sm font-medium">{tier.label}</div>
                </div>
                <div className="flex items-center gap-2">
                  {editingTier?.id === tier.id ? (
                    <>
                      <Input
                        type="number"
                        step="100"
                        min="0"
                        className="w-28"
                        value={tierPrice}
                        onChange={(e) => setTierPrice(e.target.value)}
                      />
                      <Button onClick={saveTier} disabled={saving}>Save</Button>
                      <Button variant="secondary" onClick={() => setEditingTier(null)}>Cancel</Button>
                    </>
                  ) : (
                    <>
                      <span className="text-sm font-semibold">{formatMoney(tier.priceUzs)}</span>
                      <button
                        type="button"
                        className="size-8 rounded-lg grid place-items-center text-slate-500 hover:bg-violet-50 hover:text-[#6c1d95]"
                        aria-label={`Edit ${tier.label}`}
                        onClick={() => {
                          setPricingError(null);
                          setEditingTier(tier);
                          setTierPrice(String(tier.priceUzs));
                        }}
                      >
                        <Pencil className="size-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
