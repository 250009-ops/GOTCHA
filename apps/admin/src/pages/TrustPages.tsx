import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card, DataTable, ErrorBlock, LoadingBlock, PageHeader, Select } from '../components/ui';
import { api } from '../lib/api';

function tashkent(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    timeZone: 'Asia/Tashkent',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

interface DeletionRow {
  id: string;
  requestedAt: string | null;
  purgeAfter: string;
  purgeDue: boolean;
}

export function DeletionRequestsPage() {
  const [rows, setRows] = useState<DeletionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRows(await api<DeletionRow[]>('/admin/users-deletion-requests'));
    } catch (e) {
      setRows(null);
      setError(e instanceof Error ? e.message : 'Failed to load deletion requests');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  if (error && !rows) return <ErrorBlock message={error} onRetry={() => void load()} />;
  if (!rows) return <LoadingBlock />;

  return (
    <div>
      <PageHeader
        title="Deletion requests"
        subtitle="Accounts a learner deleted. The anonymised row stays until the purge date. Payment records are kept."
      />
      {rows.length === 0 ? (
        <Card className="p-8 text-center text-sm text-slate-500">No deletion requests.</Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <DataTable headers={['User id', 'Requested', 'Purge after', '']}>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-50 text-[13px]">
                <td className="px-4 py-2.5 font-mono text-xs">{row.id}</td>
                <td className="px-4 py-2.5">{tashkent(row.requestedAt)}</td>
                <td className="px-4 py-2.5">{tashkent(row.purgeAfter)}</td>
                <td className="px-4 py-2.5">
                  {row.purgeDue ? <Badge className="bg-rose-50 text-rose-700">Purge due</Badge> : <Badge className="bg-slate-100 text-slate-600">In retention</Badge>}
                </td>
              </tr>
            ))}
          </DataTable>
        </Card>
      )}
    </div>
  );
}

interface ReportRow {
  id: string;
  status: string;
  reason: string;
  details?: string | null;
  createdAt: string;
  reporter?: { email?: string | null; displayName?: string | null } | null;
  reportedUser?: { email?: string | null; displayName?: string | null } | null;
}

export function SafetyReportsPage() {
  const [kind, setKind] = useState<'user' | 'content'>('user');
  const [status, setStatus] = useState('open');
  const [rows, setRows] = useState<ReportRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [context, setContext] = useState<Array<{ id: string; body: string; reported?: boolean; deleted?: boolean }> | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const qs = new URLSearchParams({ kind, status });
      setRows(await api<ReportRow[]>(`/admin/safety/reports?${qs}`));
    } catch (e) {
      setRows(null);
      setError(e instanceof Error ? e.message : 'Failed to load reports');
    }
  }, [kind, status]);

  useEffect(() => { void load(); }, [load]);

  async function resolve(id: string, next: 'reviewed' | 'actioned' | 'dismissed') {
    setBusy(id);
    try {
      await api(`/admin/safety/reports/${kind}/${id}`, { method: 'PATCH', body: JSON.stringify({ status: next }) });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the report');
    } finally {
      setBusy(null);
    }
  }

  if (error && !rows) return <ErrorBlock message={error} onRetry={() => void load()} />;
  if (!rows) return <LoadingBlock />;

  return (
    <div>
      <PageHeader
        title="Safety reports"
        subtitle="Learner reports about people and content. Open items are waiting for a decision. Deleted messages still show the original text."
        actions={
          <div className="flex gap-2">
            <Select aria-label="Report type" value={kind} onChange={(e) => setKind(e.target.value as 'user' | 'content')} className="w-36">
              <option value="user">People</option>
              <option value="content">Content</option>
            </Select>
            <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className="w-36">
              <option value="open">Open</option>
              <option value="reviewed">Reviewed</option>
              <option value="actioned">Actioned</option>
              <option value="dismissed">Dismissed</option>
            </Select>
          </div>
        }
      />
      {error && <p className="mb-3 text-sm text-rose-700">{error}</p>}
      {context && (
        <Card className="mb-3 p-4 space-y-2">
          <div className="text-sm font-semibold">Reported conversation (±5)</div>
          {context.length === 0 ? <p className="text-sm text-slate-500">No message was attached.</p> : context.map((m) => (
            <p key={m.id} className={m.reported ? 'text-sm font-semibold' : 'text-sm text-slate-700'}>{m.deleted ? '(deleted) ' : ''}{m.body}</p>
          ))}
        </Card>
      )}
      {rows.length === 0 ? (
        <Card className="p-8 text-center text-sm text-slate-500">No reports in this view.</Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <DataTable headers={['Report', 'Reason', 'When', '']}>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-50 text-[13px] align-top">
                <td className="px-4 py-2.5">
                  <div className="font-semibold">{row.reportedUser?.displayName || row.reportedUser?.email || row.reporter?.displayName || 'Report'}</div>
                  <div className="text-xs text-slate-500">{row.reporter?.email}</div>
                  {row.details && <div className="mt-1 text-slate-600">{row.details}</div>}
                  {kind === 'user' && (
                    <button type="button" className="mt-1 text-xs font-semibold text-g-blue-700" onClick={() => {
                      void api<{ messages: Array<{ id: string; body: string; reported?: boolean; deleted?: boolean }> }>(`/admin/safety/reports/user/${row.id}/context`)
                        .then((data) => setContext(data.messages))
                        .catch((e) => setError(e instanceof Error ? e.message : 'Could not load the conversation'));
                    }}>View messages</button>
                  )}
                </td>
                <td className="px-4 py-2.5">{row.reason}</td>
                <td className="px-4 py-2.5 whitespace-nowrap">{tashkent(row.createdAt)}</td>
                <td className="px-4 py-2.5 text-right space-x-2">
                  {row.status === 'open' && (
                    <>
                      <Button variant="secondary" disabled={busy === row.id} onClick={() => void resolve(row.id, 'actioned')}>Action</Button>
                      <Button variant="secondary" disabled={busy === row.id} onClick={() => void resolve(row.id, 'dismissed')}>Dismiss</Button>
                    </>
                  )}
                  {row.status !== 'open' && <Badge className="bg-slate-100 text-slate-600">{row.status}</Badge>}
                </td>
              </tr>
            ))}
          </DataTable>
        </Card>
      )}
    </div>
  );
}

