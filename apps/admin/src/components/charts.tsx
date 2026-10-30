/** Interactive Recharts wrappers for the admin console (Figma brand palette). */

import { useId, useMemo, type ReactNode } from 'react';
import {
  Area,
  AreaChart as RechartsAreaChart,
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type Point = { label: string; value: number };
type ValueFormat = 'number' | 'money' | 'uzs' | 'percent';

const BRAND = 'var(--g-blue-700)';
const INK = 'var(--g-admin-sidebar)';
const MUTED = '#94a3b8';
const GRID = '#e2e8f0';
const TRACK = '#f1f5f9';

function formatTipValue(value: number, format: ValueFormat = 'number') {
  if (format === 'money') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: value < 10 ? 2 : 0,
    }).format(value);
  }
  if (format === 'uzs') {
    return `${new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 0 }).format(value)} so'm`;
  }
  if (format === 'percent') return `${value}%`;
  return new Intl.NumberFormat('en-US').format(Math.round(value));
}

function formatAxisValue(value: number, format: ValueFormat = 'number') {
  if (format === 'money') {
    if (Math.abs(value) >= 1000) {
      return `$${new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value)}`;
    }
    return `$${Math.round(value)}`;
  }
  if (format === 'uzs') {
    if (Math.abs(value) >= 1000) {
      return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
    }
    return String(Math.round(value));
  }
  if (format === 'percent') return `${value}%`;
  if (Math.abs(value) >= 1000) {
    return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
  }
  return String(Math.round(value));
}

function ChartFrame({
  height,
  children,
}: {
  height?: number;
  children: ReactNode;
}) {
  return (
    <div
      className={height == null ? 'h-full w-full min-h-[180px]' : undefined}
      style={height != null ? { width: '100%', height } : { width: '100%', height: '100%' }}
    >
      <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
    </div>
  );
}

function EmptyState({ height }: { height?: number }) {
  return (
    <div
      className="grid place-items-center text-sm text-slate-400"
      style={height != null ? { height } : { minHeight: 180 }}
    >
      No data
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
  tipLabel,
  valueFormat,
  valueSuffix,
  nameKey = 'value',
}: {
  active?: boolean;
  payload?: Array<{ value?: number | string; name?: string; payload?: Record<string, unknown> }>;
  label?: string | number;
  tipLabel?: string;
  valueFormat?: ValueFormat;
  valueSuffix?: string;
  nameKey?: string;
}) {
  if (!active || !payload?.length) return null;
  const raw = payload[0]?.value;
  const value = typeof raw === 'number' ? raw : Number(raw ?? 0);
  const pointLabel = String(label ?? payload[0]?.payload?.label ?? '');
  const formatted = formatTipValue(value, valueFormat);
  const text = tipLabel
    ? tipLabel.replace('{value}', formatted).replace('{label}', pointLabel)
    : `${pointLabel}: ${formatted}${valueSuffix ?? ''}`;

  return (
    <div className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-lg">
      {!tipLabel && pointLabel ? (
        <div className="text-[10px] font-medium text-slate-300 mb-0.5">{pointLabel}</div>
      ) : null}
      <div>{tipLabel ? text : `${formatted}${valueSuffix ?? ''}`}</div>
      {nameKey !== 'value' && payload[0]?.name ? (
        <div className="text-[10px] font-medium text-slate-400 mt-0.5">{payload[0].name}</div>
      ) : null}
    </div>
  );
}

const axisTick = { fill: MUTED, fontSize: 11 };
const tooltipCursor = { stroke: GRID, strokeWidth: 1, strokeDasharray: '4 4' };

