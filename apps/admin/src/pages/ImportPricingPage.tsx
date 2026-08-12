import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { Badge, Button, Card, Input, LoadingBlock, PageHeader, Select, StatCard } from '../components/ui';
import { api } from '../lib/api';
import { cn, formatMoney, formatNumber } from '../lib/utils';

type Section = 'overview' | 'types' | 'limits' | 'tiers';

interface ImportRule {
  id: string;
  key: string;
  label: string;
  pricePerImport: number;
  pricePerPage: number;
  isActive: boolean;
  sortOrder: number;
}

interface PageTier {
  id: string;
  label: string;
  minPages: number;
  maxPages: number | null;
  priceUsd: number;
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
  };
  rules: ImportRule[];
  tiers: PageTier[];
  freeLimits: FreeLimits;
}

const SECTIONS: Array<{ id: Section; label: string; path: string }> = [
  { id: 'overview', label: 'Overview', path: '/import-pricing' },
  { id: 'types', label: 'Pricing by Type', path: '/import-pricing/types' },
  { id: 'limits', label: 'Free Limits', path: '/import-pricing/limits' },
  { id: 'tiers', label: 'Page Tiers', path: '/import-pricing/tiers' },
];

const FORMAT_OPTIONS = [
  { id: 'article', label: 'Articles' },
  { id: 'news', label: 'News' },
  { id: 'book', label: 'Books' },
  { id: 'research', label: 'Research Papers' },
];

function resolveSection(directory?: string): Section {
  if (directory === 'types' || directory === 'pricing-by-type') return 'types';
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
  const [rules, setRules] = useState<ImportRule[]>([]);
  const [limits, setLimits] = useState<FreeLimits | null>(null);
  const [editingTier, setEditingTier] = useState<PageTier | null>(null);
  const [tierPrice, setTierPrice] = useState('');
  const [saving, setSaving] = useState(false);

  async function load(nextRange = range) {
    const res = await api<ImportPricingData>(`/admin/import-pricing?range=${encodeURIComponent(nextRange)}`);
    setData(res);
    setRules(res.rules);
    setLimits(res.freeLimits);
  }

  useEffect(() => {
    load(range).catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  useEffect(() => {
    const id =
      section === 'types' ? 'section-types'
        : section === 'limits' ? 'section-limits'
          : section === 'tiers' ? 'section-tiers'
            : null;
    if (id) document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [section, data]);

  async function saveRules() {
    setSaving(true);
    try {
      const res = await api<ImportPricingData>('/admin/import-pricing/rules', {
        method: 'PATCH',
        body: JSON.stringify({ rules }),
      });
      setData(res);
      setRules(res.rules);
    } finally {
      setSaving(false);
    }
  }

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
    setSaving(true);
    try {
      await api(`/admin/import-pricing/tiers/${editingTier.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ priceUsd: Number(tierPrice) }),
      });
      setEditingTier(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  if (!data || !limits) return <LoadingBlock />;

  return (
    <div>
      <PageHeader
        title="Import & Pricing Controls"
        subtitle="Configure import costs (UZS) per content type, page-based pricing tiers, and free usage allowances. Atmos charges page-tier prices."
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
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total Imports Today"
          value={formatNumber(data.stats.totalImportsToday)}
          hint={
            <span>
              Submissions processed · <span className="text-[#6c1d95] font-semibold">+{data.stats.importsGrowthPct}%</span>
            </span>
          }
        />
        <StatCard
          label="Revenue from Imports"
          value={formatMoney(data.stats.revenueFromImports)}
          hint={
            <span>
              Paid this month
              {data.stats.paidImportsThisMonth != null ? ` · ${data.stats.paidImportsThisMonth} paid imports` : ''}
              {' · '}
              <span className="text-emerald-600 font-semibold">+{data.stats.revenueGrowthPct}%</span>
            </span>
          }
          accent="bg-emerald-50 text-emerald-700"
        />
        <StatCard
          label="Free Imports Used"
          value={`${formatNumber(data.stats.freeImportsUsed)} / ${formatNumber(data.stats.freeImportsPool)}`}
          hint={
            <div className="space-y-2">
              <div>Current monthly quota pool · <Badge className="bg-violet-50 text-[#6c1d95]">{data.stats.freeUsedPct}%</Badge></div>
              <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-[#6c1d95]" style={{ width: `${data.stats.freeUsedPct}%` }} />
              </div>
            </div>
          }
        />
        <StatCard
          label="Conversion Rate"
          value={`${data.stats.conversionPct}%`}
          hint={
            <span>
              Import users to paid plans · <span className="text-amber-600 font-semibold">+{data.stats.conversionGrowthPct}%</span>
            </span>
          }
          accent="bg-amber-50 text-amber-700"
        />
      </div>

      <Card id="section-types" className="p-5 mb-4">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <div className="font-semibold">Import Pricing by Type</div>
            <div className="text-sm text-slate-500">Set pricing structures based on imported format categories.</div>
          </div>
          <Button onClick={saveRules} disabled={saving}>{saving ? 'Saving…' : 'Save type prices'}</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="border-b border-slate-100">
                {['Content Type', 'Price per Import (UZS)', 'Price per Page (UZS)', 'Status'].map((h) => (
                  <th key={h} className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rules.map((rule, idx) => (
                <tr key={rule.id}>
                  <td className="px-3 py-3 text-sm font-medium">{rule.label}</td>
                  <td className="px-3 py-3">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      className="max-w-[140px]"
                      value={rule.pricePerImport}
                      onChange={(e) => {
                        const next = [...rules];
                        next[idx] = { ...rule, pricePerImport: Number(e.target.value) };
                        setRules(next);
                      }}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      className="max-w-[140px]"
                      value={rule.pricePerPage}
                      onChange={(e) => {
                        const next = [...rules];
                        next[idx] = { ...rule, pricePerPage: Number(e.target.value) };
                        setRules(next);
                      }}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={rule.isActive}
                      onClick={() => {
                        const next = [...rules];
                        next[idx] = { ...rule, isActive: !rule.isActive };
                        setRules(next);
                      }}
                      className={cn(
                        'relative h-5 w-9 rounded-full transition',
                        rule.isActive ? 'bg-emerald-500' : 'bg-slate-300',
                      )}
                    >
                      <span
                        className={cn(
                          'absolute top-0.5 size-4 rounded-full bg-white transition',
                          rule.isActive ? 'left-[18px]' : 'left-0.5',
                        )}
                      />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-4">
        <Card id="section-limits" className="p-5">
          <div className="mb-4">
            <div className="font-semibold">Free Usage Limits</div>
            <div className="text-sm text-slate-500">Daily constraints for unsubscribed tier users.</div>
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
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>Allow rollover unused credits</span>
              <button
                type="button"
                role="switch"
                aria-checked={limits.allowRollover}
                onClick={() => setLimits({ ...limits, allowRollover: !limits.allowRollover })}
                className={cn(
                  'relative h-5 w-10 rounded-full transition',
                  limits.allowRollover ? 'bg-[#6c1d95]' : 'bg-slate-300',
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 size-4 rounded-full bg-white transition',
                    limits.allowRollover ? 'left-[22px]' : 'left-0.5',
                  )}
                />
              </button>
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
                      <span className="text-sm font-semibold">{formatMoney(tier.priceUsd)}</span>
                      <button
                        type="button"
                        className="size-8 rounded-lg grid place-items-center text-slate-500 hover:bg-violet-50 hover:text-[#6c1d95]"
                        aria-label={`Edit ${tier.label}`}
                        onClick={() => {
                          setEditingTier(tier);
                          setTierPrice(String(tier.priceUsd));
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
