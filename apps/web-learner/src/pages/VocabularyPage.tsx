import { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpDown,
  BookOpen,
  Brain,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ChevronsUp,
  Clock,
  Loader2,
  Minus,
  Search,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { EmptyState } from '../components/EmptyState';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { cn } from '../components/ui/utils';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { VocabItem } from '../lib/types';

type SortKey = 'lemma' | 'intervalDays' | 'dueAt' | 'repetitions';
type SortDir = 'asc' | 'desc';
type VocabStatus = 'learning' | 'known';

const SRS_RATINGS = ['Again', 'Hard', 'Good', 'Easy'] as const;

function formatDate(iso: string) {
  const diff = Math.round((new Date(iso).getTime() - Date.now()) / 86400000);
  if (diff < -1) return `${Math.abs(diff)}d overdue`;
  if (diff < 0) return 'Yesterday';
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return `in ${diff}d`;
}

function StatusBadge({ status }: { status: VocabStatus }) {
  return (
    <span
      className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold', {
        'bg-blue-100 text-blue-700': status === 'learning',
        'bg-emerald-100 text-emerald-700': status === 'known',
      })}
    >
      {status}
    </span>
  );
}

function ReviewModal({
  dueItems,
  onClose,
  onRate,
}: {
  dueItems: Array<VocabItem & { status: VocabStatus }>;
  onClose: () => void;
  onRate: (id: string, rating: string) => Promise<void>;
}) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [busy, setBusy] = useState(false);

  const done = index >= dueItems.length;
  const item = !done ? dueItems[index] : null;
  const progress = dueItems.length ? Math.round((index / dueItems.length) * 100) : 0;

  const rate = async (rating: string) => {
    if (!item || busy) return;
    setBusy(true);
    try {
      await onRate(item.id, rating);
      toast.success(`"${item.lemma}" rated as ${rating}`);
      setReviewed((r) => r + 1);
      setRevealed(false);
      setIndex((i) => i + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Review failed');
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
        if (idx !== -1) void rate(SRS_RATINGS[idx]);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [revealed, item, onClose, busy]);

  if (dueItems.length === 0) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-[#7f22fe]" />
            <span className="text-sm font-semibold text-gray-700">SRS Review</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">
              {Math.min(index + 1, dueItems.length)} / {dueItems.length}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="h-1 bg-gray-100">
          <div className="h-full bg-[#7f22fe] transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
        {done ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <div className="text-xl font-bold text-gray-900 mb-1">Session complete!</div>
            <div className="text-gray-500 text-sm mb-6">
              Reviewed {reviewed} word{reviewed !== 1 ? 's' : ''}. Great job!
            </div>
            <Button onClick={onClose} className="rounded-xl bg-[#7f22fe] hover:bg-[#7008e7]">
              Back to vocabulary
            </Button>
          </div>
        ) : (
          <div className="p-6">
            <div className="text-center mb-6">
              <div className="text-3xl font-bold text-gray-900 mb-2">{item!.lemma}</div>
              {item!.contextSentence && (
                <div className="text-xs text-gray-400 italic truncate px-4">
                  &quot;{item!.contextSentence}&quot;
                </div>
              )}
            </div>
            {!revealed ? (
              <button
                type="button"
                onClick={() => setRevealed(true)}
                className="w-full py-3 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-violet-300 hover:text-violet-500 hover:bg-violet-50 transition-all"
              >
                Show translation
                <span className="block text-[11px] mt-1 opacity-60">
                  or press <kbd className="font-mono bg-gray-200 px-1 rounded">Space</kbd>
                </span>
              </button>
            ) : (
              <div className="space-y-4">
                <div className="bg-violet-50 rounded-xl px-4 py-3 text-center">
                  <div className="text-gray-700 font-medium">{item!.translation}</div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {(
                    [
                      {
                        rating: 'Again',
                        key: '1',
                        color: 'border-red-200 hover:border-red-300 hover:bg-red-50 text-red-600',
                        Icon: ThumbsDown,
                      },
                      {
                        rating: 'Hard',
                        key: '2',
                        color: 'border-amber-200 hover:border-amber-300 hover:bg-amber-50 text-amber-600',
                        Icon: Minus,
                      },
                      {
                        rating: 'Good',
                        key: '3',
                        color: 'border-blue-200 hover:border-blue-300 hover:bg-blue-50 text-blue-600',
                        Icon: ThumbsUp,
                      },
                      {
                        rating: 'Easy',
                        key: '4',
                        color:
                          'border-emerald-200 hover:border-emerald-300 hover:bg-emerald-50 text-emerald-600',
                        Icon: ChevronsUp,
                      },
                    ] as const
                  ).map((btn) => (
                    <button
                      key={btn.key}
                      type="button"
                      disabled={busy}
                      onClick={() => void rate(btn.rating)}
                      className={cn(
                        'flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-semibold transition-all disabled:opacity-50',
                        btn.color,
                      )}
                    >
                      <btn.Icon className="w-4 h-4" />
                      <span>{btn.rating}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function VocabularyPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    vocabItems,
    vocabLoading,
    vocabError,
    refreshVocab,
    rateWord,
    markVocabMastered,
    removeVocab,
  } = useAuth();
  const [search, setSearch] = useState(() => searchParams.get('q') ?? '');
  const [sortKey, setSortKey] = useState<SortKey>('dueAt');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [filter, setFilter] = useState<'all' | 'due' | 'learning' | 'known'>('all');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [sessionDueItems, setSessionDueItems] = useState<Array<VocabItem & { status: VocabStatus }>>(
    [],
  );
  const [rowBusy, setRowBusy] = useState<string | null>(null);
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

  const mapped = useMemo(
    () =>
      vocabItems.map((v) => ({
        ...v,
        status: (v.mastered ? 'known' : 'learning') as VocabStatus,
      })),
    [vocabItems],
  );

  const dueIds = useMemo(() => new Set(reviewQueue.map((v) => v.id)), [reviewQueue]);
  const dueItems = useMemo(
    () => mapped.filter((i) => dueIds.has(i.id)),
    [mapped, dueIds],
  );
  const totalKnown = mapped.filter((i) => i.status === 'known').length;
  const totalLearning = mapped.filter((i) => i.status === 'learning').length;
  const masteredPct = mapped.length ? Math.round((totalKnown / mapped.length) * 100) : 0;

  const openReview = () => {
    setSessionDueItems(dueItems);
    setReviewOpen(true);
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return mapped
      .filter((item) => {
        if (q) {
          const hit =
            item.lemma.toLowerCase().includes(q) || item.translation.toLowerCase().includes(q);
          if (!hit) return false;
        }
        if (filter === 'due') return dueIds.has(item.id);
        if (filter === 'learning') return item.status === 'learning';
        if (filter === 'known') return item.status === 'known';
        return true;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortKey === 'lemma') cmp = a.lemma.localeCompare(b.lemma);
        else if (sortKey === 'intervalDays') cmp = a.intervalDays - b.intervalDays;
        else if (sortKey === 'dueAt') cmp = new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
        else if (sortKey === 'repetitions') cmp = a.repetitions - b.repetitions;
        return sortDir === 'asc' ? cmp : -cmp;
      });
  }, [mapped, search, filter, sortKey, sortDir, dueIds]);

  const onMaster = async (id: string, lemma: string) => {
    setRowBusy(id);
    try {
      await markVocabMastered(id, true);
      toast.success(`"${lemma}" marked as known`);
      loadReviewQueue();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setRowBusy(null);
    }
  };

  const onRemove = async (id: string, lemma: string) => {
    setRowBusy(id);
    try {
      await removeVocab(id);
      toast.success(`"${lemma}" removed`);
      loadReviewQueue();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Remove failed');
    } finally {
      setRowBusy(null);
    }
  };

  const SortHeader = ({ col, label }: { col: SortKey; label: string }) => (
    <th
      onClick={() => handleSort(col)}
      className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-600 select-none"
    >
      <div className="flex items-center gap-1">
        {label}
        {sortKey === col ? (
          sortDir === 'asc' ? (
            <ChevronUp className="w-3 h-3 text-violet-500" />
          ) : (
            <ChevronDown className="w-3 h-3 text-violet-500" />
          )
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-30" />
        )}
      </div>
    </th>
  );

  if (vocabLoading && mapped.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 flex items-center justify-center gap-2 text-gray-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Loading vocabulary…</span>
      </div>
    );
  }

  if (vocabError && mapped.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 lg:py-8 space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vocabulary</h1>
          <p className="text-gray-400 text-sm mt-0.5">Build your personal word list while reading</p>
        </div>
        <EmptyState
          icon={BookOpen}
          title="Couldn’t load vocabulary"
          description={vocabError}
          actionLabel="Retry"
          onAction={() => void refreshVocab().catch(() => undefined)}
        />
      </div>
    );
  }

  if (mapped.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 lg:py-8 space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vocabulary</h1>
          <p className="text-gray-400 text-sm mt-0.5">Build your personal word list while reading</p>
        </div>
        <EmptyState
          icon={BookOpen}
          title="No words saved yet"
          description="Tap any word while reading to look it up and save it to your vocabulary list."
          actionLabel="Go to library"
          onAction={() => navigate('/app')}
        />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 lg:py-6 space-y-4">
      {reviewOpen && (
        <ReviewModal
          dueItems={sessionDueItems}
          onClose={() => {
            setReviewOpen(false);
            void refreshVocab().catch(() => undefined);
            loadReviewQueue();
          }}
          onRate={rateWord}
        />
      )}

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">Vocabulary</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {mapped.length} word{mapped.length !== 1 ? 's' : ''} · {totalLearning} learning ·{' '}
            {totalKnown} mastered
          </p>
        </div>
        {dueItems.length > 0 && (
          <Button onClick={openReview} className="bg-[#7f22fe] hover:bg-[#7008e7] rounded-xl gap-2 shrink-0">
            <Brain className="w-4 h-4" />
            Review {dueItems.length} due
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {[
          {
            label: 'Total',
            value: mapped.length,
            icon: BookOpen,
            color: 'text-[#364153] bg-[#f9fafb] border-[#e5e7eb]',
          },
          {
            label: 'Due',
            value: dueItems.length,
            icon: Clock,
            color:
              dueItems.length > 0
                ? 'text-[#bb4d00] bg-[#fffbeb] border-[#fee685]'
                : 'text-[#364153] bg-[#f9fafb] border-[#e5e7eb]',
          },
          {
            label: 'Learning',
            value: totalLearning,
            icon: Brain,
            color: 'text-[#1447e6] bg-[#eff6ff] border-[#bedbff]',
          },
          {
            label: 'Mastered',
            value: totalKnown,
            icon: CheckCircle2,
            color: 'text-[#007a55] bg-[#ecfdf5] border-[#a4f4cf]',
          },
        ].map((s) => (
          <div key={s.label} className={cn('flex items-center gap-2.5 rounded-xl border px-3 py-2.5', s.color)}>
            <s.icon className="w-4 h-4 shrink-0" />
            <div>
              <div className="font-bold text-lg leading-none">{s.value}</div>
              <div className="text-[11px] opacity-70 mt-0.5">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 px-3.5 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-violet-500" />
            <span className="text-sm font-semibold text-gray-700">Mastery</span>
          </div>
          <span className="text-sm font-bold text-[#7f22fe]">{masteredPct}%</span>
        </div>
        <Progress value={masteredPct} className="h-1.5" />
      </div>

      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search words…"
            className="w-full pl-8 pr-4 h-9 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-300"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
          {(['all', 'due', 'learning', 'known'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                'shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all capitalize',
                filter === f
                  ? 'bg-[#7f22fe] text-white border-[#7f22fe]'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300',
              )}
            >
              {f === 'due' ? `Due (${dueItems.length})` : f}
            </button>
          ))}
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <SortHeader col="lemma" label="Word" />
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  Translation
                </th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <SortHeader col="dueAt" label="Next" />
                <SortHeader col="intervalDays" label="Interval" />
                <SortHeader col="repetitions" label="Reps" />
                <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, i) => (
                <tr
                  key={item.id}
                  className={cn(
                    'border-b border-gray-50 hover:bg-gray-50/50 transition-colors',
                    i === filtered.length - 1 && 'border-0',
                  )}
                >
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      {dueIds.has(item.id) && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="Due for review" />
                      )}
                      <span className="font-semibold text-gray-900 text-sm">{item.lemma}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-sm text-gray-500 max-w-[14rem] truncate">
                    {item.translation}
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="px-3 py-2.5 text-sm whitespace-nowrap">
                    <span
                      className={cn(dueIds.has(item.id) ? 'text-amber-600 font-medium' : 'text-gray-500')}
                    >
                      {formatDate(item.dueAt)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-sm text-gray-500">{item.intervalDays}d</td>
                  <td className="px-3 py-2.5 text-sm text-gray-500">{item.repetitions}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      {!item.mastered && (
                        <button
                          type="button"
                          title="Mark known"
                          disabled={rowBusy === item.id}
                          onClick={() => void onMaster(item.id, item.lemma)}
                          className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 disabled:opacity-40"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        title="Remove"
                        disabled={rowBusy === item.id}
                        onClick={() => void onRemove(item.id, item.lemma)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-40"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400 text-sm">
                    No words match your search
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {filtered.map((item) => (
          <div key={item.id} className="bg-white rounded-xl border border-gray-100 px-3.5 py-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {dueIds.has(item.id) && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                  )}
                  <span className="font-semibold text-gray-900">{item.lemma}</span>
                  <StatusBadge status={item.status} />
                </div>
                <div className="text-sm text-gray-500 mt-0.5 truncate">{item.translation}</div>
                <div className="text-[11px] text-gray-400 mt-1.5">
                  Next {formatDate(item.dueAt)} · {item.intervalDays}d · {item.repetitions} reps
                </div>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                {!item.mastered && (
                  <button
                    type="button"
                    disabled={rowBusy === item.id}
                    onClick={() => void onMaster(item.id, item.lemma)}
                    className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  disabled={rowBusy === item.id}
                  onClick={() => void onRemove(item.id, item.lemma)}
                  className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="py-12 text-center text-gray-400 text-sm">No words match your search</div>
        )}
      </div>

      <div className="text-center text-xs text-gray-400 pb-2">
        Showing {filtered.length} of {mapped.length}
        {vocabLoading ? ' · refreshing…' : ''}
      </div>
    </div>
  );
}
