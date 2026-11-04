import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, CheckCircle2, ChevronRight, Clock, Flame, Languages, MousePointerClick, Target } from 'lucide-react';
import { BarChart, formatShortDate } from '../components/charts';
import { CatalogLanguageFlag } from '../components/CatalogLanguageFlag';
import { cn } from '../components/ui/utils';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useLearnerCopy, useLearnerLocale } from '../lib/learnerLocaleContext';
import { buildLanguageProgress } from '../lib/languageProgress';
import type { UserStatsResponse } from '../lib/types';

/** Strings the shared copy does not have yet (uz / ru / en). */
const STATX = {
  en: {
    h: 'h', m: 'min', d: 'd',
    readingIn: (r: string) => `Reading · ${r}`,
    perDay: (n: number) => `~${n} min/day`,
    allTime: (v: string) => `all time ${v}`,
    vocab: 'Vocabulary',
    words: (n: number) => `${n} words`,
    masteredInPeriod: (m: number, p: number) => `<b>${m}</b> mastered · <b>+${p}</b> in period`,
    today: 'Today',
    left: (n: number) => `${n} min left`,
    goalDone: 'Goal reached',
    best: (n: number) => `Longest: ${n} days`,
    activity: 'Activity',
    readTab: 'Reading time', wordsTab: 'Words added',
    total: 'total', avg: 'daily average', activeDays: 'active days',
    streakCard: 'Streak', last5w: 'Last 5 weeks',
    current: 'current', longest: 'longest', activeDay: 'active days',
    less: 'Less', more: 'More reading',
    week: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'],
    byLang: 'By language', byLangSub: 'Level and words to the next level',
    primary: 'Primary',
    toNext: (w: number, t: number, next: string) => `${w} / ${t} words · toward ${next}`,
    top: (w: number) => `${w} words · top level`,
    vocabBooks: 'Vocabulary & books', allTimeSub: 'All time',
    due: 'Due for review',
    inProgress: 'Reading now', finished: 'Finished', lookups: 'Word lookups',
    dueCta: (n: number) => `${n} words are waiting for review`,
    practise: 'Practise',
    noLang: 'Choose a language to learn in Settings.',
  },
  ru: {
    h: 'ч', m: 'мин', d: 'дн',
    readingIn: (r: string) => `Чтение · ${r}`,
    perDay: (n: number) => `~${n} мин/день`,
    allTime: (v: string) => `всего ${v}`,
    vocab: 'Словарь',
    words: (n: number) => `${n} слов`,
    masteredInPeriod: (m: number, p: number) => `<b>${m}</b> выучено · <b>+${p}</b> за период`,
    today: 'Сегодня',
    left: (n: number) => `осталось ${n} мин`,
    goalDone: 'Цель выполнена',
    best: (n: number) => `Рекорд: ${n} дн.`,
    activity: 'Активность',
    readTab: 'Время чтения', wordsTab: 'Новые слова',
    total: 'всего', avg: 'в среднем за день', activeDays: 'активных дней',
    streakCard: 'Серия', last5w: 'Последние 5 недель',
    current: 'текущая', longest: 'рекорд', activeDay: 'активных дней',
    less: 'Меньше', more: 'Больше чтения',
    week: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
    byLang: 'По языкам', byLangSub: 'Уровень и слова до следующего уровня',
    primary: 'Основной',
    toNext: (w: number, t: number, next: string) => `${w} / ${t} слов · к ${next}`,
    top: (w: number) => `${w} слов · высший уровень`,
    vocabBooks: 'Словарь и книги', allTimeSub: 'За всё время',
    due: 'К повторению',
    inProgress: 'Читаю', finished: 'Прочитано', lookups: 'Просмотры слов',
    dueCta: (n: number) => `${n} слов ждут повторения`,
    practise: 'Практика',
    noLang: 'Выберите язык для изучения в настройках.',
  },
  uz: {
    h: 'soat', m: 'daq', d: 'kun',
    readingIn: (r: string) => `Oʻqish · ${r}`,
    perDay: (n: number) => `Kuniga ~${n} daq`,
    allTime: (v: string) => `jami ${v}`,
    vocab: 'Lugʻat',
    words: (n: number) => `${n} soʻz`,
    masteredInPeriod: (m: number, p: number) => `<b>${m}</b> oʻzlashtirilgan · <b>+${p}</b> shu davrda`,
    today: 'Bugun',
    left: (n: number) => `${n} daqiqa qoldi`,
    goalDone: 'Maqsad bajarildi',
    best: (n: number) => `Eng uzun: ${n} kun`,
    activity: 'Faollik',
    readTab: 'Oʻqish vaqti', wordsTab: 'Qoʻshilgan soʻzlar',
    total: 'jami', avg: 'kunlik oʻrtacha', activeDays: 'faol kunlar',
    streakCard: 'Seriya', last5w: 'Oxirgi 5 hafta',
    current: 'joriy', longest: 'eng uzun', activeDay: 'faol kun',
    less: 'Kam', more: 'Koʻp oʻqilgan',
    week: ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'],
    byLang: 'Tillar boʻyicha', byLangSub: 'Daraja va keyingi darajagacha soʻzlar',
    primary: 'Asosiy',
    toNext: (w: number, t: number, next: string) => `${w} / ${t} soʻz · ${next} sari`,
    top: (w: number) => `${w} soʻz · eng yuqori daraja`,
    vocabBooks: 'Lugʻat va kitoblar', allTimeSub: 'Hammasi',
    due: 'Takrorlash kerak',
    inProgress: 'Oʻqilmoqda', finished: 'Tugatilgan', lookups: 'Soʻz izohlari',
    dueCta: (n: number) => `${n} ta soʻz takrorlashni kutmoqda`,
    practise: 'Mashq qilish',
    noLang: 'Sozlamalarda oʻrganiladigan tilni tanlang.',
  },
};

function localIsoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function capped(value: number) {
  return value > 999 ? '999+' : String(value);
}

/** Small bold fragments inside STATX sub lines — copy is ours, no user input. */
function Rich({ html }: { html: string }) {
  const parts = html.split(/<b>|<\/b>/);
  return <>{parts.map((p, i) => (i % 2 ? <b key={i} className="text-[#101828] font-semibold">{p}</b> : <span key={i}>{p}</span>))}</>;
}

const TONES = {
  o: 'bg-[#fff7ed] text-[#c2410c]',
  b: 'bg-g-blue-50 text-g-blue-700',
  t: 'bg-[#ecfeff] text-[#0e7490]',
  g: 'bg-[#ecfdf5] text-[#047857]',
  v: 'bg-[#f5f3ff] text-[#6d28d9]',
} as const;

function Kpi({
  icon: Icon,
  tone,
  label,
  value,
  sub,
  extra,
}: {
  icon: typeof Flame;
  tone: keyof typeof TONES;
  label: string;
  value: string;
  sub: React.ReactNode;
  extra?: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-[#e9ebf3] rounded-2xl p-3 sm:px-4 sm:py-3.5 flex items-center gap-2.5 sm:gap-3 min-w-0">
      <span className={cn('size-8 sm:size-[38px] rounded-[10px] sm:rounded-[11px] grid place-items-center shrink-0', TONES[tone])}>
        <Icon className="size-4 sm:size-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold text-[#6b7080] truncate">{label}</div>
        <div className="text-[17px] sm:text-[21px] font-bold tracking-tight text-[#101828] mt-0.5 whitespace-nowrap truncate">{value}</div>
        <div className="text-xs text-[#8a8fa0] mt-0.5 truncate">{sub}</div>
      </div>
      {extra}
    </div>
  );
}

function Ring({ pct }: { pct: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, pct));
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" className="shrink-0 hidden sm:block" aria-hidden>
      <circle cx="32" cy="32" r={r} fill="none" stroke="#eef0ff" strokeWidth="7" />
      {p > 0 && <circle
        cx="32" cy="32" r={r} fill="none" stroke="var(--g-blue-700, #2107aa)" strokeWidth="7" strokeLinecap="round"
        strokeDasharray={`${(c * p).toFixed(1)} ${c.toFixed(1)}`} transform="rotate(-90 32 32)"
      />}
      <text x="32" y="36" textAnchor="middle" fontSize="12" fontWeight="800" fill="#101828">{Math.round(p * 100)}%</text>
    </svg>
  );
}

