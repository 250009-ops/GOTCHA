import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Brain,
  Check,
  CheckCircle2,
  ChevronsUp,
  Clock,
  Copy,
  Loader2,
  Minus,
  Play,
  Search,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { EmptyState } from '../components/EmptyState';
import { Button } from '../components/ui/button';
import { CatalogLanguageFlag } from '../components/CatalogLanguageFlag';
import { cn } from '../components/ui/utils';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useLearnerCopy, useLearnerLocale } from '../lib/learnerLocaleContext';
import { surfaceCopy } from '@gotcha/shared';
import { LANGUAGE_META, type VocabItem } from '../lib/types';

type SortKey = 'lemma' | 'dueAt' | 'repetitions';
type VocabStatus = 'learning' | 'known';
type LearnerCopy = ReturnType<typeof useLearnerCopy>;

const SRS_RATING_VALUES = ['Again', 'Hard', 'Good', 'Easy'] as const;
/** Quick cards are a short round; the full review lives in Mashq. */
const QUICK_ROUND = 20;
const PAGE = 50;
const UNDO_MS = 5000;

/** Vocabulary strings not in the shared copy yet (uz / ru / en). */
const VX = {
  en: {
    subtitle: 'Words you saved while reading and chatting', all: 'All', quick: 'Quick cards', practise: (n: number) => `Review in Practice · ${n}`, practiseShort: 'Review in Practice',
    total: 'Total words', due: 'Due for review', learning: 'Learning', mastered: 'Mastered', mastery: 'Mastery',
    nativeBanner: (n: number, lang: string) => `${n} ${n === 1 ? 'word is' : 'words are'} saved in your native language (${lang}).`,
    nativeHint: 'You don’t need to learn these.', show: 'Show', removeAll: 'Remove', native: 'Native',
    search: 'Word, translation or source…', sort: 'Sort', sortDue: 'Review order', sortAz: 'A–Z', sortStrength: 'Strength',
    colWord: 'Word & context', colTr: 'Translation', colSrc: 'Source', colStr: 'Strength', colNext: 'Next',
    strength: ['New', 'Weak', 'Fair', 'Good', 'Strong', 'Mastered'], dueNow: 'Due now', masteredNow: 'Mastered', more: (n: number) => `Show ${n} more`,
    removed: (w: string) => `“${w}” removed`, markedKnown: (w: string) => `“${w}” marked as mastered`, undo: 'Undo',
    removeNativeTitle: (n: number) => `Remove ${n} native-language ${n === 1 ? 'word' : 'words'}?`, removeNativeBody: 'They leave your vocabulary and reviews. This can’t be undone.',
    cancel: 'Cancel', chat: 'Chat', round: (n: number, of: number) => `${n} / ${of}`, keys: 'Space — answer · 1–4 — rate · Esc — close',
  },
  ru: {
    subtitle: 'Слова, сохранённые при чтении и в чатах', all: 'Все', quick: 'Быстрые карточки', practise: (n: number) => `Повторить в Практике · ${n}`, practiseShort: 'Повторить в Практике',
    total: 'Всего слов', due: 'К повторению', learning: 'Изучаю', mastered: 'Выучено', mastery: 'Освоение',
    nativeBanner: (n: number, lang: string) => `Слов на родном языке (${lang}): ${n}.`,
    nativeHint: 'Их не нужно учить.', show: 'Показать', removeAll: 'Удалить', native: 'Родной',
    search: 'Слово, перевод или источник…', sort: 'Сортировка', sortDue: 'По повторению', sortAz: 'А–Я', sortStrength: 'По силе',
    colWord: 'Слово и контекст', colTr: 'Перевод', colSrc: 'Источник', colStr: 'Сила', colNext: 'Далее',
    strength: ['Новое', 'Слабо', 'Средне', 'Хорошо', 'Прочно', 'Выучено'], dueNow: 'Пора повторить', masteredNow: 'Выучено', more: (n: number) => `Показать ещё ${n}`,
    removed: (w: string) => `«${w}» удалено`, markedKnown: (w: string) => `«${w}» отмечено как выученное`, undo: 'Отменить',
    removeNativeTitle: (n: number) => `Удалить слова на родном языке (${n})?`, removeNativeBody: 'Они исчезнут из словаря и повторений. Отменить нельзя.',
    cancel: 'Отмена', chat: 'Чат', round: (n: number, of: number) => `${n} / ${of}`, keys: 'Пробел — ответ · 1–4 — оценка · Esc — выход',
  },
  uz: {
    subtitle: 'Oʻqish va suhbatlarda saqlagan soʻzlaringiz', all: 'Hammasi', quick: 'Tez kartochkalar', practise: (n: number) => `Mashqda takrorlash · ${n}`, practiseShort: 'Mashqda takrorlash',
    total: 'Jami soʻz', due: 'Takrorlash kerak', learning: 'Oʻrganilmoqda', mastered: 'Oʻzlashtirilgan', mastery: 'Oʻzlashtirish',
    nativeBanner: (n: number, lang: string) => `${n} ta soʻz ona tilingizda (${lang}) saqlangan.`,
    nativeHint: 'Ularni oʻrganish shart emas.', show: 'Koʻrish', removeAll: 'Oʻchirish', native: 'Ona tili',
    search: 'Soʻz, tarjima yoki manba…', sort: 'Saralash', sortDue: 'Takrorlash navbati', sortAz: 'A–Z', sortStrength: 'Kuch boʻyicha',
    colWord: 'Soʻz va kontekst', colTr: 'Tarjima', colSrc: 'Manba', colStr: 'Kuch', colNext: 'Keyingi',
    strength: ['Yangi', 'Zaif', 'Oʻrtacha', 'Yaxshi', 'Mustahkam', 'Oʻzlashtirilgan'], dueNow: 'Takrorlash kerak', masteredNow: 'Oʻzlashtirilgan', more: (n: number) => `Yana ${n} ta koʻrsatish`,
    removed: (w: string) => `“${w}” oʻchirildi`, markedKnown: (w: string) => `“${w}” oʻzlashtirilgan deb belgilandi`, undo: 'Qaytarish',
    removeNativeTitle: (n: number) => `Ona tilidagi ${n} ta soʻz oʻchirilsinmi?`, removeNativeBody: 'Ular lugʻat va takrorlashdan oʻchadi. Buni qaytarib boʻlmaydi.',
    cancel: 'Bekor qilish', chat: 'Suhbat', round: (n: number, of: number) => `${n} / ${of}`, keys: 'Probel — javob · 1–4 — baholash · Esc — chiqish',
  },
};
type VocabX = (typeof VX)['en'];

