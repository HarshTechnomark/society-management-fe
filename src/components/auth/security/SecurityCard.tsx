import type { ReactNode } from 'react';
import { cx } from '@/components/ui/cx';

export function SecurityCard({
  title,
  children,
  danger,
  id,
}: {
  title: string;
  children: ReactNode;
  danger?: boolean;
  id?: string;
}) {
  return (
    <section
      aria-labelledby={`${id ?? title}-h`}
      className={cx('glass bg-[var(--glass-2)] p-6 max-[700px]:p-4', danger && 'border-[#e5b1ad]')}
    >
      <h2
        id={`${id ?? title}-h`}
        className={cx('mb-3 text-[18px] font-bold tracking-tight', danger && 'text-bad')}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

export function Row({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] py-3 first:border-t-0">
      {children}
    </div>
  );
}
