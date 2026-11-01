import { useCallback, useEffect, useState } from 'react';
import { societiesService } from '@/services/societies.service';
import type { SocietyStatusInfo } from '@/types/societies';
import { onStatusChanged } from '../events';

/**
 * `GET /society-status` (8.22) for the admin shell: loaded when a society is active, reloaded on a 423, on
 * `society.status_changed` (module 01 realtime, later) and every 5 minutes.
 */
export function useSocietyStatus(enabled: boolean, recover = true) {
  const [status, setStatus] = useState<SocietyStatusInfo | null>(null);
  const [error, setError] = useState<unknown>(null);
  const reload = useCallback(async () => {
    try {
      const s = await societiesService.societyStatus(recover);
      setStatus(s);
      setError(null);
      return s;
    } catch (e) {
      setError(e);
      return null;
    }
  }, [recover]);
  useEffect(() => {
    if (!enabled) return;
    // First load on the next tick, so the effect itself never sets state.
    const first = setTimeout(() => void reload(), 0);
    const off = onStatusChanged(() => void reload());
    const id = setInterval(() => void reload(), 300_000);
    return () => {
      clearTimeout(first);
      off();
      clearInterval(id);
    };
  }, [enabled, reload]);
  return { status, error, reload };
}
