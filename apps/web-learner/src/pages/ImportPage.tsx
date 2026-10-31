import { useEffect, useRef, useState, useCallback } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clipboard,
  Clock,
  ExternalLink,
  FileText,
  Globe,
  Link,
  Loader2,
  Trash2,
  Upload,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { EmptyState } from '../components/EmptyState';
import { Button } from '../components/ui/button';
import { Dialog } from '../components/ui/dialog';
import { cn } from '../components/ui/utils';
import { api } from '../lib/api';
import { formatUzs, formatFreeAllowance, inspectImportFile, type ImportQuote, type ImportFreeAllowance } from '../lib/importBilling';
import { countPdfPagesFromFile } from '../lib/pdfPageCount';
import { useCatalogLanguages } from '../lib/catalogLanguages';
import { CatalogLanguageDropdown } from '../components/CatalogLanguageDropdown';
import { useAuth } from '../lib/auth';
import { useLearnerCopy } from '../lib/learnerLocaleContext';
import { PromoCodeField } from '../components/PromoCodeField';
import { CardForm, OtpForm, PayTrust, CancelConfirm, CancelOutcome, runCancel, usePay } from '../components/payments';
import { refundRequestHref } from '@gotcha/shared';
import { cancelScreen } from '@gotcha/shared';
import { BrandMark } from '../components/GotchaLogo';

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

function formatWordCount(count: number, copy: LearnerCopy) {
  return copy.common.words(count);
}

function isPendingStatus(status: string) {
  return status === 'queued' || status === 'processing' || status === 'tokenizing';
}

function pendingForMs(iso: string) {
  return Date.now() - new Date(iso).getTime();
}

function statusBadge(status: string, copy: LearnerCopy) {
  switch (status) {
    case 'ready':
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#007a55] bg-[#ecfdf5] border border-[#a4f4cf] rounded-full px-2 py-0.5 shrink-0">
          <CheckCircle2 className="w-3 h-3" />{copy.importPage.statusReady}
        </span>
      );
    case 'processing':
    case 'tokenizing':
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-g-learning-text bg-g-learning-bg border border-[#bedbff] rounded-full px-2 py-0.5 shrink-0">
          <Loader2 className="w-3 h-3 animate-spin" />{copy.importPage.statusProcessing}
        </span>
      );
    case 'queued':
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#bb4d00] bg-[#fffbeb] border border-[#fee685] rounded-full px-2 py-0.5 shrink-0">
          <Clock className="w-3 h-3" />{copy.importPage.statusQueued}
        </span>
      );
    case 'failed':
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#c10007] bg-[#fef2f2] border border-[#ffc9c9] rounded-full px-2 py-0.5 shrink-0">
          <AlertCircle className="w-3 h-3" />{copy.importPage.statusFailed}
        </span>
      );
    default:
      return <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 bg-gray-50 border border-gray-200 rounded-full px-2 py-0.5 capitalize shrink-0">{status}</span>;
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

