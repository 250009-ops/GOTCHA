import { useEffect, useMemo, useState } from 'react';
import { handleLimitError } from '../lib/limits';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, Check, GraduationCap, Loader2, RotateCcw, X } from 'lucide-react';
import { toast } from 'sonner';
import { isDailyLimitError } from '../lib/dailyLimit';
import { Button } from '../components/ui/button';
import { cn } from '../components/ui/utils';
import { api } from '../lib/api';
import { useLearnerCopy } from '../lib/learnerLocaleContext';
import type { ContentItem } from '../lib/types';

// Open "writing" questions are removed until LLM grading exists (PRD §11).
type PracticeType = 'comprehension' | 'cloze';

interface PracticeQuestion {
  id: string;
  questionIndex: number;
  prompt: string;
  options?: string[] | null;
  correctAnswer?: string; // W-24: sent only with results
  explanation?: string | null;
}

interface PracticeSession {
  id: string;
  contentId?: string | null;
  segmentId?: string | null;
  practiceType: PracticeType;
  questionCount: number;
  correctCount?: number | null;
  completedAt?: string | null;
  questions: PracticeQuestion[];
}

interface AnswerResult {
  questionId: string;
  userAnswer: string;
  isCorrect: boolean;
  correctAnswer?: string;
  explanation?: string | null;
}

