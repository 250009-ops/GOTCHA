import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowDownRight, ArrowUpRight, BookOpen, Cpu, CreditCard, TrendingUp, UserPlus, Users } from 'lucide-react';
import { BarChart, LineChart } from '../components/charts';
import { Badge, Card, DataTable, LoadingBlock, PageHeader, StatCard } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { formatMoney, formatNumber, initials, relativeTime } from '../lib/utils';

function activityVisual(type?: string) {
  switch ((type || '').toLowerCase()) {
    case 'content':
      return { Icon: BookOpen, wrap: 'bg-g-blue-100 text-g-blue-700' };
    case 'support':
      return { Icon: AlertCircle, wrap: 'bg-[#fef3c7] text-[#f59e0b]' };
    default:
      return { Icon: UserPlus, wrap: 'bg-[#ecfdf5] text-[#10b981]' };
  }
}

interface DashboardData {
  users: number;
  activeSubscribers: number;
  activeToday: number;
  engagementPct: number;
  /** Real revenue only — sum of paid Atmos import payments (UZS). No synthetic/seed subscription MRR. */
  revenue: number;
  revenueGrowthPct: number;
  aiLookupsToday: number;
  aiLimit: number;
  aiDefaultUserQuota?: number;
  aiUsagePct: number;
  userGrowthPct: number;
  conversionPct: number;
  revenueToday: number;
  revenueMomDelta: number;
  revenueCurrency?: string;
  userGrowth: Array<{ month: string; users: number }>;
  revenueTrend: Array<{ month: string; revenue: number }>;
  revenueDaily: Array<{ month: string; day?: string; revenue: number }>;
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
  recentActivity: Array<{
    id: string;
    type: string;
    title: string;
    subtitle: string;
    createdAt: string;
    href?: string;
  }>;
}

