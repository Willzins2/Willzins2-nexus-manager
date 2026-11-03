import type { ReactNode } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { money, moneyCompact } from '../lib/format';
import { useTheme } from '../lib/theme';


/** Paleta categórica em ordem fixa (validada para daltonismo); nunca cíclica. */
export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300'];
/** Cores de eixo/grade conforme o tema (atributos SVG não leem variáveis CSS). */
function useChartColors() {
  const { dark } = useTheme();
  return dark
    ? { grid: '#243049', axis: { fontSize: 12, fill: '#8b97ab' }, cursor: '#6b7891', legend: '#a8b3c5', series: ['#3987e5', '#d95926'] }
    : { grid: '#e8ebf0', axis: { fontSize: 12, fill: '#64748b' }, cursor: '#94a3b8', legend: '#475569', series: SERIES };
}

function TooltipBox({ title, rows }: { title: ReactNode; rows: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-surface px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-slate-900">{title}</p>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2 text-slate-600">
          {r.color && <span className="h-2 w-2 rounded-sm" style={{ background: r.color }} />}
          <span>{r.label}</span>
          <span className="ml-auto pl-3 font-medium text-slate-900 num">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

interface Pt {
  [k: string]: string | number;
}

/** Série temporal única (área) com crosshair + tooltip. */
export function RevenueArea({ data, x, y, xFormat, extra }: { data: Pt[]; x: string; y: string; xFormat: (v: string) => string; extra?: { key: string; label: string; format: (v: number) => string } }) {
  const { grid: GRID, axis: AXIS, cursor, series } = useChartColors();
  const S0 = series[0];
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={S0} stopOpacity={0.22} />
            <stop offset="100%" stopColor={S0} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey={x} tickFormatter={xFormat} tick={AXIS} axisLine={false} tickLine={false} minTickGap={24} />
        <YAxis tickFormatter={(v) => moneyCompact(v)} tick={AXIS} axisLine={false} tickLine={false} width={72} />
        <Tooltip
          cursor={{ stroke: cursor, strokeDasharray: '3 3' }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <TooltipBox
                title={xFormat(String(payload[0].payload[x]))}
                rows={[
                  { label: 'Faturamento', value: money(Number(payload[0].payload[y])), color: S0 },
                  ...(extra ? [{ label: extra.label, value: extra.format(Number(payload[0].payload[extra.key])) }] : []),
                ]}
              />
            ) : null
          }
        />
        <Area type="monotone" dataKey={y} stroke={S0} strokeWidth={2} fill="url(#fillRevenue)" activeDot={{ r: 5, strokeWidth: 2, stroke: 'rgb(var(--surface))' }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Barras agrupadas (até 2 séries) com legenda e tooltip. Um único eixo Y. */
export function GroupedBars({ data, x, series, xFormat }: { data: Pt[]; x: string; series: { key: string; label: string }[]; xFormat: (v: string) => string }) {
  const { grid: GRID, axis: AXIS, legend, series: COLORS } = useChartColors();
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="24%">
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey={x} tickFormatter={xFormat} tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={(v) => moneyCompact(v)} tick={AXIS} axisLine={false} tickLine={false} width={72} />
        <Tooltip
          cursor={{ fill: 'rgba(148,163,184,.12)' }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <TooltipBox
                title={xFormat(String(payload[0].payload[x]))}
                rows={series.map((s, i) => ({ label: s.label, value: money(Number(payload[0].payload[s.key])), color: COLORS[i] }))}
              />
            ) : null
          }
        />
        <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12, color: legend, paddingTop: 8 }} />
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} fill={COLORS[i]} radius={[4, 4, 0, 0]} maxBarSize={28} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Ranking horizontal em HTML (rótulos legíveis no celular), uma série. */
export function BarList({ items, format, empty = 'Sem dados no período' }: { items: { label: string; value: number; sub?: string }[]; format: (v: number) => string; empty?: string }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  if (!items.length) return <p className="py-6 text-center text-sm text-slate-500">{empty}</p>;
  return (
    <ul className="space-y-3">
      {items.map((it) => (
        <li key={it.label} title={`${it.label}: ${format(it.value)}`}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-slate-700">{it.label}</span>
            <span className="shrink-0 font-medium text-slate-900 num">{format(it.value)}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div className="h-2 rounded-full" style={{ width: `${Math.max(2, (it.value / max) * 100)}%`, background: SERIES[0] }} />
          </div>
          {it.sub && <p className="mt-0.5 text-xs text-slate-500">{it.sub}</p>}
        </li>
      ))}
    </ul>
  );
}