export function LineChart({
  data,
  height,
  color = BRAND,
  showArea = false,
  tipLabel,
  valueFormat = 'number',
  valueSuffix = '',
}: {
  data: Point[];
  height?: number;
  color?: string;
  showArea?: boolean;
  tipLabel?: string;
  valueFormat?: ValueFormat;
  valueSuffix?: string;
}) {
  const gradId = useId().replace(/:/g, '');
  const series = useMemo(() => data.map((d) => ({ ...d, name: d.label })), [data]);

  if (!data.length) return <EmptyState height={height} />;

  return (
    <ChartFrame height={height}>
      <ComposedChart data={series} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
        <defs>
          <linearGradient id={`lineFill-${gradId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          tick={axisTick}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
          minTickGap={24}
        />
        <YAxis
          tick={axisTick}
          axisLine={false}
          tickLine={false}
          width={52}
          tickFormatter={(v) => formatAxisValue(Number(v), valueFormat === 'money' ? 'number' : valueFormat)}
        />
        <Tooltip
          cursor={tooltipCursor}
          content={
            <ChartTooltip tipLabel={tipLabel} valueFormat={valueFormat} valueSuffix={valueSuffix} />
          }
        />
        {showArea ? (
          <Area
            type="monotone"
            dataKey="value"
            stroke="none"
            fill={`url(#lineFill-${gradId})`}
            isAnimationActive
            animationDuration={600}
          />
        ) : null}
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2, fill: color }}
          isAnimationActive
          animationDuration={600}
        />
      </ComposedChart>
    </ChartFrame>
  );
}

export function BarChart({
  data,
  height = 192,
  color = BRAND,
  fade = true,
  valueFormat = 'number',
}: {
  data: Point[];
  height?: number;
  color?: string;
  fade?: boolean;
  valueFormat?: ValueFormat;
}) {
  const series = useMemo(() => data.map((d) => ({ ...d })), [data]);

  if (!data.length) return <EmptyState height={height} />;

  return (
    <ChartFrame height={height}>
      <RechartsBarChart data={series} margin={{ top: 12, right: 8, left: 0, bottom: 4 }} barCategoryGap="22%">
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
        <YAxis
          tick={axisTick}
          axisLine={false}
          tickLine={false}
          width={52}
          tickFormatter={(v) => formatAxisValue(Number(v), valueFormat)}
        />
        <Tooltip
          cursor={{ fill: 'rgba(33, 7, 170, 0.06)' }}
          content={<ChartTooltip valueFormat={valueFormat} />}
        />
        <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={48} isAnimationActive animationDuration={600}>
          {series.map((_, i) => (
            <Cell
              key={`bar-${i}`}
              fill={color}
              fillOpacity={fade ? 0.45 + (0.55 * (i + 1)) / series.length : 0.92}
            />
          ))}
        </Bar>
      </RechartsBarChart>
    </ChartFrame>
  );
}

export function AreaChart({
  data,
  height = 220,
  color = BRAND,
  valueFormat = 'money',
}: {
  data: Point[];
  height?: number;
  color?: string;
  valueFormat?: ValueFormat;
}) {
  const gradId = useId().replace(/:/g, '');
  const series = useMemo(() => data.map((d) => ({ ...d })), [data]);

  if (!data.length) return <EmptyState height={height} />;

  return (
    <ChartFrame height={height}>
      <RechartsAreaChart data={series} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
        <defs>
          <linearGradient id={`areaFill-${gradId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.32} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} minTickGap={20} />
        <YAxis
          tick={axisTick}
          axisLine={false}
          tickLine={false}
          width={48}
          tickFormatter={(v) => formatAxisValue(Number(v), valueFormat)}
        />
        <Tooltip
          cursor={tooltipCursor}
          content={<ChartTooltip valueFormat={valueFormat} />}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2.5}
          fill={`url(#areaFill-${gradId})`}
          activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2, fill: color }}
          isAnimationActive
          animationDuration={650}
        />
      </RechartsAreaChart>
    </ChartFrame>
  );
}

