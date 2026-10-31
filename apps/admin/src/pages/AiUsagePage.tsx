import { useEffect, useState } from 'react';
import { Cpu } from 'lucide-react';
import { HorizontalBars, LineChart } from '../components/charts';
import { LookupLimitsCard, canEditAiLimits } from '../components/LookupLimitsCard';
import { Badge, Card, DataTable, LoadingBlock, PageHeader, Select, StatCard } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { formatNumber, initials } from '../lib/utils';

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
    uniqueUsers?: number;
    priorLookups?: number;
    growthPct: number;
    avgLookupsPerUser: number;
    todayLookups?: number;
    todayPlatformUsed?: number;
    usersAtQuota?: number;
    rateLimitedUsers?: number;
  };
  hourlyLookups: number[];
  featureUsage: Array<{ name: string; pct: number; color: string }>;
  insight: string;
  topUsers: Array<{
    user: { email: string; displayName: string | null };
    plan: string;
    lookups: number;
    monthLookups: number;
  }>;
}

function growthHint(growthPct: number, priorLookups?: number, lookups = 0) {
  if (!priorLookups && lookups === 0) return <span className="text-slate-500">No lookups yet</span>;
  if (!priorLookups) return <span className="text-slate-500">No prior period to compare</span>;
  const sign = growthPct > 0 ? '+' : '';
  const color = growthPct > 0 ? 'text-emerald-600' : growthPct < 0 ? 'text-rose-600' : 'text-slate-500';
  return <span className={color}>{sign}{growthPct}% vs prior</span>;
}

export default function AiUsagePage() {
  const { user } = useAuth();
  const canEditLimits = canEditAiLimits(user?.role);
  const [data, setData] = useState<AiUsageData | null>(null);
  const [range, setRange] = useState('today');
  const [loading, setLoading] = useState(false);

  async function load(nextRange = range) {
    setLoading(true);
    try {
      const next = await api<AiUsageData>(`/admin/ai-usage?range=${encodeURIComponent(nextRange)}`);
      setData(next);
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
  const rangeLabel =
    range === 'yesterday' ? 'Yesterday' : range === '7d' ? 'Last 7 days' : 'Today';
  const uniqueUsers = data.today.uniqueUsers ?? 0;

  return (
    <div>
      <PageHeader
        title="AI Usage"
        subtitle="Live learner lookups and quiz generations from usage logs."
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
        <Badge className="bg-violet-50 text-violet-700">Live usage logs</Badge>
        {data.settings?.lookupModel && (
          <Badge className="bg-slate-100 text-slate-600">Model {data.settings.lookupModel}</Badge>
        )}
      </div>

      {(() => {
        const usersAtQuota = data.today.usersAtQuota ?? data.today.rateLimitedUsers ?? 0;
        const todayUsed = data.today.todayPlatformUsed ?? data.today.lookups;
        const cap = data.settings?.dailyLimit ?? 0;
        const platformHit = cap > 0 && todayUsed >= cap;
        const platformHot = cap > 0 && todayUsed / cap >= 0.8;
        if (!usersAtQuota && !platformHit && !platformHot) return null;
        return (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {platformHit
              ? `Platform daily AI limit reached (${formatNumber(todayUsed)} / ${formatNumber(cap)}). Learners see a lookup warning until tomorrow or you raise the cap below.`
              : platformHot
                ? `Platform AI usage is at ${Math.round((todayUsed / cap) * 100)}% of today’s cap (${formatNumber(todayUsed)} / ${formatNumber(cap)}).`
                : `${formatNumber(usersAtQuota)} learner${usersAtQuota === 1 ? '' : 's'} hit the per-person daily lookup quota (${formatNumber(data.settings?.defaultUserQuota ?? 50)}). Raise “Daily word-lookup quota per learner” below to stop the warning.`}
          </div>
        );
      })()}

      <div className="mb-4">
        <LookupLimitsCard
          defaultUserQuota={data.settings?.defaultUserQuota ?? 50}
          dailyLimit={data.settings?.dailyLimit ?? 0}
          usersAtQuota={data.today.usersAtQuota ?? data.today.rateLimitedUsers ?? 0}
          todayPlatformUsed={data.today.todayPlatformUsed ?? data.today.lookups}
          canEdit={canEditLimits}
          onSaved={() => void load(range)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard
          label={`Total Lookups (${rangeLabel})`}
          value={formatNumber(data.today.lookups)}
          hint={growthHint(data.today.growthPct, data.today.priorLookups, data.today.lookups)}
          icon={<Cpu className="size-5" />}
        />
        <StatCard
          label="Avg Lookups / User"
          value={data.today.avgLookupsPerUser.toFixed(1)}
          hint={<span className="text-slate-500">{uniqueUsers} active learner{uniqueUsers === 1 ? '' : 's'}</span>}
        />
        <StatCard
          label="Active AI Users"
          value={formatNumber(uniqueUsers)}
          hint={<span className="text-slate-500">Learners with lookups in this range</span>}
        />
        <StatCard
          label="Tokens Used"
          value={formatNumber(data.today.tokens)}
          hint={
            <span className="text-slate-500">
              {data.today.quizzes > 0
                ? `${formatNumber(data.today.quizzes)} quiz generation${data.today.quizzes === 1 ? '' : 's'}`
                : 'From recorded usage logs'}
            </span>
          }
        />
      </div>

      <Card className="p-5 mb-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="font-semibold">Daily AI Lookups (7d)</div>
            <div className="text-sm text-slate-500">
              {peak.value > 0
                ? `Recorded learner lookups · peak ${formatNumber(peak.value)}`
                : 'No learner lookups recorded in the last 7 days'}
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
          <div className="mb-3">
            <div className="font-semibold">Top AI Users</div>
            <div className="text-sm text-slate-500">Learners with the most lookups in this range.</div>
          </div>
          {data.topUsers.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
              No learner AI usage in this range.
            </div>
          ) : (
            <DataTable headers={['User', 'Plan', 'Lookups', 'This Month']}>
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
                </tr>
              ))}
            </DataTable>
          )}
        </Card>

        <Card className="p-5">
          <div className="font-semibold">Usage by Feature</div>
          <div className="text-sm text-slate-500 mb-4">Distribution of recorded generative calls.</div>
          {data.featureUsage.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
              No feature split until learners use AI.
            </div>
          ) : (
            <HorizontalBars items={data.featureUsage} />
          )}
          <div className="mt-5 rounded-lg border border-violet-200 bg-violet-50 p-3">
            <div className="text-[11px] font-semibold uppercase text-[#6c1d95]">Latest Insight</div>
            <p className="text-sm text-slate-700 mt-1">{data.insight}</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
