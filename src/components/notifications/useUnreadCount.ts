'use client';
import { useCallback, useEffect, useState } from 'react';
import { notificationsService } from '@/services/notifications.service';

/** `GET /notifications/unread-count` for the bell: on mount, when `refreshKey` changes and every minute. Never throws. */
export function useUnreadCount(enabled: boolean, refreshKey = '') {
  const [count, setCount] = useState(0);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    const load = () =>
      notificationsService.unreadCount().then(
        c => live && setCount(c),
        () => undefined,
      );
    void load();
    const t = setInterval(() => void load(), 60_000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [enabled, refreshKey, tick]);
  const refresh = useCallback(() => setTick(t => t + 1), []);
  return { count: enabled ? count : 0, refresh };
}
