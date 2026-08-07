import { cn } from './ui/utils';

const CHART_HEIGHT = 180;
const CHART_WIDTH = 560;
const PAD_LEFT = 28;
const PAD_RIGHT = 8;
const PAD_TOP = 10;
const PAD_BOTTOM = 20;

function niceMax(max: number) {
  if (max <= 0) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  const normalized = max / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 4 ? 4 : normalized <= 8 ? 8 : 10;
  return step * magnitude;
}

function formatShortDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface SeriesPoint {
  label: string;
  value: number;
}

function useAxis(data: SeriesPoint[]) {
  const max = niceMax(Math.max(...data.map((d) => d.value), 1));
  const innerW = CHART_WIDTH - PAD_LEFT - PAD_RIGHT;
  const innerH = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;
  const x = (i: number) => PAD_LEFT + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v: number) => PAD_TOP + innerH - (v / max) * innerH;
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));
  const labelStep = Math.max(1, Math.ceil(data.length / 5));
  return { max, innerW, innerH, x, y, gridLines, labelStep };
}

function ChartFrame({
  data,
  children,
}: {
  data: SeriesPoint[];
  children: (axis: ReturnType<typeof useAxis>) => React.ReactNode;
}) {
  const axis = useAxis(data);
  return (
    <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="w-full h-[180px]" preserveAspectRatio="none">
      {axis.gridLines.map((g) => (
        <g key={g}>
          <line
            x1={PAD_LEFT}
            x2={CHART_WIDTH - PAD_RIGHT}
            y1={axis.y(g)}
            y2={axis.y(g)}
            stroke="#f3f4f6"
            strokeDasharray="3 3"
            strokeWidth={1}
          />
          <text x={0} y={axis.y(g) + 3} fontSize={9} fill="#99a1af">
            {g}
          </text>
        </g>
      ))}
      {children(axis)}
      {data.map((d, i) =>
        i % axis.labelStep === 0 ? (
          <text key={d.label} x={axis.x(i)} y={CHART_HEIGHT - 4} fontSize={9} fill="#99a1af" textAnchor="middle">
            {d.label}
          </text>
        ) : null,
      )}
    </svg>
  );
}

export function AreaLineChart({ data, color = '#7c3aed' }: { data: SeriesPoint[]; color?: string }) {
  return (
    <ChartFrame data={data}>
      {(axis) => {
        const points = data.map((d, i) => `${axis.x(i)},${axis.y(d.value)}`).join(' ');
        const area = `${PAD_LEFT},${axis.y(0)} ${points} ${axis.x(data.length - 1)},${axis.y(0)}`;
        return (
          <>
            <polygon points={area} fill={color} fillOpacity={0.12} />
            <polyline points={points} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          </>
        );
      }}
    </ChartFrame>
  );
}

export function DotLineChart({ data, color = '#00bb7a' }: { data: SeriesPoint[]; color?: string }) {
  return (
    <ChartFrame data={data}>
      {(axis) => (
        <>
          <polyline
            points={data.map((d, i) => `${axis.x(i)},${axis.y(d.value)}`).join(' ')}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {data.map((d, i) => (
            <circle key={d.label} cx={axis.x(i)} cy={axis.y(d.value)} r={3.5} fill={color} />
          ))}
        </>
      )}
    </ChartFrame>
  );
}

export function BarChart({ data, color = '#51a2ff' }: { data: SeriesPoint[]; color?: string }) {
  return (
    <ChartFrame data={data}>
      {(axis) => {
        const barWidth = Math.max(2, (axis.innerW / data.length) * 0.55);
        return (
          <>
            {data.map((d, i) => {
              const barH = axis.y(0) - axis.y(d.value);
              return (
                <rect
                  key={d.label}
                  x={axis.x(i) - barWidth / 2}
                  y={axis.y(d.value)}
                  width={barWidth}
                  height={Math.max(0, barH)}
                  rx={1.5}
                  fill={color}
                />
              );
            })}
          </>
        );
      }}
    </ChartFrame>
  );
}

const HEATMAP_LEVELS = ['bg-[#f3f4f6]', 'bg-[#ede9fe]', 'bg-[#c4b4ff]', 'bg-[#8e51ff]', 'bg-[#7008e7]'];

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
  const weeks: { date: string; count: number }[][] = [];
  for (let i = 0; i < data.length; i += 7) weeks.push(data.slice(i, i + 7));
  const max = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="space-y-2">
      <div className="flex gap-[3px] overflow-x-auto scrollbar-hide">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[3px] shrink-0">
            {week.map((d) => (
              <div
                key={d.date}
                title={`${formatShortDate(d.date)} · ${d.count} session${d.count === 1 ? '' : 's'}`}
                className={cn('w-3 h-3 rounded-[6px]', HEATMAP_LEVELS[heatmapLevel(d.count, max)])}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-end gap-1.5 text-[11px] text-[#99a1af]">
        <span>Less</span>
        {HEATMAP_LEVELS.map((c) => (
          <div key={c} className={cn('w-2.5 h-2.5 rounded-[6px]', c)} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

export { formatShortDate };
export type { SeriesPoint };
