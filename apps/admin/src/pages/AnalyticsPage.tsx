import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { BarChart, DonutChart, HorizontalBars, HourlyBars } from '../components/charts';
import { Badge, Button, Card, ErrorBlock, LoadingBlock, PageHeader, Select, StatCard } from '../components/ui';
import { api } from '../lib/api';
import { formatMoney, formatNumber } from '../lib/utils';

interface AnalyticsData {
  range?: string;
  source?: 'live' | 'seed';
  kpis: {
    dau: number;
    dauGrowthPct: number;
    avgSessionMin: number;
    avgSessionGrowthPct: number;
    retentionPct: number;
    revenue: number;
    revenueGrowthPct: number;
    users?: number;
    priorDau?: number;
    priorRevenue?: number;
  };
  engagementByHour: number[];
  languageDistribution: Array<{ name: string; pct: number; color: string; count?: number }>;
  cefrDistribution: Array<{ level: string; count: number }>;
  featureUsage: Array<{ name: string; pct: number; color: string }>;
}

function growthHint(pct: number, prior?: number, current = 0) {
  if (!prior && current === 0) return <span className="text-slate-500">No prior activity</span>;
  if (!prior) return <span className="text-slate-500">No prior period</span>;
  const sign = pct > 0 ? '+' : '';
  const color = pct > 0 ? 'text-emerald-600' : pct < 0 ? 'text-rose-600' : 'text-slate-500';
  return <span className={color}>{sign}{pct}% vs prior</span>;
}

export default function AnalyticsPage({ embedded = false }: { embedded?: boolean } = {}) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [range, setRange] = useState('30d');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (nextRange = range) => {
    setLoading(true);
    setError(null);
    try {
      setData(await api<AnalyticsData>(`/admin/analytics?range=${encodeURIComponent(nextRange)}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    void load(range);
  }, [load, range]);

  if (error && !data) return <ErrorBlock message={error} onRetry={() => void load(range)} />;
  if (!data) return <LoadingBlock />;

  const hourlyPeak = Math.max(0, ...data.engagementByHour);
  const cefrTotal = data.cefrDistribution.reduce((sum, row) => sum + row.count, 0);

  return (
    <div>
      <PageHeader
        title={embedded ? 'Engagement' : 'Analytics'}
        subtitle="Live learner reading, vocabulary, imports, and target-language mix."
        actions={
          <div className="flex gap-2">
            <Select
              value={range}
              onChange={(e) => setRange(e.target.value)}
              className="w-40"
            >
              <option value="30d">Last 30 Days</option>
              <option value="7d">Last 7 Days</option>
              <option value="90d">Last 90 Days</option>
            </Select>
            <Button onClick={() => load()} disabled={loading}>
              <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>
        }
      />

      <div className="mb-4">
        <Badge className="bg-violet-50 text-violet-700">Live platform data</Badge>
      </div>
      {data.source === 'seed' && (
        // Audit P1 #12: never show seeded numbers as if they were real.
        <Card className="p-8 text-center text-sm text-slate-500">No data yet — engagement appears once learners start reading.</Card>
      )}
      {data.source !== 'seed' && (<>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Active Today"
          value={formatNumber(data.kpis.dau)}
          hint={growthHint(data.kpis.dauGrowthPct, data.kpis.priorDau, data.kpis.dau)}
        />
        <StatCard
          label="Avg. Session Time"
          value={`${data.kpis.avgSessionMin} min`}
          hint={<span className="text-slate-500">From reading sessions in this range</span>}
        />
        <StatCard
          label="Returning Learners"
          value={`${data.kpis.retentionPct}%`}
          hint={<span className="text-slate-500">Active in this range and the prior range</span>}
        />
        <StatCard
          label="Import Revenue"
          value={formatMoney(data.kpis.revenue)}
          hint={growthHint(data.kpis.revenueGrowthPct, data.kpis.priorRevenue, data.kpis.revenue)}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
        <Card className="p-5">
          <div className="font-semibold mb-1">Reading sessions by hour (UTC)</div>
          <div className="text-sm text-slate-500 mb-3">
            {hourlyPeak > 0 ? `Live sessions in this range · peak ${formatNumber(hourlyPeak)}` : 'No reading sessions in this range'}
          </div>
          <HourlyBars
            values={data.engagementByHour}
            labels={['0:00', '4:00', '8:00', '12:00', '16:00', '20:00']}
          />
        </Card>

        <Card className="p-5">
          <div className="font-semibold mb-1">Language Distribution</div>
          <div className="text-sm text-slate-500 mb-3">Target languages chosen by live learners</div>
          {data.languageDistribution.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
              No learner target languages yet.
            </div>
          ) : (
            <div className="flex items-center gap-6">
              <DonutChart
                segments={data.languageDistribution}
                centerTitle={formatNumber(data.kpis.users ?? data.languageDistribution.reduce((s, l) => s + (l.count ?? 0), 0))}
                centerSubtitle="Learners"
              />
              <div className="space-y-3">
                {data.languageDistribution.map((l) => (
                  <div key={l.name} className="flex items-center gap-2 text-sm">
                    <span className="size-2.5 rounded-full" style={{ background: l.color }} />
                    <span>{l.name}</span>
                    <span className="font-semibold ml-auto">{l.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="font-semibold mb-1">CEFR Levels</div>
          <div className="text-sm text-slate-500 mb-3">Levels on learner target-language profiles</div>
          {cefrTotal === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
              No CEFR levels recorded yet.
            </div>
          ) : (
            <BarChart
              data={data.cefrDistribution.map((c) => ({ label: c.level, value: c.count }))}
              color="var(--g-blue-200)"
              fade={false}
            />
          )}
        </Card>

        <Card className="p-5">
          <div className="font-semibold mb-1">Feature usage</div>
          <div className="text-sm text-slate-500 mb-3">Share of reading, vocabulary, AI lookups, and imports</div>
          {data.featureUsage.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
              No learner activity in this range.
            </div>
          ) : (
            <HorizontalBars items={data.featureUsage} />
          )}
        </Card>
      </div>
      </>)}
    </div>
  );
}