interface Achievement {
  id: string;
  title?: string | null;
  name?: string | null;
  description?: string | null;
  points?: number | null;
  isActive: boolean;
}

interface GamificationPayload {
  stats: { achievements: number; activeAchievements: number; streakers: number; avgStreakDays: number };
  achievements: Achievement[];
}

export function AchievementsPage() {
  const [data, setData] = useState<GamificationPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await api<GamificationPayload>('/admin/gamification'));
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : 'Failed to load achievements');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function toggle(item: Achievement) {
    setBusy(item.id);
    try {
      await api(`/admin/gamification/achievements/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !item.isActive }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the achievement');
    } finally {
      setBusy(null);
    }
  }

  if (error && !data) return <ErrorBlock message={error} onRetry={() => void load()} />;
  if (!data) return <LoadingBlock />;

  return (
    <div>
      <PageHeader
        title="Achievements"
        subtitle={`${data.stats.activeAchievements} of ${data.stats.achievements} badges are on. ${data.stats.streakers} learners have a streak of 7 days or more.`}
      />
      {error && <p className="mb-3 text-sm text-rose-700">{error}</p>}
      <Card className="p-0 overflow-hidden">
        <DataTable headers={['Badge', 'Points', 'Status', '']}>
          {data.achievements.map((item) => (
            <tr key={item.id} className="border-b border-slate-50 text-[13px]">
              <td className="px-4 py-2.5">
                <div className="font-semibold">{item.title || item.name || item.id}</div>
                {item.description && <div className="text-xs text-slate-500">{item.description}</div>}
              </td>
              <td className="px-4 py-2.5">{item.points ?? '—'}</td>
              <td className="px-4 py-2.5">
                <Badge className={item.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}>
                  {item.isActive ? 'On' : 'Off'}
                </Badge>
              </td>
              <td className="px-4 py-2.5 text-right">
                <Button variant="secondary" disabled={busy === item.id} onClick={() => void toggle(item)}>
                  {item.isActive ? 'Turn off' : 'Turn on'}
                </Button>
              </td>
            </tr>
          ))}
        </DataTable>
      </Card>
    </div>
  );
}

export function AdminNotFoundPage() {
  return (
    <div>
      <PageHeader title="Page not found" subtitle="That admin address does not exist." />
      <a href="./" className="text-sm font-semibold text-g-blue-700">Back to overview</a>
    </div>
  );
}
