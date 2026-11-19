'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { useLoad } from '@/hooks/useLoad';
import { useMe } from '@/lib/auth';
import { notificationsService } from '@/services/notifications.service';
import type { NotificationApp } from '@/types/notifications';
import { InboxList } from './InboxList';
import { INBOX_PATH, SETTINGS_PATH } from './format';
import { useUnreadCount } from './useUnreadCount';

type Badging = Navigator & {
  setAppBadge?: (n?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

const BELL_CLASS =
  'relative inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/60 hover:bg-white/90';

/**
 * The bell of every app header (spec 11.6, 11.7): unread badge and the installed app icon badge. In the admin app it
 * opens a panel with the latest items and "Mark all read"; in the resident and platform apps it links to the inbox page.
 */
export function NotificationBell({ app, refreshKey = '' }: { app: NotificationApp; refreshKey?: string }) {
  const { me } = useMe();
  const scope = app === 'PLATFORM' ? 'platform' : 'society';
  const enabled = scope === 'platform' || !!me?.activeSocietyId;
  const { count, refresh } = useUnreadCount(enabled, scope, refreshKey);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const nav = navigator as Badging;
    if (count > 0) void nav.setAppBadge?.(count)?.catch?.(() => undefined);
    else void nav.clearAppBadge?.()?.catch?.(() => undefined);
  }, [count]);
  if (!enabled) return null;
  const label = count > 0 ? `Notifications, ${count} unread` : 'Notifications';
  const badge = count > 0 && (
    <span
      data-testid="bell-badge"
      className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-bad px-1 text-center text-[11px] font-bold text-white"
    >
      {count > 99 ? '99+' : count}
    </span>
  );
  const icon = (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 7H4c0-1 2-2 2-7Z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </svg>
  );
  if (app !== 'ADMIN')
    return (
      <Link href={INBOX_PATH[app]} aria-label={label} className={BELL_CLASS}>
        {icon}
        {badge}
      </Link>
    );
  return (
    <>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className={BELL_CLASS}
      >
        {icon}
        {badge}
      </button>
      <Drawer open={open} onClose={() => setOpen(false)} title="Notifications">
        <BellPanel app={app} unread={count} onChanged={refresh} onClose={() => setOpen(false)} />
      </Drawer>
    </>
  );
}

/** Mounted only while the drawer is open, so the list loads when the bell is opened. */
function BellPanel({
  app,
  unread,
  onChanged,
  onClose,
}: {
  app: NotificationApp;
  unread: number;
  onChanged: () => void;
  onClose: () => void;
}) {
  const load = useLoad(() => notificationsService.list({ limit: 15 }), 'bell');
  const [read, setRead] = useState<Set<number>>(new Set());
  const [allRead, setAllRead] = useState(false);
  const stamp = new Date().toISOString();
  const items = (load.data?.items ?? []).map(n =>
    allRead || read.has(n.id) ? { ...n, readAt: n.readAt ?? stamp } : n,
  );
  const markAll = async () => {
    try {
      await notificationsService.markAllRead();
      setAllRead(true);
      onChanged();
    } catch {
      /* the list stays as it was */
    }
  };
  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-2">
        <Button
          size="sm"
          variant="glass"
          disabled={unread === 0 && !items.some(n => !n.readAt)}
          onClick={() => void markAll()}
        >
          Mark all read
        </Button>
        <span className="flex gap-3 text-[13px] font-semibold">
          <Link href={INBOX_PATH[app]} onClick={onClose} className="underline">
            See all
          </Link>
          {SETTINGS_PATH[app] && (
            <Link href={SETTINGS_PATH[app]} onClick={onClose} className="underline">
              Settings
            </Link>
          )}
        </span>
      </div>
      <InboxList
        app={app}
        items={items}
        loading={load.loading}
        error={load.error}
        onRetry={load.reload}
        onRead={id => {
          setRead(s => new Set(s).add(id));
          onChanged();
        }}
        onNavigate={onClose}
      />
    </>
  );
}
