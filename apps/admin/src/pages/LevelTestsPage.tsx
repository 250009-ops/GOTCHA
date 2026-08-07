import { useEffect, useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { Badge, Card, DataTable, LoadingBlock, PageHeader, StatCard } from '../components/ui';
import { api } from '../lib/api';
import { formatNumber, levelBadgeClass, relativeTime } from '../lib/utils';

interface LevelTestsData {
  stats: {
    total: number;
    avgScore: number;
    byLevel: Array<{ level: string; count: number; avgScore: number }>;
  };
  results: Array<{
    id: string;
    targetLanguage: string;
    suggestedLevel: string;
    score: number;
    createdAt: string;
    user: { id: string; email: string; displayName: string | null } | null;
  }>;
}

export default function LevelTestsPage() {
  const [data, setData] = useState<LevelTestsData | null>(null);

  useEffect(() => {
    api<LevelTestsData>('/admin/level-tests').then(setData).catch(console.error);
  }, []);

  if (!data) return <LoadingBlock />;

  return (
    <div>
      <PageHeader
        title="Level Tests & Assessments"
        subtitle="Placement results and CEFR distribution across learners."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Assessments" value={formatNumber(data.stats.total)} icon={<ClipboardCheck className="size-5" />} />
        <StatCard label="Average Score" value={data.stats.avgScore.toFixed(1)} accent="bg-sky-50 text-sky-700" />
        <StatCard label="Levels Covered" value={data.stats.byLevel.length} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
        {data.stats.byLevel.map((row) => (
          <Card key={row.level} className="p-4 text-center">
            <Badge className={levelBadgeClass(row.level)}>{row.level.toUpperCase()}</Badge>
            <div className="text-2xl font-bold mt-2">{row.count}</div>
            <div className="text-xs text-slate-500">avg {row.avgScore}</div>
          </Card>
        ))}
      </div>

      <Card className="p-2">
        <DataTable headers={['Learner', 'Language', 'Suggested Level', 'Score', 'Taken']}>
          {data.results.map((r) => (
            <tr key={r.id}>
              <td className="px-4 py-3 text-sm font-medium">{r.user?.displayName || r.user?.email || 'Unknown'}</td>
              <td className="px-4 py-3 text-sm uppercase">{r.targetLanguage}</td>
              <td className="px-4 py-3"><Badge className={levelBadgeClass(r.suggestedLevel)}>{r.suggestedLevel.toUpperCase()}</Badge></td>
              <td className="px-4 py-3 text-sm font-semibold">{r.score}</td>
              <td className="px-4 py-3 text-sm text-slate-500">{relativeTime(r.createdAt)}</td>
            </tr>
          ))}
        </DataTable>
      </Card>
    </div>
  );
}
