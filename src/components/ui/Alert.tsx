import type { ReactNode } from 'react';
import { cx } from './cx';

type AlertTone = 'ok' | 'warn' | 'bad' | 'info';
const TONE: Record<AlertTone, string> = {
  ok: 'bg-[#dcefe5] text-[#14583a]',
  warn: 'bg-[#f6e6c9] text-[#6f4200]',
  bad: 'bg-[#f6dcda] text-[#8a1d17]',
  info: 'bg-[#d8ebf3] text-[#0a4a63]',
};

/** `bad` alerts are announced assertively; the others politely. */
export function Alert({
  tone = 'info',
  children,
  className,
}: {
  tone?: AlertTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === 'bad' ? 'alert' : 'status'}
      aria-live={tone === 'bad' ? 'assertive' : 'polite'}
      className={cx(
        'mb-4 flex items-start gap-2.5 rounded-[14px] px-3.5 py-2.5 text-[13.5px] font-medium',
        TONE[tone],
        className,
      )}
    >
      <span>{children}</span>
    </div>
  );
}
