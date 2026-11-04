import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { handleLimitError, paymentsEnabled, usePaymentsEnabled } from '../lib/limits';
import {
  AlertCircle,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clipboard,
  Clock,
  Copy,
  FileText,
  Globe,
  Link,
  Loader2,
  RotateCcw,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { EmptyState } from '../components/EmptyState';
import { Dialog } from '../components/ui/dialog';
import { cn } from '../components/ui/utils';
import { api } from '../lib/api';
import { formatUzs, formatFreeAllowance, inspectImportFile, type ImportQuote, type ImportFreeAllowance } from '../lib/importBilling';
import { countPdfPagesFromFile } from '../lib/pdfPageCount';
import { useCatalogLanguages } from '../lib/catalogLanguages';
import { CatalogLanguageDropdown } from '../components/CatalogLanguageDropdown';
import { useAuth } from '../lib/auth';
import { useLearnerCopy, useLearnerLocale } from '../lib/learnerLocaleContext';
import { localizeApiError, surfaceCopy } from '@gotcha/shared';
import { CardForm, OtpForm, PayTrust, CancelConfirm, CancelOutcome, runCancel, usePay } from '../components/payments';
import { refundRequestHref } from '@gotcha/shared';
import { cancelScreen } from '@gotcha/shared';

type LearnerCopy = ReturnType<typeof useLearnerCopy>;

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
  progressPhase?: 'extract' | 'ocr' | 'ai' | null;
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
  freeAllowance?: ImportFreeAllowance;
  /** payments-02: failed paid imports → free retry on the same payment, or refund-due. */
  paidImportRetry?: { freeRetries: { paymentId: string; importType: string; reason?: 'paid_late' }[]; refundDue: number };
}

const PAGE_SIZE = 8;
const MIN_PASTE_WORDS = 50;
const MAX_PASTE_CHARS = 5_000_000;
const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_FILE_MB = Math.round(MAX_FILE_BYTES / (1024 * 1024));
const ACCEPTED_EXT = ['.pdf', '.epub'];

type ImportTab = 'url' | 'paste' | 'pdf';

/** Import strings not in the shared copy yet (uz / ru / en). */
const IX = {
  en: {
    importsLeft: 'free imports left today', pagesLeft: 'free pages left this month',
    link: 'Article link', textLang: 'Text language', primary: 'Main',
    langHint: 'Your main learning language is selected. Change it if the text is in another language.',
    check: 'Check', checkNote: 'You see the title, size and price before anything is imported.',
    privateTitle: 'This is a private page.',
    privateBody: 'Gotcha cannot open Gemini, ChatGPT, Google Docs or Drive links — they need a sign-in. Copy the text and paste it under “Text”.',
    checking: 'CHECK BEFORE IMPORT', cleaned: 'Cleaned up from the file name — edit if needed',
    words: (n: number) => `${n.toLocaleString('en-US')} words`, pages: (n: number) => `~${n} pages`, lang: 'language', size: 'size',
    dupTitle: 'Already in your imports.', dupBody: (ago: string) => `Imported ${ago}.`, open: 'Open', dupCost: 'Importing again uses one more free import.',
    cost: 'Price', free: 'Free', freeOf: (n: number) => `1 of today’s ${n} free imports`, cancel: 'Cancel', confirm: 'Import', confirmAnyway: 'Import anyway',
    change: 'Change', dropHint: (mb: number) => `Up to ${mb} MB · PDF or EPUB · books are split into chapters`,
    ocrToast: 'Scanned pages found — AI is reading them. This can take a few minutes.', aiToast: 'AI is cleaning up the text. This can take a little longer.',
    ocrRow: 'AI is reading scanned pages…', aiRow: 'AI is cleaning up the text…', stuck: 'Still working — it will stop automatically if it stays stuck.',
    retry: 'Try again', delTitle: (t: string) => `Delete “${t}”?`,
    delBody: 'The book leaves your library together with your reading position. Words you saved stay in your vocabulary. A used free import is not returned.',
    yourImport: 'Your import', text: 'Text', pageOf: (p: number, n: number) => `Page ${p} of ${n}`, total: (n: number) => `${n} imports`, failedGeneric: 'Import failed. Try again or use another file.',
  },
  ru: {
    importsLeft: 'бесплатных импортов сегодня', pagesLeft: 'бесплатных страниц в этом месяце',
    link: 'Ссылка на статью', textLang: 'Язык текста', primary: 'Основной',
    langHint: 'Выбран ваш основной изучаемый язык. Измените, если текст на другом языке.',
    check: 'Проверить', checkNote: 'Перед импортом покажем название, объём и цену.',
    privateTitle: 'Это закрытая страница.',
    privateBody: 'Gotcha не может открыть ссылки Gemini, ChatGPT, Google Docs и Drive — нужен вход. Скопируйте текст и вставьте во вкладку «Текст».',
    checking: 'ПРОВЕРКА ПЕРЕД ИМПОРТОМ', cleaned: 'Очищено из имени файла — можно изменить',
    words: (n: number) => `${n.toLocaleString('ru-RU')} слов`, pages: (n: number) => `~${n} стр.`, lang: 'язык', size: 'объём',
    dupTitle: 'Это уже есть в импортах.', dupBody: (ago: string) => `Импортировано ${ago}.`, open: 'Открыть', dupCost: 'Повторный импорт использует ещё один бесплатный импорт.',
    cost: 'Цена', free: 'Бесплатно', freeOf: (n: number) => `1 из ${n} бесплатных сегодня`, cancel: 'Отмена', confirm: 'Импортировать', confirmAnyway: 'Всё равно импортировать',
    change: 'Заменить', dropHint: (mb: number) => `До ${mb} МБ · PDF или EPUB · книги делятся на главы`,
    ocrToast: 'Найдены сканы страниц — ИИ их распознаёт. Это займёт несколько минут.', aiToast: 'ИИ очищает текст. Это может занять немного больше времени.',
    ocrRow: 'ИИ распознаёт сканы…', aiRow: 'ИИ очищает текст…', stuck: 'Ещё обрабатывается — если зависнет, отменится автоматически.',
    retry: 'Повторить', delTitle: (t: string) => `Удалить «${t}»?`,
    delBody: 'Книга удалится из библиотеки вместе с местом чтения. Сохранённые слова останутся в словаре. Использованный бесплатный импорт не вернётся.',
    yourImport: 'Ваш импорт', text: 'Текст', pageOf: (p: number, n: number) => `Страница ${p} из ${n}`, total: (n: number) => `Импортов: ${n}`, failedGeneric: 'Импорт не удался. Повторите или выберите другой файл.',
  },
  uz: {
    importsLeft: 'bugun qolgan bepul import', pagesLeft: 'bu oy qolgan bepul sahifa',
    link: 'Maqola havolasi', textLang: 'Matn tili', primary: 'Asosiy',
    langHint: 'Asosiy oʻrganayotgan tilingiz tanlandi. Matn boshqa tilda boʻlsa, oʻzgartiring.',
    check: 'Tekshirish', checkNote: 'Import qilishdan oldin sarlavha, hajm va narxni koʻrsatamiz.',
    privateTitle: 'Bu shaxsiy sahifa.',
    privateBody: 'Gemini, ChatGPT, Google Docs va Drive havolalarini Gotcha ocha olmaydi — kirish talab qilinadi. Matnni nusxa olib, “Matn” boʻlimiga qoʻying.',
    checking: 'IMPORTDAN OLDIN TEKSHIRISH', cleaned: 'Fayl nomidan tozalandi — kerak boʻlsa tahrirlang',
    words: (n: number) => `${n.toLocaleString('en-US')} soʻz`, pages: (n: number) => `~${n} sahifa`, lang: 'til', size: 'hajm',
    dupTitle: 'Bu allaqachon importlaringizda bor.', dupBody: (ago: string) => `${ago} import qilingan.`, open: 'Ochish', dupCost: 'Qayta import bepul limitdan yana 1 tasini oladi.',
    cost: 'Narx', free: 'Bepul', freeOf: (n: number) => `bugungi ${n} tadan 1 tasi`, cancel: 'Bekor qilish', confirm: 'Import qilish', confirmAnyway: 'Baribir import qilish',
    change: 'Almashtirish', dropHint: (mb: number) => `${mb} MB gacha · PDF yoki EPUB · kitoblar boblarga boʻlinadi`,
    ocrToast: 'Skanerlangan sahifalar topildi — AI ularni oʻqiyapti. Bir necha daqiqa ketishi mumkin.', aiToast: 'AI matnni tozalayapti. Biroz koʻproq vaqt olishi mumkin.',
    ocrRow: 'AI skanerlangan sahifalarni oʻqiyapti…', aiRow: 'AI matnni tozalayapti…', stuck: 'Hali ishlanmoqda — uzoq qotib qolsa, avtomatik toʻxtatiladi.',
    retry: 'Qayta urinish', delTitle: (t: string) => `“${t}” oʻchirilsinmi?`,
    delBody: 'Kitob kutubxonangizdan oʻqish joyi bilan birga oʻchadi. Saqlangan soʻzlaringiz lugʻatda qoladi. Ishlatilgan bepul import qaytarilmaydi.',
    yourImport: 'Importingiz', text: 'Matn', pageOf: (p: number, n: number) => `${p}-sahifa / ${n}`, total: (n: number) => `${n} ta import`, failedGeneric: 'Import amalga oshmadi. Qayta urining yoki boshqa fayl tanlang.',
  },
};
type ImportX = (typeof IX)['en'];

