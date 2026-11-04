import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  BookOpen,
  Check,
  ChevronRight,
  Clock,
  Flame,
  GraduationCap,
  Info,
  Play,
  Plus,
  Headphones,
  Keyboard,
  Lightbulb,
  Loader2,
  RotateCcw,
  Snowflake,
  Sparkles,
  Volume2,
  X,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { isDailyLimitError } from '../../lib/dailyLimit';
import { DAILY_GOAL_OPTIONS, localizeApiError, practiceCopyFor, type ExerciseType, type PracticeCopy, type SrsRatingValue } from '@gotcha/shared';
import { Button } from '../ui/button';
import { cn } from '../ui/utils';
import { useLearnerLocale } from '../../lib/learnerLocaleContext';
import { useAuth } from '../../lib/auth';
import { BrandMark } from '../GotchaLogo';
import { speakText, stopSpeaking } from '../../lib/tts';
import {
  newAnswerId,
  practiceApi,
  type AnswerResult,
  type DailySession,
  type Overview,
  type PracticeItem,
  type SessionSummary,
} from './practiceApi';

const SIZES = [10, 15, 25] as const;
const MUTE_KEY = 'gotcha.practice.cantListenUntil';
const MCQ: ExerciseType[] = ['mcq_meaning', 'cloze_mcq', 'listening_mcq'];
const TYPED: ExerciseType[] = ['typed_recall', 'cloze', 'dictation'];

type Phase = 'hub' | 'loading' | 'play' | 'summary';