function LangSelect({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const copy = useLearnerCopy();
  const { langs } = useCatalogLanguages();
  const { user } = useAuth();
  const options = langs.filter((l) => l.code !== user?.nativeLanguage);

  return (
    <div className="py-4 min-w-0 max-w-full">
      <label className="block text-xs font-semibold text-[#4a5565] mb-1.5">{copy.importPage.language}</label>
      <CatalogLanguageDropdown
        value={value}
        onChange={onChange}
        options={options.map((l) => ({ code: l.code, name: l.name, nativeName: l.nativeName }))}
        ariaLabel={copy.importPage.language}
        disabled={disabled}
      />
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
      className="w-full min-w-0 max-w-full h-10 px-3 rounded-[14px] bg-g-blue-700 hover:bg-g-blue-700 disabled:opacity-50 disabled:pointer-events-none text-g-on-cta text-sm font-medium inline-flex items-center justify-center gap-2 transition-colors"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
      {children}
    </button>
  );
}

function URLForm({ loading, onSubmit }: { loading: boolean; onSubmit: (data: { url: string; title: string; lang: string }) => void }) {
  const copy = useLearnerCopy();
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [lang, setLang] = useState('en');
  const valid = /^https?:\/\//i.test(url.trim());

  return (
    <div className="min-w-0 max-w-full">
      <div className="min-w-0">
        <label className="block text-xs font-semibold text-[#4a5565] mb-1.5">{copy.import.urlTab}</label>
        <div className="relative min-w-0 max-w-full">
          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="url"
            value={url}
            disabled={loading}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={copy.import.urlPlaceholder}
            className="block w-full min-w-0 max-w-full pl-9 pr-4 h-10 bg-white border border-[#e5e7eb] rounded-[14px] text-sm outline-none focus:ring-2 focus:ring-violet-200 focus:border-g-blue-700 transition-all disabled:opacity-50"
          />
        </div>
        <p className="text-xs text-[#99a1af] mt-1 leading-relaxed [overflow-wrap:anywhere]">{copy.importPage.urlHelp}</p>
      </div>
      <div className="pt-4 min-w-0">
        <label className="block text-xs font-semibold text-[#4a5565] mb-1.5">{copy.importPage.titleOptional}</label>
        <input
          type="text"
          value={title}
          disabled={loading}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={copy.importPage.autoFromPage}
          className="block w-full min-w-0 max-w-full px-3 h-10 bg-white border border-[#e5e7eb] rounded-[14px] text-sm outline-none focus:ring-2 focus:ring-violet-200 focus:border-g-blue-700 transition-all disabled:opacity-50"
        />
      </div>
      <LangSelect value={lang} onChange={setLang} disabled={loading} />
      <SubmitButton icon={Link} disabled={!valid} loading={loading} onClick={() => onSubmit({ url: url.trim(), title, lang })}>
        {loading ? copy.import.importing : copy.importPage.importFromUrl}
      </SubmitButton>
    </div>
  );
}

function PasteForm({ loading, onSubmit }: { loading: boolean; onSubmit: (data: { text: string; title: string; lang: string }) => void }) {
  const copy = useLearnerCopy();
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [lang, setLang] = useState('en');
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const tooLong = text.length > MAX_PASTE_CHARS;
  const valid = words >= MIN_PASTE_WORDS && title.trim().length > 0 && !tooLong;

  return (
    <div className="min-w-0 max-w-full">
      <div className="min-w-0">
        <label className="block text-xs font-semibold text-[#4a5565] mb-1.5">{copy.importPage.titleLabel}</label>
        <input
          type="text"
          value={title}
          disabled={loading}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={copy.importPage.titlePlaceholder}
          className="block w-full min-w-0 max-w-full px-3 h-10 bg-white border border-[#e5e7eb] rounded-[14px] text-sm outline-none focus:ring-2 focus:ring-violet-200 focus:border-g-blue-700 transition-all disabled:opacity-50"
        />
      </div>
      <div className="pt-4 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-semibold text-[#4a5565]">{copy.importPage.textLabel}</label>
          <span className={cn('text-xs tabular-nums', words < MIN_PASTE_WORDS || tooLong ? 'text-[#99a1af]' : 'text-emerald-600 font-medium')}>
            {copy.common.words(words)}
          </span>
        </div>
        <textarea
          value={text}
          disabled={loading}
          onChange={(e) => setText(e.target.value)}
          placeholder={copy.importPage.pastePlaceholder}
          rows={8}
          className="block w-full min-w-0 max-w-full px-3 py-2.5 bg-white border border-[#e5e7eb] rounded-[14px] text-sm resize-none outline-none focus:ring-2 focus:ring-violet-200 focus:border-g-blue-700 transition-all disabled:opacity-50"
        />
        {words > 0 && words < MIN_PASTE_WORDS && (
          <p className="text-xs text-amber-600 mt-1">{MIN_PASTE_WORDS - words} {copy.importPage.wordsNeeded}</p>
        )}
        {tooLong && (
          <p className="text-xs text-[#c10007] mt-1">
            {copy.importPage.textTooLong(MAX_PASTE_CHARS)}
          </p>
        )}
      </div>
      <LangSelect value={lang} onChange={setLang} disabled={loading} />
      <SubmitButton icon={Clipboard} disabled={!valid} loading={loading} onClick={() => onSubmit({ text, title, lang })}>
        {loading ? copy.import.importing : copy.importPage.importText}
      </SubmitButton>
    </div>
  );
}

function FileForm({ loading, onSubmit }: { loading: boolean; onSubmit: (data: { file: File; title: string; lang: string }) => void }) {
  const copy = useLearnerCopy();
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
      setFileError(copy.importPage.onlyPdfEpub);
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
    <div className="min-w-0 max-w-full">
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
          'border-[1.6px] border-dashed rounded-[14px] p-5 sm:p-8 text-center cursor-pointer transition-all flex flex-col items-center min-w-0 w-full max-w-full',
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
            <FileText className="w-8 h-8 text-violet-500 mb-2 shrink-0" />
            <div className="font-medium text-gray-700 text-sm px-1 max-w-full truncate">{file.name}</div>
            <div className="text-[#99a1af] text-xs mt-0.5">{(file.size / 1024).toFixed(0)} KB · click to change</div>
          </>
        ) : (
          <>
            <Upload className="w-8 h-8 text-gray-300 mb-2 shrink-0" />
            <div className="text-sm text-[#6a7282] px-1 leading-snug [overflow-wrap:anywhere]">{copy.importPage.dropFile}</div>
            <div className="text-xs text-[#99a1af] mt-1 px-1 leading-snug [overflow-wrap:anywhere]">Max {MAX_FILE_MB} MB · PDF and EPUB · books split into printed chapters</div>
          </>
        )}
      </div>
      {fileError && (
        <p className="text-xs text-[#c10007] mt-2 flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />{fileError}
        </p>
      )}
      <div className="pt-4">
        <label className="block text-xs font-semibold text-[#4a5565] mb-1.5">{copy.importPage.titleOptional}</label>
        <input
          type="text"
          value={title}
          disabled={loading}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={copy.importPage.autoFromFilename}
          className="block w-full min-w-0 max-w-full px-3 h-10 bg-white border border-[#e5e7eb] rounded-[14px] text-sm outline-none focus:ring-2 focus:ring-violet-200 focus:border-g-blue-700 transition-all disabled:opacity-50"
        />
      </div>
      <LangSelect value={lang} onChange={setLang} disabled={loading} />
      <SubmitButton
        icon={Upload}
        disabled={!valid}
        loading={loading}
        onClick={() => file && onSubmit({ file, title, lang })}
      >
        {loading ? copy.import.importing : copy.importPage.uploadFile}
      </SubmitButton>
    </div>
  );
}