/** Links that need a sign-in: the importer can never read them (the "b887…" Gemini import). */
const PRIVATE_HOSTS = [
  'gemini.google.com', 'bard.google.com', 'chat.openai.com', 'chatgpt.com', 'claude.ai', 'docs.google.com', 'drive.google.com',
  'mail.google.com', 'onedrive.live.com', 'teams.microsoft.com', 'web.telegram.org', 'instagram.com', 'facebook.com',
];
function normalizeUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  if (/^https?:\/\//i.test(t)) return t;
  // "bbc.com/news/..." without a scheme → https
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(t)) return `https://${t}`;
  return t;
}
function isPrivateUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    return PRIVATE_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}
/** "pdfcoffee.com musashi eiji yoshikawa 4 pdf free (1).pdf" → "musashi eiji yoshikawa 4". */
function cleanFileTitle(name: string): string {
  let t = name.replace(/\.[^.]+$/, '');
  t = t.replace(/^(?:[\w-]+\.)+(?:com|org|net|io|ru|uz|info|me)[\s_-]+/i, '');
  t = t.replace(/[_]+/g, ' ').replace(/\s*\(\d+\)\s*$/g, '').replace(/\s*-\s*copy$/i, '');
  t = t.replace(/\b(pdf|epub|free|download|ebook|z-?lib(?:\.org)?|libgen)\b/gi, ' ');
  t = t.replace(/[-]{2,}/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t) return name.replace(/\.[^.]+$/, '');
  return t.charAt(0).toUpperCase() + t.slice(1);
}
const sameText = (a?: string | null, b?: string | null) =>
  !!a && !!b && a.trim().toLowerCase().replace(/\s+/g, ' ') === b.trim().toLowerCase().replace(/\s+/g, ' ');

function isPendingStatus(status: string) {
  return status === 'queued' || status === 'processing' || status === 'tokenizing';
}

function pendingForMs(iso: string) {
  return Date.now() - new Date(iso).getTime();
}

function statusBadge(status: string, copy: LearnerCopy) {
  const base = 'inline-flex items-center gap-1 h-6 px-2 rounded-md text-[11.5px] font-semibold shrink-0';
  switch (status) {
    case 'ready':
      return <span className={cn(base, 'bg-[#ecfdf5] text-[#047857]')}><CheckCircle2 className="w-3 h-3" />{copy.importPage.statusReady}</span>;
    case 'processing':
    case 'tokenizing':
      return <span className={cn(base, 'bg-g-blue-50 text-g-blue-700')}><Loader2 className="w-3 h-3 animate-spin" />{copy.importPage.statusProcessing}</span>;
    case 'queued':
      return <span className={cn(base, 'bg-[#fffbeb] text-[#b45309]')}><Clock className="w-3 h-3" />{copy.importPage.statusQueued}</span>;
    case 'failed':
      return <span className={cn(base, 'bg-[#fff1f1] text-[#dc2626]')}><AlertCircle className="w-3 h-3" />{copy.importPage.statusFailed}</span>;
    default:
      return <span className={cn(base, 'bg-gray-50 text-gray-600 capitalize')}>{status}</span>;
  }
}

function relativeTime(iso: string, copy: LearnerCopy) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return copy.timeAgo.justNow;
  if (mins < 60) return copy.timeAgo.minutesAgo(mins);
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return copy.timeAgo.hoursAgo(hrs);
  return copy.timeAgo.daysAgo(Math.floor(hrs / 24));
}

const inputCls =
  'block w-full min-w-0 max-w-full h-11 px-3.5 bg-white border border-[#e3e5ee] rounded-xl text-sm text-[#101828] placeholder:text-[#9aa0ae] outline-none focus:ring-4 focus:ring-g-blue-700/10 focus:border-g-blue-700 transition-all disabled:opacity-50';
const labelCls = 'flex items-baseline justify-between text-[13px] font-semibold text-[#344054] mb-1.5';

/** The learner's main learning language (never the native one) — imports used to default to English for everyone. */
function useDefaultImportLang() {
  const { user } = useAuth();
  const native = user?.nativeLanguage?.toLowerCase();
  const targets = (user?.targetLanguages ?? []).filter((t) => t.targetLanguage.toLowerCase() !== native);
  return (targets.find((t) => t.isPrimary) ?? targets[0])?.targetLanguage?.toLowerCase() || (native === 'en' ? 'ru' : 'en');
}

function LangSelect({ value, onChange, disabled, ix }: { value: string; onChange: (v: string) => void; disabled?: boolean; ix: ImportX }) {
  const copy = useLearnerCopy();
  const { langs } = useCatalogLanguages();
  const { user } = useAuth();
  const options = langs.filter((l) => l.code !== user?.nativeLanguage);
  const defaultLang = useDefaultImportLang();

  return (
    <div className="min-w-0 max-w-full">
      <label className={labelCls}>{ix.textLang}</label>
      <CatalogLanguageDropdown
        value={value}
        onChange={onChange}
        options={options.map((l) => ({ code: l.code, name: l.name, nativeName: l.nativeName }))}
        ariaLabel={copy.importPage.language}
        disabled={disabled}
      />
      {value === defaultLang && <p className="text-xs text-[#8a8fa0] mt-1.5 leading-relaxed">{ix.langHint}</p>}
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
      className="w-full min-w-0 max-w-full h-12 px-3 rounded-xl bg-g-blue-700 hover:bg-g-blue-800 disabled:bg-[#c5cafd] disabled:pointer-events-none text-white text-[15px] font-semibold inline-flex items-center justify-center gap-2 transition-colors shadow-[0_10px_20px_-10px_rgba(33,7,170,.5)]"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
      {children}
    </button>
  );
}

function URLForm({ loading, onSubmit, ix, prefill }: { loading: boolean; onSubmit: (data: { url: string; title: string; lang: string }) => void; ix: ImportX; prefill?: { url: string; n: number } | null }) {
  const copy = useLearnerCopy();
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const defaultLang = useDefaultImportLang();
  const [lang, setLang] = useState(defaultLang);
  useEffect(() => setLang(defaultLang), [defaultLang]);
  useEffect(() => {
    if (prefill?.url) setUrl(prefill.url);
  }, [prefill?.n]);
  const normalized = normalizeUrl(url);
  const isPrivate = isPrivateUrl(normalized);
  const valid = /^https?:\/\/\S+\.\S+/i.test(normalized) && !isPrivate;

  return (
    <div className="min-w-0 max-w-full space-y-4">
      <div className="min-w-0">
        <label className={labelCls}>{ix.link}</label>
        <div className="relative min-w-0 max-w-full">
          <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9aa0ae]" />
          <input
            type="url"
            value={url}
            disabled={loading}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={copy.import.urlPlaceholder}
            className={cn(inputCls, 'pl-10', isPrivate && 'border-[#fca5a5] focus:border-[#ef4444] focus:ring-[#fee2e2]')}
          />
        </div>
        {isPrivate ? (
          <div className="mt-2 flex gap-2.5 items-start rounded-xl border border-[#fecaca] bg-[#fff1f1] px-3 py-2.5 text-[12.5px] leading-relaxed text-[#b91c1c]" role="alert">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span><b className="font-semibold">{ix.privateTitle}</b> {ix.privateBody}</span>
          </div>
        ) : (
          <p className="text-xs text-[#8a8fa0] mt-1.5 leading-relaxed [overflow-wrap:anywhere]">{copy.importPage.urlHelp}</p>
        )}
      </div>
      <div className="min-w-0">
        <label className={labelCls}>{copy.importPage.titleOptional}</label>
        <input type="text" value={title} disabled={loading} onChange={(e) => setTitle(e.target.value)} placeholder={copy.importPage.autoFromPage} className={inputCls} />
      </div>
      <LangSelect value={lang} onChange={setLang} disabled={loading} ix={ix} />
      <SubmitButton icon={Search} disabled={!valid} loading={loading} onClick={() => onSubmit({ url: normalized, title, lang })}>
        {loading ? copy.import.importing : ix.check}
      </SubmitButton>
      <p className="text-[11.5px] text-[#9aa0ae] text-center">{ix.checkNote}</p>
    </div>
  );
}

