import { useMemo, useState } from 'react';
import type { Monthly } from '../lib/types';
import { money, monthLabel, compact } from '../lib/format';

const INCOME = '#2a78d6';
const EXPENSE = '#eb6834';

/** Grouped bar chart of monthly income vs expense with hover tooltip. */
export default function MonthlyChart({ data, height = 220 }: { data: Monthly[]; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720, PAD_L = 56, PAD_R = 12, PAD_T = 12, PAD_B = 28;
  const plotW = W - PAD_L - PAD_R, plotH = height - PAD_T - PAD_B;

  const max = useMemo(() => Math.max(1, ...data.flatMap(d => [d.income, d.expense])), [data]);
  const niceMax = useMemo(() => {
    const p = Math.pow(10, Math.floor(Math.log10(max)));
    const f = max / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
  }, [max]);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => t * niceMax);

  if (!data.length) return <div className="py-12 text-center text-sm text-ink-3">No transactions yet</div>;

  const slot = plotW / data.length;
  const barW = Math.min(22, Math.max(6, slot * 0.32));
  const y = (v: number) => PAD_T + plotH - (v / niceMax) * plotH;
  const hv = hover != null ? data[hover] : null;

  return (
    <div className="relative">
      <div className="mb-3 flex items-center gap-4 text-xs text-ink-2">
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: INCOME }} />Income</span>
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: EXPENSE }} />Expense</span>
      </div>
      <svg viewBox={`0 0 ${W} ${height}`} className="w-full" role="img" aria-label="Monthly income and expense"
        onMouseLeave={() => setHover(null)}>
        {ticks.map(t => (
          <g key={t}>
            <line x1={PAD_L} x2={W - PAD_R} y1={y(t)} y2={y(t)} stroke="#e2e8f0" strokeWidth={1} />
            <text x={PAD_L - 8} y={y(t) + 3.5} textAnchor="end" fontSize={10} fill="#94a3b8">{compact(t)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = PAD_L + slot * i + slot / 2;
          const gap = 2;
          const r = 3;
          const bar = (x: number, v: number, fill: string) => {
            const h = Math.max(0, PAD_T + plotH - y(v));
            if (h <= 0) return null;
            const top = y(v);
            return <path d={`M${x},${PAD_T + plotH} V${top + r} a${r},${r} 0 0 1 ${r},-${r} h${barW - 2 * r} a${r},${r} 0 0 1 ${r},${r} V${PAD_T + plotH} Z`} fill={fill} />;
          };
          return (
            <g key={d.month} onMouseEnter={() => setHover(i)}>
              <rect x={PAD_L + slot * i} y={PAD_T} width={slot} height={plotH} fill={hover === i ? '#f1f5f9' : 'transparent'} />
              {bar(cx - barW - gap / 2, d.income, INCOME)}
              {bar(cx + gap / 2, d.expense, EXPENSE)}
              <text x={cx} y={height - 8} textAnchor="middle" fontSize={10} fill="#64748b">{monthLabel(d.month)}</text>
            </g>
          );
        })}
        <line x1={PAD_L} x2={W - PAD_R} y1={PAD_T + plotH} y2={PAD_T + plotH} stroke="#cbd5e1" />
      </svg>
      {hv && hover != null && (
        <div className="pointer-events-none absolute top-8 rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-md"
          style={{ left: `${((PAD_L + slot * hover + slot / 2) / W) * 100}%`, transform: `translateX(${hover > data.length / 2 ? '-110%' : '10%'})` }}>
          <div className="font-medium mb-1">{monthLabel(hv.month)}</div>
          <div className="flex justify-between gap-4"><span className="text-ink-2">Income</span><span>{money(hv.income)}</span></div>
          <div className="flex justify-between gap-4"><span className="text-ink-2">Expense</span><span>{money(hv.expense)}</span></div>
          <div className="flex justify-between gap-4 border-t border-line mt-1 pt-1"><span className="text-ink-2">Net</span><span className="font-medium">{money(hv.my_net ?? hv.net)}</span></div>
        </div>
      )}
    </div>
  );
}