/** AI comprehension / cloze quiz for one chapter (entry: Reader → "Chapter quiz"). */
export default function ChapterQuizPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const copy = useLearnerCopy();
  const pp = copy.practicePage;
  const p = copy.practice;
  const contentId = searchParams.get('contentId');
  const segmentId = searchParams.get('segmentId');
  const sessionId = searchParams.get('sessionId');

  const typeLabels = useMemo(
    (): Record<PracticeType, string> => ({
      comprehension: pp.comprehension,
      cloze: pp.fillBlank,
    }),
    [pp],
  );

  const [content, setContent] = useState<ContentItem | null>(null);
  const [contentLoading, setContentLoading] = useState(Boolean(contentId));
  const [practiceType, setPracticeType] = useState<PracticeType>('comprehension');
  const [starting, setStarting] = useState(false);
  const [session, setSession] = useState<PracticeSession | null>(null);
  const [questionIdx, setQuestionIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [freeText, setFreeText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<{ score: number; results: AnswerResult[] } | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    let cancel = false;
    setStarting(true);
    api<PracticeSession>(`/practice/sessions/${sessionId}`)
      .then((started) => {
        if (cancel || !started?.questions?.length) return;
        setSession(started);
        setQuestionIdx(0);
        setAnswers({});
        setResults(null);
      })
      .catch((e) => {
        if (!cancel) toast.error(e instanceof Error ? e.message : copy.commonExt.error);
      })
      .finally(() => { if (!cancel) setStarting(false); });
    return () => { cancel = true; };
  }, [sessionId, copy.commonExt.error]);

  useEffect(() => {
    if (!contentId) {
      setContentLoading(false);
      return;
    }
    api<ContentItem>(`/content/${contentId}`)
      .then(setContent)
      .catch(() => undefined)
      .finally(() => setContentLoading(false));
  }, [contentId]);

  const currentQuestion = session?.questions[questionIdx];
  const isLastQuestion = session ? questionIdx === session.questions.length - 1 : false;

  const startSession = async () => {
    if (!segmentId) {
      toast.error(pp.openChapterFirst);
      return;
    }
    setStarting(true);
    try {
      const started = await api<PracticeSession>('/practice/sessions', {
        method: 'POST',
        body: JSON.stringify({ contentId: contentId ?? undefined, segmentId, practiceType }),
      });
      if (!started.questions?.length) {
        toast.error(p.quizUnavailable);
        return;
      }
      setSession(started);
      setQuestionIdx(0);
      setAnswers({});
      setFreeText('');
      setResults(null);
    } catch (e) {
      const raw = e instanceof Error ? e.message : '';
      const code = e && typeof e === 'object' && 'code' in e ? String((e as { code?: string }).code) : '';
      if (code === 'quiz_empty' || /could not build a quiz/i.test(raw)) {
        toast.error(p.quizUnavailable);
      } else if (code === 'mashq_burst') {
        toast.message(raw);
      } else if (!isDailyLimitError(e) && !handleLimitError(e)) {
        toast.error(raw || copy.commonExt.error);
      }
    } finally {
      setStarting(false);
    }
  };

  const selectAnswer = (value: string) => {
    if (!currentQuestion) return;
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: value }));
  };

  const goNext = () => {
    if (!session || !currentQuestion) return;
    const hasOptions = Boolean(currentQuestion.options?.length);
    if (!hasOptions) {
      if (!freeText.trim()) {
        toast.error(pp.typeAnswer);
        return;
      }
      selectAnswer(freeText.trim());
    } else if (!answers[currentQuestion.id]) {
      toast.error(pp.pickAnswer);
      return;
    }
    if (isLastQuestion) {
      void finishSession();
    } else {
      setQuestionIdx((i) => i + 1);
      setFreeText('');
    }
  };

  const finishSession = async () => {
    if (!session) return;
    const hasOptions = Boolean(currentQuestion?.options?.length);
    const finalAnswers = { ...answers };
    if (currentQuestion && !hasOptions && freeText.trim()) {
      finalAnswers[currentQuestion.id] = freeText.trim();
    }
    const payload = session.questions.map((q) => ({
      questionId: q.id,
      userAnswer: finalAnswers[q.id] ?? '',
    }));
    setSubmitting(true);
    try {
      const res = await api<{ score: number; results: AnswerResult[] }>(
        `/practice/sessions/${session.id}/answers`,
        { method: 'POST', body: JSON.stringify({ answers: payload }) },
      );
      setResults(res);
    } catch (e) {
      if (!isDailyLimitError(e) && !handleLimitError(e)) toast.error(e instanceof Error ? e.message : copy.commonExt.error);
    } finally {
      setSubmitting(false);
    }
  };

  const restart = () => {
    setSession(null);
    setResults(null);
    setAnswers({});
    setFreeText('');
    setQuestionIdx(0);
  };

  const exitQuiz = () => (contentId ? navigate(`/app/read/${contentId}`) : navigate('/app'));

  // Keyboard: 1–4 / A–D pick an option, Enter goes on, Esc leaves the quiz.
  useEffect(() => {
    if (!session || results || !currentQuestion) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA';
      if (e.key === 'Escape') { exitQuiz(); return; }
      if (e.key === 'Enter' && !typing) { e.preventDefault(); goNext(); return; }
      const opts = currentQuestion.options ?? [];
      if (typing || !opts.length) return;
      const idx = ['1', '2', '3', '4', '5', '6'].indexOf(e.key);
      const letter = 'abcdef'.indexOf(e.key.toLowerCase());
      const pick = idx >= 0 ? idx : letter;
      if (pick >= 0 && pick < opts.length) selectAnswer(opts[pick]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  /** Focused-session top bar (same look as the Mashq player): close · title · progress. */
  const HeaderBar = ({ title, step, total }: { title: string; step?: number; total?: number }) => (
    <header className="shrink-0 bg-white/90 backdrop-blur border-b border-[#eef0f5]">
      <div className="max-w-[720px] mx-auto h-14 flex items-center gap-3 px-4">
        <button
          type="button"
          onClick={exitQuiz}
          aria-label={contentId ? pp.backToReading : copy.nav.library}
          title={contentId ? pp.backToReading : copy.nav.library}
          className="size-9 -ml-1 rounded-xl grid place-items-center text-[#6b7080] hover:bg-[#f1f2f7] hover:text-[#101828]"
        >
          {step ? <X className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-[10.5px] font-bold tracking-[0.12em] uppercase text-g-blue-700 leading-none">{p.title}</div>
          <div className="text-sm font-semibold text-[#101828] truncate mt-1">{title}</div>
        </div>
        {step && total ? (
          <span className="shrink-0 text-xs font-bold text-[#6b7080] tabular-nums bg-[#f1f2f7] rounded-full px-2.5 py-1">{step} / {total}</span>
        ) : null}
      </div>
      {step && total ? (
        <div className="h-1 bg-[#eef0ff]"><div className="h-full bg-g-blue-700 transition-all duration-300" style={{ width: `${(step / total) * 100}%` }} /></div>
      ) : null}
    </header>
  );

  const primaryBtn = 'w-full h-12 rounded-xl bg-g-blue-700 hover:bg-g-blue-800 font-bold text-[15px] shadow-[0_10px_20px_-8px_rgba(33,7,170,0.45)]';
  const page = 'min-h-[100dvh] flex flex-col bg-[#f6f7fb]';

  if (!contentId || !segmentId) {
    return (
      <div className={page}>
        <HeaderBar title={p.title} />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center max-w-sm bg-white border border-[#e9ebf3] rounded-[20px] p-7">
            <div className="size-16 rounded-[20px] bg-[#f1efff] grid place-items-center mx-auto mb-4">
              <GraduationCap className="w-8 h-8 text-g-blue-700" strokeWidth={1.8} />
            </div>
            <h1 className="text-xl font-bold text-[#101828] mb-1.5">{pp.practiceWhatYouRead}</h1>
            <p className="text-sm text-[#6b7280] mb-5">{pp.readerHint}</p>
            <Button onClick={() => navigate('/app')} className={primaryBtn}>
              <BookOpen className="w-4 h-4 mr-1.5" />
              {pp.goToLibrary}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (contentLoading) {
    return (
      <div className={cn(page, 'items-center justify-center')}>
        <Loader2 className="w-6 h-6 animate-spin text-g-blue-700" />
      </div>
    );
  }

  if (results && session) {
    const pct = Math.round(results.score * 100);
    const correctCount = results.results.filter((r) => r.isCorrect).length;
    const tone = pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#f43f5e';
    const R = 34;
    const C = 2 * Math.PI * R;
    return (
      <div className={page}>
        <HeaderBar title={content?.title ?? p.title} />
        <div className="flex-1 overflow-y-auto px-4 py-6 sm:py-8">
          <div className="max-w-[720px] mx-auto flex flex-col gap-4">
            <div className="bg-white border border-[#e9ebf3] rounded-[20px] p-6 sm:p-7 flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
              <div className="relative size-[88px] shrink-0">
                <svg viewBox="0 0 80 80" className="size-full -rotate-90">
                  <circle cx="40" cy="40" r={R} fill="none" stroke="#eef0f5" strokeWidth="8" />
                  {pct > 0 && (
                    <circle cx="40" cy="40" r={R} fill="none" stroke={tone} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(pct / 100) * C} ${C}`} />
                  )}
                </svg>
                <span className="absolute inset-0 grid place-items-center text-xl font-extrabold text-[#101828] tabular-nums">{pct}%</span>
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-[#101828]">{p.score(correctCount, results.results.length)}</h2>
                <p className="text-sm text-[#6b7280] mt-1">{pct >= 70 ? pp.greatWork : p.subtitle}</p>
              </div>
            </div>

            <div className="bg-white border border-[#e9ebf3] rounded-[20px] overflow-hidden">
              {session.questions.map((q, i) => {
                const r = results.results.find((res) => res.questionId === q.id);
                return (
                  <div key={q.id} className="flex items-start gap-3 px-4 sm:px-5 py-4 border-b border-[#f2f3f7] last:border-b-0">
                    <div
                      className={cn(
                        'size-6 rounded-full grid place-items-center shrink-0 mt-0.5',
                        r?.isCorrect ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600',
                      )}
                    >
                      {r?.isCorrect ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : <X className="w-3.5 h-3.5" strokeWidth={3} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14.5px] font-semibold text-[#101828]">
                        <span className="text-[#9aa0ae] mr-1">{i + 1}.</span>{q.prompt}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {r?.userAnswer ? (
                          <span className={cn('text-[12.5px] font-medium px-2 py-0.5 rounded-md', r.isCorrect ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700 line-through decoration-rose-300')}>
                            {r.userAnswer}
                          </span>
                        ) : null}
                        {!r?.isCorrect && (r?.correctAnswer || q.correctAnswer) && (
                          <span className="text-[12.5px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700">{r?.correctAnswer || q.correctAnswer}</span>
                        )}
                      </div>
                      {(r?.explanation || q.explanation) && (
                        <p className="text-[12.5px] text-[#6b7080] mt-2 leading-relaxed">{r?.explanation || q.explanation}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-2.5">
              <Button variant="outline" onClick={restart} className="sm:flex-1 h-12 rounded-xl gap-1.5 font-semibold border-[#e1e3ec]">
                <RotateCcw className="w-4 h-4" />
                {pp.tryAnother}
              </Button>
              <Button onClick={() => navigate(`/app/read/${contentId}`)} className={cn(primaryBtn, 'sm:flex-1')}>
                <BookOpen className="w-4 h-4 mr-1.5" />
                {pp.backToReading}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (session && currentQuestion) {
    const hasOptions = Boolean(currentQuestion.options?.length);
    const selected = answers[currentQuestion.id];
    const canGo = hasOptions ? Boolean(selected) : freeText.trim().length > 0;
    return (
      <div className={page}>
        <HeaderBar title={content?.title ?? p.title} step={questionIdx + 1} total={session.questions.length} />
        <div className="flex-1 overflow-y-auto px-4 py-6 sm:py-10">
          <div className="max-w-[640px] mx-auto">
            <div className="text-[11px] font-bold tracking-[0.12em] uppercase text-[#8a8fa0] mb-2">{typeLabels[session.practiceType] ?? p.title}</div>
            <p className="text-[19px] sm:text-[22px] font-bold leading-snug tracking-tight text-[#101828] mb-6">{currentQuestion.prompt}</p>

            {hasOptions ? (
              <div className="flex flex-col gap-2.5" role="radiogroup">
                {currentQuestion.options!.map((opt, oi) => {
                  const on = selected === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => selectAnswer(opt)}
                      className={cn(
                        'flex items-center gap-3 text-left px-4 py-3.5 rounded-2xl border-2 bg-white text-[15px] font-medium transition-all',
                        on ? 'border-g-blue-700 bg-[#f4f3ff] text-[#14056b]' : 'border-[#e6e8f0] text-[#344054] hover:border-[#c5cafd]',
                      )}
                    >
                      <span className={cn('size-7 shrink-0 rounded-lg grid place-items-center text-xs font-bold', on ? 'bg-g-blue-700 text-white' : 'bg-[#f1f2f7] text-[#6b7080]')}>
                        {'ABCDEF'[oi] ?? oi + 1}
                      </span>
                      <span className="flex-1 min-w-0">{opt}</span>
                      {on && <Check className="w-4 h-4 text-g-blue-700 shrink-0" strokeWidth={3} />}
                    </button>
                  );
                })}
              </div>
            ) : (
              <input
                type="text"
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); goNext(); }
                }}
                placeholder={pp.typeAnswer}
                className="w-full h-14 px-4 bg-white border-2 border-[#e6e8f0] rounded-2xl text-[16px] text-[#101828] placeholder:text-[#9aa0ae] outline-none focus:border-g-blue-700 focus:ring-4 focus:ring-g-blue-700/10 transition-all"
                autoFocus
              />
            )}
            <div className="hidden sm:block text-[11.5px] text-[#9aa0ae] mt-4">
              {hasOptions ? '1–4 · ' : ''}Enter ↵ · Esc
            </div>
          </div>
        </div>
        <div className="shrink-0 border-t border-[#eef0f5] bg-white px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
          <div className="max-w-[640px] mx-auto">
            <Button onClick={goNext} disabled={submitting || !canGo} className={primaryBtn}>
              {submitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {pp.submitting}
                </span>
              ) : isLastQuestion ? (
                pp.finishQuiz
              ) : (
                pp.nextQuestion
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={page}>
      <HeaderBar title={content?.title ?? p.title} />
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-[448px] bg-white border border-[#e9ebf3] rounded-[20px] p-5 sm:p-7 flex flex-col gap-5 shadow-[0_24px_48px_-24px_rgba(16,24,40,0.18)]">
          <div className="flex items-start gap-3.5">
            <span className="size-12 shrink-0 rounded-2xl bg-[#f1efff] grid place-items-center">
              <GraduationCap className="w-6 h-6 text-g-blue-700" strokeWidth={1.8} />
            </span>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-[#101828]">{pp.quizYourself}</h1>
              <p className="text-sm text-[#6b7280] mt-0.5">{p.subtitle}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2" role="radiogroup">
            {(Object.keys(typeLabels) as PracticeType[]).map((t) => {
              const on = practiceType === t;
              return (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setPracticeType(t)}
                  className={cn(
                    'flex items-center gap-2 text-left px-3.5 py-3 rounded-xl border-2 transition-all',
                    on ? 'border-g-blue-700 bg-[#f4f3ff]' : 'border-[#e6e8f0] hover:border-[#c5cafd]',
                  )}
                >
                  <span className={cn('size-4 shrink-0 rounded-full border-2 grid place-items-center', on ? 'border-g-blue-700' : 'border-[#c9cdd8]')}>
                    {on && <span className="size-2 rounded-full bg-g-blue-700" />}
                  </span>
                  <span className={cn('text-sm font-semibold', on ? 'text-g-blue-700' : 'text-[#101828]')}>{typeLabels[t]}</span>
                </button>
              );
            })}
          </div>

          <Button onClick={startSession} disabled={starting} className={primaryBtn}>
            {starting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                {pp.generatingQuiz}
              </span>
            ) : (
              p.startQuiz
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
