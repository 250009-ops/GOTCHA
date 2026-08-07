import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Plus, Trash2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Badge, Button, Card, DataTable, Input, LoadingBlock, PageHeader, Select, StatCard, Textarea } from '../components/ui';
import { api } from '../lib/api';
import { APP_LANGUAGES, cn, formatNumber, levelBadgeClass } from '../lib/utils';

type Tab = 'all' | 'book' | 'article' | 'news' | 'user_imports';

interface CurriculumItem {
  id: string;
  title: string;
  language: string;
  cefrLevel: string;
  contentType: string;
  wordCount: number;
  activeReads: number;
  completion: number;
  publishStatus: string;
}

interface LicenseRow {
  id: string;
  rightsHolder: string;
  status: string;
  attributionText: string;
}

interface ModerationRow {
  id: string;
  reason: string;
  status: string;
}

interface IngestionRow {
  id: string;
  sourceType: string;
  status: string;
  attempts: number;
  errorMessage?: string | null;
}

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'book', label: 'Books' },
  { id: 'article', label: 'Articles' },
  { id: 'news', label: 'News' },
  { id: 'user_imports', label: 'User Imports' },
];

const langBadge: Record<string, string> = {
  fr: 'bg-violet-50 text-[#6c1d95]',
  en: 'bg-sky-50 text-sky-700',
  ru: 'bg-amber-50 text-amber-700',
  uz: 'bg-fuchsia-50 text-fuchsia-700',
  es: 'bg-orange-50 text-orange-700',
  de: 'bg-yellow-50 text-yellow-800',
  ja: 'bg-rose-50 text-rose-700',
  ko: 'bg-teal-50 text-teal-700',
  pt: 'bg-lime-50 text-lime-700',
};

const statusBadge: Record<string, string> = {
  published: 'bg-emerald-50 text-emerald-700',
  draft: 'bg-slate-100 text-slate-600',
  review: 'bg-orange-50 text-orange-700',
  archived: 'bg-slate-200 text-slate-500',
};

