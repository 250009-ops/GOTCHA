import { useEffect, useState } from 'react';
import { Globe2, Settings2 } from 'lucide-react';
import { Badge, Button, Card, Input, LoadingBlock, PageHeader, StatCard } from '../components/ui';
import { api } from '../lib/api';
import { formatNumber } from '../lib/utils';

interface Lang {
  code: string;
  name: string;
  nativeName: string;
  flagEmoji: string;
  regionLabel?: string | null;
  isEnabled: boolean;
  learnerCount: number;
  contentCount: number;
  cefrCoverage: number;
  status: string;
}

interface LanguagesPayload {
  stats: {
    supported: number;
    supportedDelta: number;
    totalContentItems: number;
    contentDelta: number;
    avgCefrCoverage: number;
    cefrDelta: number;
    interfaceTranslations: number;
  };
  cefrThresholds: Array<{ level: string; range: string; description: string }>;
  languages: Lang[];
}

const statusClass: Record<string, string> = {
  Active: 'bg-emerald-50 text-emerald-700',
  Beta: 'bg-blue-50 text-blue-600',
  Draft: 'bg-amber-50 text-amber-700',
  Planned: 'bg-slate-100 text-slate-500',
};

export default function LanguagesPage() {
  const [data, setData] = useState<LanguagesPayload | null>(null);
  const [q, setQ] = useState('');
  const [syncing, setSyncing] = useState(false);

  async function load() {
    setData(await api<LanguagesPayload>('/admin/languages'));
  }

  useEffect(() => { load().catch(console.error); }, []);

  async function toggle(code: string, isEnabled: boolean) {
    await api(`/admin/languages/${code}`, {
      method: 'PATCH',
      body: JSON.stringify({ isEnabled: !isEnabled, status: !isEnabled ? 'Active' : 'Draft' }),
    });
    await load();
  }

  async function syncThresholds() {
    setSyncing(true);
    try {
      await api('/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify({ cefrThresholdsSyncedAt: new Date().toISOString() }),
      });
    } finally {
      setSyncing(false);
    }
  }

  if (!data) return <LoadingBlock />;

  const filtered = data.languages.filter((l) =>
    `${l.name} ${l.nativeName} ${l.code}`.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div>
      <PageHeader
        title="Languages & Localization"
        subtitle="Manage supported target languages, content coverage, CEFR configurations, and interface translations."
        actions={<Button disabled title="Coming soon">+ Add Language</Button>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Supported Languages"
          value={data.stats.supported}
          hint={<span className="text-emerald-600">+{data.stats.supportedDelta} new vs last month</span>}
          icon={<Globe2 className="size-5" />}
        />
        <StatCard
          label="Total Content Items"
          value={formatNumber(data.stats.totalContentItems)}
          hint={<span className="text-emerald-600">+{data.stats.contentDelta} recent vs last month</span>}
        />
        <StatCard
          label="Avg. CEFR Coverage"
          value={`${data.stats.avgCefrCoverage}%`}
          hint={
            <div>
              <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden mt-1 mb-1">
                <div className="h-full bg-[#6c1d95]" style={{ width: `${data.stats.avgCefrCoverage}%` }} />
              </div>
              <span className="text-emerald-600">+{data.stats.cefrDelta}% growth vs last month</span>
            </div>
          }
        />
        <StatCard
          label="Interface Translations"
          value={`${data.stats.interfaceTranslations}%`}
          hint={
            <div>
              <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden mt-1 mb-1">
                <div className="h-full bg-[#6c1d95]" style={{ width: `${data.stats.interfaceTranslations}%` }} />
              </div>
              <span>{data.stats.interfaceTranslations}% complete vs last month</span>
            </div>
          }
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4">
        <Card className="p-0 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3">
            <div className="font-semibold">Supported Target Languages</div>
            <Input
              className="max-w-xs"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search languages..."
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="text-xs uppercase text-slate-400 bg-slate-50">
                <tr>
                  <th className="px-4 py-3 font-semibold">Language</th>
                  <th className="px-4 py-3 font-semibold">Learners</th>
                  <th className="px-4 py-3 font-semibold">Content Items</th>
                  <th className="px-4 py-3 font-semibold">CEFR Coverage</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((lang) => (
                  <tr key={lang.code} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-full bg-slate-100 grid place-items-center text-base">{lang.flagEmoji}</div>
                        <div>
                          <div className="text-sm font-semibold">{lang.name}</div>
                          <div className="text-xs text-slate-500">{lang.nativeName}{lang.regionLabel ? ` · ${lang.regionLabel}` : ''}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">{formatNumber(lang.learnerCount)}</td>
                    <td className="px-4 py-3 text-sm">{formatNumber(lang.contentCount)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-[120px] rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full bg-[#7c3aed]" style={{ width: `${lang.cefrCoverage}%` }} />
                        </div>
                        <span className="text-xs font-semibold">{lang.cefrCoverage}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={statusClass[lang.status] ?? statusClass.Planned}>{lang.status}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Button variant="secondary" onClick={() => toggle(lang.code, lang.isEnabled)}>
                        {lang.isEnabled ? 'Disable' : 'Enable'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-5 h-fit">
          <div className="font-semibold mb-1">CEFR Level Thresholds</div>
          <div className="text-sm text-slate-500 mb-4">XP required to unlock levels</div>
          <div className="space-y-3">
            {data.cefrThresholds.map((t) => (
              <div key={t.level} className="flex items-start gap-3 border-b border-slate-100 pb-3 last:border-0">
                <div className="size-8 rounded-lg bg-violet-50 text-[#6c1d95] grid place-items-center text-xs font-bold">{t.level}</div>
                <div className="flex-1">
                  <div className="text-sm font-semibold">{t.range}</div>
                  <div className="text-xs text-slate-500">{t.description}</div>
                </div>
                <Settings2 className="size-4 text-slate-300" />
              </div>
            ))}
          </div>
          <Button className="w-full mt-4" variant="secondary" onClick={syncThresholds} disabled={syncing}>
            {syncing ? 'Syncing…' : 'Sync Threshold Config'}
          </Button>
        </Card>
      </div>
    </div>
  );
}
