import type { ReactNode } from 'react';
import { cx } from './cx';

export type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'neutral' | 'gold';
const TONE: Record<Tone, string> = {
  ok: 'bg-[#dcefe5] text-[#14583a]',
  warn: 'bg-[#f6e6c9] text-[#6f4200]',
  bad: 'bg-[#f6dcda] text-[#8a1d17]',
  info: 'bg-[#d8ebf3] text-[#0a4a63]',
  neutral: 'bg-[rgba(20,35,44,0.08)] text-ink',
  gold: 'bg-[rgba(201,169,97,0.3)] text-gold-ink',
};

export function Chip({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-semibold',
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
