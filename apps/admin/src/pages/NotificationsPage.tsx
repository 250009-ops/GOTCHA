import { useEffect, useState } from 'react';
import { Bell, Plus } from 'lucide-react';
import { Badge, Button, Card, DataTable, Input, LoadingBlock, PageHeader, Select, StatCard, Textarea } from '../components/ui';
import { api } from '../lib/api';
import { relativeTime } from '../lib/utils';

interface Campaign {
  id: string;
  name: string;
  subject: string;
  body?: string;
  channel: string;
  status: string;
  audience: string;
  createdAt: string;
  scheduledAt: string | null;
  sentAt?: string | null;
}

interface NotificationsData {
  stats: { draft: number; scheduled: number; sent: number; total: number };
  campaigns: Campaign[];
}

const statusClass: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  scheduled: 'bg-[#fef3c7] text-[#f59e0b]',
  sending: 'bg-amber-50 text-amber-700',
  sent: 'bg-[#ecfdf5] text-[#10b981]',
  cancelled: 'bg-rose-50 text-rose-700',
};

function audienceLabel(raw: string): string {
  const key = (raw || 'all').toLowerCase();
  if (key === 'all') return 'All learners';
  if (key === 'payg' || key === 'premium') return 'Pay as you go';
  if (key === 'free') return 'Free';
  if (key === 'active') return 'Active';
  if (key === 'new_users') return 'New learners';
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function NotificationsPage() {
  const [data, setData] = useState<NotificationsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      setData(await api<NotificationsData>('/admin/notifications'));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load notifications');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function openCreate() {
    setEditing(null);
    setName('');
    setSubject('');
    setBody('');
    setAudience('all');
    setShowForm(true);
  }

  function openEdit(c: Campaign) {
    setEditing(c);
    setName(c.name);
    setSubject(c.subject);
    setBody(c.body ?? '');
    setAudience(c.audience === 'premium' ? 'payg' : c.audience || 'all');
    setShowForm(true);
  }

  async function saveCampaign(e: React.FormEvent) {
    e.preventDefault();
    const payload = { name, subject, body, channel: 'push', audience };
    if (editing) {
      await api(`/admin/notifications/${editing.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
    } else {
      await api('/admin/notifications', {
        method: 'POST',
        body: JSON.stringify({ ...payload, status: 'draft' }),
      });
    }
    setShowForm(false);
    setEditing(null);
    await load();
  }

  async function sendToLearners(id: string) {
    setBusyId(id);
    try {
      await api(`/admin/notifications/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'sent' }),
      });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  if (!data && !error) return <LoadingBlock />;

  if (error && !data) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
        <div className="font-semibold mb-2">Could not load notifications</div>
        <p className="mb-4">{error}</p>
        <Button onClick={() => void load()}>Retry</Button>
      </div>
    );
  }

  if (!data) return <LoadingBlock />;

  return (
    <div>
      <PageHeader
        title="Push Notifications"
        subtitle="Draft and send in-app notices to learners. Email campaigns are not used."
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" /> New notification
          </Button>
        }
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total" value={data.stats.total} icon={<Bell className="size-5" />} />
        <StatCard label="Draft" value={data.stats.draft} />
        <StatCard label="Scheduled" value={data.stats.scheduled} accent="bg-sky-50 text-sky-700" />
        <StatCard label="Sent" value={data.stats.sent} accent="bg-emerald-50 text-emerald-700" />
      </div>

      {showForm && (
        <Card className="p-5 mb-4">
          <form className="grid gap-3 max-w-2xl" onSubmit={saveCampaign}>
            <div className="text-sm font-extrabold">{editing ? 'Edit notification' : 'New notification'}</div>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Internal name" required />
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Title learners see" required />
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Message body" required rows={4} />
            <Select value={audience} onChange={(e) => setAudience(e.target.value)}>
              <option value="all">All learners</option>
              <option value="free">Free</option>
              <option value="payg">Pay as you go</option>
              <option value="active">Active</option>
              <option value="new_users">New learners</option>
            </Select>
            <div className="flex gap-2">
              <Button type="submit">{editing ? 'Save changes' : 'Save draft'}</Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowForm(false);
                  setEditing(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="p-2">
        {data.campaigns.length === 0 ? (
          <p className="text-sm text-slate-500 py-10 text-center">
            No push notifications yet. Create one to send it to the learner inbox.
          </p>
        ) : (
          <DataTable headers={['Notification', 'Audience', 'Status', 'When', '']}>
            {data.campaigns.map((c) => {
              const status = (c.status || 'draft').toLowerCase();
              const when =
                status === 'scheduled'
                  ? `Scheduled · ${c.scheduledAt ? relativeTime(c.scheduledAt) : '—'}`
                  : status === 'sent' || status === 'sending'
                    ? `Sent · ${relativeTime(c.sentAt || c.createdAt)}`
                    : `Draft · ${relativeTime(c.createdAt)}`;
              return (
                <tr key={c.id} className="cursor-pointer hover:bg-slate-50" onClick={() => openEdit(c)}>
                  <td className="px-4 py-3">
                    <div className="text-sm font-semibold">{c.subject || c.name}</div>
                    <div className="text-xs text-slate-500">{c.name}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className="bg-slate-100 text-slate-600">{audienceLabel(c.audience)}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={statusClass[status] ?? statusClass.draft}>{status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">{when}</td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    {status !== 'sent' && (
                      <Button variant="ghost" disabled={busyId === c.id} onClick={() => sendToLearners(c.id)}>
                        {busyId === c.id ? '…' : 'Send to learners'}
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </DataTable>
        )}
      </Card>
    </div>
  );
}
