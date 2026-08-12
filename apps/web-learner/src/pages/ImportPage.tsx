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
import { quoteImport } from '../lib/importBilling';

interface ImportItem {
  id: string;
  title: string;
  importType: string;
  ingestionStatus: string;
  language: string;
  createdAt: string;
  sourceUrl?: string | null;
  errorMessage?: string | null;
  progressPagesDone?: number | null;
  progressPagesTotal?: number | null;
  content?: { id: string; title: string; wordCount?: number | null } | null;
}

interface ImportListResponse {
  items: ImportItem[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  importLimit?: number | null;
  importRemaining?: number | null;
  importsUnlimited?: boolean;
}

const PAGE_SIZE = 8;
const MIN_PASTE_WORDS = 50;
const MAX_PASTE_CHARS = 5_000_000;
const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_FILE_MB = Math.round(MAX_FILE_BYTES / (1024 * 1024));
const ACCEPTED_EXT = ['.pdf', '.epub'];

const langOptions = [
  { value: 'en', label: 'English', flag: '🇬🇧' },
  { value: 'ru', label: 'Russian', flag: '🇷🇺' },
  { value: 'uz', label: 'Uzbek', flag: '🇺🇿' },
];

type ImportTab = 'url' | 'paste' | 'pdf';

function formatWordCount(count: number) {
  return `${count.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} words`;
}

function isPendingStatus(status: string) {
  return status === 'queued' || status === 'processing' || status === 'tokenizing';
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

function LangSelect({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div className="py-4">
      <label className="block text-xs font-semibold text-[#4a5565] mb-1.5">Language</label>
      <div className="relative">
        <select
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-10 pl-3 pr-8 bg-white border border-[#e5e7eb] rounded-[14px] text-sm text-[#364153] outline-none focus:ring-2 focus:ring-violet-200 focus:border-[#7f22fe] appearance-none transition-all disabled:opacity-50"
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

function SubmitButton({
  children,
  icon: Icon,
  disabled,
  loading,
  onClick,
}: {
  children: React.ReactNode;
  icon: React.ElementType;
  disabled?: boolean;
  loading?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="w-full h-10 rounded-[14px] bg-[#7f22fe] hover:bg-[#7008e7] disabled:opacity-50 disabled:pointer-events-none text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
      {children}
    </button>
  );
}

function URLForm({ loading, onSubmit }: { loading: boolean; onSubmit: (data: { url: string; title: string; lang: string }) => void }) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [lang, setLang] = useState('en');
  const valid = /^https?:\/\//i.test(url.trim());

  return (
    <div>
      <div>
        <label className="block text-xs font-semibold text-[#4a5565] mb-1.5">URL</label>
        <div className="relative">
          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="url"
            value={url}
            disabled={loading}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/article"
            className="w-full pl-9 pr-4 h-10 bg-white border border-[#e5e7eb] rounded-[14px] text-sm outline-none focus:ring-2 focus:ring-violet-200 focus:border-[#7f22fe] transition-all disabled:opacity-50"
          />
        </div>
        <p className="text-xs text-[#99a1af] mt-1">Works with Wikipedia, public articles, blogs, and .txt URLs. Paywalled or login-gated pages will fail with a clear error.</p>
      </div>
      <div className="pt-4">
        <label className="block text-xs font-semibold text-[#4a5565] mb-1.5">Title <span className="font-normal text-[#99a1af]">(optional)</span></label>
        <input
          type="text"
          value={title}
          disabled={loading}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Auto-detected from page"
          className="w-full px-3 h-10 bg-white border border-[#e5e7eb] rounded-[14px] text-sm outline-none focus:ring-2 focus:ring-violet-200 focus:border-[#7f22fe] transition-all disabled:opacity-50"
        />
      </div>
      <LangSelect value={lang} onChange={setLang} disabled={loading} />
      <SubmitButton icon={Link} disabled={!valid} loading={loading} onClick={() => onSubmit({ url: url.trim(), title, lang })}>
        {loading ? 'Importing…' : 'Import from URL'}
      </SubmitButton>
    </div>
  );
}

function PasteForm({ loading, onSubmit }: { loading: boolean; onSubmit: (data: { text: string; title: string; lang: string }) => void }) {
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [lang, setLang] = useState('en');
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const tooLong = text.length > MAX_PASTE_CHARS;
  const valid = words >= MIN_PASTE_WORDS && title.trim().length > 0 && !tooLong;

  return (
    <div>
      <div>
        <label className="block text-xs font-semibold text-[#4a5565] mb-1.5">Title</label>
        <input
          type="text"
          value={title}
          disabled={loading}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="My text"
          className="w-full px-3 h-10 bg-white border border-[#e5e7eb] rounded-[14px] text-sm outline-none focus:ring-2 focus:ring-violet-200 focus:border-[#7f22fe] transition-all disabled:opacity-50"
        />
      </div>
      <div className="pt-4">
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-semibold text-[#4a5565]">Text</label>
          <span className={cn('text-xs tabular-nums', words < MIN_PASTE_WORDS || tooLong ? 'text-[#99a1af]' : 'text-emerald-600 font-medium')}>
            {words.toLocaleString()} words
          </span>
        </div>
        <textarea
          value={text}
          disabled={loading}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Paste your text here… (minimum ${MIN_PASTE_WORDS} words; long texts are split into reader pages)`}
          rows={8}
          className="w-full px-3 py-2.5 bg-white border border-[#e5e7eb] rounded-[14px] text-sm resize-none outline-none focus:ring-2 focus:ring-violet-200 focus:border-[#7f22fe] transition-all disabled:opacity-50"
        />
        {words > 0 && words < MIN_PASTE_WORDS && (
          <p className="text-xs text-amber-600 mt-1">{MIN_PASTE_WORDS - words} more words needed</p>
        )}
        {tooLong && (
          <p className="text-xs text-[#c10007] mt-1">
            Text exceeds the {MAX_PASTE_CHARS.toLocaleString()}-character maximum. Split into multiple imports.
          </p>
        )}
      </div>
      <LangSelect value={lang} onChange={setLang} disabled={loading} />
      <SubmitButton icon={Clipboard} disabled={!valid} loading={loading} onClick={() => onSubmit({ text, title, lang })}>
        {loading ? 'Importing…' : 'Import Text'}
      </SubmitButton>
    </div>
  );
}

function FileForm({ loading, onSubmit }: { loading: boolean; onSubmit: (data: { file: File; title: string; lang: string }) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [lang, setLang] = useState('en');
  const [dragOver, setDragOver] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFile = (next: File | null) => {
    setFileError(null);
    if (!next) {
      setFile(null);
      return;
    }
    const lower = next.name.toLowerCase();
    const okExt = ACCEPTED_EXT.some((ext) => lower.endsWith(ext));
    if (!okExt) {
      setFile(null);
      setFileError('Only PDF and EPUB files are supported');
      return;
    }
    if (next.size > MAX_FILE_BYTES) {
      setFile(null);
      setFileError(`File exceeds the ${MAX_FILE_MB} MB limit`);
      return;
    }
    setFile(next);
    if (!title.trim()) {
      setTitle(next.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim());
    }
  };

  const valid = !!file && !fileError;

  return (
    <div>
      <div
        onClick={() => !loading && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); if (!loading) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (loading) return;
          validateFile(e.dataTransfer.files?.[0] ?? null);
        }}
        className={cn(
          'border-[1.6px] border-dashed rounded-[14px] p-8 text-center cursor-pointer transition-all flex flex-col items-center',
          dragOver || file ? 'border-violet-300 bg-violet-50' : 'border-[#e5e7eb] hover:border-violet-300 hover:bg-violet-50/50',
          loading && 'opacity-50 pointer-events-none',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.epub,application/pdf,application/epub+zip"
          className="hidden"
          disabled={loading}
          onChange={(e) => validateFile(e.target.files?.[0] ?? null)}
        />
        {file ? (
          <>
            <FileText className="w-8 h-8 text-violet-500 mb-2" />
            <div className="font-medium text-gray-700 text-sm">{file.name}</div>
            <div className="text-[#99a1af] text-xs mt-0.5">{(file.size / 1024).toFixed(0)} KB · click to change</div>
          </>
        ) : (
          <>
            <Upload className="w-8 h-8 text-gray-300 mb-2" />
            <div className="text-sm text-[#6a7282]">Drop a PDF or ePub here, or <span className="text-[#7f22fe] font-medium">browse</span></div>
            <div className="text-xs text-[#99a1af] mt-1">Max {MAX_FILE_MB} MB · PDF and EPUB</div>
          </>
        )}
      </div>
      {fileError && (
        <p className="text-xs text-[#c10007] mt-2 flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />{fileError}
        </p>
      )}
      <div className="flex items-start gap-2 p-3 mt-4 bg-[#eff6ff] border border-[#bedbff] rounded-[14px]">
        <Info className="w-4 h-4 text-[#1447e6] shrink-0 mt-0.5" />
        <p className="text-xs text-[#1447e6]">
          Text PDFs extract up to ~500 pages. Scanned PDFs use chunked OCR (English best; Russian/Uzbek less accurate). Large files process in the background — watch progress in history. Password-protected PDFs are not supported.
        </p>
      </div>
      <div className="pt-4">
        <label className="block text-xs font-semibold text-[#4a5565] mb-1.5">Title <span className="font-normal text-[#99a1af]">(optional)</span></label>
        <input
          type="text"
          value={title}
          disabled={loading}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Auto from filename"
          className="w-full px-3 h-10 bg-white border border-[#e5e7eb] rounded-[14px] text-sm outline-none focus:ring-2 focus:ring-violet-200 focus:border-[#7f22fe] transition-all disabled:opacity-50"
        />
      </div>
      <LangSelect value={lang} onChange={setLang} disabled={loading} />
      <SubmitButton
        icon={Upload}
        disabled={!valid}
        loading={loading}
        onClick={() => file && onSubmit({ file, title, lang })}
      >
        {loading ? 'Uploading…' : 'Upload File'}
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
  const [importLimit, setImportLimit] = useState<number | null>(null);
  const [importRemaining, setImportRemaining] = useState<number | null>(null);
  const [importsUnlimited, setImportsUnlimited] = useState(false);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Reflects the real PAYMENT_GATEWAY_ENABLED state instead of hardcoded Atmos copy
  // (see docs/E2E_AUDIT_REPORT.md's stale-paid-import-messaging finding).
  const [gatewayEnabled, setGatewayEnabled] = useState(false);

  const atImportLimit = !importsUnlimited && importRemaining !== null && importRemaining <= 0;

  const load = (pageToLoad = 1) =>
    api<ImportListResponse>(`/imports?page=${pageToLoad}&pageSize=${PAGE_SIZE}`).then((res) => {
      setImports(res.items);
      setTotal(res.total);
      setPage(res.page);
      setHasMore(res.hasMore);
      setImportLimit(res.importLimit ?? null);
      setImportRemaining(res.importRemaining ?? null);
      setImportsUnlimited(!!res.importsUnlimited);
      return res;
    });

  useEffect(() => {
    void load(1).finally(() => setHistoryLoading(false));
    quoteImport({ importType: 'paste', wordCount: 0 })
      .then((q) => setGatewayEnabled(q.gatewayEnabled))
      .catch(() => undefined);
  }, []);

  // Poll while any import is still processing
  useEffect(() => {
    const pending = imports.some((i) => isPendingStatus(i.ingestionStatus));
    if (!pending) return;
    const id = window.setInterval(() => {
      void load(page).catch(() => undefined);
    }, 2500);
    return () => window.clearInterval(id);
  }, [imports, page]);

  const toastReady = (item: ImportItem) => {
    const contentId = item.content?.id;
    if (item.ingestionStatus === 'ready' && contentId) {
      toast.success('Import ready to read', {
        action: {
          label: 'Read',
          onClick: () => navigate(`/app/read/${contentId}`),
        },
      });
      return;
    }
    if (item.ingestionStatus === 'failed') {
      toast.error(item.errorMessage || 'Import failed');
      return;
    }
    toast.success('Import submitted');
  };

  const guardLimit = () => {
    if (!atImportLimit) return true;
    toast.error(
      importLimit
        ? `Import limit reached (${importLimit}). Delete an import or pay for a new import.`
        : 'Import limit reached. Delete an import or pay for a new import.',
    );
    return false;
  };

  const confirmPay = async (quote: { amountUzs: number; estimatedPages: number; tier: { label: string } | null }) => {
    const { formatUzs } = await import('../lib/importBilling');
    return window.confirm(
      `This import is ~${quote.estimatedPages} pages (${quote.tier?.label ?? 'custom'}).\n` +
        `Pay ${formatUzs(quote.amountUzs)} via Atmos to continue?`,
    );
  };

  const handleUrlImport = async (data: { url: string; title: string; lang: string }) => {
    if (!guardLimit()) return;
    setLoading(true);
    try {
      const { quoteImport, checkoutImport, savePendingImport } = await import('../lib/importBilling');
      const quote = await quoteImport({ importType: 'url', contentFormat: 'article', textLength: 6000 });
      let paymentId: string | null = null;
      if (quote.gatewayEnabled) {
        if (quote.requiresPayment && !(await confirmPay(quote))) {
          throw new Error('Payment cancelled');
        }
        const checkout = await checkoutImport({ importType: 'url', contentFormat: 'article', textLength: 6000 });
        paymentId = checkout.paymentId;
        if (checkout.paymentUrl) {
          savePendingImport({
            kind: 'url',
            paymentId: checkout.paymentId,
            url: data.url,
            title: data.title,
            lang: data.lang,
          });
          window.location.href = checkout.paymentUrl;
          return;
        }
      }
      const item = await api<ImportItem>('/imports/url', {
        method: 'POST',
        body: JSON.stringify({
          url: data.url,
          language: data.lang,
          title: data.title || undefined,
          ...(paymentId ? { paymentId } : {}),
        }),
      });
      toastReady(item);
      await load(1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePasteImport = async (data: { text: string; title: string; lang: string }) => {
    if (!guardLimit()) return;
    setLoading(true);
    try {
      const { quoteImport, checkoutImport, savePendingImport, wordCountOf } = await import('../lib/importBilling');
      const words = wordCountOf(data.text);
      const quote = await quoteImport({
        importType: 'paste',
        contentFormat: 'article',
        textLength: data.text.length,
        wordCount: words,
      });
      let paymentId: string | null = null;
      if (quote.gatewayEnabled) {
        if (quote.requiresPayment && !(await confirmPay(quote))) {
          throw new Error('Payment cancelled');
        }
        const checkout = await checkoutImport({
          importType: 'paste',
          contentFormat: 'article',
          textLength: data.text.length,
          wordCount: words,
        });
        paymentId = checkout.paymentId;
        if (checkout.paymentUrl) {
          savePendingImport({
            kind: 'paste',
            paymentId: checkout.paymentId,
            title: data.title,
            text: data.text,
            lang: data.lang,
          });
          window.location.href = checkout.paymentUrl;
          return;
        }
      }
      const item = await api<ImportItem>('/imports/paste', {
        method: 'POST',
        body: JSON.stringify({
          title: data.title,
          text: data.text,
          language: data.lang,
          ...(paymentId ? { paymentId } : {}),
        }),
      });
      toastReady(item);
      await load(1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  const handleFileImport = async (data: { file: File; title: string; lang: string }) => {
    if (!guardLimit()) return;
    setLoading(true);
    try {
      const { quoteImport, checkoutImport, savePendingImport } = await import('../lib/importBilling');
      const isEpub = data.file.name.toLowerCase().endsWith('.epub');
      const importType = isEpub ? 'epub' : 'pdf';
      // Rough page estimate from size until server OCR reports real pages (~50KB/page).
      const pageCount = Math.max(1, Math.min(500, Math.ceil(data.file.size / 50_000)));
      const quote = await quoteImport({
        importType,
        contentFormat: 'ebook',
        pageCount,
      });
      let paymentId: string | null = null;
      if (quote.gatewayEnabled) {
        if (quote.requiresPayment && !(await confirmPay(quote))) {
          throw new Error('Payment cancelled');
        }
        const checkout = await checkoutImport({
          importType,
          contentFormat: 'ebook',
          pageCount,
        });
        paymentId = checkout.paymentId;
        if (checkout.paymentUrl) {
          const MAX_INLINE = 1.5 * 1024 * 1024;
          if (data.file.size <= MAX_INLINE) {
            const buf = await data.file.arrayBuffer();
            const bytes = new Uint8Array(buf);
            let binary = '';
            for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
            savePendingImport({
              kind: 'file',
              paymentId: checkout.paymentId,
              fileName: data.file.name,
              fileType: data.file.type,
              fileBase64: btoa(binary),
              title: data.title,
              lang: data.lang,
            });
          } else {
            savePendingImport({
              kind: 'file',
              paymentId: checkout.paymentId,
              fileName: data.file.name,
              fileType: data.file.type,
              title: data.title,
              lang: data.lang,
              needsReupload: true,
            });
            sessionStorage.setItem('gotcha_paid_payment_id', checkout.paymentId);
          }
          window.location.href = checkout.paymentUrl;
          return;
        }
      }
      const form = new FormData();
      form.append('file', data.file);
      form.append('language', data.lang);
      if (data.title.trim()) form.append('title', data.title.trim());
      if (paymentId) form.append('paymentId', paymentId);
      const item = await api<ImportItem>('/imports/file', {
        method: 'POST',
        body: form,
      });
      toastReady(item);
      await load(1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (item: ImportItem) => {
    setDeletingId(item.id);
    try {
      await api(`/imports/${item.id}`, { method: 'DELETE' });
      toast.success('Import removed from history');
      const nextPage = imports.length === 1 && page > 1 ? page - 1 : page;
      await load(nextPage);
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
                disabled={loading}
                onClick={() => setTab(t.key)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold border-b-2 transition-all disabled:opacity-60',
                  tab === t.key ? 'border-[#7f22fe] text-[#7008e7] bg-[rgba(245,243,255,0.5)]' : 'border-transparent text-[#99a1af] hover:text-gray-600 hover:bg-gray-50',
                )}
              >
                <t.icon className="w-3.5 h-3.5" />{t.label}
              </button>
            ))}
          </div>
          <div className="p-5">
            {atImportLimit && (
              <div className="flex items-start gap-2 p-3 mb-4 bg-[#fffbeb] border border-[#fee685] rounded-[14px]">
                <AlertCircle className="w-4 h-4 text-[#bb4d00] shrink-0 mt-0.5" />
                <p className="text-xs text-[#bb4d00]">
                  {gatewayEnabled
                    ? 'Import allowance reached. Delete an old import or pay per material size via Atmos.'
                    : 'Import allowance reached. Delete an old import to free up space — paid imports are not available right now.'}
                </p>
              </div>
            )}
            <p className="text-[11px] text-[#99a1af] mb-3">
              {gatewayEnabled
                ? 'Paid imports use page-tier prices from Admin (UZS) via Atmos. Free daily/monthly allowances still apply when enabled.'
                : 'Imports are free right now — paid imports via Atmos are currently disabled. Free daily/monthly allowances still apply when enabled.'}
            </p>
            {tab === 'url' && <URLForm loading={loading || atImportLimit} onSubmit={handleUrlImport} />}
            {tab === 'paste' && <PasteForm loading={loading || atImportLimit} onSubmit={handlePasteImport} />}
            {tab === 'pdf' && <FileForm loading={loading || atImportLimit} onSubmit={handleFileImport} />}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900 text-xl">Import History</h2>
            <span className="text-xs text-[#99a1af]">
              {importsUnlimited || importLimit == null
                ? `${total} import${total !== 1 ? 's' : ''}`
                : `${total} / ${importLimit} imports`}
            </span>
          </div>

          {historyLoading ? (
            <div className="py-16 text-center text-gray-400 text-sm flex flex-col items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading history…
            </div>
          ) : imports.length === 0 ? (
            <EmptyState
              icon={Upload}
              title="No imports yet"
              description="Paste text, import from a URL, or upload a PDF/EPUB to build your personal reading library."
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
                            <div className="text-[11px] text-[#99a1af] mt-0.5 capitalize">{item.importType.replace('_', ' ')}</div>
                          </div>
                          {statusBadge(item.ingestionStatus)}
                        </div>
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          <span className="text-xs text-[#99a1af]">{relativeTime(item.createdAt)}</span>
                          {!!item.content?.wordCount && item.content.wordCount > 0 && (
                            <span className="text-xs text-[#99a1af]">{formatWordCount(item.content.wordCount)}</span>
                          )}
                          {isPendingStatus(item.ingestionStatus) &&
                            item.progressPagesTotal != null &&
                            item.progressPagesTotal > 0 && (
                              <span className="text-xs text-[#1447e6] tabular-nums">
                                {Math.min(item.progressPagesDone ?? 0, item.progressPagesTotal)} /{' '}
                                {item.progressPagesTotal} pages
                              </span>
                            )}
                          {item.ingestionStatus === 'failed' && item.errorMessage && (
                            <span className="text-xs text-[#fb2c36] truncate max-w-full">{item.errorMessage}</span>
                          )}
                          {item.ingestionStatus === 'ready' && item.errorMessage && (
                            <span className="text-xs text-amber-600 truncate max-w-full">{item.errorMessage}</span>
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
                    disabled={page <= 1 || loading}
                    onClick={() => void load(page - 1)}
                  >
                    Previous
                  </Button>
                  <span className="text-xs text-gray-400">Page {page} of {Math.max(1, Math.ceil(total / PAGE_SIZE))}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl text-xs"
                    disabled={!hasMore || loading}
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
