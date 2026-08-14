import { useEffect, useState } from 'react';
import { Cpu } from 'lucide-react';
import { HorizontalBars, LineChart } from '../components/charts';
import { Badge, Card, DataTable, LoadingBlock, PageHeader, Select, StatCard } from '../components/ui';
import { api } from '../lib/api';
import { formatMoney, formatNumber, initials } from '../lib/utils';

interface AiUsageData {
  range?: string;
  chartKind?: 'hourly' | 'daily';
  source?: 'live' | 'seed';
  aiConfigured?: boolean;
  aiEnabled?: boolean;
  settings?: {
    dailyLimit: number;
    lookupModel: string;
    quizModel: string;
    defaultUserQuota: number;
  };
  chartPoints?: Array<{ label: string; value: number }>;
  today: {
    lookups: number;
    quizzes: number;
    tokens: number;
    growthPct: number;
    avgLookupsPerUser: number;
    avgLookupsTarget: number;
    apiCostToday: number;
    avgCostPerLookup: number;
    rateLimitedUsers: number;
    flagAlerts: number;
  };
  hourlyLookups: number[];
  featureUsage: Array<{ name: string; pct: number; color: string }>;
  insight: string;
  topUsers: Array<{
    user: { email: string; displayName: string | null };
    plan: string;
    lookups: number;
    monthLookups: number;
    cost: number;
    status: string;
  }>;
}

const statusClass: Record<string, string> = {
  Active: 'bg-emerald-50 text-emerald-700',
  Flagged: 'bg-amber-50 text-amber-700',
  Suspended: 'bg-rose-50 text-rose-700',
};

export default function AiUsagePage() {
  const [data, setData] = useState<AiUsageData | null>(null);
  const [range, setRange] = useState('today');
  const [loading, setLoading] = useState(false);

  async function load(nextRange = range) {
    setLoading(true);
    try {
      setData(await api<AiUsageData>(`/admin/ai-usage?range=${encodeURIComponent(nextRange)}`));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(range).catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  if (!data) return <LoadingBlock />;

  const chartData =
    data.chartPoints ??
    data.hourlyLookups.map((v, i) => ({
      label: i % 4 === 0 || i === 23 ? (i === 0 ? '12 AM' : i === 12 ? '12 PM' : `${i}`) : '',
      value: v,
    }));

  const peak = chartData.reduce((best, p) => (p.value > best.value ? p : best), chartData[0] ?? { label: '', value: 0 });
  const chartTitle = data.chartKind === 'daily' ? 'Daily AI Lookups (7d)' : 'Hourly AI Lookups (24h)';
  const rangeLabel =
    range === 'yesterday' ? 'Yesterday' : range === '7d' ? 'Last 7 days' : 'Today';

  return (
    <div>
      <PageHeader
        title="AI Usage & Analytics"
        subtitle="Track lookup volumes, translation calls, and cost margins."
        actions={
          <Select
            className="w-44"
            value={range}
            onChange={(e) => setRange(e.target.value)}
            disabled={loading}
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="7d">Last 7 days</option>
          </Select>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <Badge className={data.aiEnabled === false ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}>
          AI {data.aiEnabled === false ? 'disabled' : 'enabled'}
        </Badge>
        <Badge className={data.aiConfigured ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}>
          API key {data.aiConfigured ? 'configured' : 'missing'}
        </Badge>
        <Badge className={data.source === 'live' ? 'bg-violet-50 text-violet-700' : 'bg-slate-100 text-slate-600'}>
          {data.source === 'live' ? 'Live usage logs' : 'Demo seed metrics'}
        </Badge>
        {data.settings?.lookupModel && (
          <Badge className="bg-slate-100 text-slate-600">Model {data.settings.lookupModel}</Badge>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard
          label={`Total Lookups (${rangeLabel})`}
          value={formatNumber(data.today.lookups)}
          hint={<span className="text-emerald-600">+{data.today.growthPct}% vs prior</span>}
          icon={<Cpu className="size-5" />}
        />
        <StatCard
          label="Avg Lookups / User"
          value={data.today.avgLookupsPerUser.toFixed(1)}
          hint={<span className="text-emerald-600">Within target limit ({data.today.avgLookupsTarget.toFixed(1)})</span>}
        />
        <StatCard
          label="API Cost"
          value={formatMoney(data.today.apiCostToday, 'USD')}
          hint={<span>Avg {formatMoney(data.today.avgCostPerLookup, 'USD')} per lookup</span>}
          accent="bg-amber-50 text-amber-700"
        />
        <StatCard
          label="Rate-Limited Users"
          value={data.today.rateLimitedUsers}
          hint={<span className="text-rose-600">+{data.today.flagAlerts} flag alerts generated</span>}
          accent="bg-rose-50 text-rose-700"
        />
      </div>

      <Card className="p-5 mb-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="font-semibold">{chartTitle}</div>
            <div className="text-sm text-slate-500">
              Request density across active global timezones · peak {formatNumber(peak.value)}
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span className="size-2.5 rounded-full bg-[#6c1d95]" /> AI Lookups
          </div>
        </div>
        <div className="h-56">
          <LineChart
            data={chartData}
            showArea
            tipLabel={`{value} lookups`}
          />
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="font-semibold">Top AI Users (Abuse Detection)</div>
              <div className="text-sm text-slate-500">Inspect learners generating suspicious volume peaks.</div>
            </div>
            <Badge className="bg-rose-100 text-rose-700">ALERT MODE ACTIVE</Badge>
          </div>
          <DataTable headers={['User', 'Plan', 'Lookups', 'This Month', 'Cost', 'Status']}>
            {data.topUsers.map((row) => (
              <tr key={row.user.email}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="size-7 rounded-full bg-violet-100 text-[#6c1d95] grid place-items-center text-[10px] font-bold">
                      {initials(row.user.displayName, row.user.email)}
                    </div>
                    <span className="text-sm font-medium">{row.user.displayName || row.user.email}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-slate-500">{row.plan}</td>
                <td className="px-4 py-3 text-sm font-semibold">{formatNumber(row.lookups)}</td>
                <td className="px-4 py-3 text-sm">{formatNumber(row.monthLookups)}</td>
                <td className="px-4 py-3 text-sm">{formatMoney(row.cost, 'USD')}</td>
                <td className="px-4 py-3">
                  <Badge className={statusClass[row.status] ?? statusClass.Active}>{row.status}</Badge>
                </td>
              </tr>
            ))}
          </DataTable>
        </Card>

        <Card className="p-5">
          <div className="font-semibold">Usage by Feature</div>
          <div className="text-sm text-slate-500 mb-4">Distribution of generative calls.</div>
          <HorizontalBars items={data.featureUsage} />
          <div className="mt-5 rounded-lg border border-violet-200 bg-violet-50 p-3">
            <div className="text-[11px] font-semibold uppercase text-[#6c1d95]">Latest Insight</div>
            <p className="text-sm text-slate-700 mt-1">{data.insight}</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
