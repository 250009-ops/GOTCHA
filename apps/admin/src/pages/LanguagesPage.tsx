import { useEffect, useState } from 'react';
import { Globe2, Plus, Trash2 } from 'lucide-react';
import { Badge, Button, Card, Input, LoadingBlock, PageHeader, Select, StatCard } from '../components/ui';
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
    totalContentItems: number;
    avgCefrCoverage: number;
  };
  languages: Lang[];
  availableToAdd?: Lang[];
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
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addCode, setAddCode] = useState('');

  async function load() {
    setData(await api<LanguagesPayload>('/admin/languages'));
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);

  async function run(code: string, work: () => Promise<void>) {
    setBusy(code);
    setError(null);
    try {
      await work();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusy(null);
    }
  }

  async function toggle(lang: Lang) {
    await run(lang.code, () =>
      api(`/admin/languages/${lang.code}`, {
        method: 'PATCH',
        body: JSON.stringify({ isEnabled: !lang.isEnabled, status: lang.isEnabled ? 'Draft' : 'Active' }),
      }),
    );
  }

  async function remove(lang: Lang) {
    if (
      !window.confirm(
        `Remove ${lang.name} from the learner app? Existing learners keep it, but new signups and AI pickers will hide it.`,
      )
    ) {
      return;
    }
    await run(lang.code, () => api(`/admin/languages/${lang.code}`, { method: 'DELETE' }));
  }

  async function addLanguage(e: React.FormEvent) {
    e.preventDefault();
    if (!addCode) return;
    await run(addCode, () =>
      api('/admin/languages', { method: 'POST', body: JSON.stringify({ code: addCode }) }),
    );
    setAddOpen(false);
    setAddCode('');
  }

  if (!data) return <LoadingBlock />;

  const available = data.availableToAdd ?? data.languages.filter((l) => !l.isEnabled);
  const filtered = data.languages.filter((l) =>
    `${l.name} ${l.nativeName} ${l.code}`.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div>
      <PageHeader
        title="Languages & Localization"
        subtitle="Enabled languages appear in signup, settings, import, and AI detection."
        actions={
          <Button onClick={() => { setAddOpen(true); setAddCode(available[0]?.code ?? ''); }} disabled={available.length === 0}>
            <Plus className="size-4" /> Add Language
          </Button>
        }
      />

      {error && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard
          label="Supported Languages"
          value={data.stats.supported}
          icon={<Globe2 className="size-5" />}
        />
        <StatCard
          label="Total Content Items"
          value={formatNumber(data.stats.totalContentItems)}
        />
        <StatCard
          label="Avg. CEFR Coverage"
          value={`${data.stats.avgCefrCoverage}%`}
          hint={
            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden mt-1">
              <div className="h-full bg-g-blue-700" style={{ width: `${data.stats.avgCefrCoverage}%` }} />
            </div>
          }
        />
      </div>

      {addOpen && (
        <Card className="p-4 mb-4">
          <form className="flex flex-wrap items-end gap-3" onSubmit={addLanguage}>
            <label className="text-sm space-y-1.5 block min-w-[220px]">
              <span className="text-slate-600">Language to enable</span>
              <Select value={addCode} onChange={(e) => setAddCode(e.target.value)}>
                {available.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.flagEmoji} {l.name} ({l.code.toUpperCase()})
                  </option>
                ))}
              </Select>
            </label>
            <Button type="submit" disabled={!addCode || busy === addCode}>
              {busy === addCode ? 'Adding…' : 'Enable for learners'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
          </form>
        </Card>
      )}

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
                        <div className="h-full bg-g-blue-700" style={{ width: `${lang.cefrCoverage}%` }} />
                      </div>
                      <span className="text-xs font-semibold">{lang.cefrCoverage}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={statusClass[lang.status] ?? statusClass.Planned}>{lang.isEnabled ? 'Active' : lang.status}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <Button variant="secondary" disabled={busy === lang.code} onClick={() => void toggle(lang)}>
                        {busy === lang.code ? '…' : lang.isEnabled ? 'Disable' : 'Enable'}
                      </Button>
                      {lang.isEnabled && (
                        <button
                          type="button"
                          className="size-9 rounded-lg grid place-items-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-40"
                          aria-label={`Remove ${lang.name}`}
                          disabled={busy === lang.code}
                          onClick={() => void remove(lang)}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
