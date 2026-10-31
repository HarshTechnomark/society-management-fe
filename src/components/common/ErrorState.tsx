import type { ReactNode } from 'react';
import { ApiError } from '@/lib/apiClient';

/** An error block with the support reference (`requestId`) when the API sent one. */
export function ErrorState({
  error,
  title = 'Something went wrong',
  action,
}: {
  error?: unknown;
  title?: string;
  action?: ReactNode;
}) {
  const message =
    error instanceof ApiError ? error.message : error instanceof Error ? error.message : undefined;
  const requestId = error instanceof ApiError ? error.requestId : undefined;
  return (
    <div role="alert" className="flex flex-col items-center gap-1 px-4 py-8 text-center">
      <div
        className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f6dcda] text-bad"
        aria-hidden="true"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v6M12 16.5v.5" strokeLinecap="round" />
        </svg>
      </div>
      <h3 className="text-[16px] font-bold">{title}</h3>
      {message && <p className="max-w-sm text-[14px] text-muted">{message}</p>}
      {requestId && (
        <p className="text-[12px] text-muted">
          Reference: <code>{requestId}</code>
        </p>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