function formatDate(iso: string, copy: LearnerCopy) {
  const diff = Math.round((new Date(iso).getTime() - Date.now()) / 86400000);
  if (diff < -1) return copy.vocabPage.overdue(Math.abs(diff));
  if (diff < 0) return copy.commonExt.yesterday;
  if (diff === 0) return copy.commonExt.today;
  if (diff === 1) return copy.vocabPage.tomorrow;
  return copy.vocabPage.inDays(diff);
}

/** 0–5 memory strength from the SRS fields (shown as bars instead of raw "0d / 0" columns). */
function strengthOf(v: VocabItem): number {
  if (v.mastered) return 5;
  if (!v.repetitions) return 0;
  if (v.intervalDays >= 21) return 4;
  if (v.intervalDays >= 7) return 3;
  if (v.intervalDays >= 2) return 2;
  return 1;
}

function Strength({ value, vx }: { value: number; vx: VocabX }) {
  return (
    <div>
      <div className="flex gap-[3px]" aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => (
          <i key={i} className={cn('block w-4 h-1.5 rounded-full', i < value ? (value >= 5 ? 'bg-[#10b981]' : 'bg-g-blue-700') : 'bg-[#eceef5]')} />
        ))}
      </div>
      <div className="text-[11px] text-[#8a8fa0] mt-1">{vx.strength[value]}</div>
    </div>
  );
}

/** Context sentence with the saved word highlighted. */
function Context({ text, word, className }: { text: string; word: string; className?: string }) {
  const i = text.toLowerCase().indexOf(word.toLowerCase());
  if (i < 0) return <span className={className}>{text}</span>;
  return (
    <span className={className}>
      {text.slice(0, i)}
      <mark className="bg-[#fff6cc] text-[#344054] rounded-[3px] px-0.5">{text.slice(i, i + word.length)}</mark>
      {text.slice(i + word.length)}
    </span>
  );
}

