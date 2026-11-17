import { inr, shortDate } from '@/lib/money';
import type { BalancePoint } from '@/types/accountsBalance';

/** A small line chart of the society total over time: one series, labelled ends, a text summary for screen readers. */
export function BalanceChart({ points }: { points: BalancePoint[] }) {
  if (points.length === 0) return <p className="text-[13.5px] text-muted">No history for this period yet.</p>;
  const W = 320;
  const H = 110;
  const pad = 6;
  const vals = points.map(p => p.totalPaise);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const x = (i: number) =>
    pad + (points.length === 1 ? (W - 2 * pad) / 2 : (i * (W - 2 * pad)) / (points.length - 1));
  const y = (v: number) => H - pad - ((v - min) / span) * (H - 2 * pad);
  const line = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(p.totalPaise).toFixed(1)}`)
    .join(' ');
  const first = points[0];
  const last = points[points.length - 1];
  const label = `Society balance from ${shortDate(first.date)} (${inr(first.totalPaise)}) to ${shortDate(last.date)} (${inr(last.totalPaise)}). Lowest ${inr(min)}, highest ${inr(max)}.`;
  return (
    <figure data-testid="balance-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="h-28 w-full">
        <path
          d={`${line} L${x(points.length - 1)} ${H - pad} L${x(0)} ${H - pad} Z`}
          fill="#c9a961"
          opacity="0.18"
        />
        <path
          d={line}
          fill="none"
          stroke="#8a6d2b"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx={x(points.length - 1)} cy={y(last.totalPaise)} r="3.5" fill="#8a6d2b" />
      </svg>
      <figcaption className="flex justify-between text-[12.5px] text-muted">
        <span>
          {shortDate(first.date)} · {inr(first.totalPaise)}
        </span>
        <span>
          {shortDate(last.date)} · {inr(last.totalPaise)}
        </span>
      </figcaption>
    </figure>
  );
}
