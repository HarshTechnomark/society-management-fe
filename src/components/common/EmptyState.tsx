import type { ReactNode } from 'react';

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1 px-4 py-8 text-center">
      <div
        className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(201,169,97,0.28)] text-gold-ink"
        aria-hidden="true"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="4" y="5" width="16" height="14" rx="3" />
          <path d="M4 10h16" />
        </svg>
      </div>
      <h3 className="text-[16px] font-bold">{title}</h3>
      {text && <p className="max-w-sm text-[14px] text-muted">{text}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
