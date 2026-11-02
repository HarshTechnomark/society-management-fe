import { inr } from '@/lib/money';

/** A small line chart in SVG. `values` are plotted evenly; the text version is in the `title`. */
export function LineChart({ labels, values, title }: { labels: string[]; values: number[]; title: string }) {
  const W = 300;
  const H = 110;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const pts = values.map((v, i) => [
    values.length === 1 ? W / 2 : (i / (values.length - 1)) * (W - 16) + 8,
    H - 10 - ((v - min) / span) * (H - 24),
  ]);
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title} className="h-auto w-full">
        <polyline
          fill="none"
          stroke="var(--navy)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          points={pts.map(p => p.join(',')).join(' ')}
        />
        {pts.map((p, i) => (
          <circle key={i} cx={p[0]} cy={p[1]} r="3" fill="var(--gold)" />
        ))}
      </svg>
      <figcaption className="flex justify-between text-[11px] text-muted">
        <span>{labels[0]}</span>
        <span>{labels[labels.length - 1]}</span>
      </figcaption>
    </figure>
  );
}

export function BarChart({ labels, values, title }: { labels: string[]; values: number[]; title: string }) {
  const max = Math.max(...values, 1);
  return (
    <figure>
      <svg viewBox="0 0 300 110" role="img" aria-label={title} className="h-auto w-full">
        {values.map((v, i) => {
          const w = 300 / values.length;
          const h = (v / max) * 90;
          return (
            <rect
              key={i}
              x={i * w + w * 0.15}
              y={100 - h}
              width={w * 0.7}
              height={Math.max(h, 1)}
              rx="4"
              fill="var(--navy)"
            />
          );
        })}
      </svg>
      <figcaption className="flex justify-between text-[11px] text-muted">
        <span>{labels[0]}</span>
        <span>{labels[labels.length - 1]}</span>
      </figcaption>
    </figure>
  );
}

const COLORS = ['#143041', '#b8954a', '#1b7448', '#0b5c7a', '#8f5600'];

export function Donut({ parts, title }: { parts: { label: string; value: number }[]; title: string }) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  let acc = 0;
  const R = 40;
  const C = 2 * Math.PI * R;
  return (
    <div className="flex flex-wrap items-center gap-4">
      <svg viewBox="0 0 100 100" role="img" aria-label={title} className="h-28 w-28 -rotate-90">
        <circle r={R} cx="50" cy="50" fill="none" stroke="rgba(20,35,44,0.1)" strokeWidth="14" />
        {total > 0 &&
          parts.map((p, i) => {
            const len = (p.value / total) * C;
            const el = (
              <circle
                key={p.label}
                r={R}
                cx="50"
                cy="50"
                fill="none"
                stroke={COLORS[i % COLORS.length]}
                strokeWidth="14"
                strokeDasharray={`${len} ${C - len}`}
                strokeDashoffset={-acc}
              />
            );
            acc += len;
            return el;
          })}
      </svg>
      <ul className="text-[13px]">
        {parts.map((p, i) => (
          <li key={p.label} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: COLORS[i % COLORS.length] }}
            />
            {p.label} <b className="tabular-nums">{p.value}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

export { inr };
