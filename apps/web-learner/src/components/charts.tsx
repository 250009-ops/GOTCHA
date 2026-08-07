import { useId, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { cn } from './ui/utils';

export interface SeriesPoint {
  label: string;
  value: number;
}

const CHART_HEIGHT = 200;
const AXIS_TICK = { fill: '#99a1af', fontSize: 11, fontWeight: 500 } as const;
const GRID_STROKE = '#f3f4f6';
const AXIS_STROKE = '#e5e7eb';

function formatShortDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function niceMax(max: number) {
  if (max <= 0) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  const normalized = max / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 4 ? 4 : normalized <= 8 ? 8 : 10;
  return step * magnitude;
}

function chartDomain(data: SeriesPoint[]): [number, number] {
  const max = Math.max(...data.map((d) => d.value), 0);
  return [0, niceMax(max)];
}

function chartTicks(domain: [number, number]) {
  const max = domain[1];
  if (max <= 4) return [0, 1, 2, 3, 4].filter((t) => t <= max);
  const step = max / 4;
  return [0, 1, 2, 3, 4].map((i) => Math.round(step * i));
}

function tipDateLabel(label: string) {
  return label;
}

function ChartTooltipShell({
  active,
  payload,
  label,
  valueSuffix,
  valueLabel,
}: {
  active?: boolean;
  payload?: Array<{ value?: number | string }>;
  label?: string;
  valueSuffix?: string;
  valueLabel?: string;
}) {
  if (!active || !payload?.length) return null;
  const raw = payload[0]?.value;
  const value = typeof raw === 'number' ? raw : Number(raw ?? 0);
  return (
    <div className="rounded-xl border border-[#e5e7eb] bg-white px-3 py-2 shadow-lg shadow-violet-500/10">
      <div className="text-[11px] font-medium text-[#99a1af]">{tipDateLabel(String(label ?? ''))}</div>
      <div className="mt-0.5 text-sm font-semibold text-gray-900">
        {Number.isFinite(value) ? value.toLocaleString('en-US') : '—'}
        {valueSuffix ? ` ${valueSuffix}` : ''}
        {valueLabel ? (
          <span className="ml-1 text-xs font-medium text-[#99a1af]">{valueLabel}</span>
        ) : null}
      </div>
    </div>
  );
}

function EmptyAxesHint({ message }: { message: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <p className="rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-[#99a1af] ring-1 ring-[#f3f4f6]">
        {message}
      </p>
    </div>
  );
}

function ChartShell({
  children,
  empty,
}: {
  children: React.ReactNode;
  empty?: string;
}) {
  return (
    <div className="relative w-full" style={{ height: CHART_HEIGHT }}>
      {children}
      {empty ? <EmptyAxesHint message={empty} /> : null}
    </div>
  );
}

export function AreaLineChart({
  data,
  color = '#8e51ff',
  valueSuffix = 'min',
  valueLabel = '',
  emptyMessage = 'No activity in this range',
}: {
  data: SeriesPoint[];
  color?: string;
  valueSuffix?: string;
  valueLabel?: string;
  emptyMessage?: string;
}) {
  const gradId = useId().replace(/:/g, '');
  const domain = chartDomain(data);
  const isEmpty = !data.length || data.every((d) => d.value === 0);

  return (
    <ChartShell empty={isEmpty ? emptyMessage : undefined}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 12, left: 4, bottom: 4 }}>
          <defs>
            <linearGradient id={`learner-area-${gradId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="55%" stopColor={color} stopOpacity={0.12} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 6" vertical={false} />
          <XAxis
            dataKey="label"
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={{ stroke: AXIS_STROKE }}
            minTickGap={28}
            dy={6}
          />
          <YAxis
            domain={domain}
            ticks={chartTicks(domain)}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            width={32}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ stroke: color, strokeWidth: 1, strokeDasharray: '4 4', strokeOpacity: 0.45 }}
            content={<ChartTooltipShell valueSuffix={valueSuffix} valueLabel={valueLabel} />}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2.5}
            fill={`url(#learner-area-${gradId})`}
            activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2, fill: color }}
            animationDuration={450}
            isAnimationActive
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

export function DotLineChart({
  data,
  color = '#00966b',
  valueSuffix = 'words',
  valueLabel = '',
  emptyMessage = 'No word saves yet',
}: {
  data: SeriesPoint[];
  color?: string;
  valueSuffix?: string;
  valueLabel?: string;
  emptyMessage?: string;
}) {
  const domain = chartDomain(data);
  const isEmpty = !data.length || data.every((d) => d.value === 0);

  return (
    <ChartShell empty={isEmpty ? emptyMessage : undefined}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 12, left: 4, bottom: 4 }}>
          <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 6" vertical={false} />
          <XAxis
            dataKey="label"
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={{ stroke: AXIS_STROKE }}
            minTickGap={28}
            dy={6}
          />
          <YAxis
            domain={domain}
            ticks={chartTicks(domain)}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            width={32}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ stroke: color, strokeWidth: 1, strokeDasharray: '4 4', strokeOpacity: 0.45 }}
            content={<ChartTooltipShell valueSuffix={valueSuffix} valueLabel={valueLabel} />}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2.5}
            dot={{ r: 3.5, fill: color, stroke: '#fff', strokeWidth: 2 }}
            activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2, fill: color }}
            animationDuration={450}
            isAnimationActive
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

