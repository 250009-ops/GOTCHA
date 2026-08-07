import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Clipboard,
  Clock,
  ExternalLink,
  FileText,
  Globe,
  Info,
  Link,
  Loader2,
  Trash2,
  Upload,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { EmptyState } from '../components/EmptyState';
import { Button } from '../components/ui/button';
import { cn } from '../components/ui/utils';
import { api } from '../lib/api';

interface ImportItem {
  id: string;
  title: string;
  importType: string;
  ingestionStatus: string;
  language: string;
  createdAt: string;
  sourceUrl?: string | null;
  errorMessage?: string | null;
  content?: { id: string; title: string; wordCount?: number | null } | null;
}

interface ImportListResponse {
  items: ImportItem[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

const PAGE_SIZE = 8;
const MIN_PASTE_WORDS = 50;

const langOptions = [
  { value: 'en', label: 'English', flag: '🇬🇧' },
  { value: 'ru', label: 'Russian', flag: '🇷🇺' },
  { value: 'uz', label: 'Uzbek', flag: '🇺🇿' },
];

type ImportTab = 'url' | 'paste' | 'pdf';

function formatWordCount(count: number) {
  return `${count.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} words`;
}

function statusBadge(status: string) {
  switch (status) {
    case 'ready':
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#007a55] bg-[#ecfdf5] border border-[#a4f4cf] rounded-full px-2 py-0.5 shrink-0">
          <CheckCircle2 className="w-3 h-3" />Ready
        </span>
      );
    case 'processing':
    case 'tokenizing':
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#1447e6] bg-[#eff6ff] border border-[#bedbff] rounded-full px-2 py-0.5 shrink-0">
          <Loader2 className="w-3 h-3 animate-spin" />Processing
        </span>
      );
    case 'queued':
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#bb4d00] bg-[#fffbeb] border border-[#fee685] rounded-full px-2 py-0.5 shrink-0">
          <Clock className="w-3 h-3" />Queued
        </span>
      );
    case 'failed':
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#c10007] bg-[#fef2f2] border border-[#ffc9c9] rounded-full px-2 py-0.5 shrink-0">
          <AlertCircle className="w-3 h-3" />Failed
        </span>
      );
    default:
      return <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 bg-gray-50 border border-gray-200 rounded-full px-2 py-0.5 capitalize shrink-0">{status}</span>;
  }
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function LangSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="py-4">
      <label className="block text-xs font-semibold text-[#4a5565] mb-1.5">Language</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-10 pl-3 pr-8 bg-white border border-[#e5e7eb] rounded-[14px] text-sm text-[#364153] outline-none focus:ring-2 focus:ring-violet-200 focus:border-[#7f22fe] appearance-none transition-all"
        >
          {langOptions.map((l) => (
            <option key={l.value} value={l.value}>{l.flag} {l.label}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
      </div>
    </div>
  );
}

function SubmitButton({ children, icon: Icon, disabled, onClick }: { children: React.ReactNode; icon: React.ElementType; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full h-10 rounded-[14px] bg-[#7f22fe] hover:bg-[#7008e7] disabled:opacity-50 disabled:pointer-events-none text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors"
    >
      <Icon className="w-4 h-4" />{children}
    </button>
  );
}

function URLForm({ loading, onSubmit }: { loading: boolean; onSubmit: (data: { url: string; title: string; lang: string }) => void }) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [lang, setLang] = useState('en');
  const valid = url.startsWith('http');

  return (
    <div>
      <div>
        <label className="block text-xs font-semibold text-[#4a5565] mb-1.5">URL</label>
        <div className="relative">
          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/article"
            className="w-full pl-9 pr-4 h-10 bg-white border border-[#e5e7eb] rounded-[14px] text-sm outline-none focus:ring-2 focus:ring-violet-200 focus:border-[#7f22fe] transition-all"
          />
        </div>
        <p className="text-xs text-[#99a1af] mt-1">Works with most news sites, blogs, and articles. Paywalled content is not supported.</p>
      </div>
      <div className="pt-4">
        <label className="block text-xs font-semibold text-[#4a5565] mb-1.5">Title <span className="font-normal text-[#99a1af]">(optional)</span></label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Auto-detected from page"
          className="w-full px-3 h-10 bg-white border border-[#e5e7eb] rounded-[14px] text-sm outline-none focus:ring-2 focus:ring-violet-200 focus:border-[#7f22fe] transition-all"
        />
      </div>
      <LangSelect value={lang} onChange={setLang} />
      <SubmitButton icon={Link} disabled={!valid || loading} onClick={() => onSubmit({ url, title, lang })}>
        Import from URL
      </SubmitButton>
    </div>
  );
}

function PasteForm({ loading, onSubmit }: { loading: boolean; onSubmit: (data: { text: string; title: string; lang: string }) => void }) {
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [lang, setLang] = useState('en');
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const valid = words >= MIN_PASTE_WORDS && title.trim().length > 0;

  return (
    <div>
      <div>
        <label className="block text-xs font-semibold text-[#4a5565] mb-1.5">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="My text"
          className="w-full px-3 h-10 bg-white border border-[#e5e7eb] rounded-[14px] text-sm outline-none focus:ring-2 focus:ring-violet-200 focus:border-[#7f22fe] transition-all"
        />
      </div>
      <div className="pt-4">
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-semibold text-[#4a5565]">Text</label>
          <span className={cn('text-xs tabular-nums', words < MIN_PASTE_WORDS ? 'text-[#99a1af]' : 'text-emerald-600 font-medium')}>{words} words</span>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Paste your text here… (minimum ${MIN_PASTE_WORDS} words)`}
          rows={8}
          className="w-full px-3 py-2.5 bg-white border border-[#e5e7eb] rounded-[14px] text-sm resize-none outline-none focus:ring-2 focus:ring-violet-200 focus:border-[#7f22fe] transition-all"
        />
      </div>
      <LangSelect value={lang} onChange={setLang} />
      <SubmitButton icon={Clipboard} disabled={!valid || loading} onClick={() => onSubmit({ text, title, lang })}>
        Import Text
      </SubmitButton>
    </div>
  );
}

function FileForm() {
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [lang, setLang] = useState('en');

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        className={cn(
          'border-[1.6px] border-dashed rounded-[14px] p-8 text-center cursor-pointer transition-all flex flex-col items-center',
          file ? 'border-violet-300 bg-violet-50' : 'border-[#e5e7eb] hover:border-violet-300 hover:bg-violet-50/50',
        )}
      >
        <input ref={inputRef} type="file" accept=".pdf,.epub" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        {file ? (
          <>
            <FileText className="w-8 h-8 text-violet-500 mb-2" />
            <div className="font-medium text-gray-700 text-sm">{file.name}</div>
            <div className="text-[#99a1af] text-xs mt-0.5">{(file.size / 1024).toFixed(0)} KB</div>
          </>
        ) : (
          <>
            <Upload className="w-8 h-8 text-gray-300 mb-2" />
            <div className="text-sm text-[#6a7282]">Drop a PDF or ePub here, or <span className="text-[#7f22fe] font-medium">browse</span></div>
            <div className="text-xs text-[#99a1af] mt-1">Max 10 MB · PDF and EPUB supported</div>
          </>
        )}
      </div>
      <div className="flex items-start gap-2 p-3 mt-4 bg-[#fffbeb] border border-[#fee685] rounded-[14px]">
        <Info className="w-4 h-4 text-[#bb4d00] shrink-0 mt-0.5" />
        <p className="text-xs text-[#bb4d00]">File upload is coming soon. Use URL or paste text for now.</p>
      </div>
      <LangSelect value={lang} onChange={setLang} />
      <SubmitButton icon={Upload} disabled onClick={() => undefined}>
        Upload File
      </SubmitButton>
    </div>
  );
}

function ImportLogoMark() {
  return (
    <div className="bg-[#2107aa] w-9 h-9 rounded-[14px] flex items-center justify-center shrink-0">
      <span className="font-brand text-white text-lg leading-none">G</span>
    </div>
  );
}

export default function ImportPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<ImportTab>('url');
  const [imports, setImports] = useState<ImportItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = (pageToLoad = 1) =>
    api<ImportListResponse>(`/imports?page=${pageToLoad}&pageSize=${PAGE_SIZE}`).then((res) => {
      setImports(res.items);
      setTotal(res.total);
      setPage(res.page);
      setHasMore(res.hasMore);
    });

  useEffect(() => {
    void load(1).finally(() => setHistoryLoading(false));
  }, []);

  const handleUrlImport = async (data: { url: string; title: string; lang: string }) => {
    setLoading(true);
    try {
      await api('/imports/url', {
        method: 'POST',
        body: JSON.stringify({ url: data.url, language: data.lang, title: data.title || undefined }),
      });
      toast.success('Import queued! We\'ll process it in a moment.');
      await load(1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePasteImport = async (data: { text: string; title: string; lang: string }) => {
    setLoading(true);
    try {
      await api('/imports/paste', {
        method: 'POST',
        body: JSON.stringify({ title: data.title, text: data.text, language: data.lang }),
      });
      toast.success('Import submitted');
      await load(1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (item: ImportItem) => {
    setDeletingId(item.id);
    try {
      await api(`/imports/${item.id}`, { method: 'DELETE' });
      toast.success('Import removed from history');
      await load(page);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete import');
    } finally {
      setDeletingId(null);
    }
  };

  const tabs: { key: ImportTab; label: string; icon: React.ElementType }[] = [
    { key: 'url', label: 'URL', icon: Link },
    { key: 'paste', label: 'Paste text', icon: Clipboard },
    { key: 'pdf', label: 'PDF / EPUB', icon: FileText },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 lg:py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Import Content</h1>
        <p className="text-[#99a1af] text-sm mt-0.5">Add your own texts — articles, books, or any text you want to read and learn from.</p>
      </div>

      <div className="grid lg:grid-cols-[420px_1fr] gap-6 lg:gap-8 items-start">
        <div className="bg-white rounded-2xl border border-[#f3f4f6] overflow-hidden">
          <div className="flex border-b border-[#f3f4f6]">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold border-b-2 transition-all',
                  tab === t.key ? 'border-[#7f22fe] text-[#7008e7] bg-[rgba(245,243,255,0.5)]' : 'border-transparent text-[#99a1af] hover:text-gray-600 hover:bg-gray-50',
                )}
              >
                <t.icon className="w-3.5 h-3.5" />{t.label}
              </button>
            ))}
          </div>
          <div className="p-5">
            {tab === 'url' && <URLForm loading={loading} onSubmit={handleUrlImport} />}
            {tab === 'paste' && <PasteForm loading={loading} onSubmit={handlePasteImport} />}
            {tab === 'pdf' && <FileForm />}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900 text-xl">Import History</h2>
            <span className="text-xs text-[#99a1af]">{total} import{total !== 1 ? 's' : ''}</span>
          </div>

          {historyLoading ? (
            <div className="py-16 text-center text-gray-400 text-sm">Loading history…</div>
          ) : imports.length === 0 ? (
            <EmptyState
              icon={Upload}
              title="No imports yet"
              description="Paste text or import from a URL to build your personal reading library."
              compact
            />
          ) : (
            <div className="space-y-3">
              {imports.map((item) => {
                const showActions = item.ingestionStatus === 'ready' || item.ingestionStatus === 'failed';
                return (
                  <div key={item.id} className="bg-white rounded-2xl border border-[#f3f4f6] p-4 hover:border-violet-200 transition-colors">
                    <div className="flex items-start gap-3">
                      <ImportLogoMark />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-900 text-sm truncate">{item.title}</div>
                            {item.sourceUrl && <div className="text-xs text-[#99a1af] truncate mt-0.5">{item.sourceUrl}</div>}
                          </div>
                          {statusBadge(item.ingestionStatus)}
                        </div>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs text-[#99a1af]">{relativeTime(item.createdAt)}</span>
                          {!!item.content?.wordCount && item.content.wordCount > 0 && (
                            <span className="text-xs text-[#99a1af]">{formatWordCount(item.content.wordCount)}</span>
                          )}
                          {item.ingestionStatus === 'failed' && item.errorMessage && (
                            <span className="text-xs text-[#fb2c36] truncate">{item.errorMessage}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {showActions && (
                      <div className="mt-3 flex items-center gap-2 pt-3 border-t border-[#f9fafb]">
                        {item.ingestionStatus === 'ready' && item.content?.id && (
                          <button
                            type="button"
                            onClick={() => navigate(`/app/read/${item.content!.id}`)}
                            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-[14px] border border-black/10 bg-white text-[#0a0a0a] text-xs font-medium hover:bg-gray-50"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />Read
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={deletingId === item.id}
                          onClick={() => void handleDelete(item)}
                          className="ml-auto inline-flex items-center gap-1.5 h-7 px-2.5 rounded-[14px] text-[#ff6467] hover:bg-red-50 text-xs font-medium disabled:opacity-50"
                        >
                          {deletingId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {(page > 1 || hasMore) && (
                <div className="flex items-center justify-between pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl text-xs"
                    disabled={page <= 1}
                    onClick={() => void load(page - 1)}
                  >
                    Previous
                  </Button>
                  <span className="text-xs text-gray-400">Page {page} of {Math.max(1, Math.ceil(total / PAGE_SIZE))}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl text-xs"
                    disabled={!hasMore}
                    onClick={() => void load(page + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
