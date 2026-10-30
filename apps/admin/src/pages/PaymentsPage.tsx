import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, RotateCcw } from 'lucide-react';
import { Badge, Button, Card, DataTable, ErrorBlock, Input, LoadingBlock, PageHeader, Select, StatCard } from '../components/ui';
import { api } from '../lib/api';
import { formatMoney, formatNumber } from '../lib/utils';

type Status = 'pending' | 'paid' | 'failed' | 'expired' | 'refunded';

interface PaymentRow {
  id: string;
  status: Status;
  importType: string;
  contentFormat: string;
  estimatedPages: number;
  amountUzs: number;
  provider: string;
  account: string;
  providerPaymentId: string | null;
  createdAt: string;
  paidAt: string | null;
  user: { id: string; email: string; displayName: string | null };
}

interface PaymentsResponse {
  page: number;
  pageSize: number;
  total: number;
  gatewayEnabled: boolean;
  sandbox: boolean;
  summary: Partial<Record<Status, { count: number; amountUzs: number }>>;
  items: PaymentRow[];
}

const STATUS_STYLE: Record<Status, string> = {
  paid: 'bg-emerald-50 text-emerald-700',
  failed: 'bg-rose-50 text-rose-700',
  pending: 'bg-amber-50 text-amber-700',
  expired: 'bg-slate-100 text-slate-600',
  refunded: 'bg-g-blue-50 text-g-blue-700',
};

/** All times in Asia/Tashkent, labelled (DESIGN §9). */
function tashkent(iso: string | null) {
  if (!iso) return '—';
  return `${new Date(iso).toLocaleString('en-GB', { timeZone: 'Asia/Tashkent', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} UTC+5`;
}

export default function PaymentsPage() {
  const [data, setData] = useState<PaymentsResponse | null>(null);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refund, setRefund] = useState<PaymentRow | null>(null);
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ page: String(page), pageSize: '25' });
      if (status) qs.set('status', status);
      if (q.trim()) qs.set('q', q.trim());
      setData(await api<PaymentsResponse>(`/admin/payments?${qs}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load payments');
    } finally {
      setLoading(false);
    }
  }, [page, status, q]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitRefund() {
    if (!refund) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await api<{ note?: string }>(`/admin/payments/${refund.id}/refund`, {
        method: 'POST',
        body: JSON.stringify({ reason, amountUzs: amount ? Number(amount) : undefined }),
      });
      setMsg(res.note ?? 'Refund recorded.');
      setRefund(null);
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Refund failed');
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) return <ErrorBlock message={error} onRetry={() => void load()} />;
  if (!data) return <LoadingBlock />;
  const s = data.summary;
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <div>
      <PageHeader
        title="Payments"
        subtitle="Atmos import payments. Refunds are admin-only, audited, revoke catalog access, and reverse the Atmos transaction when there is one."
        actions={
          <div className="flex items-center gap-2">
            {data.sandbox && <Badge className="bg-amber-50 text-amber-700">Atmos test mode</Badge>}
            <Badge className={data.gatewayEnabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}>
              Gateway {data.gatewayEnabled ? 'on' : 'off'}
            </Badge>
            <Button onClick={() => load()} disabled={loading}>
              <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard label="Paid" value={formatMoney(s.paid?.amountUzs ?? 0)} hint={`${formatNumber(s.paid?.count ?? 0)} payments`} />
        <StatCard label="Pending" value={formatNumber(s.pending?.count ?? 0)} />
        <StatCard label="Failed / expired" value={formatNumber((s.failed?.count ?? 0) + (s.expired?.count ?? 0))} />
        <StatCard label="Refunded" value={formatMoney(s.refunded?.amountUzs ?? 0)} hint={`${formatNumber(s.refunded?.count ?? 0)} refunds`} />
      </div>

      <Card className="p-0 overflow-hidden">
        <form
          className="flex flex-wrap gap-2 p-4 border-b border-slate-100"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            void load();
          }}
        >
          <Input placeholder="Email, account or Atmos id" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-40" aria-label="Status">
            <option value="">All statuses</option>
            {(['paid', 'pending', 'failed', 'expired', 'refunded'] as const).map((x) => (
              <option key={x} value={x}>{x}</option>
            ))}
          </Select>
          <Button type="submit" variant="secondary">Search</Button>
        </form>
        {data.items.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">No payments yet.</p>
        ) : (
          <DataTable headers={['Learner', 'Amount', 'Status', 'Import', 'Atmos id', 'Created', '']}>
            {data.items.map((p) => (
              <tr key={p.id} className="border-b border-slate-50 text-[13px]">
                <td className="px-4 py-2.5">
                  <div className="font-semibold text-slate-900">{p.user.displayName || p.user.email}</div>
                  <div className="text-xs text-slate-500">{p.user.email}</div>
                </td>
                <td className="px-4 py-2.5 font-semibold tabular-nums">{formatMoney(p.amountUzs)}</td>
                <td className="px-4 py-2.5"><Badge className={STATUS_STYLE[p.status]}>{p.status}</Badge></td>
                <td className="px-4 py-2.5 text-slate-600">{p.importType} · {p.contentFormat} · {p.estimatedPages}p</td>
                <td className="px-4 py-2.5 text-slate-500 font-mono text-xs">{p.providerPaymentId ?? '—'}</td>
                <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{tashkent(p.createdAt)}</td>
                <td className="px-4 py-2.5 text-right">
                  {p.status === 'paid' && (
                    <Button variant="secondary" onClick={() => { setRefund(p); setReason(''); setAmount(''); setConfirmText(''); setMsg(null); }}>
                      <RotateCcw className="size-4" /> Refund
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </DataTable>
        )}
        <div className="flex items-center justify-between p-4 text-sm text-slate-500">
          <span>{formatNumber(data.total)} payments</span>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((x) => x - 1)}>Prev</Button>
            <span className="self-center">{page} / {pages}</span>
            <Button variant="secondary" disabled={page >= pages} onClick={() => setPage((x) => x + 1)}>Next</Button>
          </div>
        </div>
      </Card>
      {msg && <p className="mt-3 text-sm text-slate-600" role="status">{msg}</p>}

      {refund && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={() => setRefund(null)} />
          <div className="relative w-full max-w-md p-5 space-y-3 bg-white border border-slate-200/80 rounded-2xl shadow-xl" role="dialog" aria-modal="true" aria-labelledby="refund-title">
            <h2 id="refund-title" className="text-lg font-bold text-slate-900">Refund {formatMoney(refund.amountUzs)}</h2>
            <p className="text-sm text-slate-500">
              {refund.user.email} · {refund.account}
              {data.sandbox && !refund.providerPaymentId && ' · Test mode, no Atmos transaction: recorded locally only.'}
            </p>
            <label className="block text-xs font-semibold text-slate-600">
              Reason
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. duplicate charge" />
            </label>
            <label className="block text-xs font-semibold text-slate-600">
              Type REFUND to confirm
              <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="secondary" onClick={() => setRefund(null)}>Cancel</Button>
              <Button variant="danger" disabled={busy || reason.trim().length < 3 || confirmText !== 'REFUND'} onClick={submitRefund}>
                {busy ? '…' : 'Refund'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
