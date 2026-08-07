import { useEffect, useState } from 'react';
import { Bell, Plus } from 'lucide-react';
import { Badge, Button, Card, DataTable, Input, LoadingBlock, PageHeader, Select, StatCard, Textarea } from '../components/ui';
import { api } from '../lib/api';
import { relativeTime } from '../lib/utils';

interface NotificationsData {
  stats: { draft: number; scheduled: number; sent: number; total: number };
  campaigns: Array<{
    id: string;
    name: string;
    subject: string;
    channel: string;
    status: string;
    audience: string;
    createdAt: string;
    scheduledAt: string | null;
  }>;
}

const statusClass: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  scheduled: 'bg-sky-50 text-sky-700',
  sending: 'bg-amber-50 text-amber-700',
  sent: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-rose-50 text-rose-700',
};

export default function NotificationsPage() {
  const [data, setData] = useState<NotificationsData | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [channel, setChannel] = useState('push');
  const [audience, setAudience] = useState('all');

  async function load() {
    setData(await api<NotificationsData>('/admin/notifications'));
  }

  useEffect(() => { load().catch(console.error); }, []);

  async function createCampaign(e: React.FormEvent) {
    e.preventDefault();
    await api('/admin/notifications', {
      method: 'POST',
      body: JSON.stringify({ name, subject, body, channel, audience, status: 'draft' }),
    });
    setName('');
    setSubject('');
    setBody('');
    setShowForm(false);
    await load();
  }

  async function markSent(id: string) {
    await api(`/admin/notifications/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'sent' }),
    });
    await load();
  }

  if (!data) return <LoadingBlock />;

  return (
    <div>
      <PageHeader
        title="Notifications & Campaigns"
        subtitle="Draft and schedule learner messaging across channels."
        actions={<Button onClick={() => setShowForm((v) => !v)}><Plus className="size-4" /> New campaign</Button>}
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total" value={data.stats.total} icon={<Bell className="size-5" />} />
        <StatCard label="Draft" value={data.stats.draft} />
        <StatCard label="Scheduled" value={data.stats.scheduled} accent="bg-sky-50 text-sky-700" />
        <StatCard label="Sent" value={data.stats.sent} accent="bg-emerald-50 text-emerald-700" />
      </div>

      {showForm && (
        <Card className="p-5 mb-4">
          <form className="grid gap-3 max-w-2xl" onSubmit={createCampaign}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Campaign name" required />
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" required />
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Message body" required rows={4} />
            <div className="grid grid-cols-2 gap-3">
              <Select value={channel} onChange={(e) => setChannel(e.target.value)}>
                <option value="push">Push</option>
                <option value="email">Email</option>
                <option value="in_app">In-app</option>
              </Select>
              <Select value={audience} onChange={(e) => setAudience(e.target.value)}>
                <option value="all">All users</option>
                <option value="free">Free</option>
                <option value="active">Active</option>
                <option value="new_users">New users</option>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button type="submit">Save draft</Button>
              <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="p-2">
        <DataTable headers={['Campaign', 'Channel', 'Audience', 'Status', 'Created', '']}>
          {data.campaigns.map((c) => (
            <tr key={c.id}>
              <td className="px-4 py-3">
                <div className="text-sm font-semibold">{c.name}</div>
                <div className="text-xs text-slate-500">{c.subject}</div>
              </td>
              <td className="px-4 py-3 text-sm capitalize">{c.channel.replace('_', ' ')}</td>
              <td className="px-4 py-3 text-sm capitalize">{c.audience.replace('_', ' ')}</td>
              <td className="px-4 py-3"><Badge className={statusClass[c.status] ?? statusClass.draft}>{c.status}</Badge></td>
              <td className="px-4 py-3 text-sm text-slate-500">{relativeTime(c.createdAt)}</td>
              <td className="px-4 py-3">
                {c.status !== 'sent' && (
                  <Button variant="ghost" onClick={() => markSent(c.id)}>Mark sent</Button>
                )}
              </td>
            </tr>
          ))}
        </DataTable>
      </Card>
    </div>
  );
}