function PasteForm({ loading, onSubmit, ix }: { loading: boolean; onSubmit: (data: { text: string; title: string; lang: string }) => void; ix: ImportX }) {
  const copy = useLearnerCopy();
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const defaultLang = useDefaultImportLang();
  const [lang, setLang] = useState(defaultLang);
  useEffect(() => setLang(defaultLang), [defaultLang]);
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const tooLong = text.length > MAX_PASTE_CHARS;
  const valid = words >= MIN_PASTE_WORDS && title.trim().length > 0 && !tooLong;

  return (
    <div className="min-w-0 max-w-full space-y-4">
      <div className="min-w-0">
        <label className={labelCls}>{copy.importPage.titleLabel}</label>
        <input type="text" value={title} disabled={loading} onChange={(e) => setTitle(e.target.value)} placeholder={copy.importPage.titlePlaceholder} className={inputCls} />
      </div>
      <div className="min-w-0">
        <div className={labelCls}>
          <span>{copy.importPage.textLabel}</span>
          <span className={cn('text-xs font-medium tabular-nums', words < MIN_PASTE_WORDS || tooLong ? 'text-[#9aa0ae]' : 'text-emerald-600')}>
            {copy.common.words(words)}
          </span>
        </div>
        <textarea
          value={text}
          disabled={loading}
          onChange={(e) => setText(e.target.value)}
          placeholder={copy.importPage.pastePlaceholder}
          rows={8}
          className={cn(inputCls, 'h-auto py-3 resize-y min-h-[180px] leading-relaxed')}
        />
        {words > 0 && words < MIN_PASTE_WORDS && (
          <p className="text-xs text-amber-600 mt-1">{MIN_PASTE_WORDS - words} {copy.importPage.wordsNeeded}</p>
        )}
        {tooLong && <p className="text-xs text-[#c10007] mt-1">{copy.importPage.textTooLong(MAX_PASTE_CHARS)}</p>}
      </div>
      <LangSelect value={lang} onChange={setLang} disabled={loading} ix={ix} />
      <SubmitButton icon={Search} disabled={!valid} loading={loading} onClick={() => onSubmit({ text, title, lang })}>
        {loading ? copy.import.importing : ix.check}
      </SubmitButton>
    </div>
  );
}

