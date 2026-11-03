import { useEffect, useMemo, useState } from 'react';
import { BarChart3, TrendingUp } from 'lucide-react';
import { EmptyState } from '../components/EmptyState';
import { AreaLineChart, BarChart, DotLineChart, formatShortDate, HeatmapCalendar } from '../components/charts';
import { cn } from '../components/ui/utils';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useLearnerCopy, useLearnerLocale } from '../lib/learnerLocaleContext';
import { buildLanguageProgress } from '../lib/languageProgress';
import type { UserStatsResponse } from '../lib/types';
import { BrandMark } from '../components/GotchaLogo';

function localIsoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function GLogo({ size = 40 }: { size?: number }) {
  return <BrandMark size={size} />;
}

function KpiCard({
  value,
  label,
  sub,
  color,
}: {
  value: string;
  label: string;
  sub?: string;
  color: string;
}) {
  return (
    <div className={cn('rounded-2xl border p-4 flex items-center gap-3', color)}>
      <GLogo size={40} />
      <div>
        <div className="font-bold text-xl leading-none">{value}</div>
        <div className="text-xs mt-1 opacity-70">{label}</div>
        {sub && <div className="text-xs mt-0.5 opacity-50">{sub}</div>}
      </div>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#f3f4f6] p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-bold text-gray-900 text-lg">{title}</h3>
          <p className="text-[#99a1af] text-xs mt-0.5">{subtitle}</p>
        </div>
        {icon}
      </div>
      {children}
    </div>
  );
}

function formatStreakCount(value: number) {
  return value > 999 ? '999+' : String(value);
}

