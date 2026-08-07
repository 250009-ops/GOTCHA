import { useEffect, useState } from 'react';
import { CreditCard } from 'lucide-react';
import { AreaChart, DonutChart } from '../components/charts';
import { Badge, Card, DataTable, LoadingBlock, PageHeader, Select, StatCard } from '../components/ui';
import { api } from '../lib/api';
import { formatMoney, formatNumber } from '../lib/utils';

interface SubscriptionsData {
  range?: string;
  stats: {
    mrr: number;
    arr: number;
    activePremium: number;
    canceled: number;
    churnPct: number;
    churnDeltaPct: number;
    arpu: number;
    arpuGrowthPct: number;
    arrGrowthPct: number;
    mrrGrowthPct: number;
  };
  planDistribution: Array<{ name: string; pct: number; color: string }>;
  revenueGrowth12m: Array<{ month: string; mrr: number }>;
  funnel: {
    freeTrial: number;
    activePremium: number;
    conversionPct: number;
    churned: number;
    churnedPct: number;
  };
  transactions: Array<{
    user: string;
    email: string;
    plan: string;
    date: string;
    amount: number;
    status: string;
  }>;
  plans: Array<{
    id: string;
    name: string;
    tier: string;
    priceMonthly: number;
    subscriberCount: number;
  }>;
}

const statusClass: Record<string, string> = {
  Completed: 'bg-emerald-50 text-emerald-700',
  Refunded: 'bg-slate-100 text-slate-600',
  Failed: 'bg-rose-50 text-rose-700',
};

export default function SubscriptionsPage() {
  const [data, setData] = useState<SubscriptionsData | null>(null);
  const [range, setRange] = useState('12m');
  const [loading, setLoading] = useState(false);

  async function load(nextRange = range) {
    setLoading(true);
    try {
      setData(await api<SubscriptionsData>(`/admin/subscriptions?range=${encodeURIComponent(nextRange)}`));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(range).catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  if (!data) return <LoadingBlock />;

  const monthsLabel =
    range === '3m' ? 'last 3 months' : range === '6m' ? 'last 6 months' : 'last 12 months';

  return (
    <div>
      <PageHeader
        title="Subscriptions & Revenue"
        subtitle="Monitor your active cash flow, conversions and plan distributions."
        actions={
          <Select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="w-44"
            disabled={loading}
          >
            <option value="12m">Last 12 Months</option>
            <option value="6m">Last 6 Months</option>
            <option value="3m">Last 3 Months</option>
          </Select>
        }
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Monthly Recurring Revenue (MRR)"
          value={formatMoney(data.stats.mrr)}
          hint={<span className="text-emerald-600 font-semibold">+{data.stats.mrrGrowthPct}%</span>}
          icon={<CreditCard className="size-5" />}
        />
        <StatCard
          label="Annual Recurring Revenue (ARR)"
          value={formatMoney(data.stats.arr)}
          hint={<span className="text-emerald-600 font-semibold">+{data.stats.arrGrowthPct}%</span>}
          accent="bg-emerald-50 text-emerald-700"
        />
        <StatCard
          label="Monthly Churn Rate"
          value={`${data.stats.churnPct}%`}
          hint={<Badge className="bg-teal-50 text-teal-700">{data.stats.churnDeltaPct}%</Badge>}
          accent="bg-rose-50 text-rose-700"
        />
        <StatCard
          label="Avg Revenue Per User (ARPU)"
          value={formatMoney(data.stats.arpu)}
          hint={<span className="text-emerald-600 font-semibold">+{data.stats.arpuGrowthPct}%</span>}
        />
      </div>

      <Card className="p-5 mb-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="font-semibold">Revenue Growth</div>
            <div className="text-sm text-slate-500">Monthly subscription revenue over the {monthsLabel}</div>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span className="size-2.5 rounded-full bg-[#6c1d95]" /> Premium Subscriptions
          </div>
        </div>
        <AreaChart data={data.revenueGrowth12m.map((m) => ({ label: m.month, value: m.mrr }))} />
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
        <Card className="p-5">
          <div className="font-semibold">Plan Distribution</div>
          <div className="text-sm text-slate-500 mb-4">Structure of our registered user base</div>
          <div className="flex items-center gap-6">
            <DonutChart segments={data.planDistribution} centerTitle="100%" centerSubtitle="Distribution" />
            <div className="space-y-3 flex-1">
              {data.planDistribution.map((p) => (
                <div key={p.name} className="flex items-center gap-2 text-sm">
                  <span className="size-2.5 rounded-full" style={{ background: p.color }} />
                  <span className="text-slate-600">{p.name}</span>
                  <span className="font-semibold ml-auto">{p.pct}%</span>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-5">
            {data.plans.map((plan) => (
              <div key={plan.id} className="rounded-xl bg-slate-50 p-3">
                <div className="text-xs text-slate-500">{plan.name}</div>
                <div className="font-bold text-lg">{formatNumber(plan.subscriberCount)}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="font-semibold">Recent Transactions</div>
          <div className="text-sm text-slate-500 mb-3">Audit trail of the most recent payments processed</div>
          <DataTable headers={['User', 'Plan', 'Date', 'Amount', 'Status']}>
            {data.transactions.map((t) => (
              <tr key={`${t.email}-${t.date}`}>
                <td className="px-4 py-3">
                  <div className="text-sm font-semibold">{t.user}</div>
                  <div className="text-xs text-slate-500">{t.email}</div>
                </td>
                <td className="px-4 py-3 text-sm">{t.plan}</td>
                <td className="px-4 py-3 text-sm text-slate-500">{t.date}</td>
                <td className="px-4 py-3 text-sm">{formatMoney(t.amount)}</td>
                <td className="px-4 py-3">
                  <Badge className={statusClass[t.status] ?? statusClass.Completed}>{t.status}</Badge>
                </td>
              </tr>
            ))}
          </DataTable>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="p-5 bg-slate-50 border-slate-100">
          <div className="text-xs font-semibold text-slate-500 uppercase">Stage 01</div>
          <div className="font-semibold mt-1">Free Trial Registrations</div>
          <div className="text-2xl font-extrabold mt-2">{formatNumber(data.funnel.freeTrial)} Users</div>
          <div className="text-sm text-slate-500 mt-1">100%</div>
        </Card>
        <Card className="p-5 bg-[#6c1d95] text-white border-[#6c1d95]">
          <div className="text-xs font-semibold text-violet-200 uppercase">Stage 02</div>
          <div className="font-semibold mt-1">Active Premium Subscriptions</div>
          <div className="text-2xl font-extrabold mt-2">{formatNumber(data.funnel.activePremium)} Users</div>
          <div className="text-sm text-violet-200 mt-1">{data.funnel.conversionPct}% Conversion</div>
        </Card>
        <Card className="p-5 bg-rose-50 border-rose-100">
          <div className="text-xs font-semibold text-rose-400 uppercase">Stage 03</div>
          <div className="font-semibold mt-1">Churned This Month</div>
          <div className="text-2xl font-extrabold mt-2 text-rose-600">{formatNumber(data.funnel.churned)} Users</div>
          <div className="text-sm text-rose-500 mt-1">{data.funnel.churnedPct}% Churned</div>
        </Card>
      </div>
    </div>
  );
}