function Card({ title, sub, action, children, className }: { title: string; sub?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('bg-white border border-[#e9ebf3] rounded-2xl p-3.5 sm:px-[18px] sm:py-4 min-w-0', className)}>
      <div className="flex items-start justify-between gap-2.5 mb-3">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-[#101828]">{title}</h2>
          {sub && <p className="text-xs text-[#8a8fa0] mt-0.5">{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Segmented<T extends string>({ value, options, onChange, small }: { value: T; options: Array<{ id: T; label: string }>; onChange: (v: T) => void; small?: boolean }) {
  return (
    <div className="inline-flex shrink-0 bg-[#f1f2f7] p-1 rounded-[12px]" role="tablist">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={value === o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            'rounded-[9px] font-semibold transition-colors whitespace-nowrap',
            small ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-[13px]',
            value === o.id ? 'bg-white text-[#101828] shadow-sm' : 'text-[#6b7080] hover:text-[#101828]',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function StatsPage() {
  const { user, stats, vocabItems } = useAuth();
  const copy = useLearnerCopy();
  const { locale } = useLearnerLocale();
  const sx = STATX[locale === 'ru' || locale === 'uz' ? locale : 'en'];
  const [apiStats, setApiStats] = useState<UserStatsResponse | null>(null);
  const [range, setRange] = useState<'7d' | '30d'>('30d');
  const [metric, setMetric] = useState<'reading' | 'words'>('reading');

  useEffect(() => {
    api<UserStatsResponse>('/users/me/stats').then(setApiStats).catch(console.error);
  }, []);

  const rangeDays = range === '7d' ? 7 : 30;
  const rangeLabel = range === '7d' ? copy.statsPage.last7Days : copy.statsPage.last30Days;
  const dailyGoalMinutes = stats?.dailyGoalMinutes ?? 15;
  const todayMinutes = apiStats?.todayReadMinutes ?? stats?.todayMinutes ?? 0;
  const totalReadMinutes = apiStats?.totalReadMinutes ?? 0;

  const dailyByDate = useMemo(() => new Map((apiStats?.history?.daily ?? []).map((d) => [d.date, d])), [apiStats]);
  const heatByDate = useMemo(() => new Map((apiStats?.history?.heatmap ?? []).map((d) => [d.date, d])), [apiStats]);

  // Full calendar axis for the chosen range (missing days = 0).
  const dailySlice = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days: { date: string; minutes: number; wordsSaved: number }[] = [];
    for (let i = rangeDays - 1; i >= 0; i -= 1) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = localIsoDate(d);
      days.push(dailyByDate.get(key) ?? { date: key, minutes: 0, wordsSaved: 0 });
    }
    return days;
  }, [dailyByDate, rangeDays]);

  const readingInPeriod = dailySlice.reduce((s, d) => s + d.minutes, 0);
  const wordsInPeriod = dailySlice.reduce((s, d) => s + d.wordsSaved, 0);
  const series = dailySlice.map((d) => ({ label: formatShortDate(d.date), value: metric === 'reading' ? d.minutes : d.wordsSaved }));
  const metricTotal = metric === 'reading' ? readingInPeriod : wordsInPeriod;
  const metricActive = dailySlice.filter((d) => (metric === 'reading' ? d.minutes : d.wordsSaved) > 0).length;
  const metricAvg = Math.round(metricTotal / rangeDays);

  const currentStreak = apiStats?.streakCount ?? stats?.streakCount ?? 0;
  const bestStreak = Math.max(apiStats?.bestStreak ?? 0, currentStreak);

  // 5 Monday-start weeks ending with the current week.
  const calendar = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const mondayOffset = (today.getDay() + 6) % 7;
    const start = new Date(today);
    start.setDate(today.getDate() - mondayOffset - 28);
    const cells: Array<{ date: string; level: 0 | 1 | 2 | 3; future: boolean; today: boolean }> = [];
    let active = 0;
    for (let i = 0; i < 35; i += 1) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = localIsoDate(d);
      const future = d.getTime() > today.getTime();
      const minutes = dailyByDate.get(key)?.minutes ?? 0;
      const words = dailyByDate.get(key)?.wordsSaved ?? 0;
      const books = heatByDate.get(key)?.count ?? 0;
      let level: 0 | 1 | 2 | 3 = 0;
      if (minutes >= 25 || books >= 3) level = 3;
      else if (minutes >= 10 || books === 2) level = 2;
      else if (minutes > 0 || books > 0 || words > 0) level = 1;
      if (!future && level > 0) active += 1;
      cells.push({ date: key, level: future ? 0 : level, future, today: d.getTime() === today.getTime() });
    }
    return { cells, active };
  }, [dailyByDate, heatByDate]);

  const totalVocab = vocabItems.length || apiStats?.vocabularyTotal || 0;
  const mastered = apiStats?.vocabularyMastered ?? vocabItems.filter((v) => v.mastered).length;
  const learning = Math.max(0, totalVocab - mastered);
  const due = apiStats?.vocabularyDue ?? 0;
  const masteredPct = totalVocab ? (mastered / totalVocab) * 100 : 0;

  const languageProgress = useMemo(
    () => buildLanguageProgress(user?.targetLanguages, vocabItems, locale, user?.nativeLanguage),
    [user?.targetLanguages, user?.nativeLanguage, vocabItems, locale],
  );

  const hm = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h} ${sx.h} ${m} ${sx.m}` : `${m} ${sx.m}`;
  };
  const goalLeft = Math.max(0, dailyGoalMinutes - todayMinutes);

  return (
    <div className="max-w-[1180px] mx-auto px-3 sm:px-6 py-5 lg:py-8">
      <div className="flex items-center sm:items-end justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h1 className="text-[22px] sm:text-2xl font-bold tracking-tight text-[#101828]">{copy.stats.title}</h1>
          <p className="hidden sm:block text-sm text-[#6b7080] mt-0.5">{copy.stats.subtitle}</p>
        </div>
        <Segmented
          value={range}
          onChange={setRange}
          options={[{ id: '7d', label: copy.statsPage.last7Days }, { id: '30d', label: copy.statsPage.last30Days }]}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-3.5">
        <Kpi
          icon={Flame}
          tone="o"
          label={copy.statsPage.currentStreak}
          value={`${capped(currentStreak)} ${sx.d}`}
          sub={sx.best(bestStreak)}
        />
        <Kpi
          icon={Clock}
          tone="b"
          label={sx.readingIn(rangeLabel.toLowerCase())}
          value={hm(readingInPeriod)}
          sub={`${sx.perDay(Math.round(readingInPeriod / rangeDays))} · ${sx.allTime(hm(totalReadMinutes))}`}
        />
        <Kpi
          icon={Languages}
          tone="t"
          label={sx.vocab}
          value={sx.words(totalVocab)}
          sub={<Rich html={sx.masteredInPeriod(mastered, wordsInPeriod)} />}
        />
        <Kpi
          icon={Target}
          tone="g"
          label={sx.today}
          value={`${todayMinutes} / ${dailyGoalMinutes} ${sx.m}`}
          sub={goalLeft === 0 ? sx.goalDone : sx.left(goalLeft)}
          extra={<Ring pct={dailyGoalMinutes ? todayMinutes / dailyGoalMinutes : 0} />}
        />
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] gap-3.5 mb-3.5">
        <Card
          title={sx.activity}
          sub={rangeLabel}
          action={
            <Segmented
              small
              value={metric}
              onChange={setMetric}
              options={[{ id: 'reading', label: sx.readTab }, { id: 'words', label: sx.wordsTab }]}
            />
          }
        >
          <div className="flex gap-6 mb-1">
            {[
              { v: metric === 'reading' ? `${metricTotal} ${sx.m}` : sx.words(metricTotal), l: sx.total },
              { v: metric === 'reading' ? `${metricAvg} ${sx.m}` : String(metricAvg), l: sx.avg },
              { v: `${metricActive}`, l: sx.activeDays },
            ].map((s) => (
              <div key={s.l} className="flex flex-col">
                <b className="text-[17px] font-bold text-[#101828]">{s.v}</b>
                <span className="text-[11.5px] text-[#8a8fa0]">{s.l}</span>
              </div>
            ))}
          </div>
          <BarChart
            data={series}
            color={metric === 'reading' ? '#3b2ad6' : '#0e7490'}
            valueSuffix={metric === 'reading' ? copy.commonExt.minutes : ''}
            emptyMessage={copy.statsPage.noDataYet}
          />
        </Card>

        <Card title={sx.streakCard} sub={sx.last5w}>
          <div className="grid grid-cols-3 gap-2 mb-3.5">
            {[
              { v: capped(currentStreak), l: sx.current },
              { v: capped(bestStreak), l: sx.longest },
              { v: String(calendar.active), l: sx.activeDay },
            ].map((s) => (
              <div key={s.l} className="bg-[#f7f8fc] rounded-xl px-2.5 py-2 flex flex-col">
                <b className="text-lg font-bold text-[#101828]">{s.v}</b>
                <span className="text-[11.5px] text-[#8a8fa0]">{s.l}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5 max-w-[260px] sm:max-w-[300px] mx-auto">
            {sx.week.map((d) => (
              <span key={d} className="text-center text-[10.5px] font-semibold text-[#9aa0ae]">{d}</span>
            ))}
            {calendar.cells.map((c) => (
              <span
                key={c.date}
                title={c.future ? undefined : formatShortDate(c.date)}
                className={cn(
                  'aspect-square rounded-[7px]',
                  c.future
                    ? 'bg-[#fafbfd] border border-dashed border-[#eceef5]'
                    : ['bg-[#f1f2f7]', 'bg-[#c5cafd]', 'bg-[#7a7ef5]', 'bg-g-blue-700'][c.level],
                  c.today && 'ring-2 ring-[#f59e0b] ring-offset-2',
                )}
              />
            ))}
          </div>
          <div className="flex items-center justify-end gap-1.5 mt-2.5 text-[11px] text-[#8a8fa0]">
            <span>{sx.less}</span>
            <i className="size-[11px] rounded-[3px] bg-[#c5cafd]" />
            <i className="size-[11px] rounded-[3px] bg-[#7a7ef5]" />
            <i className="size-[11px] rounded-[3px] bg-g-blue-700" />
            <span>{sx.more}</span>
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] gap-3.5">
        <Card title={sx.byLang} sub={sx.byLangSub}>
          {languageProgress.length === 0 ? (
            <p className="text-sm text-[#8a8fa0] py-2">{sx.noLang}</p>
          ) : (
            <ul>
              {languageProgress.map((lang) => (
                <li
                  key={lang.code}
                  className="grid grid-cols-[22px_minmax(0,1fr)_auto] sm:grid-cols-[24px_minmax(0,150px)_130px_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5 py-2.5 border-b last:border-b-0 border-[#f2f3f7]"
                >
                  <CatalogLanguageFlag code={lang.code.toLowerCase()} className="h-[15px] w-[22px] rounded-[3px]" />
                  <span className="flex items-center gap-1.5 min-w-0">
                    <b className="text-sm font-semibold text-[#101828] truncate">{lang.name}</b>
                    {lang.isPrimary && (
                      <span className="shrink-0 text-[10.5px] font-bold text-g-blue-700 bg-g-blue-50 rounded-md px-1.5 py-px">{sx.primary}</span>
                    )}
                  </span>
                  <span className="text-[13px] font-bold text-[#101828] whitespace-nowrap">
                    {lang.cefr} <span className="font-medium text-[#8a8fa0]">{lang.levelWord}</span>
                  </span>
                  <div className="col-span-3 sm:col-span-1 flex flex-col gap-1 min-w-0">
                    <div className="h-1.5 rounded-full bg-g-blue-50 overflow-hidden">
                      <div className="h-full rounded-full bg-g-blue-700" style={{ width: `${Math.round(lang.pct * 100)}%` }} />
                    </div>
                    <span className="text-[11.5px] text-[#8a8fa0] truncate">
                      {lang.next ? sx.toNext(lang.wordCount, lang.target, lang.next) : sx.top(lang.wordCount)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={sx.vocabBooks} sub={sx.allTimeSub}>
          <div className="flex h-2.5 rounded-full overflow-hidden gap-0.5 bg-[#f1f2f7]">
            {mastered > 0 && <i className="block h-full bg-[#10b981]" style={{ width: `${masteredPct}%` }} />}
            {learning > 0 && <i className="block h-full bg-[#6d7cf7] flex-1" />}
          </div>
          <div className="flex flex-col gap-2 mt-3 mb-3.5">
            {[
              { c: 'bg-[#10b981]', l: copy.vocabulary.mastered, v: mastered },
              { c: 'bg-[#6d7cf7]', l: copy.vocabulary.learning, v: learning },
              { c: 'bg-[#f59e0b]', l: sx.due, v: due },
            ].map((r) => (
              <div key={r.l} className="flex items-center gap-2 text-[13px] text-[#4a5565]">
                <i className={cn('size-[9px] rounded-[3px]', r.c)} />
                {r.l}
                <b className="ml-auto text-[#101828] font-bold tabular-nums">{r.v}</b>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 border-t border-[#f2f3f7] pt-3.5">
            {[
              { icon: BookOpen, tone: 'b' as const, v: apiStats?.contentInProgress ?? 0, l: sx.inProgress },
              { icon: CheckCircle2, tone: 'g' as const, v: apiStats?.contentCompleted ?? 0, l: sx.finished },
              { icon: MousePointerClick, tone: 'v' as const, v: apiStats?.wordsTapped ?? 0, l: sx.lookups },
            ].map((m) => (
              <div key={m.l} className="flex items-center gap-2 min-w-0">
                <span className={cn('size-8 rounded-[9px] grid place-items-center shrink-0', TONES[m.tone])}>
                  <m.icon className="size-[15px]" />
                </span>
                <div className="min-w-0">
                  <b className="block text-[15px] font-bold text-[#101828]">{m.v}</b>
                  <span className="block text-[11px] text-[#8a8fa0] truncate">{m.l}</span>
                </div>
              </div>
            ))}
          </div>
          {due > 0 && (
            <div className="flex items-center justify-between gap-2 mt-3.5 bg-[#fffbeb] border border-[#fde68a] rounded-xl px-3 py-2.5">
              <span className="text-[12.5px] font-semibold text-[#92400e]">{sx.dueCta(due)}</span>
              <Link
                to="/app/practice"
                className="shrink-0 inline-flex items-center gap-1 h-[34px] px-3 rounded-[10px] bg-g-blue-700 text-white text-[13px] font-semibold hover:opacity-95"
              >
                {sx.practise}
                <ChevronRight className="size-3.5" />
              </Link>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
