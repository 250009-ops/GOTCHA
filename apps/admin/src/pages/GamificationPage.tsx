import { useEffect, useState } from 'react';
import { Flame, Plus, Sparkles } from 'lucide-react';
import { Badge, Button, Card, Input, LoadingBlock, PageHeader, Select, StatCard, Textarea } from '../components/ui';
import { api } from '../lib/api';
import { formatNumber } from '../lib/utils';

interface GamificationData {
  stats: {
    achievements: number;
    activeAchievements: number;
    streakers: number;
    vocabMasters: number;
    activeReaders: number;
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
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('special');
  const [points, setPoints] = useState('25');

  async function load() {
    setData(await api<GamificationData>('/admin/gamification'));
  }

  useEffect(() => { load().catch(console.error); }, []);

  async function createAchievement(e: React.FormEvent) {
    e.preventDefault();
    await api('/admin/gamification/achievements', {
      method: 'POST',
      body: JSON.stringify({
        title,
        description,
        category,
        points: Number(points),
        code: `ach_${Date.now()}`,
      }),
    });
    setTitle('');
    setDescription('');
    setShowForm(false);
    await load();
  }

  async function toggle(id: string, isActive: boolean) {
    await api(`/admin/gamification/achievements/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: !isActive }),
    });
    await load();
  }

  if (!data) return <LoadingBlock />;

  return (
    <div>
      <PageHeader
        title="Gamification & Achievements"
        subtitle="Configure badges, streaks, and reward thresholds."
        actions={<Button onClick={() => setShowForm((v) => !v)}><Plus className="size-4" /> Add achievement</Button>}
      />

      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4 mb-6">
        <StatCard label="Achievements" value={data.stats.achievements} icon={<Sparkles className="size-5" />} />
        <StatCard label="Active" value={data.stats.activeAchievements} accent="bg-emerald-50 text-emerald-700" />
        <StatCard label="Streakers (7d+)" value={formatNumber(data.stats.streakers)} icon={<Flame className="size-5" />} accent="bg-orange-50 text-orange-600" />
        <StatCard label="Vocab Masters" value={formatNumber(data.stats.vocabMasters)} />
        <StatCard label="Active Readers" value={formatNumber(data.stats.activeReaders)} />
      </div>

      {showForm && (
        <Card className="p-5 mb-4">
          <form className="grid gap-3 max-w-2xl" onSubmit={createAchievement}>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" required />
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" required />
            <div className="grid grid-cols-2 gap-3">
              <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                {['streak', 'reading', 'vocabulary', 'social', 'special'].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
              <Input value={points} onChange={(e) => setPoints(e.target.value)} type="number" min={1} placeholder="Points" />
            </div>
            <div className="flex gap-2">
              <Button type="submit">Create</Button>
              <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

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
            <Button className="mt-4" variant="secondary" onClick={() => toggle(a.id, a.isActive)}>
              {a.isActive ? 'Disable' : 'Enable'}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
