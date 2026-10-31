import { useCallback, useEffect, useState } from 'react';
import { Search, UserMinus, Users, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Badge, Button, Card, DataTable, Input, LoadingBlock, PageHeader, StatCard } from '../components/ui';
import { api } from '../lib/api';
import { formatNumber, initials, levelBadgeClass, relativeTime } from '../lib/utils';

type FilterChip = 'All' | 'Pay as you go' | 'Free' | 'Suspended';

interface ActivityItem {
  id: string;
  label: string;
  createdAt: string;
  type?: string;
}

interface UserRow {
  id: string;
  email: string;
  displayName: string | null;
  targetLanguage: string;
  cefrLevel: string | null;
  billingTier: string;
  planLabel?: string;
  createdAt: string;
  vocabCount: number;
  sessionCount?: number;
  streakCount?: number;
  isAdmin: boolean;
  isSuspended?: boolean;
  isActiveRecently?: boolean;
  recentActivity?: ActivityItem[];
}

interface UsersResponse {
  stats: { total: number; premium: number; payAsYouGo?: number; free: number; suspended: number };
  users: UserRow[];
}

function chipQuery(filter: FilterChip): { tier?: string; status?: string } {
  if (filter === 'Pay as you go') return { tier: 'payg' };
  if (filter === 'Free') return { tier: 'free' };
  if (filter === 'Suspended') return { status: 'suspended' };
  return {};
}

function isPayAsYouGo(u: Pick<UserRow, 'billingTier' | 'planLabel'>) {
  const text = `${u.billingTier} ${u.planLabel ?? ''}`.toLowerCase();
  return text.includes('pay');
}

