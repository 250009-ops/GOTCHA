import { useEffect, useState } from 'react';
import { Flame } from 'lucide-react';
import { Badge, Button, Card, LoadingBlock, PageHeader, StatCard } from '../components/ui';
import { api } from '../lib/api';
import { formatNumber } from '../lib/utils';

interface GamificationData {
  stats: {
    achievements: number;
    activeAchievements: number;
    streakers: number;
    avgStreakDays?: number;
  };
  achievements: Array<{
    id: string;
    code: string;
    title: string;
    description: string;
    category: string;
    points: number;
    threshold: number;
    isActive: boolean;
  }>;
}

export default function GamificationPage() {
  const [data, setData] = useState<GamificationData | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function load() {
    setData(await api<GamificationData>('/admin/gamification'));
  }

  useEffect(() => { load().catch(console.error); }, []);

  async function toggle(id: string, isActive: boolean) {
    setSavingId(id);
    try {
      await api(`/admin/gamification/achievements/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !isActive }),
      });
      await load();
    } finally {
      setSavingId(null);
    }
  }

  if (!data) return <LoadingBlock />;

  return (
    <div>
      <PageHeader
        title="Gamification & Achievements"
        subtitle="Live streak stats and the seeded badge catalog. Custom achievement creation is not available yet."
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Avg Streak"
          value={`${data.stats.avgStreakDays ?? 0} days`}
          icon={<Flame className="size-5" />}
          accent="bg-orange-50 text-orange-600"
        />
        <StatCard label="Achievements" value={data.stats.achievements} />
        <StatCard label="Active" value={data.stats.activeAchievements} accent="bg-emerald-50 text-emerald-700" />
        <StatCard label="Streakers (7d+)" value={formatNumber(data.stats.streakers)} />
      </div>

      {data.achievements.length === 0 ? (
        <Card className="p-8 text-center text-sm text-slate-500">
          No achievements in the catalog yet.
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.achievements.map((a) => (
            <Card key={a.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-lg">{a.title}</div>
                  <div className="text-sm text-slate-500 mt-1">{a.description}</div>
                </div>
                <Badge className={a.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}>
                  {a.isActive ? 'Active' : 'Off'}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2 mt-4 text-xs">
                <Badge className="bg-violet-50 text-[#6c1d95] capitalize">{a.category}</Badge>
                <Badge className="bg-slate-100 text-slate-600">{a.points} pts</Badge>
                <Badge className="bg-slate-100 text-slate-600">Threshold {a.threshold}</Badge>
              </div>
              <Button
                className="mt-4"
                variant="secondary"
                disabled={savingId === a.id}
                onClick={() => toggle(a.id, a.isActive)}
              >
                {a.isActive ? 'Disable' : 'Enable'}
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
