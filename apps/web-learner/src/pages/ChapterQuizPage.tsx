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
      if (/could not build a quiz/i.test(raw)) {
        toast.error(p.quizUnavailable);
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

  const HeaderBar = ({ title }: { title: string }) => (
    <header className="h-12 bg-white border-b border-[#e5e7eb] flex items-center gap-3 px-4 shrink-0">
      <button
        type="button"
        onClick={() => (contentId ? navigate(`/app/read/${contentId}`) : navigate('/app'))}
        className="flex items-center gap-1.5 text-[#6a7282] hover:text-[#1e2939] text-sm font-medium"
      >
        <ArrowLeft className="w-4 h-4" />
        {contentId ? pp.backToReading : copy.nav.library}
      </button>
      <div className="w-px h-4 bg-[#e5e7eb]" />
      <span className="font-semibold text-[#1e2939] text-sm truncate">{title}</span>
    </header>
  );

  if (!contentId || !segmentId) {
    return (
      <div className="min-h-screen flex flex-col bg-g-reader-bg">
        <HeaderBar title={p.title} />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center max-w-sm">
            <div className="w-14 h-14 rounded-2xl bg-g-blue-50 flex items-center justify-center mx-auto mb-4">
              <GraduationCap className="w-7 h-7 text-g-blue-700" />
            </div>
            <h1 className="text-lg font-bold text-[#101828] mb-1.5">{pp.practiceWhatYouRead}</h1>
            <p className="text-sm text-[#6b7280] mb-5">{pp.readerHint}</p>
            <Button onClick={() => navigate('/app')} className="rounded-xl bg-g-blue-700 hover:bg-g-blue-800">
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
      <div className="min-h-screen flex items-center justify-center bg-g-reader-bg">
        <Loader2 className="w-6 h-6 animate-spin text-g-blue-700" />
      </div>
    );
  }

  if (results && session) {
    const pct = Math.round(results.score * 100);
    const correctCount = results.results.filter((r) => r.isCorrect).length;
    return (
      <div className="min-h-screen flex flex-col bg-g-reader-bg">
        <HeaderBar title={content?.title ?? p.title} />
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-2xl mx-auto flex flex-col gap-5">
            <div className="bg-white border border-[#e5e7eb] rounded-2xl p-6 text-center">
              <div
                className={cn(
                  'w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 text-xl font-extrabold',
                  pct >= 70 ? 'bg-emerald-50 text-emerald-600' : pct >= 40 ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600',
                )}
              >
                {pct}%
              </div>
              <h2 className="text-lg font-bold text-[#101828]">
                {p.score(correctCount, results.results.length)}
              </h2>
              <p className="text-sm text-[#6b7280] mt-1">
                {pct >= 70 ? pp.greatWork : p.subtitle}
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {session.questions.map((q, i) => {
                const r = results.results.find((res) => res.questionId === q.id);
                return (
                  <div key={q.id} className="bg-white border border-[#e5e7eb] rounded-2xl p-4">
                    <div className="flex items-start gap-2.5">
                      <div
                        className={cn(
                          'w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5',
                          r?.isCorrect ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600',
                        )}
                      >
                        {r?.isCorrect ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#101828]">
                          {i + 1}. {q.prompt}
                        </p>
                        {r?.userAnswer ? (
                          <p className="text-xs text-[#6b7280] mt-1">
                            <span className="font-medium text-[#374151]">{r.userAnswer}</span>
                          </p>
                        ) : null}
                        {!r?.isCorrect && (
                          <p className="text-xs text-emerald-700 mt-0.5 font-medium">{r?.correctAnswer || q.correctAnswer}</p>
                        )}
                        {(r?.explanation || q.explanation) && (
                          <p className="text-xs text-[#9ca3af] mt-1.5">{r?.explanation || q.explanation}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={restart} className="flex-1 rounded-xl gap-1.5">
                <RotateCcw className="w-4 h-4" />
                {pp.tryAnother}
              </Button>
              <Button
                onClick={() => navigate(`/app/read/${contentId}`)}
                className="flex-1 rounded-xl bg-g-blue-700 hover:bg-g-blue-800"
              >
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
    return (
      <div className="min-h-screen flex flex-col bg-g-reader-bg">
        <HeaderBar title={content?.title ?? p.title} />
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-2xl mx-auto flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-1.5 bg-[#f3f4f6] rounded-full overflow-hidden">
                <div
                  className="h-full bg-g-blue-700 rounded-full transition-all"
                  style={{ width: `${((questionIdx + 1) / session.questions.length) * 100}%` }}
                />
              </div>
              <span className="text-xs font-medium text-[#99a1af] shrink-0 tabular-nums">
                {questionIdx + 1} / {session.questions.length}
              </span>
            </div>

            <div className="bg-white border border-[#e5e7eb] rounded-2xl p-5 sm:p-6">
              <p className="text-base font-semibold text-[#101828] mb-4">{currentQuestion.prompt}</p>

              {hasOptions ? (
                <div className="flex flex-col gap-2.5">
                  {currentQuestion.options!.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => selectAnswer(opt)}
                      className={cn(
                        'text-left px-4 py-3 rounded-[14px] border text-sm font-medium transition-all',
                        selected === opt
                          ? 'border-g-blue-700 bg-g-blue-50 text-g-blue-700'
                          : 'border-[#e5e7eb] text-[#374151] hover:border-gray-300',
                      )}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              ) : (
                <input
                  type="text"
                  value={freeText}
                  onChange={(e) => setFreeText(e.target.value)}
                  placeholder={pp.typeAnswer}
                  className="w-full h-11 px-3.5 bg-[#f9fafb] border border-[#e5e7eb] rounded-[14px] text-sm text-[#101828] placeholder:text-[#9ca3af] outline-none focus:ring-2 focus:ring-g-blue-700/20 focus:border-g-blue-700 focus:bg-white transition-all"
                  autoFocus
                />
              )}
            </div>

            <Button
              onClick={goNext}
              disabled={submitting}
              className="w-full h-11 rounded-[14px] bg-g-blue-700 hover:bg-g-blue-800 font-bold text-sm"
            >
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
    <div className="min-h-screen flex flex-col bg-g-reader-bg">
      <HeaderBar title={content?.title ?? p.title} />
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md bg-white border border-[#e5e7eb] rounded-2xl p-6 flex flex-col gap-5">
          <div>
            <h1 className="text-lg font-bold text-[#101828]">{pp.quizYourself}</h1>
            <p className="text-sm text-[#6b7280] mt-1">{p.subtitle}</p>
          </div>

          <div className="flex flex-col gap-2">
            {(Object.keys(typeLabels) as PracticeType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setPracticeType(t)}
                className={cn(
                  'text-left px-4 py-3 rounded-[14px] border transition-all',
                  practiceType === t
                    ? 'border-g-blue-700 bg-g-blue-50'
                    : 'border-[#e5e7eb] hover:border-gray-300',
                )}
              >
                <div className={cn('text-sm font-semibold', practiceType === t ? 'text-g-blue-700' : 'text-[#101828]')}>
                  {typeLabels[t]}
                </div>
              </button>
            ))}
          </div>

          <Button
            onClick={startSession}
            disabled={starting}
            className="w-full h-11 rounded-[14px] bg-g-blue-700 hover:bg-g-blue-800 font-bold text-sm"
          >
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
