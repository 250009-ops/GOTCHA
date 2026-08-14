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
  if (key === 'all') return 'All Users';
  if (key === 'premium') return 'Premium';
  if (key === 'free') return 'Free';
  if (key === 'active') return 'Active';
  if (key === 'new_users') return 'New Users';
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function channelChip(raw: string): 'push' | 'email' {
  return raw?.toLowerCase().includes('email') ? 'email' : 'push';
}

export default function NotificationsPage() {
  const [data, setData] = useState<NotificationsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [channelFilter, setChannelFilter] = useState<'push' | 'email'>('push');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [channel, setChannel] = useState('push');
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
    load().catch(console.error);
  }, []);

  function openCreate() {
    setEditing(null);
    setName('');
    setSubject('');
    setBody('');
    setChannel(channelFilter);
    setAudience('all');
    setShowForm(true);
  }

  function openEdit(c: Campaign) {
    setEditing(c);
    setName(c.name);
    setSubject(c.subject);
    setBody(c.body ?? '');
    setChannel(channelChip(c.channel));
    setAudience(c.audience || 'all');
    setShowForm(true);
  }

  async function saveCampaign(e: React.FormEvent) {
    e.preventDefault();
    if (editing) {
      await api(`/admin/notifications/${editing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name, subject, body, channel, audience }),
      });
    } else {
      await api('/admin/notifications', {
        method: 'POST',
        body: JSON.stringify({ name, subject, body, channel, audience, status: 'draft' }),
      });
    }
    setShowForm(false);
    setEditing(null);
    await load();
  }

  async function markSent(id: string) {
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
        <Button onClick={() => load().catch(console.error)}>Retry</Button>
      </div>
    );
  }

  if (!data) return <LoadingBlock />;

  const filtered = data.campaigns.filter((c) => channelChip(c.channel) === channelFilter);

  return (
    <div>
      <PageHeader
        title="Notifications & Campaigns"
        subtitle="Draft and schedule learner messaging across channels."
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" /> New campaign
          </Button>
        }
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total" value={data.stats.total} icon={<Bell className="size-5" />} />
        <StatCard label="Draft" value={data.stats.draft} />
        <StatCard label="Scheduled" value={data.stats.scheduled} accent="bg-sky-50 text-sky-700" />
        <StatCard label="Sent" value={data.stats.sent} accent="bg-emerald-50 text-emerald-700" />
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {(
          [
            ['push', 'Push Notifications'],
            ['email', 'Email Campaigns'],
          ] as const
        ).map(([key, label]) => {
          const on = channelFilter === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setChannelFilter(key)}
              className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${
                on ? 'bg-[#7008e7] text-white border-[#7008e7]' : 'bg-white text-slate-600 border-slate-200'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {showForm && (
        <Card className="p-5 mb-4">
          <form className="grid gap-3 max-w-2xl" onSubmit={saveCampaign}>
            <div className="text-sm font-extrabold">{editing ? 'Edit campaign' : 'New campaign'}</div>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Campaign name" required />
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject / title" required />
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Message body" required rows={4} />
            <div className="grid grid-cols-2 gap-3">
              <Select value={channel} onChange={(e) => setChannel(e.target.value)}>
                <option value="push">Push</option>
                <option value="email">Email</option>
                <option value="in_app">In-app</option>
              </Select>
              <Select value={audience} onChange={(e) => setAudience(e.target.value)}>
                <option value="all">All Users</option>
                <option value="premium">Premium</option>
                <option value="free">Free</option>
                <option value="active">Active</option>
                <option value="new_users">New users</option>
              </Select>
            </div>
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
        {filtered.length === 0 ? (
          <p className="text-sm text-slate-500 py-10 text-center">
            No {channelFilter === 'email' ? 'email' : 'push'} campaigns yet.
          </p>
        ) : (
          <DataTable headers={['Campaign', 'Audience', 'Status', 'When', 'Open rate', '']}>
            {filtered.map((c) => {
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
                    <Badge
                      className={
                        (c.audience || '').toLowerCase() === 'premium'
                          ? 'bg-[#f0e7ff] text-[#7008e7]'
                          : 'bg-slate-100 text-slate-600'
                      }
                    >
                      {audienceLabel(c.audience)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={statusClass[status] ?? statusClass.draft}>{status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">{when}</td>
                  {/* No open-rate field on NotificationCampaign — stay honest. */}
                  <td className="px-4 py-3 text-sm text-slate-500">—</td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    {status !== 'sent' && (
                      <Button variant="ghost" disabled={busyId === c.id} onClick={() => markSent(c.id)}>
                        {busyId === c.id ? '…' : 'Mark sent'}
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
