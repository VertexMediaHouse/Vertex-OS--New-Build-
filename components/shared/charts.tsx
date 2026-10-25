"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Line,
  LineChart as RLineChart,
  Pie,
  PieChart as RPieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import { AXIS } from "@/lib/chart-colors";
import { formatINR, formatINRCompact } from "@/lib/format";

// Mark specs (dataviz skill): bars ≤ 24px with 4px rounded data-ends, 2px lines,
// ≥ 8px markers with a 2px surface ring, hairline solid grid, 2px surface gaps.

export type Series = { key: string; label: string; color: string };
type Formatter = (v: number) => string;
/** Formatters by name, so Server Components can choose one (functions can't cross to the client). */
export type FormatName = "plain" | "inr" | "inrCompact" | "hours" | "percent";
const FORMATS: Record<FormatName, Formatter> = { plain: (v) => String(v), inr: formatINR, inrCompact: formatINRCompact, hours: (v) => `${Math.round(v)}h`, percent: (v) => `${Math.round(v)}%` };
const plain = FORMATS.plain;

/** Legend row above a chart: "● VMH ● VTH —●— Total". */
export function ChartLegend({ items, className }: { items: { label: string; color: string; line?: boolean }[]; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-2xs text-ink-2", className)}>
      {items.map((i) => (
        <li key={i.label} className="inline-flex items-center gap-1.5">
          {i.line ? (
            <span className="relative inline-block h-0.5 w-4 rounded" style={{ background: i.color }} aria-hidden>
              <span className="absolute top-1/2 left-1/2 size-1.5 -translate-1/2 rounded-full" style={{ background: i.color }} />
            </span>
          ) : (
            <span className="size-2.5 rounded-[3px]" style={{ background: i.color }} aria-hidden />
          )}
          {i.label}
        </li>
      ))}
    </ul>
  );
}

type TipEntry = { dataKey?: unknown; name?: unknown; value?: unknown; color?: string; payload?: unknown };
type TipProps = { active?: boolean; payload?: readonly TipEntry[]; label?: unknown; format?: Formatter };

function TooltipBox({ active, payload, label, format = plain }: TipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-2xs shadow-md">
      {label !== undefined && label !== null && <p className="mb-1 font-semibold text-ink">{String(label)}</p>}
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="flex items-center gap-2 text-ink-2">
          <span className="size-2 rounded-full" style={{ background: p.color ?? (p.payload as { color?: string })?.color }} aria-hidden />
          {String(p.name)}
          <span className="ml-auto pl-3 font-semibold text-ink tabular">{format(Number(p.value))}</span>
        </p>
      ))}
    </div>
  );
}

const axisProps = { tickLine: false, axisLine: false, tick: { fill: AXIS.text, fontSize: 10.5 } } as const;

