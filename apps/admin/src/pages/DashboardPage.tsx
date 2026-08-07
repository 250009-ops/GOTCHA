import { useEffect, useState } from 'react';
import { ArrowUpRight, Cpu, CreditCard, TrendingUp, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BarChart, DonutChart, LineChart } from '../components/charts';
import { Badge, Card, DataTable, LoadingBlock, PageHeader, StatCard } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { formatMoney, formatNumber, initials, levelBadgeClass, relativeTime } from '../lib/utils';

interface DashboardData {
  users: number;
  activeSubscribers: number;
  mrr: number;
  mrrGrowthPct: number;
  aiLookupsToday: number;
  aiLimit: number;
  aiUsagePct: number;
  userGrowthPct: number;
  conversionPct: number;
  revenueMomDelta: number;
  userGrowth: Array<{ month: string; users: number }>;
  revenueTrend: Array<{ month: string; mrr: number }>;
  aiCategories: Array<{ name: string; pct: number; color: string }>;
  topPhrases: Array<{ phrase: string; language: string; level: string; lookups: number; aiMatch: number }>;
  recentUsers: Array<{
    id: string;
    displayName: string | null;
    email: string;
    targetLanguage: string;
    billingTier: string;
    createdAt: string;
  }>;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    api<DashboardData>('/admin/dashboard').then(setData).catch(console.error);
  }, []);

  if (!data) return <LoadingBlock />;

  return (
    <div>
      <PageHeader
        title="Dashboard Overview"
        subtitle={`Welcome back, ${user?.displayName?.split(' ')[0] || 'Alex'}. Here is today's GOTCHA platform performance.`}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6 min-w-0">
        <StatCard
          label="Total Registered Users"
          value={formatNumber(data.users)}
          hint={<span className="text-emerald-600 font-semibold inline-flex items-center gap-1"><ArrowUpRight className="size-3" />+{data.userGrowthPct}% vs last month</span>}
          icon={<Users className="size-5" />}
        />
        <StatCard
          label="Active Subscribers"
          value={formatNumber(data.activeSubscribers)}
          hint={<span className="inline-flex items-center gap-2"><Badge className="bg-violet-50 text-[#6c1d95]">Pro Tier</Badge><span className="text-emerald-600 font-semibold">{data.conversionPct}% Conv.</span></span>}
          icon={<CreditCard className="size-5" />}
          accent="bg-sky-50 text-sky-700"
        />
        <StatCard
          label="Monthly Rec. Revenue"
          value={formatMoney(data.mrr)}
          hint={<span className="text-emerald-600 font-semibold inline-flex items-center gap-1"><ArrowUpRight className="size-3" />+{data.mrrGrowthPct}% vs last month</span>}
          icon={<TrendingUp className="size-5" />}
          accent="bg-emerald-50 text-emerald-700"
        />
        <StatCard
          label="AI Lookups Today"
          value={formatNumber(data.aiLookupsToday)}
          hint={
            <div>
              <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden mt-1 mb-1">
                <div className="h-full bg-[#6c1d95]" style={{ width: `${data.aiUsagePct}%` }} />
              </div>
              <span>{(data.aiLookupsToday / 1000).toFixed(1)}k of {(data.aiLimit / 1000).toFixed(0)}k limit · {data.aiUsagePct}% Used</span>
            </div>
          }
          icon={<Cpu className="size-5" />}
          accent="bg-fuchsia-50 text-fuchsia-700"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="font-semibold">User Growth Trend</div>
            <Badge className="bg-slate-100 text-slate-600">
              {data.userGrowth[0]?.month} - {data.userGrowth.at(-1)?.month}
            </Badge>
          </div>
          <div className="h-48">
            <LineChart
              data={data.userGrowth.map((m) => ({ label: m.month, value: m.users }))}
              tipLabel="{value} Users"
              showArea
            />
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="font-semibold">Revenue Performance</div>
            <Badge className="bg-emerald-50 text-emerald-700">+{formatMoney(data.revenueMomDelta)} MoM</Badge>
          </div>
          <BarChart
            data={data.revenueTrend.map((m) => ({ label: m.month, value: m.mrr }))}
            valueFormat="money"
          />
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
        <Card className="p-5">
          <div className="font-semibold mb-4">AI Lookup Categories</div>
          <div className="flex items-center gap-6">
            <DonutChart
              segments={data.aiCategories}
              centerTitle={`${(data.aiLookupsToday / 1000).toFixed(1)}k`}
              centerSubtitle="Today's Hits"
            />
            <div className="space-y-3">
              {data.aiCategories.map((c) => (
                <div key={c.name} className="flex items-center gap-2 text-sm">
                  <span className="size-2.5 rounded-full" style={{ background: c.color }} />
                  <span className="text-slate-600">{c.name}</span>
                  <span className="font-semibold ml-auto">{c.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold">Most Looked-up Idioms & Phrases</div>
            <Link to="/content" className="text-sm font-semibold text-[#6c1d95]">View Library</Link>
          </div>
          <DataTable headers={['Phrase', 'Language', 'Level', 'Lookups', 'AI Match %']}>
            {data.topPhrases.map((row) => (
              <tr key={row.phrase}>
                <td className="px-4 py-3 text-sm font-medium">{row.phrase}</td>
                <td className="px-4 py-3 text-sm text-slate-500">{row.language}</td>
                <td className="px-4 py-3"><Badge className={levelBadgeClass(row.level)}>{row.level.toUpperCase()}</Badge></td>
                <td className="px-4 py-3 text-sm">{formatNumber(row.lookups)}</td>
                <td className="px-4 py-3 text-sm font-semibold text-emerald-600">{row.aiMatch}%</td>
              </tr>
            ))}
          </DataTable>
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold">Recent User Acquisitions</div>
          <Badge className="bg-slate-100 text-slate-600">Export CSV</Badge>
        </div>
        <DataTable headers={['User Name', 'Email Address', 'Target Language', 'Billing Tier', 'Signed Up']}>
          {data.recentUsers.map((u) => (
            <tr key={u.id}>
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-full bg-violet-100 text-[#6c1d95] grid place-items-center text-xs font-bold">
                    {initials(u.displayName, u.email)}
                  </div>
                  <span className="text-sm font-medium">{u.displayName || 'Learner'}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-sm text-slate-500">{u.email}</td>
              <td className="px-4 py-3 text-sm">{u.targetLanguage}</td>
              <td className="px-4 py-3">
                <Badge className={u.billingTier.toLowerCase().includes('premium') || u.billingTier.toLowerCase().includes('pro') ? 'bg-violet-50 text-[#6c1d95]' : 'bg-slate-100 text-slate-600'}>
                  {u.billingTier}
                </Badge>
              </td>
              <td className="px-4 py-3 text-sm text-slate-500">{relativeTime(u.createdAt)}</td>
            </tr>
          ))}
        </DataTable>
      </Card>
    </div>
  );
}