function FileForm({ loading, onSubmit, ix }: { loading: boolean; onSubmit: (data: { file: File; title: string; lang: string }) => void; ix: ImportX }) {
  const copy = useLearnerCopy();
  const { locale } = useLearnerLocale();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [titleCleaned, setTitleCleaned] = useState(false);
  const defaultLang = useDefaultImportLang();
  const [lang, setLang] = useState(defaultLang);
  useEffect(() => setLang(defaultLang), [defaultLang]);
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
      setFileError(copy.importPage.onlyPdfEpub);
      return;
    }
    if (next.size > MAX_FILE_BYTES) {
      setFile(null);
      setFileError(surfaceCopy(locale).fileTooBig(MAX_FILE_MB));
      return;
    }
    setFile(next);
    if (!title.trim() || titleCleaned) {
      setTitle(cleanFileTitle(next.name));
      setTitleCleaned(true);
    }
  };

  const valid = !!file && !fileError;
  const ext = file?.name.toLowerCase().endsWith('.epub') ? 'EPUB' : 'PDF';
  const sizeLabel = file ? (file.size >= 1024 * 1024 ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(file.size / 1024))} KB`) : '';

  return (
    <div className="min-w-0 max-w-full space-y-4">
      <div
        role="button"
        tabIndex={0}
        onClick={() => !loading && inputRef.current?.click()}
        onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !loading) { e.preventDefault(); inputRef.current?.click(); } }}
        onDragOver={(e) => { e.preventDefault(); if (!loading) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (loading) return;
          validateFile(e.dataTransfer.files?.[0] ?? null);
        }}
        className={cn(
          'border-[1.5px] border-dashed rounded-xl cursor-pointer transition-all min-w-0 w-full max-w-full',
          file ? 'p-3.5 flex items-center gap-3 text-left' : 'p-6 sm:p-8 flex flex-col items-center text-center',
          dragOver ? 'border-g-blue-700 bg-g-blue-50' : file ? 'border-[#d6d9e6] bg-[#fafbff]' : 'border-[#d6d9e6] hover:border-g-blue-200 hover:bg-[#fafbff]',
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
            <span className="w-10 h-12 rounded-lg bg-[#fff1f1] border border-[#fecaca] text-[#dc2626] grid place-items-center text-[10px] font-extrabold shrink-0">{ext}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-[#101828] truncate">{file.name}</span>
              <span className="block text-xs text-[#8a8fa0] mt-0.5">{sizeLabel}</span>
            </span>
            <span className="text-[13px] font-semibold text-g-blue-700 shrink-0">{ix.change}</span>
          </>
        ) : (
          <>
            <span className="size-11 rounded-xl bg-g-blue-50 text-g-blue-700 grid place-items-center mb-3"><Upload className="w-5 h-5" /></span>
            <div className="text-sm font-semibold text-[#344054] px-1 leading-snug [overflow-wrap:anywhere]">{copy.importPage.dropFile}</div>
            <div className="text-xs text-[#8a8fa0] mt-1 px-1 leading-snug [overflow-wrap:anywhere]">{ix.dropHint(MAX_FILE_MB)}</div>
          </>
        )}
      </div>
      {fileError && (
        <p className="text-xs text-[#c10007] -mt-2 flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />{fileError}
        </p>
      )}
      <div>
        <label className={labelCls}>{copy.importPage.titleOptional}</label>
        <input
          type="text"
          value={title}
          disabled={loading}
          onChange={(e) => { setTitle(e.target.value); setTitleCleaned(false); }}
          placeholder={copy.importPage.autoFromFilename}
          className={inputCls}
        />
        {titleCleaned && file && <p className="text-xs text-[#8a8fa0] mt-1.5">{ix.cleaned}</p>}
      </div>
      <LangSelect value={lang} onChange={setLang} disabled={loading} ix={ix} />
      <SubmitButton icon={Search} disabled={!valid} loading={loading} onClick={() => file && onSubmit({ file, title, lang })}>
        {loading ? copy.import.importing : ix.check}
      </SubmitButton>
    </div>
  );
}

/** Pre-import check: what will be imported, what it costs, and whether it is already there. */
type PendingImport = {
  type: 'url' | 'paste' | 'pdf' | 'epub';
  title: string;
  sizeLabel: string | null;
  lang: string;
  duplicate: ImportItem | null;
  run: () => Promise<void>;
};

function ConfirmCard({
  pending,
  ix,
  freeLeft,
  freePerDay,
  onCancel,
  onConfirm,
  onOpen,
  timeAgo,
}: {
  pending: PendingImport;
  ix: ImportX;
  freeLeft: number | null;
  freePerDay: number | null;
  onCancel: () => void;
  onConfirm: () => void;
  onOpen: (contentId: string) => void;
  timeAgo: (iso: string) => string;
}) {
  const { langs } = useCatalogLanguages();
  const langName = langs.find((l) => l.code === pending.lang)?.nativeName ?? pending.lang.toUpperCase();
  const Icon = pending.type === 'url' ? Link : pending.type === 'paste' ? Clipboard : FileText;
  return (
    <div className="rounded-2xl border border-[#e0e3ff] bg-[#f8f8ff] p-4 space-y-3.5" data-testid="import-confirm">
      <div className="text-[10.5px] font-bold tracking-[0.12em] text-g-blue-700">{ix.checking}</div>
      <div className="flex items-start gap-3">
        <span className="w-11 h-14 rounded-lg bg-gradient-to-b from-[#3b2ad6] to-[#14056b] text-white grid place-items-center shrink-0"><Icon className="w-5 h-5" /></span>
        <div className="min-w-0">
          <div className="text-[15px] font-bold text-[#101828] leading-snug [overflow-wrap:anywhere]">{pending.title}</div>
          <div className="text-[12.5px] text-[#6b7080] mt-0.5">{langName}{pending.sizeLabel ? ` · ${pending.sizeLabel}` : ''}</div>
        </div>
      </div>
      {pending.duplicate && (
        <div className="flex gap-2.5 items-start rounded-xl border border-[#fde68a] bg-[#fffbeb] px-3 py-2.5 text-[12.5px] leading-relaxed text-[#92400e]" role="status">
          <Copy className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            <b className="font-semibold">{ix.dupTitle}</b> {ix.dupBody(timeAgo(pending.duplicate.createdAt))}{' '}
            {pending.duplicate.content?.id && (
              <button type="button" onClick={() => onOpen(pending.duplicate!.content!.id)} className="font-bold underline underline-offset-2">{ix.open}</button>
            )}{' '}
            {ix.dupCost}
          </span>
        </div>
      )}
      <div className="flex items-center justify-between gap-3 border-t border-[#eceef5] pt-3 text-[13px] text-[#4a5565]">
        <span>{ix.cost}</span>
        <span className="text-right"><b className="text-[#047857] font-semibold">{ix.free}</b>{freeLeft != null && freePerDay ? <> · {ix.freeOf(freePerDay)}</> : null}</span>
      </div>
      <div className="grid grid-cols-[1fr_1.4fr] gap-2">
        <button type="button" onClick={onCancel} className="h-11 rounded-xl border border-[#e1e3ec] bg-white text-sm font-semibold text-[#101828] hover:bg-gray-50">{ix.cancel}</button>
        <button type="button" onClick={onConfirm} autoFocus className="h-11 rounded-xl bg-g-blue-700 hover:bg-g-blue-800 text-white text-sm font-semibold inline-flex items-center justify-center gap-2">
          <Upload className="w-4 h-4" />{pending.duplicate ? ix.confirmAnyway : ix.confirm}
        </button>
      </div>
    </div>
  );
}

function DeleteDialog({ item, ix, busy, onCancel, onConfirm, copy }: { item: ImportItem; ix: ImportX; busy: boolean; onCancel: () => void; onConfirm: () => void; copy: LearnerCopy }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ background: 'rgba(11,12,38,.5)' }} onClick={onCancel}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="imp-del-title" className="w-full max-w-[420px] bg-white rounded-2xl p-5 sm:p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <span className="size-11 rounded-xl bg-[#fff1f1] text-[#dc2626] grid place-items-center mb-3"><Trash2 className="w-5 h-5" /></span>
        <h2 id="imp-del-title" className="text-lg font-bold text-[#101828] [overflow-wrap:anywhere]">{ix.delTitle(item.title)}</h2>
        <p className="text-sm text-[#4a5565] mt-1.5 leading-relaxed">{ix.delBody}</p>
        <div className="grid grid-cols-2 gap-2 mt-5">
          <button type="button" autoFocus onClick={onCancel} className="h-11 rounded-xl border border-[#e1e3ec] text-sm font-semibold text-[#101828] hover:bg-gray-50">{ix.cancel}</button>
          <button type="button" disabled={busy} onClick={onConfirm} className="h-11 rounded-xl bg-[#dc2626] hover:bg-[#b91c1c] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}{copy.importPage.delete}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

type PaymentModalState = {
  open: boolean;
  quote: ImportQuote | null;
  importTitle: string;
  importType: string;
  onPaid: ((paymentId: string) => void) | null;
};

type PaymentStep = 'price' | 'card' | 'otp' | 'done';

function PaymentConfirmModal({
  state,
  onClose,
  loading: externalLoading,
}: {
  state: PaymentModalState;
  onClose: () => void;
  loading: boolean;
}) {
  const copy = useLearnerCopy();
  const { locale } = useLearnerLocale();
  const [step, setStep] = useState<PaymentStep>('price');
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const pay = usePay();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelOutcome, setCancelOutcome] = useState<{ status: string; code: string | null; needsAttention: boolean } | null>(null);
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [otp, setOtp] = useState('');
  const [, setMaskedPhone] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [, setCanResendOtp] = useState(false);

  useEffect(() => {
    if (state.open) {
      setStep('price');
      setPaymentId(null);
      setCardNumber('');
      setExpiry('');
      setOtp('');
      setMaskedPhone(undefined);
      setError(null);
      setLoading(false);
      setCanResendOtp(false);
    }
  }, [state.open]);

  useEffect(() => {
    if (step === 'otp') {
      setCanResendOtp(false);
      const timer = setTimeout(() => setCanResendOtp(true), 30000);
      return () => clearTimeout(timer);
    }
  }, [step]);

  if (!state.quote) return null;

  const { quote, onPaid, importTitle, importType } = state;
  const displayTitle = importTitle || IX[locale === 'ru' || locale === 'uz' ? locale : 'en'].yourImport;
  const typeLabel = importType === 'pdf' || importType === 'epub'
    ? importType.toUpperCase()
    : importType === 'url'
    ? 'URL'
    : 'Text';



  const cardDigits = cardNumber.replace(/\s/g, '');
  const isCardValid =
    cardDigits.length >= 16 &&
    cardDigits.length <= 19 &&
    (() => {
      const d = expiry.replace(/\D/g, '');
      return d.length === 4 && Number(d.slice(0, 2)) >= 1 && Number(d.slice(0, 2)) <= 12;
    })();
  const isOtpValid = otp.replace(/\s/g, '').length >= 4;

  const handleProceedToCard = async () => {
    setLoading(true);
    setError(null);
    try {
      const { checkoutImport } = await import('../lib/importBilling');
      const checkout = await checkoutImport({
        importType: quote.importType as 'paste' | 'url' | 'pdf' | 'epub',
        contentFormat: quote.contentFormat,
        pageCount: quote.estimatedPages,
        promoCode: quote.promo?.code,
      });
      setPaymentId(checkout.paymentId);
      if (checkout.step === 'done' || checkout.isFree) {
        onPaid?.(checkout.paymentId);
        onClose();
      } else {
        setStep('card');
      }
    } catch (err) {
      setError(pay.errOr(err, copy.errors.failedStartPayment));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitCard = async () => {
    if (!paymentId || !isCardValid) return;
    setLoading(true);
    setError(null);
    try {
      const { preApplyPayment } = await import('../lib/importBilling');
      const expiryFormatted = expiry.replace(/\//g, '');
      const result = await preApplyPayment(paymentId, cardNumber.replace(/\s/g, ''), expiryFormatted);
      if (result.step !== 'otp') {
        throw new Error(copy.errors.unexpectedPaymentState);
      }
      setMaskedPhone(result.maskedPhone);
      setStep('otp');
      setOtp('');
    } catch (err) {
      setError(pay.errOr(err, copy.errors.cardVerificationFailed));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitOtp = async () => {
    if (!paymentId || !isOtpValid) return;
    setLoading(true);
    setError(null);
    try {
      const { applyPayment } = await import('../lib/importBilling');
      const result = await applyPayment(paymentId, otp.replace(/\s/g, ''));
      if (result.step === 'paid') {
        setStep('done');
        onPaid?.(paymentId);
        onClose();
      } else if (result.step === 'otp') {
        setError(copy.errors.paymentNotConfirmedOtp);
        setOtp('');
      } else {
        setError(copy.errors.paymentNotConfirmedCard);
        setStep('card');
        setCardNumber('');
        setExpiry('');
        setOtp('');
      }
    } catch (err) {
      setError(pay.errOr(err, copy.errors.otpVerificationFailed));
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!paymentId) return;
    setLoading(true);
    setError(null);
    try {
      const { retryOtp } = await import('../lib/importBilling');
      await retryOtp(paymentId);
      setCanResendOtp(false);
      setTimeout(() => setCanResendOtp(true), 30000);
      setError(null);
    } catch (err) {
      setError(pay.errOr(err, copy.errors.couldNotResendOtp));
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setError(null);
    if (step === 'card') {
      setStep('price');
    } else if (step === 'otp') {
      setStep('card');
      setOtp('');
    }
  };

  return (
    <Dialog open={state.open} onOpenChange={(open) => { if (open || loading) return; if (paymentId && (step === 'card' || step === 'otp')) setConfirmCancel(true); else onClose(); }}>
      <div className="flex flex-col gap-5 items-center px-5 pb-6 pt-2">

        {step === 'price' && (
          <>
            <div
              className="w-20 h-[110px] rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(to right, var(--g-blue-500), var(--g-blue-700))', boxShadow: '0 8px 8px rgba(33, 7, 170, 0.2)' }}
            >
              <FileText className="w-8 h-8 text-g-on-cta" />
            </div>

            <div className="flex flex-col gap-2 items-center w-full">
              <h2 className="text-[#101828] text-xl font-bold text-center leading-tight">{displayTitle}</h2>
              <div className="flex gap-2 items-center pt-1">
                <span className="bg-[#f3f4f6] text-[#101828] text-xs font-semibold px-2.5 py-1 rounded-full">
                  {typeLabel}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-4 w-full px-4 py-0.5">
              <span className="text-[#101828] text-[13px] font-semibold">
                ~{quote.estimatedPages.toLocaleString(locale === 'ru' ? 'ru-RU' : locale === 'uz' ? 'uz-Latn-UZ' : 'en-GB')} {locale === 'ru' ? (quote.estimatedPages === 1 ? 'страница' : 'страниц') : locale === 'uz' ? 'sahifa' : (quote.estimatedPages === 1 ? 'page' : 'pages')}
              </span>
              {quote.tier && (
                <>
                  <span className="w-px h-3 bg-[#d1d5db]" />
                  <span className="text-[#101828] text-[13px] font-semibold">{quote.tier.label}</span>
                </>
              )}
            </div>

            <div className="w-full border border-[#e4e7ec] rounded-xl p-4 flex flex-col gap-3 bg-white">
              {quote.tier && quote.tier.priceUzs > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[#6a7282]">{copy.importPage.pageTier(quote.tier.label)}</span>
                  <span className="text-[#101828] font-medium">{formatUzs(quote.tier.priceUzs)}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-sm">
                <span className="text-[#6a7282]">{copy.importPage.estimatedPages}</span>
                <span className="text-[#101828] font-medium">~{quote.estimatedPages}</span>
              </div>
              {!!quote.discountUzs && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[#6a7282]">{quote.promo?.code}</span>
                  <span className="text-g-ok font-medium">−{formatUzs(quote.discountUzs)}</span>
                </div>
              )}
              <div className="h-px bg-[#e4e7ec]" />
              <div className="flex justify-between items-center">
                <span className="text-[#101828] text-sm font-semibold">{copy.importPage.total}</span>
                <span className="text-g-blue-700 text-base font-bold">{formatUzs(quote.amountUzs)}</span>
              </div>
            </div>
            {quote.freeLimits && (
              <p className="text-[11px] text-[#6a7282] text-center leading-relaxed">
                {quote.freeReason === 'Within free import allowance'
                  ? copy.importPage.freeAllowanceCovered
                  : quote.requiresPayment && !quote.tier
                    ? copy.importPage.lengthNotPriced
                    : formatFreeAllowance(quote.freeLimits, copy.billing)}
              </p>
            )}

            {error && (
              <div className="w-full p-3 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-xs text-red-600">{error}</p>
              </div>
            )}

            <button
              type="button"
              onClick={handleProceedToCard}
              disabled={loading || externalLoading || (quote.requiresPayment && (!quote.tier || quote.amountUzs <= 0))}
              className="w-full h-[52px] rounded-[14px] bg-g-blue-700 hover:bg-g-blue-900 disabled:opacity-50 disabled:pointer-events-none text-g-on-cta text-base font-bold flex items-center justify-center gap-2 transition-colors"
              style={{ boxShadow: '0 6px 8px rgba(33, 7, 170, 0.25)' }}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {copy.importPage.statusProcessing}
                </>
              ) : (
                <>{copy.importPage.purchaseFor(formatUzs(quote.amountUzs))}</>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="text-[#6a7282] text-sm font-medium hover:text-[#101828] transition-colors disabled:opacity-50"
            >
              {copy.common.cancel}
            </button>
          </>
        )}

        {step === 'card' && (
          <>
            <h2 className="text-xl font-bold text-center" style={{ color: 'var(--g-text)' }}>{copy.importPage.enterCardDetails}</h2>
            <CardForm pan={cardNumber} exp={expiry} onPan={setCardNumber} onExp={setExpiry} onSubmit={handleSubmitCard}
              amountUzs={quote.amountUzs} loading={loading} error={error} onCancel={() => setConfirmCancel(true)} />
            <button type="button" onClick={handleBack} disabled={loading} className="text-sm font-medium disabled:opacity-50" style={{ color: 'var(--g-text-2)' }}>
              {copy.common.back}
            </button>
            <PayTrust />
          </>
        )}

        {step === 'otp' && (
          <>
            <h2 className="text-xl font-bold text-center" style={{ color: 'var(--g-text)' }}>{copy.importPage.enterSmsCode}</h2>
            <OtpForm cardMask={cardNumber} otp={otp} onOtp={setOtp} onSubmit={handleSubmitOtp} onResend={handleResendOtp} loading={loading} error={error} onCancel={() => setConfirmCancel(true)} />
            <button type="button" onClick={handleBack} disabled={loading} className="text-sm font-medium disabled:opacity-50" style={{ color: 'var(--g-text-2)' }}>
              {copy.common.back}
            </button>
          </>
        )}
        <CancelConfirm open={confirmCancel} busy={loading} onKeep={() => setConfirmCancel(false)} onConfirm={async () => {
          setConfirmCancel(false);
          if (paymentId) {
            const { cancelPayment } = await import('../lib/importBilling');
            const r = await runCancel(() => cancelPayment(paymentId, 'learner_cancel')).catch(() => null);
            // 06b (race: reversing) / 06c (already paid: support only) get their own screen; plain 06 just closes.
            if (r && cancelScreen(r) !== '06') { setCancelOutcome(r); return; }
          }
          onClose();
        }} />
        {cancelOutcome && <CancelOutcome outcome={cancelOutcome} reference={paymentId} needsAttention={cancelOutcome.needsAttention} onDone={() => { setCancelOutcome(null); onClose(); }} />}
      </div>
    </Dialog>
  );
}


/** final-5: stop before importing when the free allowance is used up, or a paid import is needed while payments are off. */
function blockedByFreeLimit(quote: ImportQuote): boolean {
  const overFree = quote.freeReason === 'Free import limit reached' || (!quote.isFree && !quote.requiresPayment);
  if (!overFree && !(quote.requiresPayment && !paymentsEnabled())) return false;
  const f = quote.freeLimits;
  const daily = !f || f.dailyFreeRemaining <= 0;
  return handleLimitError({
    code: 'IMPORT_LIMIT_REACHED',
    body: { ...(f ?? {}), limit: daily ? 'daily_imports' : 'monthly_pages' },
  });
}

/**
 * Stored import errors carry no HTTP status, so the shared localizer would fall back to
 * "no connection" for any message it doesn't know. Show a neutral import error instead.
 */
function importErrorText(locale: string, message: string, fallback: string): string {
  const generic = localizeApiError(locale, { message: '\u0000', status: -1 });
  const text = localizeApiError(locale, { message, status: -1 });
  return text === generic ? fallback : text;
}

export default function ImportPage() {
  const payments = usePaymentsEnabled();
  const copy = useLearnerCopy();
  const { locale } = useLearnerLocale();
  const ix = IX[locale === 'ru' || locale === 'uz' ? locale : 'en'];
  const navigate = useNavigate();
  const [tab, setTab] = useState<ImportTab>('url');
  const [imports, setImports] = useState<ImportItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [importLimit, setImportLimit] = useState<number | null>(null);
  const [importRemaining, setImportRemaining] = useState<number | null>(null);
  const [importsUnlimited, setImportsUnlimited] = useState(false);
  const [freeAllowance, setFreeAllowance] = useState<ImportFreeAllowance | null>(null);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ImportItem | null>(null);
  const [pending, setPending] = useState<PendingImport | null>(null);
  const [urlPrefill, setUrlPrefill] = useState<{ url: string; n: number } | null>(null);
  /** Wider history window for the duplicate check (the visible list is one page of 8). */
  const [knownImports, setKnownImports] = useState<ImportItem[]>([]);
  const [gatewayEnabled, setGatewayEnabled] = useState(false);
  const [paidRetry, setPaidRetry] = useState<{ freeRetries: { paymentId: string; importType: string; reason?: 'paid_late' }[]; refundDue: number }>({ freeRetries: [], refundDue: 0 });
  const payCopy = usePay();
  /** A failed paid import is retried free on the SAME payment (no new charge) instead of opening checkout. */
  const openPayOrRetry = (modal: PaymentModalState) => {
    const free = paidRetry.freeRetries.find((r) => r.importType === modal.importType);
    if (free && modal.onPaid) {
      toast.message(payCopy.t('imp.retryUsing'));
      setPaidRetry((s) => ({ ...s, freeRetries: s.freeRetries.filter((r) => r.paymentId !== free.paymentId) }));
      void modal.onPaid(free.paymentId);
      return;
    }
    setPaymentModal(modal);
  };
  const [paymentModal, setPaymentModal] = useState<PaymentModalState>({ open: false, quote: null, importTitle: '', importType: '', onPaid: null });

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
      setPaidRetry(res.paidImportRetry ?? { freeRetries: [], refundDue: 0 });
      if (res.freeAllowance) {
        setFreeAllowance(res.freeAllowance);
        setGatewayEnabled(res.freeAllowance.gatewayEnabled);
      }
      return res;
    });

  const loadKnown = () =>
    api<ImportListResponse>('/imports?page=1&pageSize=50')
      .then((res) => setKnownImports(res.items ?? []))
      .catch(() => undefined);

  useEffect(() => {
    void load(1).finally(() => setHistoryLoading(false));
    void loadKnown();
  }, []);

  useEffect(() => {
    const pendingNow = imports.some((i) => isPendingStatus(i.ingestionStatus));
    if (!pendingNow) return;
    const id = window.setInterval(() => {
      void load(page).catch(() => undefined);
    }, 2500);
    return () => window.clearInterval(id);
  }, [imports, page]);

  const slowPhaseToastShown = useRef(new Set<string>());
  useEffect(() => {
    for (const item of imports) {
      if (!isPendingStatus(item.ingestionStatus) || !item.progressPhase) continue;
      const key = `${item.id}:${item.progressPhase}`;
      if (slowPhaseToastShown.current.has(key)) continue;
      slowPhaseToastShown.current.add(key);
      if (item.progressPhase === 'ocr') toast.info(ix.ocrToast, { id: key, duration: 9000 });
      else if (item.progressPhase === 'ai') toast.info(ix.aiToast, { id: key, duration: 8000 });
    }
  }, [imports, ix]);

  const toastReady = (item: ImportItem) => {
    const contentId = item.content?.id;
    if (item.ingestionStatus === 'ready' && contentId) {
      toast.success(copy.importPage.importReady, {
        action: {
          label: copy.importPage.read,
          onClick: () => navigate(`/app/read/${contentId}`),
        },
      });
      return;
    }
    if (item.ingestionStatus === 'failed') {
      toast.error(item.errorMessage ? importErrorText(locale, item.errorMessage, ix.failedGeneric) : copy.importPage.statusFailed);
      return;
    }
    toast.success(copy.import.importButton);
  };

  const guardLimit = () => {
    if (!atImportLimit) return true;
    toast.error(copy.importPage.importLimitReached);
    return false;
  };

  const closePaymentModal = useCallback(() => {
    setPaymentModal({ open: false, quote: null, importTitle: '', importType: '', onPaid: null });
    setLoading(false);
  }, []);

  /** Same title, file name or link already imported (ready or still processing). */
  const findDuplicate = (title: string, sourceUrl?: string | null): ImportItem | null => {
    const pool = [...imports, ...knownImports].filter((i) => i.ingestionStatus !== 'failed');
    const url = sourceUrl?.replace(/[#?].*$/, '').replace(/\/$/, '');
    return (
      pool.find((i) => (url && i.sourceUrl && i.sourceUrl.replace(/[#?].*$/, '').replace(/\/$/, '') === url) || sameText(i.title, title) || sameText(i.content?.title, title)) ?? null
    );
  };

  /** Runs an import call with the shared loading / toast / refresh handling. */
  const runImport = async (call: () => Promise<ImportItem>, failMsg: string) => {
    setLoading(true);
    try {
      const item = await call();
      toastReady(item);
      await load(1);
      void loadKnown();
    } catch (err) {
      if (!handleLimitError(err)) toast.error(err instanceof Error ? err.message : failMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleUrlImport = async (data: { url: string; title: string; lang: string }) => {
    if (!guardLimit()) return;
    setLoading(true);
    try {
      const { quoteImport: getQuote } = await import('../lib/importBilling');
      const preview = await api<{ title: string; wordCount: number; textLength: number }>('/imports/url/preview', {
        method: 'POST',
        body: JSON.stringify({ url: data.url }),
      });
      const quoteParams = { importType: 'url' as const, contentFormat: 'article', textLength: preview.textLength, wordCount: preview.wordCount };
      const quote = await getQuote(quoteParams);
      if (blockedByFreeLimit(quote)) return;

      if (quote.gatewayEnabled && quote.requiresPayment) {
        openPayOrRetry({
          open: true,
          quote,
          importTitle: data.title || preview.title || data.url,
          importType: 'url',
          onPaid: async (paymentId) => {
            await runImport(
              () => api<ImportItem>('/imports/url', {
                method: 'POST',
                body: JSON.stringify({ url: data.url, language: data.lang, title: data.title || undefined, paymentId }),
              }),
              copy.errors.importFailed,
            );
          },
        });
        return;
      }

      const title = data.title || preview.title || data.url;
      setPending({
        type: 'url',
        title,
        sizeLabel: preview.wordCount ? ix.words(preview.wordCount) : null,
        lang: data.lang,
        duplicate: findDuplicate(title, data.url),
        run: () => runImport(
          () => api<ImportItem>('/imports/url', {
            method: 'POST',
            body: JSON.stringify({ url: data.url, language: data.lang, title: data.title || undefined }),
          }),
          copy.errors.importFailed,
        ),
      });
    } catch (err) {
      if (!handleLimitError(err)) toast.error(err instanceof Error ? err.message : copy.errors.importFailed);
    } finally {
      if (!paymentModal.open) setLoading(false);
    }
  };

  const handlePasteImport = async (data: { text: string; title: string; lang: string }) => {
    if (!guardLimit()) return;
    setLoading(true);
    try {
      const { quoteImport: getQuote, wordCountOf } = await import('../lib/importBilling');
      const words = wordCountOf(data.text);
      const quoteParams = { importType: 'paste' as const, contentFormat: 'article', textLength: data.text.length, wordCount: words };
      const quote = await getQuote(quoteParams);
      if (blockedByFreeLimit(quote)) return;

      const call = (paymentId?: string) => () => api<ImportItem>('/imports/paste', {
        method: 'POST',
        body: JSON.stringify({ title: data.title, text: data.text, language: data.lang, ...(paymentId ? { paymentId } : {}) }),
      });

      if (quote.gatewayEnabled && quote.requiresPayment) {
        openPayOrRetry({
          open: true,
          quote,
          importTitle: data.title,
          importType: 'paste',
          onPaid: async (paymentId) => {
            await runImport(call(paymentId), copy.errors.importFailed);
          },
        });
        return;
      }

      setPending({
        type: 'paste',
        title: data.title,
        sizeLabel: ix.words(words),
        lang: data.lang,
        duplicate: findDuplicate(data.title),
        run: () => runImport(call(), copy.errors.importFailed),
      });
    } catch (err) {
      if (!handleLimitError(err)) toast.error(err instanceof Error ? err.message : copy.errors.importFailed);
    } finally {
      if (!paymentModal.open) setLoading(false);
    }
  };

  const handleFileImport = async (data: { file: File; title: string; lang: string }) => {
    if (!guardLimit()) return;
    setLoading(true);
    try {
      const { quoteImport: getQuote } = await import('../lib/importBilling');
      const isEpub = data.file.name.toLowerCase().endsWith('.epub');
      const importType = isEpub ? 'epub' : 'pdf';
      let pageCount = !isEpub ? await countPdfPagesFromFile(data.file) : null;
      if (!pageCount) {
        pageCount = (await inspectImportFile(data.file)).pageCount;
      }
      const quoteParams = { importType: importType as 'pdf' | 'epub', contentFormat: 'ebook', pageCount };
      const quote = await getQuote(quoteParams);
      if (blockedByFreeLimit(quote)) return;

      const call = (paymentId?: string) => () => {
        const form = new FormData();
        form.append('file', data.file);
        form.append('language', data.lang);
        if (data.title.trim()) form.append('title', data.title.trim());
        if (paymentId) form.append('paymentId', paymentId);
        return api<ImportItem>('/imports/file', { method: 'POST', body: form });
      };

      if (quote.gatewayEnabled && quote.requiresPayment) {
        openPayOrRetry({
          open: true,
          quote,
          importTitle: data.title || data.file.name,
          importType: importType,
          onPaid: async (paymentId) => {
            await runImport(call(paymentId), copy.errors.uploadFailed);
          },
        });
        return;
      }

      const title = data.title.trim() || cleanFileTitle(data.file.name);
      setPending({
        type: importType,
        title,
        sizeLabel: pageCount ? ix.pages(pageCount) : null,
        lang: data.lang,
        duplicate: findDuplicate(title) ?? findDuplicate(data.file.name.replace(/\.[^.]+$/, '')),
        run: () => runImport(call(), copy.errors.uploadFailed),
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.errors.uploadFailed);
    } finally {
      if (!paymentModal.open) setLoading(false);
    }
  };

  const handleDelete = async (item: ImportItem) => {
    setDeletingId(item.id);
    try {
      await api(`/imports/${item.id}`, { method: 'DELETE' });
      toast.success(copy.importPage.importRemoved);
      const nextPage = imports.length === 1 && page > 1 ? page - 1 : page;
      await load(nextPage);
      void loadKnown();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.errors.couldNotDeleteImport);
    } finally {
      setDeletingId(null);
      setConfirmDelete(null);
    }
  };

  const tabs: { key: ImportTab; label: string; icon: React.ElementType }[] = [
    { key: 'url', label: copy.import.urlTab, icon: Link },
    { key: 'paste', label: copy.import.pasteTab, icon: Clipboard },
    { key: 'pdf', label: copy.import.fileTab, icon: FileText },
  ];
  const typeLabel = (t: string) => (t === 'paste' ? ix.text : t === 'url' ? 'URL' : t.toUpperCase());
  const typeIcon = (t: string) => (t === 'url' ? Link : t === 'paste' ? Clipboard : t === 'epub' ? BookOpen : FileText);
  const typeTone = (t: string) =>
    t === 'url' ? 'bg-g-blue-50 text-g-blue-700' : t === 'paste' ? 'bg-[#ecfeff] text-[#0e7490]' : t === 'epub' ? 'bg-[#f5f3ff] text-[#6d28d9]' : 'bg-[#fff1f1] text-[#dc2626]';
  const hostOf = (u?: string | null) => { try { return u ? new URL(u).hostname.replace(/^www\./, '') : ''; } catch { return ''; } };
  const pageCountTotal = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const busy = loading || atImportLimit;

  return (
    <div className="w-full max-w-[1180px] mx-auto px-3 sm:px-6 py-5 lg:py-8 min-w-0 overflow-x-clip">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-5 min-w-0">
        <div className="min-w-0">
          <h1 className="text-[22px] sm:text-2xl font-bold tracking-tight text-[#101828]">{copy.importPage.pageTitle}</h1>
          <p className="text-sm text-[#6b7080] mt-0.5 [overflow-wrap:anywhere]">{copy.importPage.pageSubtitle}</p>
        </div>
        {freeAllowance && (
          <div className="grid grid-cols-2 gap-2 sm:flex shrink-0" title={formatFreeAllowance(freeAllowance, copy.billing)}>
            {[
              { v: freeAllowance.dailyFreeRemaining, of: freeAllowance.dailyFreeImportsPerUser, l: ix.importsLeft, c: 'bg-g-blue-700' },
              { v: freeAllowance.monthlyPagesRemaining, of: freeAllowance.monthlyFreePageLimit, l: ix.pagesLeft, c: 'bg-[#0e7490]' },
            ].map((q) => (
              <div key={q.l} className="flex items-center gap-3 bg-white border border-[#e9ebf3] rounded-xl px-3 py-2 min-w-0">
                <div className="min-w-0">
                  <b className="block text-sm font-bold text-[#101828] tabular-nums">{q.v} / {q.of}</b>
                  <span className="block text-[11px] text-[#8a8fa0] truncate">{q.l}</span>
                </div>
                <span className="hidden sm:block w-14 h-1.5 rounded-full bg-[#eef0ff] overflow-hidden shrink-0">
                  <i className={cn('block h-full rounded-full', q.c)} style={{ width: `${q.of ? Math.round((q.v / q.of) * 100) : 0}%` }} />
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 w-full min-w-0 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] gap-4 lg:gap-5 items-start">
        <section className="gotcha-import-panel bg-white rounded-2xl border border-[#e9ebf3] overflow-hidden w-full max-w-full min-w-0">
          <div className="grid grid-cols-3 gap-1 bg-[#f1f2f7] rounded-xl p-1 m-3 sm:m-4 mb-0 sm:mb-0" role="tablist" aria-label={copy.importPage.pageTitle}>
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                disabled={loading}
                onClick={() => { setTab(t.key); setPending(null); }}
                className={cn(
                  'min-w-0 h-9 inline-flex items-center justify-center gap-1.5 rounded-[9px] text-[13px] font-semibold transition-colors disabled:opacity-60',
                  tab === t.key ? 'bg-white text-[#101828] shadow-sm' : 'text-[#6b7080] hover:text-[#101828]',
                )}
              >
                <t.icon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{t.label}</span>
              </button>
            ))}
          </div>
          <div className="p-3 sm:p-4 min-w-0 max-w-full [overflow-wrap:anywhere] space-y-3">
            {atImportLimit && (
              <div className="flex items-start gap-2 p-3 bg-[#fffbeb] border border-[#fee685] rounded-xl">
                <AlertCircle className="w-4 h-4 text-[#bb4d00] shrink-0 mt-0.5" />
                <p className="text-xs text-[#bb4d00] break-words">
                  {gatewayEnabled
                    ? copy.importPage.allowanceReachedPaid
                    : copy.importPage.allowanceReachedFree}
                </p>
              </div>
            )}
            {paidRetry.freeRetries.some((r) => r.reason !== 'paid_late') && (
              <div role="status" data-testid="imp-free-retry" className="p-3 rounded-xl border text-xs leading-relaxed" style={{ background: 'var(--g-card)', borderColor: 'var(--g-ok)' }}>
                {payCopy.t('imp.freeRetry')}
              </div>
            )}
            {/* PAY2-08: paid, but the import never ran (payment confirmed late). imp.refundDue stays for the refund-due case. */}
            {paidRetry.freeRetries.filter((r) => r.reason === 'paid_late').map((r) => (
              <div key={r.paymentId} role="status" data-testid="imp-paid-no-result" className="p-3 rounded-xl border text-xs leading-relaxed" style={{ background: 'var(--g-card)', borderColor: 'var(--g-line)', color: 'var(--g-text)' }}>
                <p className="font-bold text-sm mb-1">{payCopy.t('imp.paidNoResult.title')}</p>
                <p>{payCopy.t('imp.paidNoResult.body')}</p>
                <a href={refundRequestHref(r.paymentId)} data-testid="imp-paid-no-result-refund" className="mt-2 inline-flex min-h-[44px] items-center font-semibold underline">{payCopy.t('imp.paidNoResult.refund')}</a>
              </div>
            ))}
            {paidRetry.refundDue > 0 && (
              <div role="status" data-testid="imp-refund-due" className="p-3 rounded-xl border text-xs leading-relaxed" style={{ background: 'var(--g-card)', borderColor: 'var(--g-line)' }}>
                {payCopy.t('imp.refundDue')}
              </div>
            )}
            <p className="text-[11.5px] text-[#8a8fa0] leading-relaxed break-words">
              {gatewayEnabled && payments
                ? copy.importPage.paidImportsHint
                : copy.importPage.freeImportsHint}
            </p>
            {pending ? (
              <ConfirmCard
                pending={pending}
                ix={ix}
                freeLeft={freeAllowance?.dailyFreeRemaining ?? null}
                freePerDay={freeAllowance?.dailyFreeImportsPerUser ?? null}
                timeAgo={(iso) => relativeTime(iso, copy)}
                onCancel={() => setPending(null)}
                onOpen={(cid) => navigate(`/app/read/${cid}`)}
                onConfirm={() => { const p = pending; setPending(null); void p.run(); }}
              />
            ) : null}
            {/* Forms stay mounted so switching tabs never loses what was typed. */}
            <div hidden={tab !== 'url' || !!pending}><URLForm loading={busy} onSubmit={handleUrlImport} ix={ix} prefill={urlPrefill} /></div>
            <div hidden={tab !== 'paste' || !!pending}><PasteForm loading={busy} onSubmit={handlePasteImport} ix={ix} /></div>
            <div hidden={tab !== 'pdf' || !!pending}><FileForm loading={busy} onSubmit={handleFileImport} ix={ix} /></div>
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-[#e9ebf3] min-w-0 w-full max-w-full overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3.5 min-w-0">
            <h2 className="text-base font-bold text-[#101828] min-w-0">{copy.importPage.importHistory}</h2>
            <span className="text-xs text-[#8a8fa0] shrink-0">
              {importsUnlimited || importLimit == null ? ix.total(total) : copy.importPage.importsCountLimit(total, importLimit)}
            </span>
          </div>

          {historyLoading ? (
            <div className="py-16 text-center text-gray-400 text-sm flex flex-col items-center gap-2 border-t border-[#f2f3f7]">
              <Loader2 className="w-5 h-5 animate-spin" />
              {copy.common.loading}
            </div>
          ) : imports.length === 0 ? (
            <div className="border-t border-[#f2f3f7]">
              <EmptyState icon={Upload} title={copy.import.noImports} description={copy.importPage.pageSubtitle} compact />
            </div>
          ) : (
            <>
              <ul>
                {imports.map((item) => {
                  const Icon = typeIcon(item.importType);
                  const pendingRow = isPendingStatus(item.ingestionStatus);
                  const host = hostOf(item.sourceUrl);
                  const pct = item.progressPagesTotal ? Math.min(100, Math.round(((item.progressPagesDone ?? 0) / item.progressPagesTotal) * 100)) : null;
                  return (
                    <li key={item.id} className="flex items-center gap-3 px-3 sm:px-4 py-3 border-t border-[#f2f3f7] min-h-[64px]">
                      <span className={cn('size-9 rounded-[10px] grid place-items-center shrink-0', typeTone(item.importType))}><Icon className="w-[17px] h-[17px]" /></span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-[#101828] truncate">{item.title}</div>
                        <div className="flex items-center gap-1.5 text-xs text-[#8a8fa0] mt-0.5 min-w-0 whitespace-nowrap overflow-hidden">
                          <span>{typeLabel(item.importType)}</span>
                          {host && <><span>·</span><span className="truncate">{host}</span></>}
                          {!!item.content?.wordCount && item.content.wordCount > 0 && <><span>·</span><span>{copy.common.words(item.content.wordCount)}</span></>}
                          {item.ingestionStatus === 'failed' && item.errorMessage ? (
                            <><span>·</span><span className="text-[#dc2626] truncate">{importErrorText(locale, item.errorMessage, ix.failedGeneric)}</span></>
                          ) : pendingRow && item.progressPagesTotal ? (
                            <><span>·</span><span className="text-g-blue-700 tabular-nums">{copy.importPage.pagesProgress(Math.min(item.progressPagesDone ?? 0, item.progressPagesTotal), item.progressPagesTotal)}</span></>
                          ) : (
                            <><span>·</span><span>{relativeTime(item.createdAt, copy)}</span></>
                          )}
                        </div>
                        {pendingRow && pct != null && (
                          <div className="h-1 rounded-full bg-[#eef0ff] overflow-hidden mt-1.5 max-w-[180px]"><i className="block h-full bg-g-blue-700" style={{ width: `${pct}%` }} /></div>
                        )}
                        {pendingRow && item.progressPhase === 'ocr' && <div className="text-xs text-g-blue-800 mt-1">{ix.ocrRow}</div>}
                        {pendingRow && item.progressPhase === 'ai' && <div className="text-xs text-g-blue-800 mt-1">{ix.aiRow}</div>}
                        {pendingRow && !item.progressPhase && pendingForMs(item.createdAt) > 3 * 60_000 && <div className="text-xs text-[#bb4d00] mt-1">{ix.stuck}</div>}
                        {item.ingestionStatus === 'ready' && item.errorMessage && (
                          <div className="text-xs text-amber-600 truncate mt-0.5">{importErrorText(locale, item.errorMessage, item.errorMessage)}</div>
                        )}
                      </div>
                      <span className="hidden sm:inline-flex">{statusBadge(item.ingestionStatus, copy)}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {item.ingestionStatus === 'ready' && item.content?.id && (
                          <button
                            type="button"
                            onClick={() => navigate(`/app/read/${item.content!.id}`)}
                            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-[9px] border border-[#e1e3ec] bg-white text-[#101828] text-xs font-semibold hover:bg-gray-50"
                          >
                            <BookOpen className="w-3.5 h-3.5" /><span className="hidden min-[420px]:inline">{copy.importPage.read}</span>
                          </button>
                        )}
                        {item.ingestionStatus === 'failed' && item.importType === 'url' && item.sourceUrl && !isPrivateUrl(item.sourceUrl) && (
                          <button
                            type="button"
                            onClick={() => { setTab('url'); setPending(null); setUrlPrefill({ url: item.sourceUrl!, n: Date.now() }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-[9px] border border-[#e1e3ec] bg-white text-[#101828] text-xs font-semibold hover:bg-gray-50"
                          >
                            <RotateCcw className="w-3.5 h-3.5" /><span className="hidden min-[420px]:inline">{ix.retry}</span>
                          </button>
                        )}
                        {(item.ingestionStatus === 'ready' || item.ingestionStatus === 'failed') && (
                          <button
                            type="button"
                            disabled={deletingId === item.id}
                            onClick={() => setConfirmDelete(item)}
                            className="inline-grid place-items-center size-8 rounded-[9px] text-[#9aa0ae] hover:text-[#dc2626] hover:bg-[#fff1f1] disabled:opacity-50"
                            title={copy.importPage.deleteImport}
                            aria-label={copy.importPage.deleteImport}
                          >
                            {deletingId === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
              {(page > 1 || hasMore) && (
                <div className="flex items-center justify-between px-4 py-2.5 border-t border-[#f2f3f7] text-xs text-[#6b7080]">
                  <span>{ix.pageOf(page, pageCountTotal)}</span>
                  <span className="flex gap-1.5">
                    <button type="button" disabled={page <= 1 || loading} onClick={() => void load(page - 1)} aria-label={copy.importPage.previous} className="size-8 rounded-[9px] border border-[#e1e3ec] grid place-items-center disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
                    <button type="button" disabled={!hasMore || loading} onClick={() => void load(page + 1)} aria-label={copy.importPage.next} className="size-8 rounded-[9px] border border-[#e1e3ec] grid place-items-center disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
                  </span>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {confirmDelete && (
        <DeleteDialog
          item={confirmDelete}
          ix={ix}
          copy={copy}
          busy={deletingId === confirmDelete.id}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => void handleDelete(confirmDelete)}
        />
      )}

      <PaymentConfirmModal
        state={paymentModal}
        onClose={closePaymentModal}
        loading={loading}
      />
    </div>
  );
}