function ImportLogoMark() {
  return <BrandMark size={36} />;
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
  const [promoQuote, setPromoQuote] = useState<import('../lib/importBilling').ImportQuote | null>(null);

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
      setPromoQuote(null);
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

  const { quote: baseQuote, onPaid, importTitle, importType } = state;
  const quote = promoQuote ?? baseQuote;
  const applyPromo = async (code: string) => {
    setLoading(true);
    setError(null);
    try {
      const { quoteImport } = await import('../lib/importBilling');
      setPromoQuote(await quoteImport({
        importType: baseQuote.importType as 'paste' | 'url' | 'pdf' | 'epub',
        contentFormat: baseQuote.contentFormat,
        pageCount: baseQuote.estimatedPages,
        promoCode: code,
      }));
    } catch (err) {
      setError(pay.errOr(err, copy.errors.failedStartPayment));
    } finally {
      setLoading(false);
    }
  };
  const displayTitle = importTitle || 'Your Import';
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
        <div className="w-9 h-[5px] rounded-full bg-[#d1d5db]" />

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
                ~{quote.estimatedPages.toLocaleString()} {quote.estimatedPages === 1 ? 'page' : 'pages'}
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

            {quote.requiresPayment && (
              <PromoCodeField applied={quote.promo?.code ?? null} busy={loading} onApply={applyPromo} onRemove={() => setPromoQuote(null)} />
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

export default function ImportPage() {
  const copy = useLearnerCopy();
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

  useEffect(() => {
    void load(1).finally(() => setHistoryLoading(false));
  }, []);

  useEffect(() => {
    const pending = imports.some((i) => isPendingStatus(i.ingestionStatus));
    if (!pending) return;
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
      if (item.progressPhase === 'ocr') {
        toast.info('AI detected scanned pages. Reading them may take a few minutes.', {
          id: key,
          duration: 9000,
        });
      } else if (item.progressPhase === 'ai') {
        toast.info('AI is cleaning up the text. This can take a little longer.', {
          id: key,
          duration: 8000,
        });
      }
    }
  }, [imports]);

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
      toast.error(item.errorMessage || copy.importPage.statusFailed);
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


  const handleUrlImport = async (data: { url: string; title: string; lang: string }) => {
    if (!guardLimit()) return;
    setLoading(true);
    try {
      const { quoteImport: getQuote, checkoutImport } = await import('../lib/importBilling');
      const quote = await getQuote({ importType: 'url', contentFormat: 'article', textLength: 6000 });

      if (quote.gatewayEnabled && quote.requiresPayment) {
        openPayOrRetry({
          open: true,
          quote,
          importTitle: data.title || data.url,
          importType: 'url',
          onPaid: async (paymentId) => {
            setLoading(true);
            try {
              const item = await api<ImportItem>('/imports/url', {
                method: 'POST',
                body: JSON.stringify({
                  url: data.url,
                  language: data.lang,
                  title: data.title || undefined,
                  paymentId,
                }),
              });
              toastReady(item);
              await load(1);
            } catch (err) {
              toast.error(err instanceof Error ? err.message : copy.errors.importFailed);
            } finally {
              setLoading(false);
            }
          },
        });
        return;
      }

      let paymentId: string | null = null;
      if (quote.gatewayEnabled) {
        const checkout = await checkoutImport({ importType: 'url', contentFormat: 'article', textLength: 6000 });
        paymentId = checkout.paymentId;
      }
      const item = await api<ImportItem>('/imports/url', {
        method: 'POST',
        body: JSON.stringify({ url: data.url, language: data.lang, title: data.title || undefined, ...(paymentId ? { paymentId } : {}) }),
      });
      toastReady(item);
      await load(1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.errors.importFailed);
    } finally {
      if (!paymentModal.open) setLoading(false);
    }
  };

  const handlePasteImport = async (data: { text: string; title: string; lang: string }) => {
    if (!guardLimit()) return;
    setLoading(true);
    try {
      const { quoteImport: getQuote, checkoutImport, wordCountOf } = await import('../lib/importBilling');
      const words = wordCountOf(data.text);
      const quoteParams = { importType: 'paste' as const, contentFormat: 'article', textLength: data.text.length, wordCount: words };
      const quote = await getQuote(quoteParams);

      if (quote.gatewayEnabled && quote.requiresPayment) {
        openPayOrRetry({
          open: true,
          quote,
          importTitle: data.title,
          importType: 'paste',
          onPaid: async (paymentId) => {
            setLoading(true);
            try {
              const item = await api<ImportItem>('/imports/paste', {
                method: 'POST',
                body: JSON.stringify({ title: data.title, text: data.text, language: data.lang, paymentId }),
              });
              toastReady(item);
              await load(1);
            } catch (err) {
              toast.error(err instanceof Error ? err.message : copy.errors.importFailed);
            } finally {
              setLoading(false);
            }
          },
        });
        return;
      }

      let paymentId: string | null = null;
      if (quote.gatewayEnabled) {
        const checkout = await checkoutImport(quoteParams);
        paymentId = checkout.paymentId;
      }
      const item = await api<ImportItem>('/imports/paste', {
        method: 'POST',
        body: JSON.stringify({ title: data.title, text: data.text, language: data.lang, ...(paymentId ? { paymentId } : {}) }),
      });
      toastReady(item);
      await load(1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.errors.importFailed);
    } finally {
      if (!paymentModal.open) setLoading(false);
    }
  };

  const handleFileImport = async (data: { file: File; title: string; lang: string }) => {
    if (!guardLimit()) return;
    setLoading(true);
    try {
      const { quoteImport: getQuote, checkoutImport } = await import('../lib/importBilling');
      const isEpub = data.file.name.toLowerCase().endsWith('.epub');
      const importType = isEpub ? 'epub' : 'pdf';
      let pageCount = !isEpub ? await countPdfPagesFromFile(data.file) : null;
      if (!pageCount) {
        pageCount = (await inspectImportFile(data.file)).pageCount;
      }
      const quoteParams = { importType: importType as 'pdf' | 'epub', contentFormat: 'ebook', pageCount };
      const quote = await getQuote(quoteParams);

      if (quote.gatewayEnabled && quote.requiresPayment) {
        openPayOrRetry({
          open: true,
          quote,
          importTitle: data.title || data.file.name,
          importType: importType,
          onPaid: async (paymentId) => {
            setLoading(true);
            try {
              const form = new FormData();
              form.append('file', data.file);
              form.append('language', data.lang);
              if (data.title.trim()) form.append('title', data.title.trim());
              form.append('paymentId', paymentId);
              const item = await api<ImportItem>('/imports/file', { method: 'POST', body: form });
              toastReady(item);
              await load(1);
            } catch (err) {
              toast.error(err instanceof Error ? err.message : copy.errors.uploadFailed);
            } finally {
              setLoading(false);
            }
          },
        });
        return;
      }

      let paymentId: string | null = null;
      if (quote.gatewayEnabled) {
        const checkout = await checkoutImport(quoteParams);
        paymentId = checkout.paymentId;
      }
      const form = new FormData();
      form.append('file', data.file);
      form.append('language', data.lang);
      if (data.title.trim()) form.append('title', data.title.trim());
      if (paymentId) form.append('paymentId', paymentId);
      const item = await api<ImportItem>('/imports/file', { method: 'POST', body: form });
      toastReady(item);
      await load(1);
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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.errors.couldNotDeleteImport);
    } finally {
      setDeletingId(null);
    }
  };

  const tabs: { key: ImportTab; label: string; short: string; icon: React.ElementType }[] = [
    { key: 'url', label: copy.import.urlTab, short: copy.import.urlTab, icon: Link },
    { key: 'paste', label: copy.import.pasteTab, short: copy.import.pasteTab, icon: Clipboard },
    { key: 'pdf', label: copy.import.fileTab, short: copy.import.fileTab, icon: FileText },
  ];

  return (
    <div className="w-full max-w-6xl mx-auto px-3 sm:px-6 py-6 lg:py-8 min-w-0 overflow-x-clip">
      <div className="mb-6 min-w-0 max-w-full">
        <h1 className="text-2xl font-bold text-gray-900">{copy.importPage.pageTitle}</h1>
        <p className="text-[#99a1af] text-sm mt-0.5 [overflow-wrap:anywhere]">{copy.importPage.pageSubtitle}</p>
      </div>

      <div className="grid grid-cols-1 w-full min-w-0 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] gap-6 lg:gap-8 items-start">
        <section className="gotcha-import-panel bg-white rounded-2xl border border-[#f3f4f6] overflow-hidden w-full max-w-full min-w-0">
          <div className="grid grid-cols-3 min-w-0 border-b border-[#f3f4f6]">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                disabled={loading}
                onClick={() => setTab(t.key)}
                className={cn(
                  'min-w-0 max-w-full flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 py-2.5 sm:py-3 px-1 text-[10px] sm:text-xs font-semibold border-b-2 transition-all disabled:opacity-60',
                  tab === t.key ? 'border-g-blue-700 text-g-blue-700 bg-[rgba(245,243,255,0.5)]' : 'border-transparent text-[#99a1af] hover:text-gray-600 hover:bg-gray-50',
                )}
              >
                <t.icon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate max-w-full sm:hidden">{t.short}</span>
                <span className="hidden sm:inline truncate max-w-full">{t.label}</span>
              </button>
            ))}
          </div>
          <div className="p-3 sm:p-5 min-w-0 max-w-full [overflow-wrap:anywhere]">
            {atImportLimit && (
              <div className="flex items-start gap-2 p-3 mb-4 bg-[#fffbeb] border border-[#fee685] rounded-[14px]">
                <AlertCircle className="w-4 h-4 text-[#bb4d00] shrink-0 mt-0.5" />
                <p className="text-xs text-[#bb4d00] break-words">
                  {gatewayEnabled
                    ? copy.importPage.allowanceReachedPaid
                    : copy.importPage.allowanceReachedFree}
                </p>
              </div>
            )}
            {paidRetry.freeRetries.some((r) => r.reason !== 'paid_late') && (
              <div role="status" data-testid="imp-free-retry" className="p-3 mb-4 rounded-[14px] border text-xs leading-relaxed" style={{ background: 'var(--g-card)', borderColor: 'var(--g-ok)' }}>
                {payCopy.t('imp.freeRetry')}
              </div>
            )}
            {/* PAY2-08: paid, but the import never ran (payment confirmed late). imp.refundDue stays for the refund-due case. */}
            {paidRetry.freeRetries.filter((r) => r.reason === 'paid_late').map((r) => (
              <div key={r.paymentId} role="status" data-testid="imp-paid-no-result" className="p-3 mb-4 rounded-[14px] border text-xs leading-relaxed" style={{ background: 'var(--g-card)', borderColor: 'var(--g-line)', color: 'var(--g-text)' }}>
                <p className="font-bold text-sm mb-1">{payCopy.t('imp.paidNoResult.title')}</p>
                <p>{payCopy.t('imp.paidNoResult.body')}</p>
                <a href={refundRequestHref(r.paymentId)} data-testid="imp-paid-no-result-refund" className="mt-2 inline-flex min-h-[44px] items-center font-semibold underline">{payCopy.t('imp.paidNoResult.refund')}</a>
              </div>
            ))}
            {paidRetry.refundDue > 0 && (
              <div role="status" data-testid="imp-refund-due" className="p-3 mb-4 rounded-[14px] border text-xs leading-relaxed" style={{ background: 'var(--g-card)', borderColor: 'var(--g-line)' }}>
                {payCopy.t('imp.refundDue')}
              </div>
            )}
            {freeAllowance && (
              <div className="flex items-start gap-2 p-3 mb-4 bg-g-blue-50 border border-g-blue-200 rounded-[14px]">
                <p className="text-xs text-g-blue-800 leading-relaxed break-words">{formatFreeAllowance(freeAllowance, copy.billing)}</p>
              </div>
            )}
            <p className="text-[11px] text-[#99a1af] mb-3 leading-relaxed break-words">
              {gatewayEnabled
                ? copy.importPage.paidImportsHint
                : copy.importPage.freeImportsHint}
            </p>
            {tab === 'url' && <URLForm loading={loading || atImportLimit} onSubmit={handleUrlImport} />}
            {tab === 'paste' && <PasteForm loading={loading || atImportLimit} onSubmit={handlePasteImport} />}
            {tab === 'pdf' && <FileForm loading={loading || atImportLimit} onSubmit={handleFileImport} />}
          </div>
        </section>

        <div className="min-w-0 w-full max-w-full">
          <div className="flex items-start justify-between gap-3 mb-4 min-w-0">
            <h2 className="font-bold text-gray-900 text-xl min-w-0">{copy.importPage.importHistory}</h2>
            <span className="text-xs text-[#99a1af] text-right shrink-0 max-w-[55%] leading-snug">
              {freeAllowance
                ? copy.importPage.freeLeftToday(freeAllowance.dailyFreeRemaining, total)
                : importsUnlimited || importLimit == null
                  ? copy.importPage.importsCount(total)
                  : copy.importPage.importsCountLimit(total, importLimit)}
            </span>
          </div>

          {historyLoading ? (
            <div className="py-16 text-center text-gray-400 text-sm flex flex-col items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              {copy.common.loading}
            </div>
          ) : imports.length === 0 ? (
            <EmptyState
              icon={Upload}
              title={copy.import.noImports}
              description={copy.importPage.pageSubtitle}
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
                          {statusBadge(item.ingestionStatus, copy)}
                        </div>
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          <span className="text-xs text-[#99a1af]">{relativeTime(item.createdAt, copy)}</span>
                          {!!item.content?.wordCount && item.content.wordCount > 0 && (
                            <span className="text-xs text-[#99a1af]">{formatWordCount(item.content.wordCount, copy)}</span>
                          )}
                          {isPendingStatus(item.ingestionStatus) &&
                            item.progressPagesTotal != null &&
                            item.progressPagesTotal > 0 && (
                              <span className="text-xs text-g-learning-text tabular-nums">
                                {copy.importPage.pagesProgress(
                                  Math.min(item.progressPagesDone ?? 0, item.progressPagesTotal),
                                  item.progressPagesTotal,
                                )}
                              </span>
                            )}
                          {isPendingStatus(item.ingestionStatus) && item.progressPhase === 'ocr' && (
                            <span className="text-xs text-g-blue-800">
                              AI is reading scanned pages…
                            </span>
                          )}
                          {isPendingStatus(item.ingestionStatus) && item.progressPhase === 'ai' && (
                            <span className="text-xs text-g-blue-800">
                              AI is cleaning up the text…
                            </span>
                          )}
                          {isPendingStatus(item.ingestionStatus) &&
                            !item.progressPhase &&
                            pendingForMs(item.createdAt) > 3 * 60_000 && (
                            <span className="text-xs text-[#bb4d00]">
                              Still working — this will fail automatically if it stays stuck.
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
                            <ExternalLink className="w-3.5 h-3.5" />{copy.importPage.read}
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={deletingId === item.id}
                          onClick={() => void handleDelete(item)}
                          className="ml-auto inline-flex items-center gap-1.5 h-7 px-2.5 rounded-[14px] text-[#ff6467] hover:bg-red-50 text-xs font-medium disabled:opacity-50"
                          title={copy.importPage.deleteImport}
                        >
                          {deletingId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          {copy.importPage.delete}
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
                    {copy.importPage.previous}
                  </Button>
                  <span className="text-xs text-gray-400">Page {page} of {Math.max(1, Math.ceil(total / PAGE_SIZE))}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl text-xs"
                    disabled={!hasMore || loading}
                    onClick={() => void load(page + 1)}
                  >
                    {copy.importPage.next}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <PaymentConfirmModal
        state={paymentModal}
        onClose={closePaymentModal}
        loading={loading}
      />
    </div>
  );
}
