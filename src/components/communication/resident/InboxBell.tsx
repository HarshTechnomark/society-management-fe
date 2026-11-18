'use client';
import Link from 'next/link';
import { useEffect } from 'react';
import { usePolling } from '@/components/platformOps/usePolling';
import { residentNoticesService } from '@/services/residentNotices.service';

type Badging = Navigator & {
  setAppBadge?: (n?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

/** Bell with the unread count; also sets the installed app icon badge (Badging API). Polls every 30 seconds. */
export function InboxBell({ scope = 'society' }: { scope?: 'society' | 'platform' }) {
  const q = usePolling(() => residentNoticesService.unreadCount(true, scope), 30_000, true);
  const count = q.data ?? 0;
  useEffect(() => {
    const nav = navigator as Badging;
    if (count > 0) void nav.setAppBadge?.(count)?.catch?.(() => undefined);
    else void nav.clearAppBadge?.()?.catch?.(() => undefined);
  }, [count]);
  return (
    <Link
      href={scope === 'platform' ? '/platform/notifications' : '/resident/inbox'}
      aria-label={count > 0 ? `Inbox, ${count} unread` : 'Inbox'}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/60 hover:bg-white/80"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <path d="M6 9a6 6 0 1 1 12 0c0 6 2 7 2 7H4s2-1 2-7" />
        <path d="M10 20a2 2 0 0 0 4 0" />
      </svg>
      {count > 0 && (
        <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-bad px-1 text-center text-[11px] font-bold leading-[18px] text-white">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}