/** Columns per category; stacked or grouped series, optional total line (revenue trend). */
export function BarsChart({
  data,
  xKey,
  series,
  stacked = false,
  line,
  height = 180,
  yFormat: yName = "plain",
  tooltipFormat: tipName,
  barSize,
  topLabels,
  xTickLines,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  series: Series[];
  stacked?: boolean;
  line?: Series;
  height?: number;
  yFormat?: FormatName;
  tooltipFormat?: FormatName;
  barSize?: number;
  /** Show the stack total above each column (Leads by Source). */
  topLabels?: boolean;
  /** Second x-tick line, e.g. "12 Oct" under "Mon". */
  xTickLines?: Record<string, string>;
}) {
  const yFormat = FORMATS[yName];
  const tooltipFormat = tipName ? FORMATS[tipName] : undefined;
  const size = barSize ?? (stacked || series.length === 1 ? 20 : 14);
  const withTotals = topLabels ? data.map((d) => ({ ...d, __total: series.reduce((s, x) => s + Number(d[x.key] ?? 0), 0) })) : data;
  return (
    <div style={{ height }} role="img" aria-label={`Chart: ${series.map((s) => s.label).join(", ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={withTotals} margin={{ top: topLabels ? 18 : 6, right: 4, bottom: 0, left: 0 }} barGap={2} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke={AXIS.grid} />
          <XAxis
            dataKey={xKey}
            {...axisProps}
            interval={0}
            height={xTickLines ? 34 : 22}
            tick={
              xTickLines
                ? ({ x, y, payload }: { x?: number | string; y?: number | string; payload?: { value?: unknown } }) => (
                    <text x={Number(x)} y={Number(y) + 10} textAnchor="middle" fill={AXIS.text} fontSize={10.5}>
                      <tspan x={Number(x)}>{String(payload?.value ?? "")}</tspan>
                      <tspan x={Number(x)} dy={13}>
                        {xTickLines[String(payload?.value ?? "")]}
                      </tspan>
                    </text>
                  )
                : axisProps.tick
            }
          />
          <YAxis {...axisProps} width={44} tickFormatter={yFormat} allowDecimals={false} />
          <Tooltip cursor={{ fill: "rgba(148,163,184,0.08)" }} content={(p) => <TooltipBox active={p.active} payload={p.payload} label={p.label} format={tooltipFormat ?? yFormat} />} />
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              fill={s.color}
              stackId={stacked ? "stack" : undefined}
              barSize={size}
              // rounded data-end only on the top segment of a stack
              radius={!stacked || i === series.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
              stroke={stacked ? "var(--card-bg)" : undefined}
              strokeWidth={stacked ? 1 : 0}
            >
              {topLabels && i === series.length - 1 && <LabelList dataKey="__total" position="top" fill="var(--text-2)" fontSize={11} fontWeight={600} />}
            </Bar>
          ))}
          {line && <Line dataKey={line.key} name={line.label} stroke={line.color} strokeWidth={2} dot={{ r: 3, fill: line.color, stroke: "var(--card-bg)", strokeWidth: 2 }} activeDot={{ r: 4 }} />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Donut with a centre value ("28 Total Projects"). Segments separated by a 2px surface gap. */
export function DonutChart({
  data,
  center,
  centerLabel,
  size = 120,
  thickness = 16,
  format: fName = "plain",
}: {
  data: { label: string; value: number; color: string }[];
  center: React.ReactNode;
  centerLabel?: string;
  size?: number;
  thickness?: number;
  format?: FormatName;
}) {
  const format = FORMATS[fName];
  const shown = data.filter((d) => d.value > 0);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={data.map((d) => `${d.label} ${format(d.value)}`).join(", ")}>
      <ResponsiveContainer width="100%" height="100%">
        <RPieChart>
          <Pie data={shown.length ? shown : [{ label: "None", value: 1, color: "var(--track)" }]} dataKey="value" nameKey="label" innerRadius={size / 2 - thickness} outerRadius={size / 2} startAngle={90} endAngle={-270} stroke="var(--card-bg)" strokeWidth={2} isAnimationActive={false}>
            {(shown.length ? shown : [{ color: "var(--track)" }]).map((d, i) => (
              <Cell key={i} fill={d.color} />
            ))}
          </Pie>
          {shown.length > 0 && <Tooltip content={(p) => <TooltipBox active={p.active} payload={p.payload} label={p.label} format={format} />} />}
        </RPieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-xl leading-6 font-bold text-ink">{center}</span>
        {centerLabel && <span className="text-[10.5px] leading-3 text-ink-2">{centerLabel}</span>}
      </div>
    </div>
  );
}

/** Full pie (Reports "Project Type"). */
export function PieChart({ data, size = 140, format: fName = "plain" }: { data: { label: string; value: number; color: string }[]; size?: number; format?: FormatName }) {
  const format = FORMATS[fName];
  return (
    <div style={{ width: size, height: size }} className="shrink-0" role="img" aria-label={data.map((d) => `${d.label} ${format(d.value)}`).join(", ")}>
      <ResponsiveContainer width="100%" height="100%">
        <RPieChart>
          <Pie data={data.filter((d) => d.value > 0)} dataKey="value" nameKey="label" outerRadius={size / 2} startAngle={90} endAngle={-270} stroke="var(--card-bg)" strokeWidth={2} isAnimationActive={false}>
            {data.filter((d) => d.value > 0).map((d) => (
              <Cell key={d.label} fill={d.color} />
            ))}
          </Pie>
          <Tooltip content={(p) => <TooltipBox active={p.active} payload={p.payload} label={p.label} format={format} />} />
        </RPieChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Lines with end-value chips (Goal Progress Overview). */
export function LinesChart({ data, xKey, series, height = 200, yFormat: yName = "plain", endLabels = true }: { data: Record<string, string | number | null>[]; xKey: string; series: Series[]; height?: number; yFormat?: FormatName; endLabels?: boolean }) {
  const yFormat = FORMATS[yName];
  const last = data.length - 1;
  return (
    <div style={{ height }} role="img" aria-label={`Chart: ${series.map((s) => s.label).join(", ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <RLineChart data={data} margin={{ top: 10, right: endLabels ? 56 : 12, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={AXIS.grid} />
          <XAxis dataKey={xKey} {...axisProps} padding={{ left: 20, right: 20 }} />
          <YAxis {...axisProps} width={40} tickFormatter={yFormat} domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} />
          <Tooltip content={(p) => <TooltipBox active={p.active} payload={p.payload} label={p.label} format={yFormat} />} />
          {series.map((s) => (
            <Line key={s.key} dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} isAnimationActive={false} dot={{ r: 4, fill: s.color, stroke: "var(--card-bg)", strokeWidth: 2 }} activeDot={{ r: 5 }}>
              {endLabels && (
                <LabelList
                  dataKey={s.key}
                  content={({ x, y, value, index }) =>
                    index === last && value != null ? (
                      <g>
                        <rect x={Number(x) + 10} y={Number(y) - 10} width={40} height={20} rx={5} fill={s.color} opacity={0.16} />
                        <text x={Number(x) + 30} y={Number(y) + 4} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--text)">
                          {yFormat(Number(value))}
                        </text>
                      </g>
                    ) : null
                  }
                />
              )}
            </Line>
          ))}
        </RLineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** HTML bar list: label (avatar/logo) + bar + value. Hours by member, top clients. */
export function BarList({ rows, max, color = "var(--brand)", barClass }: { rows: { key: string; label: React.ReactNode; value: number; display: string }[]; max?: number; color?: string; barClass?: string }) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.key} className="grid grid-cols-[minmax(0,140px)_minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0 truncate text-xs text-ink">{r.label}</div>
          <div className="h-2 overflow-hidden rounded-full bg-track">
            <div className={cn("h-full rounded-full", barClass)} style={{ width: `${(r.value / top) * 100}%`, background: barClass ? undefined : color }} />
          </div>
          <span className="w-16 text-right text-xs font-medium text-ink tabular">{r.display}</span>
        </li>
      ))}
    </ul>
  );
}

/** Legend list with counts/percents beside a donut. */
export function DonutLegend({ items, className }: { items: { label: string; color: string; value: React.ReactNode; extra?: React.ReactNode }[]; className?: string }) {
  return (
    <ul className={cn("min-w-0 flex-1 space-y-1.5", className)}>
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-2 text-2xs text-ink-2">
          <span className="size-2 shrink-0 rounded-full" style={{ background: i.color }} aria-hidden />
          <span className="min-w-0 flex-1 truncate">{i.label}</span>
          <span className="font-semibold text-ink tabular">{i.value}</span>
          {i.extra !== undefined && <span className="w-9 text-right text-ink-muted tabular">{i.extra}</span>}
        </li>
      ))}
    </ul>
  );
}

export { BarChart };
