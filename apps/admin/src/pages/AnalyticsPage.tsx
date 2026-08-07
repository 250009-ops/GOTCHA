import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { BarChart, DonutChart, HorizontalBars, HourlyBars } from '../components/charts';
import { Badge, Button, Card, LoadingBlock, PageHeader, Select, StatCard } from '../components/ui';
import { api } from '../lib/api';
import { formatNumber } from '../lib/utils';

interface AnalyticsData {
  range?: string;
  kpis: {
    dau: number;
    dauGrowthPct: number;
    avgSessionMin: number;
    avgSessionGrowthPct: number;
    lessonCompletionPct: number;
    lessonCompletionDeltaPct: number;
    retentionPct: number;
    retentionGrowthPct: number;
  };
  engagementByHour: number[];
  languageDistribution: Array<{ name: string; pct: number; color: string }>;
  cefrDistribution: Array<{ level: string; count: number }>;
  featureUsage: Array<{ name: string; pct: number; color: string }>;
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [range, setRange] = useState('30d');
  const [loading, setLoading] = useState(false);

  async function load(nextRange = range) {
    setLoading(true);
    try {
      setData(await api<AnalyticsData>(`/admin/analytics?range=${encodeURIComponent(nextRange)}`));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(range).catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  if (!data) return <LoadingBlock />;

  return (
    <div>
      <PageHeader
        title="Analytics"
        subtitle="Overview of GOTCHA app user behavior, engagement metrics, and learning curves."
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
              <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /> Refresh Report
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Daily Active Users"
          value={formatNumber(data.kpis.dau)}
          hint={<Badge className="bg-emerald-50 text-emerald-700">+{data.kpis.dauGrowthPct}%</Badge>}
        />
        <StatCard
          label="Avg. Session Time"
          value={`${data.kpis.avgSessionMin} min`}
          hint={<Badge className="bg-emerald-50 text-emerald-700">+{data.kpis.avgSessionGrowthPct}%</Badge>}
        />
        <StatCard
          label="Lesson Completion"
          value={`${data.kpis.lessonCompletionPct}%`}
          hint={<Badge className="bg-rose-50 text-rose-700">{data.kpis.lessonCompletionDeltaPct}%</Badge>}
        />
        <StatCard
          label="User Retention"
          value={`${data.kpis.retentionPct}%`}
          hint={<Badge className="bg-emerald-50 text-emerald-700">+{data.kpis.retentionGrowthPct}%</Badge>}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
        <Card className="p-5">
          <div className="font-semibold mb-1">Engagement by Hour (UTC)</div>
          <div className="text-sm text-slate-500 mb-3">Hourly user sessions · {range}</div>
          <HourlyBars
            values={data.engagementByHour}
            labels={['0:00', '4:00', '8:00', '12:00', '16:00', '20:00']}
          />
        </Card>

        <Card className="p-5">
          <div className="font-semibold mb-1">Language Distribution</div>
          <div className="text-sm text-slate-500 mb-3">Target languages chosen by learners</div>
          <div className="flex items-center gap-6">
            <DonutChart
              segments={data.languageDistribution}
              centerTitle={formatNumber(data.kpis.dau)}
              centerSubtitle="Active Users"
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
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="font-semibold mb-1">CEFR Levels Distribution</div>
          <div className="text-sm text-slate-500 mb-3">Skill proficiency based on placement tests</div>
          <BarChart
            data={data.cefrDistribution.map((c) => ({ label: c.level, value: c.count }))}
            color="#a78bfa"
            fade={false}
          />
        </Card>

        <Card className="p-5">
          <div className="font-semibold mb-1">Feature Usage (Daily Hits)</div>
          <div className="text-sm text-slate-500 mb-3">Interaction breakdown across app features</div>
          <HorizontalBars items={data.featureUsage} />
        </Card>
      </div>
    </div>
  );
}