export function DonutChart({
  segments,
  centerTitle,
  centerSubtitle,
  size = 144,
}: {
  segments: Array<{ name: string; pct: number; color: string }>;
  centerTitle: string;
  centerSubtitle?: string;
  size?: number;
}) {
  const data = useMemo(
    () => segments.map((s) => ({ name: s.name, value: s.pct, color: s.color })),
    [segments],
  );

  if (!data.length) {
    return (
      <div className="grid place-items-center text-sm text-slate-400" style={{ width: size, height: size }}>
        No data
      </div>
    );
  }

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0];
              return (
                <div className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-lg">
                  <div className="text-[10px] font-medium text-slate-300 mb-0.5">{row.name}</div>
                  <div>{row.value}%</div>
                </div>
              );
            }}
          />
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="62%"
            outerRadius="88%"
            paddingAngle={2}
            stroke="#fff"
            strokeWidth={2}
            isAnimationActive
            animationDuration={600}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 grid place-items-center text-center pointer-events-none px-3">
        <div>
          <div className="text-lg font-extrabold text-slate-900 leading-none">{centerTitle}</div>
          {centerSubtitle ? <div className="text-[10px] text-slate-400 mt-1">{centerSubtitle}</div> : null}
        </div>
      </div>
    </div>
  );
}

export function HorizontalBars({
  items,
  height,
}: {
  items: Array<{ name: string; pct: number; color: string }>;
  height?: number;
}) {
  const series = useMemo(
    () => items.map((item) => ({ label: item.name, value: item.pct, color: item.color })),
    [items],
  );
  const chartHeight = height ?? Math.max(160, items.length * 36 + 24);

  if (!items.length) return <EmptyState height={chartHeight} />;

  return (
    <ChartFrame height={chartHeight}>
      <RechartsBarChart
        data={series}
        layout="vertical"
        margin={{ top: 4, right: 28, left: 4, bottom: 4 }}
        barCategoryGap="28%"
      >
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" horizontal={false} />
        <XAxis
          type="number"
          domain={[0, 100]}
          tick={axisTick}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v}%`}
        />
        <YAxis
          type="category"
          dataKey="label"
          width={110}
          tick={{ fill: INK, fontSize: 12, fontWeight: 500 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: 'rgba(33, 7, 170, 0.05)' }}
          content={<ChartTooltip valueFormat="percent" />}
        />
        <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={14} background={{ fill: TRACK }} isAnimationActive>
          {series.map((entry) => (
            <Cell key={entry.label} fill={entry.color || BRAND} />
          ))}
        </Bar>
      </RechartsBarChart>
    </ChartFrame>
  );
}

export function HourlyBars({
  values,
  labels,
  height = 208,
}: {
  values: number[];
  labels: string[];
  height?: number;
}) {
  const series = useMemo(
    () =>
      values.map((value, i) => ({
        label: `${String(i).padStart(2, '0')}:00`,
        tick: labels.includes(`${i}:00`) || labels.includes(String(i)) ? `${i}:00` : '',
        value,
      })),
    [values, labels],
  );

  // Map sparse label markers (0:00, 4:00, …) onto ticks
  const tickSet = useMemo(() => {
    const set = new Set<string>();
    for (const l of labels) {
      const hour = Number.parseInt(l, 10);
      if (!Number.isNaN(hour)) set.add(`${String(hour).padStart(2, '0')}:00`);
    }
    return set;
  }, [labels]);

  if (!values.length) return <EmptyState height={height} />;

  return (
    <ChartFrame height={height}>
      <RechartsBarChart data={series} margin={{ top: 12, right: 8, left: 0, bottom: 4 }} barCategoryGap="12%">
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          tick={axisTick}
          axisLine={false}
          tickLine={false}
          interval={0}
          tickFormatter={(v) => (tickSet.has(String(v)) ? String(v).replace(/^0/, '') : '')}
        />
        <YAxis
          tick={axisTick}
          axisLine={false}
          tickLine={false}
          width={44}
          tickFormatter={(v) => formatAxisValue(Number(v))}
        />
        <Tooltip
          cursor={{ fill: 'rgba(33, 7, 170, 0.06)' }}
          content={<ChartTooltip tipLabel="{label} — {value}" />}
        />
        <Bar dataKey="value" fill={BRAND} radius={[3, 3, 0, 0]} maxBarSize={18} isAnimationActive>
          {series.map((entry) => (
            <Cell
              key={entry.label}
              fill={BRAND}
              fillOpacity={0.5 + (entry.value / Math.max(...values, 1)) * 0.5}
            />
          ))}
        </Bar>
      </RechartsBarChart>
    </ChartFrame>
  );
}
