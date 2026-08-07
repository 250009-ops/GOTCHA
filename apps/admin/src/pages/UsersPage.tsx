import { useEffect, useState } from 'react';
import { Search, UserMinus, Users } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Badge, Button, Card, DataTable, Input, LoadingBlock, PageHeader, StatCard } from '../components/ui';
import { api } from '../lib/api';
import { formatNumber, initials, levelBadgeClass, relativeTime } from '../lib/utils';

interface UsersResponse {
  stats: { total: number; premium: number; free: number; suspended: number };
  users: Array<{
    id: string;
    email: string;
    displayName: string | null;
    targetLanguage: string;
    cefrLevel: string | null;
    billingTier: string;
    createdAt: string;
    vocabCount: number;
    isAdmin: boolean;
  }>;
}

export default function UsersPage() {
  const [params] = useSearchParams();
  const [data, setData] = useState<UsersResponse | null>(null);
  const [q, setQ] = useState(() => params.get('q') ?? '');

  async function load(query = q) {
    const res = await api<UsersResponse>(`/admin/users${query ? `?q=${encodeURIComponent(query)}` : ''}`);
    setData(res);
  }

  useEffect(() => {
    const fromUrl = params.get('q') ?? '';
    setQ(fromUrl);
    load(fromUrl).catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  async function suspend(id: string) {
    await api(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify({ deleted: true }) });
    await load();
  }

  if (!data) return <LoadingBlock />;

  return (
    <div>
      <PageHeader
        title="User Management"
        subtitle="Search, filter, and moderate learner accounts across the platform."
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

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Users" value={formatNumber(data.stats.total)} icon={<Users className="size-5" />} />
        <StatCard label="Premium" value={formatNumber(data.stats.premium)} accent="bg-violet-50 text-[#6c1d95]" />
        <StatCard label="Free" value={formatNumber(data.stats.free)} accent="bg-slate-100 text-slate-600" />
        <StatCard label="Suspended" value={formatNumber(data.stats.suspended)} accent="bg-rose-50 text-rose-600" icon={<UserMinus className="size-5" />} />
      </div>

      <Card className="p-2">
        <DataTable headers={['User', 'Language', 'Level', 'Plan', 'Vocab', 'Joined', '']}>
          {data.users.map((u) => (
            <tr key={u.id}>
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-full bg-violet-100 text-[#6c1d95] grid place-items-center text-xs font-bold">
                    {initials(u.displayName, u.email)}
                  </div>
                  <div>
                    <div className="text-sm font-semibold flex items-center gap-2">
                      {u.displayName || 'Learner'}
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
                <Badge className={u.billingTier === 'Premium' ? 'bg-violet-50 text-[#6c1d95]' : 'bg-slate-100 text-slate-600'}>
                  {u.billingTier}
                </Badge>
              </td>
              <td className="px-4 py-3 text-sm">{u.vocabCount}</td>
              <td className="px-4 py-3 text-sm text-slate-500">{relativeTime(u.createdAt)}</td>
              <td className="px-4 py-3">
                {!u.isAdmin && (
                  <Button variant="danger" onClick={() => suspend(u.id)}>Suspend</Button>
                )}
              </td>
            </tr>
          ))}
        </DataTable>
      </Card>
    </div>
  );
}