export function BarChart({
  data,
  color = '#51a2ff',
  valueSuffix = 'words',
  valueLabel = '',
  emptyMessage = 'No words saved in this range',
}: {
  data: SeriesPoint[];
  color?: string;
  valueSuffix?: string;
  valueLabel?: string;
  emptyMessage?: string;
}) {
  const domain = chartDomain(data);
  const isEmpty = !data.length || data.every((d) => d.value === 0);
  const radius: [number, number, number, number] = [6, 6, 2, 2];

  return (
    <ChartShell empty={isEmpty ? emptyMessage : undefined}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart data={data} margin={{ top: 12, right: 12, left: 4, bottom: 4 }} barCategoryGap="28%">
          <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 6" vertical={false} />
          <XAxis
            dataKey="label"
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={{ stroke: AXIS_STROKE }}
            minTickGap={28}
            dy={6}
          />
          <YAxis
            domain={domain}
            ticks={chartTicks(domain)}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            width={32}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: `${color}14` }}
            content={<ChartTooltipShell valueSuffix={valueSuffix} valueLabel={valueLabel} />}
          />
          <Bar
            dataKey="value"
            fill={color}
            radius={radius}
            maxBarSize={28}
            animationDuration={450}
            isAnimationActive
          />
        </RechartsBarChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

const HEATMAP_LEVELS = [
  'bg-[#f3f4f6] ring-1 ring-inset ring-gray-200',
  'bg-[#ede9fe]',
  'bg-[#c4b4ff]',
  'bg-[#8e51ff]',
  'bg-[#7008e7]',
];

function heatmapLevel(count: number, max: number) {
  if (count <= 0) return 0;
  if (max <= 0) return 1;
  const pct = count / max;
  if (pct > 0.75) return 4;
  if (pct > 0.5) return 3;
  if (pct > 0.25) return 2;
  return 1;
}

export function HeatmapCalendar({ data }: { data: { date: string; count: number }[] }) {
  const [hover, setHover] = useState<{ date: string; count: number; x: number; y: number } | null>(null);

  const { weeks, max, monthLabels } = useMemo(() => {
    const weeks: { date: string; count: number }[][] = [];
    for (let i = 0; i < data.length; i += 7) weeks.push(data.slice(i, i + 7));
    const max = Math.max(...data.map((d) => d.count), 0);
    const monthLabels: { week: number; label: string }[] = [];
    let lastMonth = -1;
    weeks.forEach((week, wi) => {
      const first = week[0];
      if (!first) return;
      const month = new Date(`${first.date}T00:00:00`).getMonth();
      if (month !== lastMonth) {
        monthLabels.push({
          week: wi,
          label: new Date(`${first.date}T00:00:00`).toLocaleDateString('en-US', { month: 'short' }),
        });
        lastMonth = month;
      }
    });
    return { weeks, max, monthLabels };
  }, [data]);

  if (!data.length) {
    return (
      <div className="flex h-[120px] items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/50 text-xs text-[#99a1af]">
        Activity heatmap will appear as you learn
      </div>
    );
  }

  return (
    <div className="relative space-y-3">
      <div className="overflow-x-auto scrollbar-hide pb-1">
        <div className="inline-flex min-w-full flex-col gap-1">
          <div className="relative mb-1 h-3">
            {monthLabels.map((m) => (
              <span
                key={`${m.label}-${m.week}`}
                className="absolute text-[10px] font-medium text-[#99a1af]"
                style={{ left: m.week * 15 }}
              >
                {m.label}
              </span>
            ))}
          </div>
          <div className="flex gap-[3px]">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[3px] shrink-0">
                {week.map((d) => {
                  const level = heatmapLevel(d.count, max || 1);
                  return (
                    <button
                      key={d.date}
                      type="button"
                      aria-label={`${formatShortDate(d.date)}: ${d.count} session${d.count === 1 ? '' : 's'}`}
                      className={cn(
                        'h-3 w-3 rounded-[5px] transition-transform duration-150 hover:scale-125 hover:ring-2 hover:ring-[#8e51ff]/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8e51ff]',
                        HEATMAP_LEVELS[level],
                      )}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const parent = e.currentTarget.closest('.relative')?.getBoundingClientRect();
                        setHover({
                          date: d.date,
                          count: d.count,
                          x: rect.left - (parent?.left ?? 0) + rect.width / 2,
                          y: rect.top - (parent?.top ?? 0),
                        });
                      }}
                      onMouseLeave={() => setHover(null)}
                      onFocus={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const parent = e.currentTarget.closest('.relative')?.getBoundingClientRect();
                        setHover({
                          date: d.date,
                          count: d.count,
                          x: rect.left - (parent?.left ?? 0) + rect.width / 2,
                          y: rect.top - (parent?.top ?? 0),
                        });
                      }}
                      onBlur={() => setHover(null)}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {hover ? (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-xl border border-[#e5e7eb] bg-white px-2.5 py-1.5 shadow-lg shadow-violet-500/10"
          style={{ left: hover.x, top: Math.max(hover.y - 8, 8) }}
        >
          <div className="text-[11px] font-medium text-[#99a1af]">{formatShortDate(hover.date)}</div>
          <div className="text-xs font-semibold text-gray-900">
            {hover.count} session{hover.count === 1 ? '' : 's'}
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-1.5 text-[11px] text-[#99a1af]">
        <span>Less</span>
        {HEATMAP_LEVELS.map((c) => (
          <div key={c} className={cn('h-2.5 w-2.5 rounded-[5px]', c)} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

export { formatShortDate };