export default function StatsPage() {
  const { user, stats, vocabItems } = useAuth();
  const copy = useLearnerCopy();
  const { locale } = useLearnerLocale();
  const [apiStats, setApiStats] = useState<UserStatsResponse | null>(null);
  const [range, setRange] = useState<'7d' | '30d'>('30d');

  useEffect(() => {
    api<UserStatsResponse>('/users/me/stats').then(setApiStats).catch(console.error);
  }, []);

  const masteredCount = vocabItems.filter((v) => v.mastered).length;
  const dailyGoalMinutes = stats?.dailyGoalMinutes ?? 15;
  const todayMinutes = apiStats?.todayReadMinutes ?? stats?.todayMinutes ?? 0;
  const streakGoalSub =
    todayMinutes >= dailyGoalMinutes
      ? copy.stats.goalProgress(100)
      : `${Math.max(0, dailyGoalMinutes - todayMinutes)} ${copy.commonExt.minutes} · ${copy.stats.dailyGoal}`;
  const totalReadMinutes = apiStats?.totalReadMinutes ?? 0;
  const rangeDays = range === '7d' ? 7 : 30;
  const avgMinPerDay = Math.round(totalReadMinutes / rangeDays);
  const hasActivity = totalReadMinutes > 0 || (apiStats?.wordsSaved ?? 0) > 0 || vocabItems.length > 0;

  const dailySlice = useMemo(() => {
    const daily = apiStats?.history?.daily ?? [];
    const sliced = daily.slice(-rangeDays);
    if (sliced.length >= rangeDays) return sliced;

    // Pad sparse/missing history so charts keep a full 7d/30d axis.
    const byDate = new Map(sliced.map((d) => [d.date, d]));
    const days: { date: string; minutes: number; wordsSaved: number }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = rangeDays - 1; i >= 0; i -= 1) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = localIsoDate(d);
      days.push(byDate.get(key) ?? { date: key, minutes: 0, wordsSaved: 0 });
    }
    return days;
  }, [apiStats, rangeDays]);

  const readingSeries = useMemo(
    () => dailySlice.map((d) => ({ label: formatShortDate(d.date), value: d.minutes })),
    [dailySlice],
  );
  const wordsSeries = useMemo(
    () => dailySlice.map((d) => ({ label: formatShortDate(d.date), value: d.wordsSaved })),
    [dailySlice],
  );
  const weeklySeries = useMemo(() => {
    const weekly = apiStats?.history?.weekly ?? [];
    if (weekly.length) {
      return weekly.map((w) => ({ label: formatShortDate(w.weekStart), value: w.wordsSaved }));
    }
    // Fallback empty weeks so the line chart still paints axes.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: 8 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (7 - i) * 7);
      const day = d.getDay();
      d.setDate(d.getDate() - day);
      return { label: formatShortDate(localIsoDate(d)), value: 0 };
    });
  }, [apiStats]);
  const readingInPeriod = dailySlice.reduce((s, d) => s + d.minutes, 0);
  const wordsInPeriod = dailySlice.reduce((s, d) => s + d.wordsSaved, 0);
  const avgReadingInPeriod = rangeDays > 0 ? Math.round(readingInPeriod / rangeDays) : 0;
  const heatmap = apiStats?.history?.heatmap ?? [];
  const currentStreak = apiStats?.streakCount ?? stats?.streakCount ?? 0;
  const bestStreak = apiStats?.bestStreak ?? currentStreak;

  const totalVocab = vocabItems.length || apiStats?.vocabularyTotal || 0;
  const mastered = apiStats?.vocabularyMastered ?? masteredCount;
  const learning = Math.max(0, totalVocab - mastered);
  const masteredPct = totalVocab ? Math.round((mastered / totalVocab) * 100) : 0;
  const learningPct = totalVocab ? 100 - masteredPct : 0;
  const languageProgress = useMemo(
    () => buildLanguageProgress(user?.targetLanguages, vocabItems, locale),
    [user?.targetLanguages, vocabItems, locale],
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 lg:py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{copy.stats.title}</h1>
          <p className="text-[#99a1af] text-sm mt-0.5">{copy.stats.subtitle}</p>
        </div>
        <div className="flex gap-2 bg-[#f3f4f6] p-1 rounded-[14px]">
          {(['7d', '30d'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={cn(
                'px-3 py-1.5 rounded-[10px] text-xs font-semibold transition-all',
                range === r ? 'bg-white text-[#1e2939] shadow-sm' : 'text-[#99a1af] hover:text-gray-600',
              )}
            >
              {r === '7d' ? copy.statsPage.last7Days : copy.statsPage.last30Days}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard value={`${formatStreakCount(currentStreak)} ${copy.commonExt.days}`} label={copy.statsPage.currentStreak} color="text-[#bb4d00] bg-[#fffbeb] border-[#fee685]" />
        <KpiCard
          value={`${Math.floor(totalReadMinutes / 60)} ${copy.commonExt.hours} ${totalReadMinutes % 60} ${copy.commonExt.minutes}`}
          label={copy.statsPage.readingTime}
          sub={hasActivity ? `${copy.statsPage.dailyAverage} ${avgMinPerDay} ${copy.commonExt.minutes}` : undefined}
          color="text-g-blue-700 bg-g-blue-50 border-g-blue-200"
        />
        <KpiCard
          value={`${totalVocab}`}
          label={copy.statsPage.wordsAdded}
          sub={`${mastered} ${copy.vocabulary.mastered.toLowerCase()}`}
          color="text-g-learning-text bg-g-learning-bg border-[#bedbff]"
        />
        <KpiCard
          value={`${todayMinutes} ${copy.commonExt.minutes}`}
          label={copy.stats.todayReading}
          sub={streakGoalSub}
          color="text-[#364153] bg-[#f9fafb] border-[#e5e7eb]"
        />
      </div>

      <div className="bg-white rounded-2xl border border-[#f3f4f6] p-5 space-y-3">
        <h3 className="font-bold text-gray-900 text-lg">{copy.stats.wordsLearned}</h3>
        {languageProgress.length === 0 ? (
          <p className="text-sm text-[#99a1af]">{copy.statsPage.noDataYet}</p>
        ) : (
          languageProgress.map((lang) => (
            <div key={lang.code} className="rounded-2xl border border-[#e5e7eb] p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-9 h-9 rounded-[10px] bg-g-blue-50 text-g-blue-700 text-xs font-extrabold flex items-center justify-center shrink-0">
                    {lang.code}
                  </span>
                  <span className="font-extrabold text-gray-900 truncate">{lang.name}</span>
                </div>
                <span className="text-sm font-extrabold text-gray-900 shrink-0">{lang.level}</span>
              </div>
              <div className="flex items-center justify-between mt-3 text-xs">
                <span className="font-semibold text-[#99a1af]">{lang.towardLabel}</span>
                <span className="font-bold text-g-blue-700">{Math.round(lang.pct * 100)}%</span>
              </div>
              <div className="mt-2 h-2 bg-[#f3f4f6] rounded-[4px] overflow-hidden">
                <div
                  className="h-full bg-g-blue-700 rounded-[4px] transition-all"
                  style={{ width: `${Math.round(lang.pct * 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-2.5 text-xs">
                <span className="text-[#99a1af]">{copy.statsPage.wordsAdded}</span>
                <span className="font-bold text-gray-900">{copy.common.words(lang.wordCount)}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {!hasActivity ? (
        <EmptyState
          icon={BarChart3}
          title={copy.statsPage.noDataYet}
          description={copy.stats.subtitle}
        />
      ) : (
        <>
          <div className="grid lg:grid-cols-2 gap-5">
            <ChartCard title={copy.statsPage.readingTime} subtitle={`${readingInPeriod} ${copy.stats.minutes} · ${copy.statsPage.dailyAverage} ${avgReadingInPeriod} ${copy.stats.minutes}`} icon={<GLogo size={32} />}>
              <AreaLineChart
                data={readingSeries}
                color="var(--g-blue-500)"
                valueSuffix={copy.commonExt.minutes}
                emptyMessage={copy.statsPage.noDataYet}
              />
            </ChartCard>

            <ChartCard title={copy.statsPage.wordsAdded} subtitle={copy.common.words(wordsInPeriod)} icon={<GLogo size={32} />}>
              <BarChart
                data={wordsSeries}
                color="#51a2ff"
                valueSuffix=""
                emptyMessage={copy.statsPage.noDataYet}
              />
            </ChartCard>
          </div>

          <div className="grid lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] gap-5">
            <ChartCard title={copy.statsPage.wordsAdded} subtitle={copy.stats.thisWeek} icon={<TrendingUp className="w-4 h-4 text-[#00966b]" />}>
              <DotLineChart
                data={weeklySeries}
                color="#00966b"
                valueSuffix=""
                emptyMessage={copy.statsPage.noDataYet}
              />
            </ChartCard>

            <div className="bg-white rounded-2xl border border-[#f3f4f6] p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900 text-lg">{copy.stats.streak}</h3>
                <span className="text-[#99a1af] text-xs">{copy.stats.thisWeek}</span>
              </div>
              <HeatmapCalendar
                data={heatmap}
                labels={{
                  noBooksRead: copy.charts.noBooksRead,
                  booksRead: copy.charts.booksRead,
                  booksReadFinished: copy.charts.booksReadFinished,
                }}
              />
              <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-[#f9fafb]">
                <div className="text-center">
                  <div className="font-bold text-lg text-gray-900">{formatStreakCount(currentStreak)}</div>
                  <div className="text-xs text-[#99a1af]">{copy.statsPage.currentStreak}</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-lg text-gray-900">{formatStreakCount(bestStreak)}</div>
                  <div className="text-xs text-[#99a1af]">{copy.stats.streak}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#f3f4f6] p-5">
            <h3 className="font-bold text-gray-900 text-lg mb-4">{copy.statsPage.vocabularyBreakdown}</h3>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { label: copy.statsPage.wordsAdded, value: totalVocab, dot: 'bg-[#e5e7eb]', text: 'text-[#364153]' },
                { label: copy.vocabulary.learning, value: learning, dot: 'bg-[#51a2ff]', text: 'text-g-learning-text' },
                { label: copy.vocabulary.mastered, value: mastered, dot: 'bg-[#00d492]', text: 'text-[#007a55]' },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-3 p-3 bg-[#f9fafb] rounded-[14px]">
                  <div className={cn('w-3 h-3 rounded-[6px] shrink-0', s.dot)} />
                  <div>
                    <div className={cn('font-bold text-lg leading-none', s.text)}>{s.value}</div>
                    <div className="text-xs text-[#99a1af] mt-0.5">{s.label}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <div className="h-2.5 bg-[#f3f4f6] rounded-full overflow-hidden flex">
                <div className="h-full bg-[#00d492] transition-all" style={{ width: `${masteredPct}%` }} />
                <div className="h-full bg-[#51a2ff] transition-all" style={{ width: `${learningPct}%` }} />
              </div>
              <div className="flex justify-between mt-1.5 text-xs text-[#99a1af]">
                <span>{masteredPct}% {copy.vocabulary.mastered.toLowerCase()}</span>
                <span>{learningPct}% {copy.vocabulary.learning.toLowerCase()}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