export default function ContentPage() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'all';
  const [stats, setStats] = useState({ total: 847, published: 723, draft: 89, review: 35, archived: 0 });
  const [items, setItems] = useState<CurriculumItem[] | null>(null);
  const [q, setQ] = useState(() => params.get('q') ?? '');
  const [langFilter, setLangFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [plainText, setPlainText] = useState('');
  const [language, setLanguage] = useState('en');
  const [cefrLevel, setCefrLevel] = useState('b1');
  const [licenses, setLicenses] = useState<LicenseRow[]>([]);
  const [moderation, setModeration] = useState<ModerationRow[]>([]);
  const [ingestion, setIngestion] = useState<IngestionRow[]>([]);
  const [rightsHolder, setRightsHolder] = useState('');
  const [attributionText, setAttributionText] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  async function loadCurriculum() {
    const type = tab === 'all' ? 'all' : tab === 'user_imports' ? 'user_imports' : tab;
    const [list, s] = await Promise.all([
      api<CurriculumItem[]>(`/admin/content/curriculum?type=${type}`),
      api<typeof stats>('/admin/content/stats'),
    ]);
    setItems(list);
    setStats(s);
  }

  async function loadOps() {
    const [lic, mod, ing] = await Promise.all([
      api<LicenseRow[]>('/admin/licenses'),
      api<ModerationRow[]>('/admin/moderation?status=pending'),
      api<IngestionRow[]>('/admin/ingestion'),
    ]);
    setLicenses(lic);
    setModeration(mod);
    setIngestion(ing);
  }

  useEffect(() => {
    loadCurriculum().catch(console.error);
  }, [tab]);

  useEffect(() => {
    const fromUrl = params.get('q');
    if (fromUrl != null) setQ(fromUrl);
  }, [params]);

  useEffect(() => {
    if (tab === 'user_imports') loadOps().catch(console.error);
  }, [tab]);

  const filtered = useMemo(() => {
    return (items ?? []).filter((item) => {
      if (langFilter !== 'all' && item.language !== langFilter) return false;
      if (levelFilter !== 'all' && item.cefrLevel !== levelFilter) return false;
      if (q && !item.title.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [items, langFilter, levelFilter, q]);

  async function createContent(e: React.FormEvent) {
    e.preventDefault();
    await api('/admin/content', {
      method: 'POST',
      body: JSON.stringify({
        title,
        plainText,
        language,
        contentType: 'article',
        contentSource: 'public_domain',
        cefrLevel,
      }),
    });
    setTitle('');
    setPlainText('');
    setShowForm(false);
    await loadCurriculum();
  }

  async function publish(id: string) {
    setBusyId(id);
    try {
      await api(`/admin/content/${id}/publish`, { method: 'PATCH' });
      await loadCurriculum();
    } finally {
      setBusyId(null);
    }
  }

  async function archive(id: string) {
    setBusyId(id);
    try {
      await api(`/admin/content/${id}/archive`, { method: 'PATCH' });
      await loadCurriculum();
    } finally {
      setBusyId(null);
    }
  }

  async function createLicense(e: React.FormEvent) {
    e.preventDefault();
    await api('/admin/licenses', {
      method: 'POST',
      body: JSON.stringify({ rightsHolder, attributionText, status: 'cleared' }),
    });
    setRightsHolder('');
    setAttributionText('');
    await loadOps();
  }

  async function review(id: string, status: string) {
    await api(`/admin/moderation/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
    await loadOps();
  }

  function setTab(next: Tab) {
    setParams(next === 'all' ? {} : { tab: next });
  }

  if (!items) return <LoadingBlock />;

  return (
    <div>
      <PageHeader
        title="Content & Curriculum"
        subtitle="Create, manage, and distribute learning items across levels."
        actions={
          <div className="flex flex-wrap gap-2">
            <Select value={langFilter} onChange={(e) => setLangFilter(e.target.value)} className="w-36">
              <option value="all">Language: All</option>
              {APP_LANGUAGES.map((l) => (
                <option key={l} value={l}>{l.toUpperCase()}</option>
              ))}
            </Select>
            <Select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)} className="w-36">
              <option value="all">Level: A1-C2</option>
              {['a1', 'a2', 'b1', 'b2', 'c1', 'c2'].map((l) => (
                <option key={l} value={l}>{l.toUpperCase()}</option>
              ))}
            </Select>
            <Button onClick={() => setShowForm((v) => !v)}>
              <Plus className="size-4" /> Add Content
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Items" value={formatNumber(stats.total)} icon={<BookOpen className="size-5" />} />
        <StatCard label="Published" value={formatNumber(stats.published)} accent="bg-emerald-50 text-emerald-700" />
        <StatCard label="Draft" value={formatNumber(stats.draft)} accent="bg-slate-100 text-slate-700" />
        <StatCard label="Under Review" value={formatNumber(stats.review)} accent="bg-orange-50 text-orange-700" />
      </div>

      {showForm && (
        <Card className="p-5 mb-4">
          <form className="grid gap-3 max-w-3xl" onSubmit={createContent}>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" required />
            <div className="grid grid-cols-2 gap-3">
              <Select value={language} onChange={(e) => setLanguage(e.target.value)}>
                {APP_LANGUAGES.map((l) => (
                  <option key={l} value={l}>{l.toUpperCase()}</option>
                ))}
              </Select>
              <Select value={cefrLevel} onChange={(e) => setCefrLevel(e.target.value)}>
                {['a1', 'a2', 'b1', 'b2', 'c1', 'c2'].map((l) => (
                  <option key={l} value={l}>{l.toUpperCase()}</option>
                ))}
              </Select>
            </div>
            <Textarea rows={7} value={plainText} onChange={(e) => setPlainText(e.target.value)} placeholder="Plain text content" required />
            <div className="flex gap-2">
              <Button type="submit">Create draft</Button>
              <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-3 border-b border-slate-100">
          <div className="flex gap-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  'px-3 py-2.5 text-sm font-semibold border-b-2 -mb-px transition',
                  tab === t.id
                    ? 'border-[#6c1d95] text-[#6c1d95]'
                    : 'border-transparent text-slate-500 hover:text-slate-800',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <Input
            className="max-w-xs mb-2"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search curriculum..."
          />
        </div>

        {tab !== 'user_imports' ? (
          <DataTable headers={['Curriculum Item', 'Language', 'Level', 'Type', 'Word Count', 'Active Reads', 'Completion', 'Status', 'Actions']}>
            {filtered.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3 text-sm font-semibold max-w-[240px] truncate">{item.title}</td>
                <td className="px-4 py-3">
                  <Badge className={langBadge[item.language] ?? 'bg-slate-100 text-slate-600'}>
                    {item.language.toUpperCase()}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge className={levelBadgeClass(item.cefrLevel)}>{item.cefrLevel.toUpperCase()}</Badge>
                </td>
                <td className="px-4 py-3 text-sm capitalize">{item.contentType.replace('_', ' ')}</td>
                <td className="px-4 py-3 text-sm">{formatNumber(item.wordCount)}</td>
                <td className="px-4 py-3 text-sm">{formatNumber(item.activeReads)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 min-w-[110px]">
                    <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full bg-sky-600" style={{ width: `${item.completion}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-slate-600">{item.completion}%</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge className={statusBadge[item.publishStatus] ?? statusBadge.draft}>
                    {item.publishStatus === 'review' ? 'Review' : item.publishStatus[0].toUpperCase() + item.publishStatus.slice(1)}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    {item.publishStatus !== 'published' && item.publishStatus !== 'archived' && (
                      <Button variant="ghost" disabled={busyId === item.id} onClick={() => publish(item.id)}>
                        Publish
                      </Button>
                    )}
                    {item.publishStatus !== 'archived' && (
                      <button
                        type="button"
                        className="text-slate-400 hover:text-rose-500 disabled:opacity-40"
                        aria-label="Archive"
                        disabled={busyId === item.id}
                        onClick={() => archive(item.id)}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        ) : (
          <div className="p-4 space-y-6">
            <section>
              <div className="font-semibold mb-1">Moderation queue</div>
              <div className="text-sm text-slate-500 mb-3">Review user imports awaiting approval (Figma: User Imports).</div>
              {moderation.length === 0 ? (
                <Card className="p-6 text-center text-sm text-slate-500">No pending moderation items.</Card>
              ) : (
                <div className="space-y-3">
                  {moderation.map((item) => (
                    <Card key={item.id} className="p-4 flex items-center justify-between gap-3">
                      <div className="text-sm font-medium">{item.reason}</div>
                      <div className="flex gap-2">
                        <Button onClick={() => review(item.id, 'approved')}>Approve</Button>
                        <Button variant="danger" onClick={() => review(item.id, 'rejected')}>Reject</Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </section>

            <section>
              <div className="font-semibold mb-1">Ingestion jobs</div>
              <div className="text-sm text-slate-500 mb-3">Background processing for imports and feeds.</div>
              <DataTable headers={['Type', 'Status', 'Attempts', 'Error']}>
                {ingestion.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 text-sm">{item.sourceType}</td>
                    <td className="px-4 py-3 text-sm capitalize">{item.status}</td>
                    <td className="px-4 py-3 text-sm">{item.attempts}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{item.errorMessage ?? '—'}</td>
                  </tr>
                ))}
              </DataTable>
              {ingestion.length === 0 && (
                <div className="px-4 py-6 text-sm text-slate-500">No ingestion jobs yet.</div>
              )}
            </section>

            <section>
              <div className="font-semibold mb-1">Licenses</div>
              <div className="text-sm text-slate-500 mb-3">Rights registry for curated / licensed curriculum.</div>
              <Card className="p-4 mb-3">
                <form className="grid gap-3 md:grid-cols-[1fr_1fr_auto]" onSubmit={createLicense}>
                  <Input value={rightsHolder} onChange={(e) => setRightsHolder(e.target.value)} placeholder="Rights holder" required />
                  <Input value={attributionText} onChange={(e) => setAttributionText(e.target.value)} placeholder="Attribution text" required />
                  <Button type="submit">Add license</Button>
                </form>
              </Card>
              <DataTable headers={['Holder', 'Status', 'Attribution']}>
                {licenses.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 text-sm font-medium">{item.rightsHolder}</td>
                    <td className="px-4 py-3"><Badge className="bg-violet-50 text-[#6c1d95]">{item.status}</Badge></td>
                    <td className="px-4 py-3 text-sm text-slate-500">{item.attributionText}</td>
                  </tr>
                ))}
              </DataTable>
            </section>
          </div>
        )}
      </Card>
    </div>
  );
}
