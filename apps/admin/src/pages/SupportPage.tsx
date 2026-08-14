import { useEffect, useState } from 'react';
import { Ticket } from 'lucide-react';
import { Badge, Button, Card, DataTable, LoadingBlock, PageHeader, Select, StatCard } from '../components/ui';
import { api } from '../lib/api';
import { relativeTime } from '../lib/utils';

interface SupportData {
  stats: { open: number; inProgress: number; resolved: number; total: number };
  tickets: Array<{
    id: string;
    subject: string;
    body: string;
    status: string;
    priority: string;
    category: string;
    createdAt: string;
    user: { email: string; displayName: string | null } | null;
  }>;
}

const priorityClass: Record<string, string> = {
  low: 'bg-[#ecfdf5] text-[#10b981]',
  medium: 'bg-[#fef3c7] text-[#f59e0b]',
  high: 'bg-[#fee2e2] text-[#ef4444]',
  urgent: 'bg-[#fee2e2] text-[#ef4444]',
};

export default function SupportPage() {
  const [data, setData] = useState<SupportData | null>(null);

  async function load() {
    setData(await api<SupportData>('/admin/support'));
  }

  useEffect(() => { load().catch(console.error); }, []);

  async function updateStatus(id: string, status: string) {
    await api(`/admin/support/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    await load();
  }

  if (!data) return <LoadingBlock />;

  return (
    <div>
      <PageHeader title="Support Tickets" subtitle="Triage learner issues and track resolution progress." />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard label="Open" value={data.stats.open} icon={<Ticket className="size-5" />} accent="bg-amber-50 text-amber-700" />
        <StatCard label="In Progress" value={data.stats.inProgress} accent="bg-sky-50 text-sky-700" />
        <StatCard label="Resolved" value={data.stats.resolved} accent="bg-emerald-50 text-emerald-700" />
        <StatCard label="Total" value={data.stats.total} />
      </div>

      <Card className="p-2">
        <DataTable headers={['Ticket', 'Requester', 'Priority', 'Category', 'Status', 'Created', '']}>
          {data.tickets.map((t) => (
            <tr key={t.id}>
              <td className="px-4 py-3 max-w-[280px]">
                <div className="text-sm font-semibold">{t.subject}</div>
                <div className="text-xs text-slate-500 truncate">{t.body}</div>
              </td>
              <td className="px-4 py-3 text-sm">{t.user?.displayName || t.user?.email || 'Anonymous'}</td>
              <td className="px-4 py-3"><Badge className={priorityClass[t.priority] ?? priorityClass.medium}>{t.priority}</Badge></td>
              <td className="px-4 py-3 text-sm capitalize">{t.category}</td>
              <td className="px-4 py-3">
                <Select
                  className="w-36"
                  value={t.status}
                  onChange={(e) => updateStatus(t.id, e.target.value)}
                >
                  {['open', 'in_progress', 'waiting', 'resolved', 'closed'].map((s) => (
                    <option key={s} value={s}>{s.replace('_', ' ')}</option>
                  ))}
                </Select>
              </td>
              <td className="px-4 py-3 text-sm text-slate-500">{relativeTime(t.createdAt)}</td>
              <td className="px-4 py-3">
                {t.status !== 'resolved' && (
                  <Button variant="ghost" onClick={() => updateStatus(t.id, 'resolved')}>Resolve</Button>
                )}
              </td>
            </tr>
          ))}
        </DataTable>
      </Card>
    </div>
  );
}
