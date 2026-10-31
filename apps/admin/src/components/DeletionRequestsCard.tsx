import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Card } from './ui';

type Req = { id: string; requestedAt: string; purgeAfter: string; purgeDue: boolean };

/** final-5 A10/B12: learners' own account-deletion requests (already anonymised; purge 1 year after the request). */
export function DeletionRequestsCard() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Req[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const allowed = user?.role === 'superadmin' || user?.role === 'moderator';
  useEffect(() => {
    if (!allowed) return;
    api<Req[]>('/admin/users-deletion-requests').then(setRows).catch((e) => setErr(e instanceof Error ? e.message : 'Could not load'));
  }, [allowed]);
  if (!allowed) return null;
  const d = (s: string) => new Date(s).toLocaleDateString('en-GB', { timeZone: 'Asia/Tashkent', day: '2-digit', month: 'short', year: 'numeric' });
  return (
    <div data-testid="deletion-requests"><Card className="p-5 mb-6">
      <div className="font-semibold">Deletion requests</div>
      <p className="text-sm text-slate-500 mb-3">
        Accounts the learner deleted. Profile and learning data are already removed, messages are anonymised and reports unlinked.
        The anonymised record is purged permanently 1 year after the request.
      </p>
      {err ? <div className="text-sm text-rose-600">{err}</div> : null}
      {rows === null && !err ? <div className="text-sm text-slate-500">Loading…</div> : null}
      {rows && rows.length === 0 ? <div className="text-sm text-slate-500">No deletion requests.</div> : null}
      {rows && rows.length > 0 ? (
        <table className="w-full text-sm">
          <thead><tr className="text-left text-slate-500"><th className="py-1">User id</th><th>Requested</th><th>Purge from</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="py-1 font-mono text-xs">{r.id}</td>
                <td>{d(r.requestedAt)}</td>
                <td>{d(r.purgeAfter)}</td>
                <td>{r.purgeDue ? <span className="text-rose-600 font-semibold">Purge due</span> : 'In retention'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </Card></div>
  );
}