function GrowthHint({ value, suffix }: { value: number; suffix: string }) {
  if (!Number.isFinite(value) || value === 0) {
    return <span className="text-slate-500 font-semibold">0% {suffix}</span>;
  }
  const up = value > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`font-semibold inline-flex items-center gap-1 ${up ? 'text-emerald-600' : 'text-rose-600'}`}>
      <Icon className="size-3" />
      {up ? '+' : ''}
      {value}% {suffix}
    </span>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api<DashboardData>('/admin/dashboard')
      .then(setData)
      .catch((e: unknown) => {
        setData(null);
        setError(e instanceof Error ? e.message : 'Failed to load dashboard');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !data) return <LoadingBlock />;

  if (error && !data) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
        <div className="font-semibold mb-2">Could not load dashboard</div>
        <p className="mb-4">{error}</p>
        <button
          type="button"
          onClick={load}
          className="rounded-lg bg-g-blue-700 px-4 py-2 text-white text-sm font-semibold"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return <LoadingBlock />;

  const firstName = user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || 'Admin';
  const hasDailyRevenue = data.revenueDaily?.some((d) => d.revenue > 0);
  const revenueBars = hasDailyRevenue
    ? data.revenueDaily.map((m) => ({ label: m.month, value: m.revenue }))
    : data.revenueTrend.map((m) => ({ label: m.month, value: m.revenue }));
  const revenueBadge = hasDailyRevenue ? '7 Days' : '6 Mo';

  return (
    <div>
      <PageHeader
        title="Overview"
        subtitle={`Welcome back, ${firstName}. Live platform metrics from the database.`}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6 min-w-0">
        <Link to="/users" className="block min-w-0">
          <StatCard
            label="Total Users"
            value={formatNumber(data.users)}
            hint={<GrowthHint value={data.userGrowthPct} suffix="this week" />}
            icon={<Users className="size-5" />}
          />
        </Link>
        <Link to="/users" className="block min-w-0">
          <StatCard
            label="Active Today"
            value={formatNumber(data.activeToday)}
            hint={
              <span className="inline-flex items-center gap-2 flex-wrap">
                <span className="text-emerald-600 font-semibold">{data.engagementPct}% engagement</span>
                <span className="text-slate-400">·</span>
                <span className="text-slate-600">{formatNumber(data.activeSubscribers)} pay as you go</span>
              </span>
            }
            icon={<CreditCard className="size-5" />}
            accent="bg-sky-50 text-sky-700"
          />
        </Link>
        <StatCard
          label="Revenue"
          value={formatMoney(data.revenue, 'UZS')}
          hint={
            <span className="inline-flex flex-col gap-1">
              {data.revenueToday > 0 ? (
                <span className="text-emerald-600 font-semibold">+{formatMoney(data.revenueToday, 'UZS')} today</span>
              ) : (
                <GrowthHint value={data.revenueGrowthPct} suffix="MoM" />
              )}
              {data.revenueMomDelta !== 0 && (
                <span className="text-slate-500">
                  {data.revenueMomDelta > 0 ? '+' : ''}
                  {formatMoney(data.revenueMomDelta, 'UZS')} MoM
                </span>
              )}
              <span className="text-slate-400 text-xs">Real Atmos import payments only</span>
            </span>
          }
          icon={<TrendingUp className="size-5" />}
          accent="bg-emerald-50 text-emerald-700"
        />
        <Link to="/ai-usage" className="block min-w-0">
          <StatCard
            label="AI Lookups"
            value={formatNumber(data.aiLookupsToday)}
            hint={
              data.aiLimit > 0 ? (
                <div>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden mt-1 mb-1">
                    <div className="h-full bg-g-blue-700" style={{ width: `${Math.min(100, data.aiUsagePct)}%` }} />
                  </div>
                  <span className="text-g-blue-700 font-semibold">
                    {data.aiUsagePct}% of daily limit
                  </span>
                </div>
              ) : (
                <span className="text-slate-500">No platform limit configured</span>
              )
            }
            icon={<Cpu className="size-5" />}
            accent="bg-fuchsia-50 text-fuchsia-700"
          />
        </Link>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="font-semibold">User Growth Trend</div>
            {data.userGrowth.length > 0 ? (
              <Badge className="bg-slate-100 text-slate-600">
                {data.userGrowth[0]?.month} - {data.userGrowth.at(-1)?.month}
              </Badge>
            ) : (
              <Badge className="bg-slate-100 text-slate-600">No data</Badge>
            )}
          </div>
          {data.userGrowth.length > 0 ? (
            <div className="h-48">
              <LineChart
                data={data.userGrowth.map((m) => ({ label: m.month, value: m.users }))}
                tipLabel="{value} Users"
                showArea
              />
            </div>
          ) : (
            <p className="text-sm text-slate-500 py-10 text-center">No user growth history yet.</p>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="font-semibold">Revenue Trend</div>
            <Badge className="bg-g-blue-100 text-g-blue-700">{revenueBadge}</Badge>
          </div>
          {revenueBars.length > 0 ? (
            <BarChart data={revenueBars} valueFormat="uzs" />
          ) : (
            <p className="text-sm text-slate-500 py-10 text-center">No revenue history yet.</p>
          )}
        </Card>
      </div>

      {(data.aiCategories.length > 0 || data.topPhrases.length > 0) && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
          {data.aiCategories.length > 0 && (
            <Card className="p-5">
              <div className="font-semibold mb-4">AI Lookup Categories</div>
              <div className="space-y-3">
                {data.aiCategories.map((c) => (
                  <div key={c.name} className="flex items-center gap-2 text-sm">
                    <span className="size-2.5 rounded-full" style={{ background: c.color }} />
                    <span className="text-slate-600">{c.name}</span>
                    <span className="font-semibold ml-auto">{c.pct}%</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
          {data.topPhrases.length > 0 && (
            <Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="font-semibold">Most Looked-up Idioms & Phrases</div>
                <Link to="/content" className="text-sm font-semibold text-g-blue-700">
                  View Library
                </Link>
              </div>
              <DataTable headers={['Phrase', 'Language', 'Level', 'Lookups', 'AI Match %']}>
                {data.topPhrases.map((row) => (
                  <tr key={row.phrase}>
                    <td className="px-4 py-3 text-sm font-medium">{row.phrase}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{row.language}</td>
                    <td className="px-4 py-3 text-sm">{row.level.toUpperCase()}</td>
                    <td className="px-4 py-3 text-sm">{formatNumber(row.lookups)}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-emerald-600">{row.aiMatch}%</td>
                  </tr>
                ))}
              </DataTable>
            </Card>
          )}
        </div>
      )}

      {data.recentActivity?.length > 0 && (
        <Card className="p-5 mb-4">
          <div className="font-semibold mb-3">Recent Activity</div>
          <div className="space-y-2">
            {data.recentActivity.map((item) => {
              const { Icon, wrap } = activityVisual(item.type);
              const row = (
                <>
                  <div className={`size-7 rounded-full grid place-items-center shrink-0 ${wrap}`}>
                    <Icon className="size-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-bold text-[#101828]">{item.title}</div>
                    <div className="text-[11px] text-[#4a5565] truncate">{item.subtitle}</div>
                  </div>
                  <span className="text-[11px] text-[#99a1af] shrink-0">{relativeTime(item.createdAt)}</span>
                </>
              );
              const className =
                'flex items-center gap-3 rounded-xl border border-[#e5e7eb] bg-white px-3 py-3';
              return item.href ? (
                <Link key={item.id} to={item.href} className={className}>
                  {row}
                </Link>
              ) : (
                <div key={item.id} className={className}>
                  {row}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold">Recent User Acquisitions</div>
          <Link to="/users" className="text-sm font-semibold text-g-blue-700">
            View users
          </Link>
        </div>
        {data.recentUsers.length === 0 ? (
          <p className="text-sm text-slate-500 py-6 text-center">No users yet.</p>
        ) : (
          <DataTable headers={['User Name', 'Email Address', 'Target Language', 'Billing Tier', 'Signed Up']}>
            {data.recentUsers.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-full bg-violet-100 text-g-blue-700 grid place-items-center text-xs font-bold">
                      {initials(u.displayName, u.email)}
                    </div>
                    <span className="text-sm font-medium">{u.displayName || 'Learner'}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-slate-500">{u.email}</td>
                <td className="px-4 py-3 text-sm">{u.targetLanguage}</td>
                <td className="px-4 py-3">
                  <Badge
                    className={
                      u.billingTier.toLowerCase().includes('premium') || u.billingTier.toLowerCase().includes('pro')
                        ? 'bg-violet-50 text-g-blue-700'
                        : 'bg-slate-100 text-slate-600'
                    }
                  >
                    {u.billingTier}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-sm text-slate-500">{relativeTime(u.createdAt)}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>
    </div>
  );
}
