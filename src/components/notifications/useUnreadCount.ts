'use client';
import { useCallback, useEffect, useState } from 'react';
import { notificationsService } from '@/services/notifications.service';
import type { InboxScope } from '@/types/notifications';

/** `GET /notifications/unread-count` for the bell: on mount, when `refreshKey` changes and every minute. Never throws. */
export function useUnreadCount(enabled: boolean, scope: InboxScope = 'society', refreshKey = '') {
  const [count, setCount] = useState(0);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    const load = () =>
      notificationsService.unreadCount(scope).then(
        c => live && setCount(c),
        () => undefined,
      );
    void load();
    const t = setInterval(() => void load(), 60_000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [enabled, scope, refreshKey, tick]);
  const refresh = useCallback(() => setTick(t => t + 1), []);
  return { count: enabled ? count : 0, refresh };
}
