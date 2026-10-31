import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../components/ui';
import { api } from '../lib/api';
import { formatAge, REPORT_SLA_HOURS, slaState } from '../lib/reportSla';

type Person = { id: string; displayName?: string | null; email?: string | null; birthYear?: number | null };
type Report = {
  id: string;
  reason: string;
  details?: string | null;
  status: string;
  createdAt: string;
  reviewedAt?: string | null;
  reporter?: Person;
  reportedUser?: Person;
  messageSnapshot?: string | null;
  conversationId?: string | null;
  contentId?: string | null;
  importId?: string | null;
};
type Kind = 'user' | 'content';
const STATUSES = ['open', 'reviewed', 'actioned', 'dismissed'] as const;
const REASONS = ['all', 'spam', 'harassment', 'inappropriate', 'underage', 'other'] as const;

const slaClass = {
  ok: 'bg-emerald-50 text-emerald-700',
  'due-soon': 'bg-amber-50 text-amber-700',
  overdue: 'bg-rose-50 text-rose-700 font-semibold',
  closed: 'bg-slate-100 text-slate-500',
};
const who = (p?: Person) => (p ? p.displayName || p.email || p.id.slice(0, 8) : '—');

export default function ReportsPage() {
  const [params, setParams] = useSearchParams();
  const kind: Kind = params.get('kind') === 'content' ? 'content' : 'user';
  const status = (STATUSES as readonly string[]).includes(params.get('status') ?? '') ? params.get('status')! : 'open';
  const [reason, setReason] = useState<(typeof REASONS)[number]>('all');
  const [rows, setRows] = useState<Report[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const focusId = params.get('id');

  const load = useCallback(async () => {
    setError(null);
    try {
      setRows(await api<Report[]>(`/admin/safety/reports?kind=${kind}&status=${status}`));
      setNow(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load reports');
      setRows([]);
    }
  }, [kind, status]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const t = window.setInterval(() => setNow(new Date()), 60_000); return () => window.clearInterval(t); }, []);

  const visible = useMemo(() => (rows ?? []).filter((r) => reason === 'all' || r.reason === reason), [rows, reason]);
  const overdue = visible.filter((r) => slaState(r, now) === 'overdue').length;

  const setParam = (k: string, v: string) => { const p = new URLSearchParams(params); p.set(k, v); p.delete('id'); setParams(p); };
  const resolve = async (r: Report, to: 'reviewed' | 'actioned' | 'dismissed') => {
    setBusy(r.id);
    try {
      await api(`/admin/safety/reports/${kind}/${r.id}`, { method: 'PATCH', body: JSON.stringify({ status: to }) });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Reports" subtitle={`User and content reports. Review each open report within ${REPORT_SLA_HOURS} h.`} />
      <div className="flex flex-wrap items-center gap-2">
        {(['user', 'content'] as Kind[]).map((k) => (
          <button key={k} type="button" onClick={() => setParam('kind', k)}
            className={`px-3 py-1.5 rounded-lg text-sm border ${kind === k ? 'bg-slate-900 text-white' : 'bg-white'}`}>
            {k === 'user' ? 'User reports' : 'Content reports'}
          </button>
        ))}
        <label className="text-sm ml-2">Status{' '}
          <select className="border rounded-lg px-2 py-1" value={status} onChange={(e) => setParam('status', e.target.value)}>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="text-sm">Reason{' '}
          <select className="border rounded-lg px-2 py-1" value={reason} onChange={(e) => setReason(e.target.value as typeof reason)}>
            {REASONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <button type="button" className="px-3 py-1.5 rounded-lg text-sm border bg-white" onClick={() => void load()}>Refresh</button>
        {status === 'open' && <span className={`ml-auto text-sm px-2 py-1 rounded ${overdue ? slaClass.overdue : slaClass.ok}`}>{overdue} overdue (&gt;{REPORT_SLA_HOURS} h)</span>}
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {rows === null ? <p className="text-sm text-slate-500">Loading…</p> : visible.length === 0 ? (
        <p className="text-sm text-slate-500">No {status} {kind} reports.</p>
      ) : (
        <div className="overflow-x-auto bg-white rounded-xl border">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500 border-b">
              <tr>
                <th className="p-2">Age / SLA</th><th className="p-2">Reason</th><th className="p-2">Reporter</th>
                <th className="p-2">{kind === 'user' ? 'Reported user' : 'Content'}</th><th className="p-2">Details</th><th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const sla = slaState(r, now);
                return (
                  <tr key={r.id} className={`border-b align-top ${focusId === r.id ? 'bg-amber-50/60' : ''}`}>
                    <td className="p-2 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded ${slaClass[sla]}`} title={new Date(r.createdAt).toLocaleString()}>
                        {formatAge(r.createdAt, now)}{sla === 'overdue' ? ' · overdue' : sla === 'due-soon' ? ' · due soon' : ''}
                      </span>
                    </td>
                    <td className="p-2">{r.reason}</td>
                    <td className="p-2">{who(r.reporter)}</td>
                    <td className="p-2">
                      {kind === 'user' ? <>{who(r.reportedUser)}{r.reportedUser?.birthYear ? <span className="text-slate-400"> · b. {r.reportedUser.birthYear}</span> : null}</>
                        : <span className="font-mono text-xs">{r.contentId ?? r.importId ?? '—'}</span>}
                    </td>
                    <td className="p-2 max-w-md">
                      {r.details && <p className="whitespace-pre-wrap">{r.details}</p>}
                      {r.messageSnapshot && <blockquote className="mt-1 border-l-2 pl-2 text-slate-600 whitespace-pre-wrap">{r.messageSnapshot}</blockquote>}
                    </td>
                    <td className="p-2 whitespace-nowrap space-x-1">
                      {r.status === 'open' ? (['reviewed', 'actioned', 'dismissed'] as const).map((s) => (
                        <button key={s} type="button" disabled={busy === r.id} onClick={() => void resolve(r, s)}
                          className="px-2 py-1 rounded border text-xs disabled:opacity-50">{s === 'actioned' ? 'Action taken' : s === 'reviewed' ? 'Reviewed' : 'Dismiss'}</button>
                      )) : <span className="text-xs text-slate-500">{r.status}{r.reviewedAt ? ` · ${new Date(r.reviewedAt).toLocaleString()}` : ''}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