export default function UsersPage() {
  const [params] = useSearchParams();
  const [data, setData] = useState<UsersResponse | null>(null);
  const [q, setQ] = useState(() => params.get('q') ?? '');
  const [filter, setFilter] = useState<FilterChip>('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [confirmHardDelete, setConfirmHardDelete] = useState(false);

  const load = useCallback(
    async (query = q, chip = filter) => {
      setLoading(true);
      setError(null);
      const { tier, status } = chipQuery(chip);
      const qs = new URLSearchParams();
      if (query.trim()) qs.set('q', query.trim());
      if (tier) qs.set('tier', tier);
      if (status) qs.set('status', status);
      try {
        const res = await api<UsersResponse>(`/admin/users${qs.toString() ? `?${qs}` : ''}`);
        setData(res);
        setSelected((prev) => {
          if (!prev) return null;
          return res.users.find((u) => u.id === prev.id) ?? prev;
        });
      } catch (e: unknown) {
        setData(null);
        setError(e instanceof Error ? e.message : 'Failed to load users');
      } finally {
        setLoading(false);
      }
    },
    [q, filter],
  );

  useEffect(() => {
    const fromUrl = params.get('q') ?? '';
    if (fromUrl !== q) setQ(fromUrl);
    load(fromUrl || q, filter).catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, filter]);

  async function openDetail(u: UserRow) {
    setSelected(u);
    setActionMsg(null);
    setActionErr(null);
    setConfirmHardDelete(false);
    try {
      const detail = await api<UserRow>(`/admin/users/${u.id}`);
      setSelected(detail);
    } catch (e: unknown) {
      setActionErr(e instanceof Error ? e.message : 'Failed to load user detail');
    }
  }

  async function setSuspended(id: string, deleted: boolean) {
    setBusyId(id);
    setActionErr(null);
    try {
      const updated = await api<UserRow>(`/admin/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ deleted }),
      });
      await load();
      setSelected(updated);
    } catch (e: unknown) {
      setActionErr(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusyId(null);
    }
  }

  async function resetPassword(id: string) {
    setBusyId(id);
    setActionMsg(null);
    setActionErr(null);
    try {
      const res = await api<{ message?: string }>(`/admin/users/${id}/reset-password`, { method: 'POST', body: '{}' });
      setActionMsg(res.message ?? 'Password reset email sent.');
    } catch (e: unknown) {
      setActionErr(e instanceof Error ? e.message : 'Reset failed');
    } finally {
      setBusyId(null);
    }
  }

  async function hardDelete(id: string) {
    setBusyId(id);
    setActionErr(null);
    try {
      await api(`/admin/users/${id}`, { method: 'DELETE' });
      setSelected(null);
      setConfirmHardDelete(false);
      await load();
    } catch (e: unknown) {
      setActionErr(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setBusyId(null);
    }
  }

  if (loading && !data) return <LoadingBlock />;

  if (error && !data) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
        <div className="font-semibold mb-2">Could not load users</div>
        <p className="mb-4">{error}</p>
        <Button onClick={() => load().catch(console.error)}>Retry</Button>
      </div>
    );
  }

  if (!data) return <LoadingBlock />;

  const chips: FilterChip[] = ['All', 'Pay as you go', 'Free', 'Suspended'];
  const paygCount = data.stats.payAsYouGo ?? data.stats.premium;
  const paygSelected = selected ? isPayAsYouGo(selected) : false;

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle={`Total: ${formatNumber(data.stats.total)} users`}
        actions={
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              load().catch(console.error);
            }}
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <Input className="pl-9 w-64" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search users…" />
            </div>
            <Button type="submit" variant="secondary">Search</Button>
          </form>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
        <StatCard label="Total Users" value={formatNumber(data.stats.total)} icon={<Users className="size-5" />} />
        <StatCard label="Pay as you go" value={formatNumber(paygCount)} accent="bg-violet-50 text-[#6c1d95]" />
        <StatCard label="Free" value={formatNumber(data.stats.free)} accent="bg-slate-100 text-slate-600" />
        <StatCard
          label="Suspended"
          value={formatNumber(data.stats.suspended)}
          accent="bg-rose-50 text-rose-600"
          icon={<UserMinus className="size-5" />}
        />
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {chips.map((chip) => {
          const selectedChip = filter === chip;
          const isSuspended = chip === 'Suspended';
          const className = selectedChip
            ? 'bg-[#7008e7] text-white border-[#7008e7]'
            : isSuspended
              ? 'bg-[#fee2e2] text-[#ef4444] border-[#fca5a5]'
              : 'bg-white text-slate-600 border-slate-200';
          return (
            <button
              key={chip}
              type="button"
              onClick={() => setFilter(chip)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${className}`}
            >
              {chip}
              {chip === 'Suspended' && data.stats.suspended > 0 ? ` (${data.stats.suspended})` : ''}
            </button>
          );
        })}
      </div>

      <div className={`grid gap-4 ${selected ? 'xl:grid-cols-[1fr_360px]' : ''}`}>
        <Card className="p-2">
          {data.users.length === 0 ? (
            <p className="text-sm text-slate-500 py-10 text-center">
              {filter === 'Suspended'
                ? 'No suspended users.'
                : 'No users found.'}
            </p>
          ) : (
            <DataTable headers={['User', 'Language', 'Level', 'Plan', 'Vocab', 'Joined', '']}>
              {data.users.map((u) => {
                const payg = isPayAsYouGo(u);
                const plan = u.planLabel || (payg ? 'Pay as you go' : 'Free');
                return (
                  <tr
                    key={u.id}
                    className={`cursor-pointer hover:bg-slate-50 ${selected?.id === u.id ? 'bg-violet-50/60' : ''}`}
                    onClick={() => openDetail(u)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="size-9 rounded-full bg-violet-100 text-[#6c1d95] grid place-items-center text-xs font-bold">
                          {initials(u.displayName, u.email)}
                        </div>
                        <div>
                          <div className="text-sm font-semibold flex items-center gap-2">
                            {u.displayName || 'Learner'}
                            <span
                              className={`size-1.5 rounded-full ${u.isActiveRecently ? 'bg-emerald-500' : 'bg-slate-300'}`}
                              title={u.isActiveRecently ? 'Active in last 7 days' : 'Inactive'}
                            />
                            {u.isSuspended && <Badge className="bg-rose-50 text-rose-600">Suspended</Badge>}
                            {u.isAdmin && <Badge className="bg-amber-50 text-amber-700">Admin</Badge>}
                          </div>
                          <div className="text-xs text-slate-500">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">{u.targetLanguage}</td>
                    <td className="px-4 py-3">
                      {u.cefrLevel ? <Badge className={levelBadgeClass(u.cefrLevel)}>{u.cefrLevel.toUpperCase()}</Badge> : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={payg ? 'bg-[#f0e7ff] text-[#7008e7]' : 'bg-slate-100 text-slate-600'}>
                        {plan}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm">{u.vocabCount}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{relativeTime(u.createdAt)}</td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      {!u.isAdmin && !u.isSuspended && (
                        <Button variant="danger" disabled={busyId === u.id} onClick={() => setSuspended(u.id, true)}>
                          {busyId === u.id ? '…' : 'Suspend'}
                        </Button>
                      )}
                      {!u.isAdmin && u.isSuspended && (
                        <Button variant="secondary" disabled={busyId === u.id} onClick={() => setSuspended(u.id, false)}>
                          {busyId === u.id ? '…' : 'Unsuspend'}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </DataTable>
          )}
        </Card>

        {selected && (
          <Card className="p-5 h-fit sticky top-4">
            <div className="flex items-start justify-between gap-2 mb-4">
              <div className="text-sm font-extrabold text-slate-900">User Profile</div>
              <button type="button" className="text-slate-400 hover:text-slate-700" onClick={() => setSelected(null)} aria-label="Close">
                <X className="size-4" />
              </button>
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="size-14 rounded-full border-2 border-[#7008e7] bg-violet-100 text-[#6c1d95] grid place-items-center text-lg font-bold">
                {initials(selected.displayName, selected.email)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <div className="text-base font-extrabold">{selected.displayName || 'Learner'}</div>
                  <Badge
                    className={
                      selected.isSuspended
                        ? 'bg-rose-50 text-rose-600'
                        : paygSelected
                          ? 'bg-[#f0e7ff] text-[#7008e7]'
                          : 'bg-slate-100 text-slate-600'
                    }
                  >
                    {selected.isSuspended ? 'Suspended' : paygSelected ? 'Pay as you go' : 'Free'}
                  </Badge>
                </div>
                <div className="text-xs text-slate-500">{selected.email}</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
                <div className="text-[11px] text-slate-500">Words</div>
                <div className="text-sm font-extrabold text-[#7008e7]">{formatNumber(selected.vocabCount)}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
                <div className="text-[11px] text-slate-500">Streak</div>
                <div className="text-sm font-extrabold">{selected.streakCount ?? 0} days</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
                <div className="text-[11px] text-slate-500">Articles</div>
                <div className="text-sm font-extrabold">{formatNumber(selected.sessionCount ?? 0)}</div>
              </div>
            </div>

            <div className="mb-4">
              <div className="text-sm font-extrabold mb-2">Recent Activity</div>
              <div className="rounded-xl border border-slate-200 p-3 space-y-2">
                {(selected.recentActivity ?? []).length === 0 ? (
                  <p className="text-xs text-slate-500">No recent activity yet.</p>
                ) : (
                  (selected.recentActivity ?? []).slice(0, 5).map((item) => (
                    <div key={item.id} className="flex justify-between gap-3 text-xs">
                      <span className="font-semibold text-slate-800 truncate">{item.label}</span>
                      <span className="text-slate-400 shrink-0">{relativeTime(item.createdAt)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-extrabold">Admin Actions</div>
              {selected.isAdmin ? (
                <p className="text-xs text-slate-500">Admin accounts cannot be modified here.</p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="secondary"
                      disabled={busyId === selected.id}
                      onClick={() => resetPassword(selected.id)}
                    >
                      {busyId === selected.id ? '…' : 'Reset PW'}
                    </Button>
                    {selected.isSuspended ? (
                      <Button
                        variant="secondary"
                        disabled={busyId === selected.id}
                        onClick={() => setSuspended(selected.id, false)}
                      >
                        {busyId === selected.id ? '…' : 'Unsuspend'}
                      </Button>
                    ) : (
                      <Button
                        variant="danger"
                        disabled={busyId === selected.id}
                        onClick={() => setSuspended(selected.id, true)}
                      >
                        {busyId === selected.id ? '…' : 'Suspend'}
                      </Button>
                    )}
                  </div>
                  {confirmHardDelete ? (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 space-y-2">
                      <p className="text-xs text-rose-700 font-semibold">
                        Permanently delete this user and all learning data?
                      </p>
                      <div className="flex gap-2">
                        <Button variant="danger" disabled={busyId === selected.id} onClick={() => hardDelete(selected.id)}>
                          {busyId === selected.id ? '…' : 'Confirm delete'}
                        </Button>
                        <Button variant="secondary" disabled={busyId === selected.id} onClick={() => setConfirmHardDelete(false)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="w-full text-center text-sm font-bold text-rose-600 py-2"
                      onClick={() => setConfirmHardDelete(true)}
                    >
                      Delete User Permanently
                    </button>
                  )}
                </>
              )}
              {actionMsg && <p className="text-xs text-emerald-600">{actionMsg}</p>}
              {actionErr && <p className="text-xs text-rose-600">{actionErr}</p>}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