function ReviewModal({
  dueItems,
  onClose,
  vx,
}: {
  dueItems: Array<VocabItem & { status: VocabStatus }>;
  onClose: () => void;
  vx: VocabX;
}) {
  const copy = useLearnerCopy();
  const { locale } = useLearnerLocale();
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [busy, setBusy] = useState(false);

  const ratingButtons = useMemo(
    () =>
      [
        { rating: SRS_RATING_VALUES[0], label: copy.vocabulary.again, key: '1', color: 'border-red-200 hover:bg-red-50 text-red-600', Icon: ThumbsDown },
        { rating: SRS_RATING_VALUES[1], label: copy.vocabulary.hard, key: '2', color: 'border-amber-200 hover:bg-amber-50 text-amber-700', Icon: Minus },
        { rating: SRS_RATING_VALUES[2], label: copy.vocabulary.good, key: '3', color: 'border-g-blue-200 hover:bg-g-blue-50 text-g-blue-700', Icon: ThumbsUp },
        { rating: SRS_RATING_VALUES[3], label: copy.vocabulary.easy, key: '4', color: 'border-emerald-200 hover:bg-emerald-50 text-emerald-700', Icon: ChevronsUp },
      ] as const,
    [copy],
  );

  const done = index >= dueItems.length;
  const item = !done ? dueItems[index] : null;
  const progress = dueItems.length ? Math.round((index / dueItems.length) * 100) : 0;

  // Speed: rate straight against the API and refresh the list once on close — the old path re-fetched
  // the whole vocabulary after every single card, and toasted every rating.
  const rate = async (rating: string) => {
    if (!item || busy) return;
    setBusy(true);
    try {
      await api(`/vocabulary/${item.id}/review`, { method: 'POST', body: JSON.stringify({ rating: rating.toLowerCase() }) });
      setReviewed((r) => r + 1);
      setRevealed(false);
      setIndex((i) => i + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : copy.errors.reviewFailed);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (!revealed && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        setRevealed(true);
        return;
      }
      if (revealed && !busy) {
        const idx = ['1', '2', '3', '4'].indexOf(e.key);
        if (idx !== -1) void rate(ratingButtons[idx].rating);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [revealed, item, onClose, busy, ratingButtons]);

  if (dueItems.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" style={{ background: 'rgba(11,12,38,.5)' }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={vx.quick} className="bg-white rounded-[20px] shadow-2xl w-full max-w-[520px] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-[#eef0f5]">
          <Copy className="w-4 h-4 text-g-blue-700" />
          <span className="text-sm font-semibold text-[#101828]">{vx.quick}</span>
          <span className="ml-auto text-xs font-semibold text-[#8a8fa0] tabular-nums">{vx.round(Math.min(index + 1, dueItems.length), dueItems.length)}</span>
          <button type="button" onClick={onClose} aria-label={copy.commonExt.close} className="p-1 rounded-lg hover:bg-gray-100 text-[#9aa0ae]"><X className="w-4 h-4" /></button>
        </div>
        <div className="h-1 bg-[#eef0ff]"><div className="h-full bg-g-blue-700 transition-all duration-300" style={{ width: `${progress}%` }} /></div>
        {done ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle2 className="w-8 h-8 text-emerald-600" /></div>
            <div className="text-xl font-bold text-[#101828] mb-1">{copy.vocabulary.reviewComplete}</div>
            <div className="text-[#6b7080] text-sm mb-6">{copy.vocabulary.wordsReviewed(reviewed)}</div>
            <Button onClick={onClose} className="rounded-xl bg-g-blue-700 hover:bg-g-blue-800">{copy.vocabulary.title}</Button>
          </div>
        ) : (
          <div className="px-6 sm:px-7 pt-7 pb-5 text-center">
            <div className="text-[32px] sm:text-[34px] font-extrabold tracking-tight text-[#101828] break-words">{item!.lemma}</div>
            <div className="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold text-[#6b7080]">
              <CatalogLanguageFlag code={item!.sourceLang} className="h-3 w-[18px] rounded-[2px]" />
              {item!.content?.title ?? vx.chat}
            </div>
            {item!.contextSentence && (
              <p className="font-serif text-[15px] leading-relaxed text-[#4a5565] mt-4">“<Context text={item!.contextSentence} word={item!.lemma} />”</p>
            )}
            {!revealed ? (
              <button
                type="button"
                onClick={() => setRevealed(true)}
                className="mt-5 w-full py-3.5 bg-[#f6f7fb] border-2 border-dashed border-[#e3e5ee] rounded-xl text-sm font-semibold text-[#6b7080] hover:border-g-blue-200 hover:text-g-blue-700 hover:bg-g-blue-50 transition-all"
              >
                {copy.vocabulary.showAnswer}
                <span className="block text-[11px] mt-0.5 font-medium opacity-70">{surfaceCopy(locale).orPressSpace}</span>
              </button>
            ) : (
              <>
                <div className="mt-5 bg-[#f4f5ff] rounded-xl px-4 py-3 text-[17px] font-semibold text-[#14056b]">{item!.translation}</div>
                <div className="grid grid-cols-4 gap-2 mt-4">
                  {ratingButtons.map((btn) => (
                    <button
                      key={btn.key}
                      type="button"
                      disabled={busy}
                      onClick={() => void rate(btn.rating)}
                      className={cn('flex flex-col items-center gap-1 py-2.5 rounded-xl border text-[13px] font-semibold transition-all disabled:opacity-50', btn.color)}
                    >
                      <btn.Icon className="w-4 h-4" />
                      <span>{btn.label}</span>
                      <span className="text-[10.5px] font-medium text-[#9aa0ae]">{btn.key}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
            <div className="hidden sm:block text-[11.5px] text-[#9aa0ae] mt-4">{vx.keys}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VocabularyPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const copy = useLearnerCopy();
  const { locale } = useLearnerLocale();
  const vx = VX[locale === 'ru' || locale === 'uz' ? locale : 'en'];
  const { user, vocabItems, vocabLoading, vocabError, refreshVocab, markVocabMastered, removeVocab } = useAuth();
  const [search, setSearch] = useState(() => searchParams.get('q') ?? '');
  const [sortKey, setSortKey] = useState<SortKey>('dueAt');
  const [filter, setFilter] = useState<'all' | 'due' | 'learning' | 'known'>('all');
  const [langFilter, setLangFilter] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [sessionDueItems, setSessionDueItems] = useState<Array<VocabItem & { status: VocabStatus }>>([]);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [confirmNative, setConfirmNative] = useState(false);
  const [nativeBusy, setNativeBusy] = useState(false);
  /** Deleted rows hide at once; the real DELETE waits for the undo window. */
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const pendingDeletes = useRef(new Map<string, number>());
  // Server-authoritative "due for review" set — sourced from GET /vocabulary/review-queue
  // rather than recomputing `dueAt <= now` client-side (see docs/E2E_AUDIT_REPORT.md).
  const [reviewQueue, setReviewQueue] = useState<VocabItem[]>([]);

  const loadReviewQueue = () => {
    api<VocabItem[]>('/vocabulary/review-queue?limit=200')
      .then(setReviewQueue)
      .catch(() => undefined);
  };

  useEffect(() => {
    void refreshVocab().catch(() => undefined);
    loadReviewQueue();
  }, [refreshVocab]);

  useEffect(() => {
    const q = searchParams.get('q');
    if (q != null) setSearch(q);
  }, [searchParams]);

  // Leaving the page commits any delete still inside its undo window.
  useEffect(() => {
    const map = pendingDeletes.current;
    return () => {
      for (const [id, timer] of map) {
        window.clearTimeout(timer);
        void removeVocab(id).catch(() => undefined);
      }
      map.clear();
    };
  }, [removeVocab]);

  useEffect(() => setLimit(PAGE), [filter, langFilter, search, sortKey]);

  const native = (user?.nativeLanguage ?? '').toLowerCase();
  const mapped = useMemo(
    () =>
      vocabItems
        .filter((v) => !hidden.has(v.id))
        .map((v) => ({ ...v, status: (v.mastered ? 'known' : 'learning') as VocabStatus })),
    [vocabItems, hidden],
  );

  const dueIds = useMemo(() => new Set(reviewQueue.map((v) => v.id)), [reviewQueue]);
  const dueItems = useMemo(() => mapped.filter((i) => dueIds.has(i.id)), [mapped, dueIds]);
  const totalKnown = mapped.filter((i) => i.status === 'known').length;
  const totalLearning = mapped.length - totalKnown;
  const masteredPct = mapped.length ? Math.round((totalKnown / mapped.length) * 100) : 0;
  const nativeItems = useMemo(() => mapped.filter((i) => native && i.sourceLang?.toLowerCase() === native), [mapped, native]);
  const langCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of mapped) {
      const l = (v.sourceLang ?? '').toLowerCase();
      if (l) m.set(l, (m.get(l) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [mapped]);
  const nativeName = LANGUAGE_META[native as keyof typeof LANGUAGE_META]?.nativeName ?? native.toUpperCase();

  const openReview = () => {
    setSessionDueItems(dueItems.slice(0, QUICK_ROUND));
    setReviewOpen(true);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return mapped
      .filter((item) => {
        if (q) {
          const hit =
            item.lemma.toLowerCase().includes(q) ||
            item.translation.toLowerCase().includes(q) ||
            (item.content?.title ?? '').toLowerCase().includes(q) ||
            (item.contextSentence ?? '').toLowerCase().includes(q);
          if (!hit) return false;
        }
        if (langFilter && (item.sourceLang ?? '').toLowerCase() !== langFilter) return false;
        if (filter === 'due') return dueIds.has(item.id);
        if (filter === 'learning') return item.status === 'learning';
        if (filter === 'known') return item.status === 'known';
        return true;
      })
      .sort((a, b) => {
        if (sortKey === 'lemma') return a.lemma.localeCompare(b.lemma);
        if (sortKey === 'repetitions') return strengthOf(a) - strengthOf(b) || a.lemma.localeCompare(b.lemma);
        // Review order: due words first, then by next review date.
        const da = dueIds.has(a.id) ? 0 : 1;
        const db = dueIds.has(b.id) ? 0 : 1;
        return da - db || new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
      });
  }, [mapped, search, filter, langFilter, sortKey, dueIds]);
  const visible = filtered.slice(0, limit);

  const onMaster = async (id: string, lemma: string) => {
    setRowBusy(id);
    try {
      await markVocabMastered(id, true);
      toast.success(vx.markedKnown(lemma), {
        action: { label: vx.undo, onClick: () => void markVocabMastered(id, false).then(loadReviewQueue).catch(() => undefined) },
      });
      loadReviewQueue();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : copy.errors.updateFailed);
    } finally {
      setRowBusy(null);
    }
  };

  const commitDelete = useCallback(
    async (id: string) => {
      pendingDeletes.current.delete(id);
      try {
        await removeVocab(id);
        loadReviewQueue();
      } catch (e) {
        setHidden((h) => { const n = new Set(h); n.delete(id); return n; });
        toast.error(e instanceof Error ? e.message : copy.errors.updateFailed);
      }
    },
    [removeVocab, copy.errors.updateFailed],
  );

  const onRemove = (id: string, lemma: string) => {
    setHidden((h) => new Set(h).add(id));
    const timer = window.setTimeout(() => void commitDelete(id), UNDO_MS);
    pendingDeletes.current.set(id, timer);
    toast(vx.removed(lemma), {
      duration: UNDO_MS,
      action: {
        label: vx.undo,
        onClick: () => {
          const t = pendingDeletes.current.get(id);
          if (t) window.clearTimeout(t);
          pendingDeletes.current.delete(id);
          setHidden((h) => { const n = new Set(h); n.delete(id); return n; });
        },
      },
    });
  };

  const removeNative = async () => {
    setNativeBusy(true);
    try {
      for (const v of nativeItems) await api(`/vocabulary/${v.id}`, { method: 'DELETE' });
      await refreshVocab();
      loadReviewQueue();
      if (langFilter === native) setLangFilter('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : copy.errors.updateFailed);
    } finally {
      setNativeBusy(false);
      setConfirmNative(false);
    }
  };

  const head = (
    <div>
      <h1 className="text-[22px] sm:text-2xl font-bold tracking-tight text-[#101828]">{copy.vocabulary.title}</h1>
      <p className="text-sm text-[#6b7080] mt-0.5">{vx.subtitle}</p>
    </div>
  );

  if (vocabLoading && vocabItems.length === 0) {
    return (
      <div className="max-w-[1180px] mx-auto px-4 sm:px-6 py-10 flex items-center justify-center gap-2 text-gray-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">{copy.vocabPage.loading}</span>
      </div>
    );
  }

  if (vocabError && vocabItems.length === 0) {
    return (
      <div className="max-w-[1180px] mx-auto px-3 sm:px-6 py-5 lg:py-8 space-y-4">
        {head}
        <EmptyState icon={BookOpen} title={copy.vocabPage.loadErrorTitle} description={vocabError} actionLabel={copy.commonExt.retry} onAction={() => void refreshVocab().catch(() => undefined)} />
      </div>
    );
  }

  if (vocabItems.length === 0) {
    return (
      <div className="max-w-[1180px] mx-auto px-3 sm:px-6 py-5 lg:py-8 space-y-5">
        {head}
        <EmptyState icon={BookOpen} title={copy.vocabulary.noWordsTitle} description={copy.vocabulary.noWordsDescription} actionLabel={copy.vocabulary.startReading} onAction={() => navigate('/app')} />
      </div>
    );
  }

  const statusChips: Array<{ id: typeof filter; label: string; n: number }> = [
    { id: 'all', label: vx.all, n: mapped.length },
    { id: 'due', label: vx.due, n: dueItems.length },
    { id: 'learning', label: vx.learning, n: totalLearning },
    { id: 'known', label: vx.mastered, n: totalKnown },
  ];

  return (
    <div className="max-w-[1180px] mx-auto px-3 sm:px-6 py-5 lg:py-8 min-w-0">
      {reviewOpen && (
        <ReviewModal
          vx={vx}
          dueItems={sessionDueItems}
          onClose={() => {
            setReviewOpen(false);
            void refreshVocab().catch(() => undefined);
            loadReviewQueue();
          }}
        />
      )}

      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-4">
        {head}
        <div className="flex gap-2 shrink-0">
          {dueItems.length > 0 && (
            <button type="button" onClick={openReview} className="inline-flex items-center justify-center gap-2 h-10 px-3 sm:px-3.5 rounded-xl border border-[#e1e3ec] bg-white text-sm font-semibold text-[#101828] hover:bg-gray-50" aria-label={vx.quick}>
              <Copy className="w-4 h-4" /><span className="hidden sm:inline">{vx.quick}</span>
            </button>
          )}
          <button type="button" onClick={() => navigate('/app/practice')} className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-g-blue-700 hover:bg-g-blue-800 text-white text-sm font-semibold shadow-[0_10px_20px_-10px_rgba(33,7,170,.5)]">
            <Play className="w-4 h-4" />{dueItems.length > 0 ? vx.practise(dueItems.length) : vx.practiseShort}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 lg:grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.4fr)] bg-white border border-[#e9ebf3] rounded-2xl mb-3 overflow-hidden">
        {[
          { icon: BookOpen, tone: 'bg-[#f1f2f7] text-[#4a5565]', v: mapped.length, l: vx.total, c: 'text-[#101828]' },
          { icon: Clock, tone: 'bg-[#fff7ed] text-[#c2410c]', v: dueItems.length, l: vx.due, c: 'text-[#c2410c]' },
          { icon: Brain, tone: 'bg-g-blue-50 text-g-blue-700', v: totalLearning, l: vx.learning, c: 'text-[#101828]' },
          { icon: CheckCircle2, tone: 'bg-[#ecfdf5] text-[#047857]', v: totalKnown, l: vx.mastered, c: 'text-[#047857]' },
        ].map((s) => (
          <div key={s.l} className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2.5 px-2 sm:px-4 py-3 border-r border-[#f2f3f7] last:border-r-0 lg:last:border-r text-center sm:text-left min-w-0">
            <span className={cn('hidden sm:grid size-9 rounded-[10px] place-items-center shrink-0', s.tone)}><s.icon className="w-[17px] h-[17px]" /></span>
            <div className="min-w-0">
              <b className={cn('block text-lg sm:text-xl font-bold tabular-nums leading-tight', s.c)}>{s.v}</b>
              <span className="block text-[10.5px] sm:text-xs text-[#6b7080] truncate">{s.l}</span>
            </div>
          </div>
        ))}
        <div className="hidden lg:flex flex-col justify-center gap-1.5 px-4 py-3">
          <div className="flex justify-between text-[12.5px] font-semibold text-[#4a5565]"><span>{vx.mastery}</span><b className="text-g-blue-700">{masteredPct}%</b></div>
          <div className="h-2 rounded-full bg-[#eef0ff] overflow-hidden"><i className="block h-full bg-[#10b981] rounded-full" style={{ width: `${masteredPct}%` }} /></div>
        </div>
      </div>

      {nativeItems.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 bg-[#fffbeb] border border-[#fde68a] rounded-xl px-3.5 py-2.5 mb-3 text-[13px] text-[#92400e]">
          <span className="flex items-start gap-2 flex-1 min-w-0">
            <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0" />
            <span><b className="font-semibold">{vx.nativeBanner(nativeItems.length, nativeName)}</b> {vx.nativeHint}</span>
          </span>
          <span className="flex gap-2 shrink-0">
            <button type="button" onClick={() => setLangFilter(native)} className="h-8 px-3 rounded-lg border border-[#fcd34d] bg-white text-xs font-semibold hover:bg-[#fff7d6]">{vx.show}</button>
            <button type="button" onClick={() => setConfirmNative(true)} className="h-8 px-3 rounded-lg border border-[#fecaca] bg-white text-xs font-semibold text-[#b91c1c] hover:bg-[#fff1f1]">{vx.removeAll}</button>
          </span>
        </div>
      )}

      <div className="flex items-center gap-2 mb-2.5">
        <div className="relative flex-1 sm:max-w-[360px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9aa0ae]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={vx.search}
            aria-label={copy.vocabPage.searchPlaceholder}
            className="w-full pl-9 pr-3 h-10 bg-white border border-[#e3e5ee] rounded-xl text-sm outline-none focus:ring-4 focus:ring-g-blue-700/10 focus:border-g-blue-700"
          />
        </div>
        <label className="sm:ml-auto shrink-0 inline-flex items-center gap-2 text-xs font-semibold text-[#8a8fa0]">
          <span className="hidden sm:inline">{vx.sort}</span>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="h-9 rounded-lg border border-[#e3e5ee] bg-white px-2.5 text-[13px] font-semibold text-[#4a5565] outline-none focus:border-g-blue-700"
          >
            <option value="dueAt">{vx.sortDue}</option>
            <option value="lemma">{vx.sortAz}</option>
            <option value="repetitions">{vx.sortStrength}</option>
          </select>
        </label>
      </div>
      <div className="flex gap-1.5 overflow-x-auto sm:overflow-visible sm:flex-wrap scrollbar-hide min-w-0 mb-3 -mx-3 px-3 sm:mx-0 sm:px-0" role="radiogroup" aria-label={copy.vocabPage.status}>
        {statusChips.map((c) => (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={filter === c.id}
            onClick={() => setFilter(c.id)}
            className={cn(
              'shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-full border text-[13px] font-semibold transition-colors',
              filter === c.id ? 'bg-g-blue-700 border-g-blue-700 text-white' : 'bg-white border-[#e3e5ee] text-[#4a5565] hover:border-[#c5cafd]',
            )}
          >
            {c.label}<span className="text-[11px] opacity-70 tabular-nums">{c.n}</span>
          </button>
        ))}
        {langCounts.length > 1 && <span className="shrink-0 w-px h-6 bg-[#e3e5ee] self-center mx-0.5" />}
        {langCounts.length > 1 &&
          langCounts.map(([code, n]) => (
            <button
              key={code}
              type="button"
              onClick={() => setLangFilter(langFilter === code ? '' : code)}
              aria-pressed={langFilter === code}
              aria-label={LANGUAGE_META[code as keyof typeof LANGUAGE_META]?.nativeName ?? code}
              className={cn(
                'shrink-0 inline-flex items-center gap-1.5 h-9 px-2.5 rounded-full border text-[13px] font-semibold transition-colors',
                langFilter === code ? 'bg-g-blue-50 border-g-blue-700 text-g-blue-700' : 'bg-white border-[#e3e5ee] text-[#4a5565] hover:border-[#c5cafd]',
              )}
            >
              <CatalogLanguageFlag code={code} className="h-3 w-[18px] rounded-[2px]" />
              <span className="tabular-nums">{n}</span>
            </button>
          ))}
      </div>

      <div className="bg-white border border-[#e9ebf3] rounded-2xl overflow-hidden">
        <div className="hidden md:grid grid-cols-[minmax(0,1.5fr)_minmax(0,1.1fr)_minmax(0,1fr)_110px_150px_76px] gap-3 items-center px-4 h-10 bg-[#fafbfd] border-b border-[#eef0f5] text-[10.5px] font-bold tracking-[0.1em] uppercase text-[#8a8fa0]">
          <span>{vx.colWord}</span><span>{vx.colTr}</span><span>{vx.colSrc}</span><span>{vx.colStr}</span><span>{vx.colNext}</span><span />
        </div>
        {visible.map((item) => {
          const due = dueIds.has(item.id);
          const isNative = Boolean(native) && item.sourceLang?.toLowerCase() === native;
          return (
            <div
              key={item.id}
              className={cn(
                'grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1.5fr)_minmax(0,1.1fr)_minmax(0,1fr)_110px_150px_76px] gap-x-3 gap-y-1 items-center px-3 md:px-4 py-2.5 md:py-0 md:min-h-[58px] border-b border-[#f2f3f7] last:border-b-0',
                isNative && 'bg-[#fffdf3]',
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <CatalogLanguageFlag code={item.sourceLang} className="h-3.5 w-5 rounded-[3px] shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <b className="text-[14.5px] font-semibold text-[#101828] truncate">{item.lemma}</b>
                    {isNative && <span className="shrink-0 text-[10px] font-bold px-1.5 py-px rounded-[5px] bg-[#fef3c7] text-[#b45309]">{vx.native}</span>}
                  </div>
                  <div className="md:hidden text-[12.5px] text-[#6b7080] truncate">{item.translation}{item.content?.title ? ` · ${item.content.title}` : ''}</div>
                  {item.contextSentence && (
                    <Context text={item.contextSentence} word={item.lemma} className="hidden md:block font-serif text-xs text-[#8a8fa0] truncate mt-0.5" />
                  )}
                </div>
              </div>
              <div className="hidden md:block text-[13.5px] text-[#4a5565] truncate">{item.translation}</div>
              <div className="hidden md:flex items-center gap-1.5 text-[12.5px] text-[#6b7080] min-w-0">
                <BookOpen className="w-3.5 h-3.5 text-[#9aa0ae] shrink-0" />
                <span className="truncate">{item.content?.title ?? vx.chat}</span>
              </div>
              <div className="hidden md:block"><Strength value={strengthOf(item)} vx={vx} /></div>
              <div className="hidden md:block">
                {item.mastered ? (
                  <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#047857]"><Check className="w-3.5 h-3.5" />{vx.masteredNow}</span>
                ) : due ? (
                  <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#c2410c] bg-[#fff7ed] px-2 py-1 rounded-md"><Clock className="w-3.5 h-3.5" />{vx.dueNow}</span>
                ) : (
                  <span className="text-[12.5px] text-[#6b7080]">{formatDate(item.dueAt, copy)}</span>
                )}
              </div>
              <div className="flex items-center justify-end gap-1">
                <span className="md:hidden">
                  {due && !item.mastered ? <Clock className="w-4 h-4 text-[#c2410c]" /> : item.mastered ? <Check className="w-4 h-4 text-[#047857]" /> : null}
                </span>
                {!item.mastered && (
                  <button
                    type="button"
                    title={copy.vocabPage.markKnown}
                    aria-label={copy.vocabPage.markKnown}
                    disabled={rowBusy === item.id}
                    onClick={() => void onMaster(item.id, item.lemma)}
                    className="size-8 rounded-lg grid place-items-center text-[#047857] border border-[#d1fae5] bg-[#f0fdf8] hover:bg-[#dcfce7] disabled:opacity-40"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  title={copy.vocabPage.remove}
                  aria-label={copy.vocabPage.remove}
                  disabled={rowBusy === item.id}
                  onClick={() => onRemove(item.id, item.lemma)}
                  className="size-8 rounded-lg grid place-items-center text-[#9aa0ae] hover:text-[#dc2626] hover:bg-[#fff1f1] disabled:opacity-40"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <div className="px-4 py-12 text-center text-[#9aa0ae] text-sm">{copy.vocabPage.noMatchSearch}</div>}
        {filtered.length > limit && (
          <div className="flex justify-center p-3 border-t border-[#f2f3f7]">
            <button type="button" onClick={() => setLimit((n) => n + PAGE)} className="h-9 px-4 rounded-xl border border-[#e1e3ec] bg-white text-sm font-semibold text-[#101828] hover:bg-gray-50">
              {vx.more(Math.min(PAGE, filtered.length - limit))}
            </button>
          </div>
        )}
      </div>

      <div className="text-center text-xs text-[#9aa0ae] pt-3">
        {copy.vocabPage.showingCount(Math.min(limit, filtered.length), mapped.length)}
        {vocabLoading && <Loader2 className="inline w-3 h-3 ml-1.5 animate-spin align-[-2px]" />}
      </div>

      {confirmNative && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ background: 'rgba(11,12,38,.5)' }} onClick={() => setConfirmNative(false)}>
          <div role="alertdialog" aria-modal="true" className="w-full max-w-[420px] bg-white rounded-2xl p-5 sm:p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <span className="size-11 rounded-xl bg-[#fff1f1] text-[#dc2626] grid place-items-center mb-3"><Trash2 className="w-5 h-5" /></span>
            <h2 className="text-lg font-bold text-[#101828]">{vx.removeNativeTitle(nativeItems.length)}</h2>
            <p className="text-sm text-[#4a5565] mt-1.5 leading-relaxed">{nativeItems.slice(0, 6).map((v) => v.lemma).join(', ')}{nativeItems.length > 6 ? '…' : ''}. {vx.removeNativeBody}</p>
            <div className="grid grid-cols-2 gap-2 mt-5">
              <button type="button" autoFocus onClick={() => setConfirmNative(false)} className="h-11 rounded-xl border border-[#e1e3ec] text-sm font-semibold text-[#101828] hover:bg-gray-50">{vx.cancel}</button>
              <button type="button" disabled={nativeBusy} onClick={() => void removeNative()} className="h-11 rounded-xl bg-[#dc2626] hover:bg-[#b91c1c] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60">
                {nativeBusy && <Loader2 className="w-4 h-4 animate-spin" />}{vx.removeAll}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