/** Hub / exit-dialog strings not in the shared practice copy yet (uz / ru / en). */
const PX = {
  en: {
    today: 'Today', toGoal: (n: number) => `${n} XP to your goal`, goalDone: 'Daily goal reached',
    dueLabel: 'due for review', newLabel: 'new words', streakLabel: 'streak', days: (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`,
    freezeLabel: 'streak freezes',
    sessionHas: 'This session:', reviews: (n: number) => `${n} reviews`, fresh: (n: number) => `${n} new`, words: 'words',
    forecastSub: 'Words coming up for review in the next 7 days', openVocab: 'Open vocabulary', tomorrow: 'Tomorrow',
    goalSub: 'Same goal as in Settings',
    exitTitle: 'Leave this session?', keep: 'Keep going', leave: 'Finish now',
    week: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  },
  ru: {
    today: 'Сегодня', toGoal: (n: number) => `До цели ${n} XP`, goalDone: 'Цель дня выполнена',
    dueLabel: 'пора повторить', newLabel: 'новых слов', streakLabel: 'серия', days: (n: number) => `${n} дн.`,
    freezeLabel: 'заморозки серии',
    sessionHas: 'В этой сессии:', reviews: (n: number) => `${n} повтор.`, fresh: (n: number) => `${n} новых`, words: 'слов',
    forecastSub: 'Слова к повторению в ближайшие 7 дней', openVocab: 'Открыть словарь', tomorrow: 'Завтра',
    goalSub: 'Та же цель, что в настройках',
    exitTitle: 'Выйти из сессии?', keep: 'Продолжить', leave: 'Завершить',
    week: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
  },
  uz: {
    today: 'Bugun', toGoal: (n: number) => `Maqsadga ${n} XP qoldi`, goalDone: 'Bugungi maqsad bajarildi',
    dueLabel: 'takrorlash vaqti keldi', newLabel: 'yangi soʻz', streakLabel: 'seriya', days: (n: number) => `${n} kun`,
    freezeLabel: 'seriya muzlatgichi',
    sessionHas: 'Bu mashqda:', reviews: (n: number) => `${n} takrorlash`, fresh: (n: number) => `${n} yangi`, words: 'soʻz',
    forecastSub: 'Kelgusi 7 kunda takrorlanadigan soʻzlar', openVocab: 'Lugʻatni ochish', tomorrow: 'Ertaga',
    goalSub: 'Sozlamalardagi maqsad bilan bir xil',
    exitTitle: 'Mashqdan chiqasizmi?', keep: 'Davom etish', leave: 'Yakunlash',
    week: ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'],
  },
};
type PracticeExtra = (typeof PX)['en'];

function listeningMuted() {
  const until = Number(localStorage.getItem(MUTE_KEY) ?? 0);
  return until > Date.now();
}

/** Plays item audio. Word known on screen → browser voice (free); otherwise server TTS by vocab id. */
async function playItemAudio(item: PracticeItem, slow = false) {
  stopSpeaking();
  if (item.word && !slow) return speakText(item.word, item.lang);
  const blob = await practiceApi.audio(item.vocabId);
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.playbackRate = slow ? 0.75 : 1;
  audio.onended = () => URL.revokeObjectURL(url);
  await audio.play();
}

// ---------------------------------------------------------------------------------------------

export default function DailyPractice() {
  const navigate = useNavigate();
  const { locale } = useLearnerLocale();
  const { updatePreferences } = useAuth();
  const t = useMemo(() => practiceCopyFor(locale), [locale]);

  const [phase, setPhase] = useState<Phase>('hub');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [size, setSize] = useState<number>(15);
  const [session, setSession] = useState<DailySession | null>(null);
  const [queue, setQueue] = useState<PracticeItem[]>([]);
  const [idx, setIdx] = useState(0);
  const [stats, setStats] = useState({ xpToday: 0, dailyGoalXp: 60, streakCount: 0, streakFreezes: 0 });
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [mistakeIds, setMistakeIds] = useState<string[]>([]);
  const [confirmExit, setConfirmExit] = useState(false);
  const px = PX[locale === 'ru' || locale === 'uz' ? locale : 'en'];

  const loadOverview = useCallback(() => {
    practiceApi
      .overview()
      .then((o) => {
        setOverview(o);
        setStats({ xpToday: o.xpToday, dailyGoalXp: o.dailyGoalXp, streakCount: o.streakCount, streakFreezes: o.streakFreezes });
      })
      .catch((e: unknown) => (isDailyLimitError(e) ? undefined : toast.error(e instanceof Error ? e.message : String(e))));
  }, []);

  useEffect(loadOverview, [loadOverview]);

  /** Back to the practice home inside the app (never forces the Library). */
  const toHub = () => {
    setSummary(null);
    loadOverview();
    setPhase('hub');
  };

  const start = async (opts: { focus?: string[]; extra?: boolean } = {}) => {
    setPhase('loading');
    try {
      const caps = typeof Audio !== 'undefined' && !listeningMuted() ? ['listening'] : [];
      const s = await practiceApi.daily({ size, caps, ...opts });
      if (!s.items.length) {
        setOverview((o) => (o ? { ...o, dueCount: 0 } : o));
        setPhase('hub');
        if (s.caughtUp) toast.success(t.allCaughtUp);
        return;
      }
      setSession(s);
      setQueue(s.items);
      setIdx(0);
      setMistakeIds([]);
      setStats({ xpToday: s.xpToday, dailyGoalXp: s.dailyGoalXp, streakCount: s.streakCount, streakFreezes: s.streakFreezes });
      setPhase('play');
    } catch (e) {
      (isDailyLimitError(e) ? undefined : toast.error(e instanceof Error ? e.message : String(e)));
      setPhase('hub');
    }
  };

  const finish = async () => {
    if (!session?.sessionId) return setPhase('hub');
    setPhase('loading');
    try {
      const s = await practiceApi.complete(session.sessionId);
      setSummary(s);
      setStats({ xpToday: s.xpToday, dailyGoalXp: s.dailyGoalXp, streakCount: s.streakCount, streakFreezes: s.streakFreezes });
      setPhase('summary');
    } catch (e) {
      (isDailyLimitError(e) ? undefined : toast.error(e instanceof Error ? e.message : String(e)));
      setPhase('hub');
    }
  };

  const exit = () => {
    // Mid-session: ask in-app (progress so far is saved by finishing the session).
    if (phase === 'play' && idx > 0) {
      setConfirmExit(true);
      return;
    }
    stopSpeaking();
    toHub();
  };
  const leaveSession = () => {
    setConfirmExit(false);
    stopSpeaking();
    void finish();
  };

  const onAnswered = (item: PracticeItem, res: AnswerResult | null) => {
    if (res) {
      setStats({ xpToday: res.xpToday, dailyGoalXp: res.dailyGoalXp, streakCount: res.streakCount, streakFreezes: res.streakFreezes });
      if (res.goalReachedNow) toast.success(t.goalReached);
      if (res.freezesUsed > 0) toast(t.freezeUsed);
      if (!res.correct) setMistakeIds((m) => (m.includes(item.vocabId) ? m : [...m, item.vocabId]));
      if (res.requeue) {
        // Again → show it again 3–5 positions later (as recognition, so it's a fair second try).
        setQueue((q) => {
          const copy = [...q];
          const at = Math.min(copy.length, idx + 3 + Math.floor(Math.random() * 3));
          copy.splice(at, 0, { ...item, key: `${item.key}:retry${idx}`, type: item.type === 'flashcard' ? 'flashcard' : item.type });
          return copy;
        });
      }
    }
  };

  const next = () => {
    if (idx + 1 >= queue.length) void finish();
    else setIdx((i) => i + 1);
  };

  // ---------- render
  if (phase === 'loading') {
    return (
      <Shell t={t} onExit={exit} stats={stats}>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-g-accent" />
        </div>
      </Shell>
    );
  }

  if (phase === 'play' && queue[idx]) {
    return (
      <Shell t={t} onExit={exit} stats={stats} progress={{ done: idx, total: queue.length }}>
        {confirmExit && <ExitDialog t={t} px={px} onKeep={() => setConfirmExit(false)} onLeave={leaveSession} />}
        <ExercisePlayer
          key={queue[idx].key}
          item={queue[idx]}
          sessionId={session?.sessionId ?? null}
          t={t}
          stats={stats}
          onExit={exit}
          onAnswered={onAnswered}
          onNext={next}
        />
      </Shell>
    );
  }

  if (phase === 'summary' && summary) {
    return (
      <Shell t={t} onExit={toHub} stats={stats}>
        <Summary
          t={t}
          s={summary}
          canRetry={mistakeIds.length > 0}
          onRetry={() => void start({ focus: mistakeIds })}
          onNew={toHub}
          onRead={() => navigate('/app')}
        />
      </Shell>
    );
  }

  return (
    <Hub
        t={t}
        px={px}
        o={overview}
        size={size}
        setSize={setSize}
        onStart={() => void start()}
        onExtra={() => void start({ extra: true })}
        onGoal={async (g) => {
          try {
            await updatePreferences({ dailyGoalXp: g });
            setStats((s) => ({ ...s, dailyGoalXp: g }));
            setOverview((o) => (o ? { ...o, dailyGoalXp: g } : o));
          } catch (e) {
            if (!isDailyLimitError(e)) toast.error(e instanceof Error ? e.message : localizeApiError(locale, { status: 400 }));
          }
        }}
        onLibrary={() => navigate('/app')}
        onVocabulary={() => navigate('/app/vocabulary')}
      />
  );
}

// ---------------------------------------------------------------------------------------------

function Shell({
  t,
  children,
  onExit,
  stats,
  progress,
}: {
  t: PracticeCopy;
  children: ReactNode;
  onExit: () => void;
  stats: { xpToday: number; dailyGoalXp: number; streakCount: number; streakFreezes: number };
  progress?: { done: number; total: number };
}) {
  const pct = Math.min(100, stats.dailyGoalXp ? (stats.xpToday / stats.dailyGoalXp) * 100 : 0);
  // Portaled to <body> so the shell's own layers (sidebar, header, scroll container) can't clip or cover it.
  return createPortal(
    // Focused session screen: covers the app shell while a session runs (hub lives inside the shell).
    <div className="fixed inset-0 z-[70] flex flex-col bg-g-bg" role="dialog" aria-modal="true" aria-label={t.title} data-testid="practice-session">
      <header className="h-14 sm:h-16 bg-g-card border-b border-g-line flex items-center gap-3 px-3 sm:px-5 shrink-0">
        <button
          type="button"
          onClick={onExit}
          aria-label="Close"
          className="w-10 h-10 flex items-center justify-center rounded-xl border border-g-line text-g-text-2 hover:bg-g-accent-soft hover:text-g-text"
        >
          <X className="w-5 h-5" />
        </button>
        {progress ? (
          <div className="flex-1 flex items-center gap-3 min-w-0">
            <div
              className="flex-1 h-2 bg-g-accent-soft rounded-full overflow-hidden"
              role="progressbar"
              aria-valuenow={progress.done}
              aria-valuemax={progress.total}
              aria-label={t.progress(progress.done + 1, progress.total)}
            >
              <div className="h-full bg-g-progress rounded-full transition-all duration-300" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
            </div>
            <span className="text-xs font-semibold text-g-text-2 tabular-nums shrink-0 hidden sm:inline">{t.progress(progress.done + 1, progress.total)}</span>
          </div>
        ) : (
          <span className="flex-1 font-semibold text-g-text text-sm truncate">{t.title}</span>
        )}
        <div
          className="hidden sm:inline-flex items-center gap-2 h-9 px-3 rounded-full border border-g-line bg-g-card text-xs font-semibold text-g-text-2 tabular-nums"
          title={t.dailyGoal}
        >
          <span className="w-14 h-1.5 rounded-full bg-g-accent-soft overflow-hidden">
            <span className="block h-full rounded-full bg-g-progress" style={{ width: `${pct}%` }} />
          </span>
          {stats.xpToday}/{stats.dailyGoalXp} XP
        </div>
        <div
          className="flex items-center gap-1 px-2.5 h-8 rounded-full bg-g-streak-bg border border-g-streak-line text-g-streak-text text-xs font-bold tabular-nums"
          title={`${t.streakDays(stats.streakCount)} · ${t.freezes(stats.streakFreezes)}`}
        >
          <Flame className="w-3.5 h-3.5 text-g-streak-icon" />
          {stats.streakCount}
          {stats.streakFreezes > 0 && <Snowflake className="w-3 h-3 text-g-info ml-0.5" aria-label={t.freezes(stats.streakFreezes)} />}
        </div>
      </header>
      {children}
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------------------------

function GoalRing({ value, goal, size = 96 }: { value: number; goal: number; size?: number }) {
  const pct = Math.min(1, goal ? value / goal : 0);
  const r = size / 2 - 8;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${value} / ${goal} XP`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--g-accent-soft)" strokeWidth={8} />
      {pct > 0 && <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--g-progress)"
        strokeWidth={8}
        strokeLinecap="round"
        strokeDasharray={`${c * pct} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dasharray 320ms cubic-bezier(.2,0,0,1)' }}
      />}
      <text x="50%" y="48%" textAnchor="middle" className="fill-g-text" style={{ font: '800 18px Inter, sans-serif' }}>
        {value}
      </text>
      <text x="50%" y="66%" textAnchor="middle" className="fill-g-text-2" style={{ font: '600 11px Inter, sans-serif' }}>
        / {goal} XP
      </text>
    </svg>
  );
}

function ExitDialog({ t, px, onKeep, onLeave }: { t: PracticeCopy; px: PracticeExtra; onKeep: () => void; onLeave: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Same-target listeners (the player's own Esc → exit) must not also fire.
        e.stopImmediatePropagation();
        onKeep();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onKeep]);
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" style={{ background: 'rgba(11,12,38,.5)' }} onClick={onKeep}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="practice-exit-title"
        className="w-full max-w-[400px] bg-g-card rounded-2xl p-5 sm:p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="size-11 rounded-xl bg-g-warn-bg text-g-warn grid place-items-center mb-3">
          <AlertTriangle className="w-5 h-5" />
        </span>
        <h2 id="practice-exit-title" className="text-lg font-bold text-g-text">{px.exitTitle}</h2>
        <p className="text-sm text-g-text-2 mt-1.5 leading-relaxed">{t.exitConfirm}</p>
        <div className="grid grid-cols-2 gap-2 mt-5">
          <button type="button" autoFocus onClick={onKeep} className="min-h-11 rounded-xl border border-g-line text-sm font-semibold text-g-text hover:bg-g-card-2">
            {px.keep}
          </button>
          <button type="button" onClick={onLeave} className="min-h-11 rounded-xl bg-g-cta hover:bg-g-cta-hover text-white text-sm font-semibold">
            {px.leave}
          </button>
        </div>
      </div>
    </div>
  );
}

function forecastLabel(iso: string, i: number, px: PracticeExtra) {
  if (i === 0) return px.today;
  if (i === 1) return px.tomorrow;
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso.slice(5) : px.week[d.getDay()];
}

function Hub({
  t,
  px,
  o,
  size,
  setSize,
  onStart,
  onExtra,
  onGoal,
  onLibrary,
  onVocabulary,
}: {
  t: PracticeCopy;
  px: PracticeExtra;
  o: Overview | null;
  size: number;
  setSize: (n: number) => void;
  onStart: () => void;
  onExtra: () => void;
  onGoal: (g: number) => void;
  onLibrary: () => void;
  onVocabulary: () => void;
}) {
  const head = (
    <div className="mb-4">
      <h1 className="text-[22px] sm:text-2xl font-bold tracking-tight text-[#101828]">{t.title}</h1>
      <p className="text-sm text-[#6b7080] mt-0.5">{t.subtitle}</p>
    </div>
  );
  if (!o) {
    return (
      <div className="max-w-[1180px] mx-auto px-3 sm:px-6 py-5 lg:py-8">
        {head}
        <div className="h-48 bg-white border border-[#e9ebf3] rounded-2xl animate-pulse" />
      </div>
    );
  }
  const sizeLabels: Record<number, string> = { 10: t.short, 15: t.normal, 25: t.long };
  const nothingDue = o.dueCount === 0 && o.newCount === 0;

  if (o.totalWords === 0) {
    return (
      <div className="max-w-[1180px] mx-auto px-3 sm:px-6 py-5 lg:py-8">
        {head}
        <div className="bg-white border border-[#e9ebf3] rounded-2xl px-6 py-14 text-center">
          <div className="w-14 h-14 rounded-2xl bg-g-accent-soft flex items-center justify-center mx-auto mb-4">
            <GraduationCap className="w-7 h-7 text-g-accent" />
          </div>
          <h2 className="text-lg font-bold text-g-text mb-1.5">{t.emptyTitle}</h2>
          <p className="text-sm text-g-text-2 mb-5 max-w-sm mx-auto">{t.emptyBody}</p>
          <Button onClick={onLibrary} className="rounded-xl bg-g-cta hover:bg-g-cta-hover text-white">
            <BookOpen className="w-4 h-4 mr-1.5" />
            {t.goToLibrary}
          </Button>
        </div>
      </div>
    );
  }

  // What the next session will roughly contain: reviews first, then new words up to the daily cap.
  const reviews = Math.min(o.dueCount, size);
  const newCap = o.dailyNewWords > 0 ? o.dailyNewWords : size;
  const fresh = Math.max(0, Math.min(o.newCount, size - reviews, newCap));
  const left = Math.max(0, o.dailyGoalXp - o.xpToday);
  const fmax = Math.max(1, ...o.forecast.map((f) => f.count));

  return (
    <div className="max-w-[1180px] mx-auto px-3 sm:px-6 py-5 lg:py-8">
      {head}
      <section className="bg-white border border-[#e9ebf3] rounded-2xl p-4 sm:p-5 grid gap-4 lg:gap-0 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.9fr)_minmax(0,1.25fr)] mb-3.5">
        <div className="flex items-center gap-4 lg:pr-5 lg:border-r border-[#f0f1f6]">
          <GoalRing value={o.xpToday} goal={o.dailyGoalXp} size={96} />
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#8a8fa0]">{px.today}</div>
            <div className="text-2xl font-bold tracking-tight text-[#101828] mt-0.5 tabular-nums">{o.xpToday} / {o.dailyGoalXp} XP</div>
            <div className={cn('text-sm mt-0.5', left === 0 ? 'text-g-ok font-semibold' : 'text-[#6b7080]')}>{left === 0 ? px.goalDone : px.toGoal(left)}</div>
          </div>
        </div>
        <div className="grid grid-cols-3 lg:grid-cols-1 gap-2 lg:gap-2.5 lg:px-5 lg:border-r border-[#f0f1f6]">
          {[
            { icon: Clock, tone: 'bg-[#fef3c7] text-[#b45309]', v: String(o.dueCount), l: px.dueLabel },
            { icon: Plus, tone: 'bg-g-blue-50 text-g-blue-700', v: String(o.newCount), l: px.newLabel },
            { icon: Flame, tone: 'bg-[#fff7ed] text-[#c2410c]', v: px.days(o.streakCount), l: o.streakFreezes > 0 ? `${px.streakLabel} · ${t.freezes(o.streakFreezes)}` : px.streakLabel },
          ].map((s) => (
            <div key={s.l} className="flex flex-col lg:flex-row lg:items-center gap-1.5 lg:gap-3 min-w-0 bg-[#f7f8fc] lg:bg-transparent rounded-xl p-2.5 lg:p-0">
              <span className={cn('size-8 lg:size-9 rounded-[10px] grid place-items-center shrink-0', s.tone)}>
                <s.icon className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <b className="block text-base lg:text-lg font-bold text-[#101828] leading-tight">{s.v}</b>
                <span className="block text-[11.5px] lg:text-[12.5px] text-[#6b7080] leading-snug">{s.l}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="lg:pl-5 flex flex-col gap-2.5">
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#8a8fa0]">{t.sessionLength}</div>
          <div className="grid grid-cols-3 gap-1 bg-[#f1f2f7] p-1 rounded-xl" role="radiogroup" aria-label={t.sessionLength}>
            {SIZES.map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={size === n}
                onClick={() => setSize(n)}
                className={cn(
                  'min-h-9 px-1.5 rounded-[9px] text-[13px] font-semibold transition-colors whitespace-nowrap',
                  size === n ? 'bg-white text-g-blue-700 shadow-sm' : 'text-[#6b7080] hover:text-[#101828]',
                )}
              >
                {sizeLabels[n]}
              </button>
            ))}
          </div>
          {nothingDue ? (
            <>
              <p className="text-sm font-semibold text-g-ok flex items-center gap-1.5">
                <Check className="w-4 h-4" /> {t.allCaughtUp}
              </p>
              <Button onClick={onExtra} className="w-full h-12 rounded-xl bg-g-cta hover:bg-g-cta-hover text-white font-bold">
                <Sparkles className="w-4 h-4 mr-1.5" />
                {t.practiceExtra}
              </Button>
              <p className="text-xs text-g-text-2 text-center">{t.extraNote}</p>
            </>
          ) : (
            <>
              <p className="text-[13px] text-[#4a5565] flex items-center gap-1.5 flex-wrap" data-testid="practice-preview">
                <Info className="w-3.5 h-3.5 text-[#8a8fa0] shrink-0" />
                {px.sessionHas}
                {reviews > 0 && <b className="text-[#101828]">{px.reviews(reviews)}</b>}
                {reviews > 0 && fresh > 0 && <span>+</span>}
                {fresh > 0 && <b className="text-[#101828]">{px.fresh(fresh)}</b>}
                <span>{px.words}</span>
              </p>
              <Button onClick={onStart} className="w-full h-12 rounded-xl bg-g-cta hover:bg-g-cta-hover text-white font-bold text-base">
                <Play className="w-4 h-4 mr-1.5" />
                {o.practicedToday ? t.continueSession : t.startSession}
              </Button>
            </>
          )}
          <p className="hidden sm:block text-xs text-g-text-3 text-center">{t.shortcuts}</p>
        </div>
      </section>

      <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section className="bg-white border border-[#e9ebf3] rounded-2xl p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h2 className="text-base font-bold text-[#101828]">{t.nextReview}</h2>
              <p className="text-xs text-[#8a8fa0] mt-0.5">{px.forecastSub}</p>
            </div>
            <button type="button" onClick={onVocabulary} className="shrink-0 inline-flex items-center gap-0.5 text-sm font-semibold text-g-blue-700 hover:underline">
              {px.openVocab} <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          {o.forecast.length > 0 ? (
            <div className="flex items-end gap-2 sm:gap-3 h-[150px]" role="img" aria-label={t.dueTomorrow(o.forecast[1]?.count ?? 0)}>
              {o.forecast.slice(0, 7).map((d, i) => (
                <div key={d.date} className="flex-1 flex flex-col items-center justify-end gap-1.5 h-full" title={`${d.date}: ${d.count}`}>
                  <span className="text-xs font-bold text-[#101828] tabular-nums">{d.count || ''}</span>
                  <div
                    className={cn('w-full max-w-[56px] rounded-md', d.count === 0 ? 'bg-[#eceef5]' : i === 0 ? 'bg-g-blue-700' : 'bg-[#c5cafd]')}
                    style={{ height: `${d.count === 0 ? 4 : Math.max(8, (d.count / fmax) * 96)}px` }}
                  />
                  <span className="text-[11px] font-semibold text-[#8a8fa0] whitespace-nowrap">{forecastLabel(d.date, i, px)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[#8a8fa0]">{t.allCaughtUp}</p>
          )}
        </section>

        <section className="bg-white border border-[#e9ebf3] rounded-2xl p-4 sm:p-5">
          <h2 className="text-base font-bold text-[#101828]">{t.goalPicker}</h2>
          <p className="text-xs text-[#8a8fa0] mt-0.5 mb-3">{px.goalSub}</p>
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-2" role="radiogroup" aria-label={t.goalPicker}>
            {DAILY_GOAL_OPTIONS.map((g) => {
              const [name, xp] = t.goalNames[g].split(' · ');
              const on = o.dailyGoalXp === g;
              return (
                <button
                  key={g}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => onGoal(g)}
                  className={cn(
                    'min-h-11 px-3 rounded-xl border flex items-center gap-2.5 text-left transition-colors',
                    on ? 'border-g-blue-700 bg-g-blue-50/60' : 'border-[#e3e5ee] hover:border-[#c5cafd]',
                  )}
                >
                  <span className={cn('size-[18px] rounded-full border-2 grid place-items-center shrink-0', on ? 'border-g-blue-700' : 'border-[#c3c7d4]')}>
                    {on && <span className="size-2 rounded-full bg-g-blue-700" />}
                  </span>
                  <span className="text-sm font-semibold text-[#101828] flex-1 min-w-0 truncate">{name}</span>
                  {xp && <span className="text-xs font-semibold text-[#6b7080] shrink-0">{xp}</span>}
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

function ExercisePlayer({
  item,
  sessionId,
  t,
  onAnswered,
  onNext,
  stats,
  onExit,
}: {
  item: PracticeItem;
  sessionId: string | null;
  t: PracticeCopy;
  stats: { xpToday: number; dailyGoalXp: number; streakCount: number; streakFreezes: number };
  onExit: () => void;
  onAnswered: (item: PracticeItem, res: AnswerResult | null) => void;
  onNext: () => void;
}) {
  const [text, setText] = useState('');
  const [choice, setChoice] = useState<string | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [hint, setHint] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [skipped, setSkipped] = useState(false);
  const [replays, setReplays] = useState(0);
  const startedAt = useRef(Date.now());
  const inputRef = useRef<HTMLInputElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  const done = !!result || skipped;
  const isListening = item.type === 'listening_mcq' || item.type === 'dictation';

  const play = useCallback(
    async (slow = false) => {
      try {
        await playItemAudio(item, slow);
        setReplays((r) => r + 1);
      } catch {
        if (item.type === 'listening_mcq' || item.type === 'dictation') {
          // Offline / TTS failure → "Audio unavailable", auto-skip without penalty (DESIGN §2).
          toast(t.audioUnavailable);
          setSkipped(true);
          onAnswered(item, null);
        }
      }
    },
    [item, t, onAnswered],
  );

  useEffect(() => {
    if (isListening) void play();
    inputRef.current?.focus();
    return () => stopSpeaking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (done) continueRef.current?.focus();
  }, [done]);

  const submit = async (payload: { answer?: string; selfRating?: SrsRatingValue }) => {
    if (busy || done) return;
    setBusy(true);
    try {
      const res = await practiceApi.answer({
        answerId: newAnswerId(),
        sessionId,
        vocabId: item.vocabId,
        type: item.type,
        responseMs: Date.now() - startedAt.current,
        hintUsed: hint || replays > 2,
        extra: item.extra,
        ...payload,
      });
      setResult(res);
      onAnswered(item, res);
      if (item.type === 'flashcard') {
        // Self-rated: no verdict sheet needed, go straight on.
        onNext();
      }
    } catch (e) {
      (isDailyLimitError(e) ? undefined : toast.error(e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };

  const skip = () => {
    if (done) return;
    stopSpeaking();
    setSkipped(true);
    onAnswered(item, null); // skipped items are not graded and stay due
  };

  const check = () => {
    if (MCQ.includes(item.type)) {
      if (choice) void submit({ answer: choice });
    } else if (TYPED.includes(item.type)) {
      if (text.trim()) void submit({ answer: text });
    }
  };

  // Keyboard: Enter check/continue · 1–4 options/ratings · Space flip · H hint · Ctrl+→ skip · Ctrl+Space replay
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.tagName === 'INPUT';
      if (e.key === 'Escape') {
        e.preventDefault();
        onExit();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (done) onNext();
        else check();
        return;
      }
      if (e.ctrlKey && e.key === 'ArrowRight') {
        e.preventDefault();
        if (done) onNext();
        else skip();
        return;
      }
      if (e.ctrlKey && e.code === 'Space') {
        e.preventDefault();
        void play();
        return;
      }
      if (typing || done) return;
      if (item.type === 'flashcard') {
        if (e.code === 'Space' && !flipped) {
          e.preventDefault();
          setFlipped(true);
        } else if (flipped && ['1', '2', '3', '4'].includes(e.key)) {
          void submit({ selfRating: (['again', 'hard', 'good', 'easy'] as const)[Number(e.key) - 1] });
        }
      } else if (MCQ.includes(item.type) && item.options && ['1', '2', '3', '4'].includes(e.key)) {
        const opt = item.options[Number(e.key) - 1];
        if (opt) setChoice(opt);
      } else if (e.key.toLowerCase() === 'h') {
        setHint(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const eyebrow = t.typeNames[item.type];
  const prompt = t.prompts[item.type];

  return (
    <div className="flex-1 flex flex-col">
      <div className={cn('flex-1 overflow-y-auto p-4 sm:p-6', done ? 'pb-56' : 'pb-32')}>
        <div className="max-w-[1040px] mx-auto lg:grid lg:grid-cols-[minmax(0,720px)_280px] lg:justify-center gap-6">
        <section className="max-w-2xl lg:max-w-none mx-auto w-full flex flex-col gap-4" aria-labelledby="ex-prompt">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-[.06em] text-g-accent">{eyebrow}</span>
            {item.extra && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-g-accent-soft text-g-accent">{t.practiceExtra}</span>}
          </div>
          <h2 id="ex-prompt" className="text-lg sm:text-xl font-bold text-g-text">
            {prompt}
            {item.type === 'typed_recall' && item.translation ? <span className="text-g-accent"> “{item.translation}”</span> : null}
          </h2>

          <div className="bg-g-card border border-g-line rounded-[24px] p-5 sm:p-8 shadow-g-card">
            {/* ---- flashcard */}
            {item.type === 'flashcard' && (
              <div className="text-center">
                <WordLine item={item} onPlay={() => void play()} t={t} />
                {flipped ? (
                  <div className="mt-5 pt-5 border-t border-g-line">
                    <p className="text-xl font-bold text-g-text" lang={item.nativeLang}>
                      {item.translation}
                    </p>
                    {item.context && <Context text={item.context} word={item.word} lang={item.lang} />}
                    {item.source && <p className="text-xs text-g-text-2 mt-2">{item.source.title}</p>}
                  </div>
                ) : (
                  <Button onClick={() => setFlipped(true)} className="mt-6 h-12 px-6 rounded-[14px] bg-g-cta hover:bg-g-cta-hover text-white font-bold">
                    {t.showAnswer} <Kbd>Space</Kbd>
                  </Button>
                )}
              </div>
            )}

            {/* ---- recognition MCQ */}
            {item.type === 'mcq_meaning' && (
              <div className="text-center mb-5">
                <WordLine item={item} onPlay={() => void play()} t={t} />
                {item.context && <Context text={item.context} word={item.word} lang={item.lang} />}
              </div>
            )}

            {/* ---- cloze */}
            {(item.type === 'cloze' || item.type === 'cloze_mcq') && item.cloze && (
              <div className="mb-4">
                <p className="font-serif text-[19px] sm:text-[26px] leading-[1.7] text-g-text" lang={item.lang}>
                  {item.cloze.before}
                  {item.type === 'cloze' ? (
                    <input
                      ref={inputRef}
                      value={text}
                      disabled={done}
                      onChange={(e) => setText(e.target.value)}
                      aria-label="Missing word"
                      lang={item.lang}
                      autoCapitalize="off"
                      autoCorrect="off"
                      autoComplete="off"
                      spellCheck={false}
                      className="inline-block mx-1 px-1 border-0 border-b-2 border-g-accent bg-transparent text-g-accent font-semibold outline-none text-center"
                      style={{ width: `${Math.max(item.cloze.length + 2, text.length + 2)}ch`, minWidth: '96px' }}
                    />
                  ) : (
                    <span className="inline-block mx-1 min-w-[96px] border-b-2 border-g-accent text-center text-g-accent font-semibold">
                      {choice ?? '\u00a0'}
                    </span>
                  )}
                  {item.cloze.after}
                </p>
                {item.translation && <p className="text-sm text-g-text-2 mt-2" lang={item.nativeLang}>{item.translation}</p>}
              </div>
            )}

            {/* ---- listening */}
            {isListening && (
              <div className="flex flex-col items-center gap-3 mb-5">
                <button
                  type="button"
                  onClick={() => void play()}
                  aria-label={t.playAudio}
                  className="w-24 h-24 rounded-full bg-g-cta text-white flex items-center justify-center ring-[10px] ring-g-accent-soft hover:bg-g-cta-hover transition"
                >
                  <Volume2 className="w-10 h-10" />
                </button>
                <div className="flex gap-2">
                  <button type="button" onClick={() => void play(true)} className="px-3 h-9 rounded-full border border-g-line text-sm font-semibold text-g-text hover:border-gray-300">
                    0.75×
                  </button>
                  <button type="button" onClick={() => void play()} className="px-3 h-9 rounded-full border border-g-line text-sm font-semibold text-g-text hover:border-gray-300 inline-flex items-center gap-1">
                    <RotateCcw className="w-3.5 h-3.5" /> {t.replay}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.setItem(MUTE_KEY, String(Date.now() + 60 * 60_000));
                    skip();
                  }}
                  className="text-xs font-semibold text-g-text-2 hover:text-g-text inline-flex items-center gap-1"
                >
                  <Headphones className="w-3.5 h-3.5" /> {t.cantListen}
                </button>
              </div>
            )}

            {/* ---- typed input */}
            {(item.type === 'typed_recall' || item.type === 'dictation') && (
              <input
                ref={inputRef}
                value={text}
                disabled={done}
                onChange={(e) => setText(e.target.value)}
                placeholder={t.typeHere}
                lang={item.lang}
                autoCapitalize="off"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                className="w-full h-[52px] px-4 bg-g-input border border-g-line-input rounded-[14px] text-base text-g-text placeholder:text-g-text-3 outline-none focus:ring-2 focus:ring-g-accent/20 focus:border-g-accent transition-all"
              />
            )}

            {/* ---- options */}
            {MCQ.includes(item.type) && item.options && (
              <div className="flex flex-col gap-2.5" role="radiogroup">
                {item.options.map((opt, i) => {
                  const isPicked = choice === opt;
                  const isRight = result && normalizeShow(opt) === normalizeShow(item.type === 'mcq_meaning' ? result.translation : result.expected);
                  return (
                    <button
                      key={opt}
                      type="button"
                      role="radio"
                      aria-checked={isPicked}
                      disabled={done}
                      onClick={() => setChoice(opt)}
                      className={cn(
                        'min-h-14 text-left px-4 py-3 rounded-[14px] border-[1.5px] text-base font-medium transition-all flex items-center gap-3',
                        done && isRight
                          ? 'border-g-ok bg-g-ok-bg text-g-ok'
                          : done && isPicked
                            ? 'border-g-bad bg-g-bad-bg text-g-bad'
                            : isPicked
                              ? 'border-g-accent bg-g-accent-soft text-g-accent'
                              : done
                                ? 'border-g-line-input text-g-text opacity-60'
                                : 'border-g-line-input text-g-text hover:border-g-accent-line',
                      )}
                    >
                      <span className="w-6 h-6 rounded-md border border-current/30 text-xs font-bold flex items-center justify-center shrink-0 opacity-70">{i + 1}</span>
                      <span lang={item.type === 'mcq_meaning' ? item.nativeLang : item.lang}>{opt}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {hint && !done && item.hint && (
              <p role="note" className="mt-3 text-sm font-medium px-3 py-2 rounded-xl bg-g-info-bg text-g-info">
                {item.cloze?.hint ?? `${item.hint.firstLetter}${' _'.repeat(Math.max(0, item.hint.length - 1))}`} · {item.hint.length}
              </p>
            )}
          </div>
        </section>
        <SidePanel t={t} stats={stats} />
        </div>
      </div>

      {/* ---- footer / feedback sheet */}
      {item.type === 'flashcard' && flipped && !done ? (
        <footer className="fixed inset-x-0 bottom-0 bg-g-card border-t border-g-line p-3 sm:p-4 pb-[max(12px,env(safe-area-inset-bottom))]">
          <div className="max-w-2xl mx-auto">
            <p className="text-xs font-semibold text-g-text-2 mb-2 text-center">{t.rateHow}</p>
            <div className="grid grid-cols-4 gap-2">
              {(
                [
                  ['again', t.again, 'border-g-bad-line text-g-bad hover:bg-g-bad-bg'],
                  ['hard', t.hard, 'border-g-line-input text-g-text hover:bg-g-card-2'],
                  ['good', t.good, 'border-g-ok-line text-g-ok hover:bg-g-ok-bg'],
                  ['easy', t.easy, 'border-g-accent-line text-g-accent hover:bg-g-accent-soft'],
                ] as const
              ).map(([r, label, cls], i) => (
                <button
                  key={r}
                  type="button"
                  disabled={busy}
                  onClick={() => void submit({ selfRating: r })}
                  className={cn('min-h-12 rounded-[14px] border-[1.5px] bg-g-card text-sm font-bold transition', cls)}
                >
                  {label}
                  <span className="hidden sm:inline text-[10px] opacity-60 ml-1">{i + 1}</span>
                </button>
              ))}
            </div>
          </div>
        </footer>
      ) : done && item.type !== 'flashcard' ? (
        <FeedbackSheet t={t} item={item} result={result} skipped={skipped} onContinue={onNext} continueRef={continueRef} onPlay={() => void play()} />
      ) : item.type !== 'flashcard' ? (
        <footer className="fixed inset-x-0 bottom-0 bg-g-card border-t border-g-line p-3 sm:p-4 pb-[max(12px,env(safe-area-inset-bottom))]">
          <div className="max-w-2xl mx-auto flex items-center gap-2">
            <button type="button" onClick={skip} className="min-h-12 px-4 rounded-[14px] text-sm font-semibold text-g-text-2 hover:bg-g-accent-soft">
              {t.skip}
            </button>
            {item.hint && !hint && (
              <button
                type="button"
                onClick={() => setHint(true)}
                className="min-h-12 px-3 rounded-[14px] text-sm font-semibold text-g-info hover:bg-g-info-bg inline-flex items-center gap-1"
              >
                <Lightbulb className="w-4 h-4" /> {t.hint}
              </button>
            )}
            <Button
              onClick={check}
              disabled={busy || (MCQ.includes(item.type) ? !choice : !text.trim())}
              className="ml-auto min-h-12 px-8 rounded-[14px] bg-g-cta hover:bg-g-cta-hover text-white font-bold text-base"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : t.check}
            </Button>
          </div>
        </footer>
      ) : null}
    </div>
  );
}

function SidePanel({ t, stats }: { t: PracticeCopy; stats: { xpToday: number; dailyGoalXp: number } }) {
  const pct = Math.min(100, stats.dailyGoalXp ? Math.round((stats.xpToday / stats.dailyGoalXp) * 100) : 0);
  const keys: Array<[string, string]> = [
    [`${t.check} / ${t.continue}`, 'Enter'],
    ['1–4', '1–4'],
    [t.showAnswer, 'Space'],
    [t.hint, 'H'],
    [t.playAudio, 'Ctrl Space'],
    [t.skip, 'Ctrl →'],
    [t.endSession, 'Esc'],
  ];
  return (
    <aside className="hidden lg:flex flex-col gap-4 pt-[52px]">
      <div className="bg-g-card border border-g-line rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <BrandMark size={32} />
          <div>
            <div className="text-xl font-extrabold text-g-text tabular-nums">{pct}%</div>
            <div className="text-xs text-g-text-2">
              {t.dailyGoal} · {stats.xpToday}/{stats.dailyGoalXp} XP
            </div>
          </div>
        </div>
        <div className="mt-3 h-1.5 rounded-full bg-g-accent-soft overflow-hidden">
          <div className="h-full rounded-full bg-g-progress transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="bg-g-card border border-g-line rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold text-g-text">{t.shortcutsTitle}</span>
          <Keyboard className="w-4 h-4 text-g-text-2" aria-hidden />
        </div>
        <ul className="flex flex-col gap-2">
          {keys.map(([label, k]) => (
            <li key={label} className="flex items-center justify-between gap-2 text-xs text-g-text-2">
              <span className="truncate">{label}</span>
              <kbd className="font-mono text-[11px] font-semibold px-1.5 rounded-md border border-g-line-input border-b-2 bg-g-card-2 text-g-text-2">{k}</kbd>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

function normalizeShow(s: string) {
  return s.trim().toLowerCase();
}

function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="hidden sm:inline ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded border border-white/40">{children}</kbd>;
}

function WordLine({ item, onPlay, t }: { item: PracticeItem; onPlay: () => void; t: PracticeCopy }) {
  return (
    <div className="flex items-center justify-center gap-3">
      <span className="text-[34px] leading-tight font-extrabold text-g-text break-words" lang={item.lang} style={{ fontFamily: 'Manrope, Inter, sans-serif' }}>
        {item.word}
      </span>
      <button type="button" onClick={onPlay} aria-label={t.playAudio} className="w-10 h-10 rounded-full bg-g-accent-soft text-g-accent flex items-center justify-center hover:bg-g-accent-soft">
        <Volume2 className="w-5 h-5" />
      </button>
    </div>
  );
}

function Context({ text, word, lang }: { text: string; word?: string; lang: string }) {
  if (!word) return <p className="text-sm text-g-text-2 mt-3 italic" lang={lang}>{text}</p>;
  const i = text.toLowerCase().indexOf(word.toLowerCase());
  return (
    <p className="font-serif text-sm sm:text-base text-g-text-2 mt-3" lang={lang}>
      {i < 0 ? (
        text
      ) : (
        <>
          {text.slice(0, i)}
          <strong className="text-g-text">{text.slice(i, i + word.length)}</strong>
          {text.slice(i + word.length)}
        </>
      )}
    </p>
  );
}

function FeedbackSheet({
  t,
  item,
  result,
  skipped,
  onContinue,
  continueRef,
  onPlay,
}: {
  t: PracticeCopy;
  item: PracticeItem;
  result: AnswerResult | null;
  skipped: boolean;
  onContinue: () => void;
  continueRef: React.RefObject<HTMLButtonElement | null>;
  onPlay: () => void;
}) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const verdict = skipped ? 'skipped' : result?.verdict ?? 'wrong';
  const tone = {
    correct: { bg: 'bg-g-ok-bg', text: 'text-g-ok', btn: 'bg-g-ok hover:brightness-90 text-g-on-fill', icon: <Check className="w-5 h-5" />, title: t.correct },
    almost: { bg: 'bg-g-warn-bg', text: 'text-g-warn', btn: 'bg-g-cta hover:bg-g-cta-hover text-white', icon: <Sparkles className="w-5 h-5" />, title: t.almost },
    wrong: { bg: 'bg-g-bad-bg', text: 'text-g-bad', btn: 'bg-g-bad hover:brightness-90 text-g-on-fill', icon: <X className="w-5 h-5" />, title: t.incorrect },
    skipped: { bg: 'bg-g-card-2', text: 'text-g-text-2', btn: 'bg-g-cta hover:bg-g-cta-hover text-white', icon: <RotateCcw className="w-5 h-5" />, title: t.willRetry },
  }[verdict];
  const note =
    result?.reason === 'wrong_script'
      ? t.keyboardHint
      : result?.reason === 'uz_apostrophe'
        ? t.uzApostropheNote
        : result?.reason === 'diacritics'
          ? t.accentNote
          : result?.reason === 'real_word'
            ? t.realWordNote
            : result?.verdict === 'almost'
              ? t.typoNote
              : null;
  const typed = TYPED.includes(item.type);
  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-0 border-t border-g-line transition-transform duration-[220ms] ease-[cubic-bezier(.2,0,0,1)]',
        tone.bg,
        shown ? 'translate-y-0' : 'translate-y-full',
      )}
      role="status"
      aria-live={verdict === 'wrong' ? 'assertive' : 'polite'}
    >
      <div className="max-w-2xl mx-auto p-4 sm:p-5 pb-[max(16px,env(safe-area-inset-bottom))] flex flex-col gap-3">
        <div className={cn('flex items-center gap-2 font-extrabold text-lg', tone.text)}>
          {tone.icon}
          {tone.title}
          {result && result.xpGained > 0 && <span className="ml-auto text-sm font-bold text-g-accent">+{result.xpGained} XP</span>}
        </div>
        {result && (verdict !== 'correct' || typed) && (
          <div className="text-sm text-g-text flex flex-col gap-1">
            {typed && result.diff.length > 0 && verdict !== 'correct' && (
              <p className="font-mono text-base" aria-label={`${t.yourAnswer}`}>
                {result.diff.map((p, i) => (
                  <span
                    key={i}
                    className={cn(
                      p.op === 'del' && 'line-through text-g-bad bg-g-bad-bg',
                      p.op === 'add' && 'underline decoration-2 text-g-ok bg-g-ok-bg',
                    )}
                  >
                    {p.text}
                  </span>
                ))}
              </p>
            )}
            <p>
              <span className="text-g-text-2">{t.correctAnswerIs}: </span>
              <strong lang={item.type === 'mcq_meaning' ? item.nativeLang : item.lang}>{item.type === 'mcq_meaning' ? result.translation : result.expected}</strong>
              <button type="button" onClick={onPlay} aria-label={t.playAudio} className="inline-flex align-middle ml-1.5 text-g-accent">
                <Volume2 className="w-4 h-4" />
              </button>
              <span className="text-g-text-2"> · {item.type === 'mcq_meaning' ? result.word : result.translation}</span>
            </p>
            {note && <p className={cn('text-xs font-semibold', tone.text)}>{note}</p>}
            {result.requeue && <p className="text-xs text-g-text-2">{t.willRetry}</p>}
          </div>
        )}
        <Button ref={continueRef} onClick={onContinue} className={cn('w-full sm:w-auto sm:self-end min-h-12 px-8 rounded-[14px] font-bold text-base text-white', tone.btn)}>
          {t.continue}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

function Summary({
  t,
  s,
  canRetry,
  onRetry,
  onNew,
  onRead,
}: {
  t: PracticeCopy;
  s: SessionSummary;
  canRetry: boolean;
  onRetry: () => void;
  onNew: () => void;
  onRead: () => void;
}) {
  const goal = s.xpToday >= s.dailyGoalXp;
  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="max-w-2xl mx-auto flex flex-col gap-4">
        <section className="bg-g-card border border-g-line rounded-2xl p-6 flex flex-col items-center text-center gap-3">
          <GoalRing value={s.xpToday} goal={s.dailyGoalXp} size={132} />
          <h1 className="text-xl font-extrabold text-g-text">{goal ? t.goalReached : t.summaryTitle}</h1>
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-g-streak-bg border border-g-streak-line text-g-streak-text text-sm font-bold">
            <Flame className="w-4 h-4 text-g-streak-icon" />
            {t.streakDays(s.streakCount)}
            {s.streakExtended && <span className="text-g-ok"> · +1</span>}
          </div>
        </section>

        <section className="grid grid-cols-3 gap-2 sm:gap-3">
          {[
            [t.accuracy, `${Math.round(s.accuracy * 100)}%`],
            [t.xpEarned, `+${s.xpEarned}`],
            [t.wordsPracticed, String(s.answered)],
          ].map(([label, value]) => (
            <div key={label} className="bg-g-card border border-g-line rounded-2xl p-3 sm:p-4 text-center">
              <div className="text-xl sm:text-2xl font-extrabold text-g-text tabular-nums">{value}</div>
              <div className="text-[11px] sm:text-xs font-semibold text-g-text-2 mt-0.5">{label}</div>
            </div>
          ))}
        </section>

        <section className="bg-g-card border border-g-line rounded-2xl p-5">
          <h2 className="text-sm font-bold text-g-text mb-3">{t.mistakesToReview}</h2>
          {s.mistakes.length === 0 ? (
            <p className="text-sm text-g-ok font-semibold flex items-center gap-1.5">
              <Check className="w-4 h-4" /> {t.noMistakes}
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-g-line">
              {s.mistakes.map((m) => (
                <li key={m.vocabId} className="py-2.5 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-g-text truncate">{m.word}</div>
                    <div className="text-sm text-g-text-2 truncate">{m.translation}</div>
                  </div>
                  <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-g-bad-bg text-g-bad shrink-0">
                    {t.nextReview}: {new Date(m.nextDueAt).toLocaleString(undefined, { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-sm text-g-text-2 mt-3">{t.dueTomorrow(s.dueTomorrow)}</p>
        </section>

        <div className="flex flex-col sm:flex-row gap-2">
          {canRetry && (
            <Button onClick={onRetry} variant="outline" className="flex-1 min-h-12 rounded-[14px] font-bold !bg-g-card !text-g-text !border-g-line hover:!bg-g-card-2">
              <RotateCcw className="w-4 h-4 mr-1.5" /> {t.practiceMistakes}
            </Button>
          )}
          <Button onClick={onRead} variant="outline" className="flex-1 min-h-12 rounded-[14px] font-bold !bg-g-card !text-g-text !border-g-line hover:!bg-g-card-2">
            <BookOpen className="w-4 h-4 mr-1.5" /> {t.continueReading}
          </Button>
          <Button onClick={onNew} className="flex-1 min-h-12 rounded-[14px] bg-g-cta hover:bg-g-cta-hover text-white font-bold">
            {t.newSession}
          </Button>
        </div>
      </div>
    </div>
  );
}
