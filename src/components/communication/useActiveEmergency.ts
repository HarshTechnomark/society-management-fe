'use client';
import { useEffect } from 'react';
import { usePolling } from '@/components/platformOps/usePolling';
import { communicationEmergencyService } from '@/services/communicationEmergency.service';

/**
 * Active emergencies for the caller (spec 8.30). The apps call it on start and on socket reconnect; there is
 * no socket client in this app yet, so it polls every 20 seconds and again when the tab becomes visible.
 */
export function useActiveEmergency(audience: 'me' | 'gate', enabled = true) {
  const q = usePolling(
    () => (enabled ? communicationEmergencyService.active(audience) : Promise.resolve([])),
    20_000,
    enabled,
  );
  const { reload } = q;
  useEffect(() => {
    if (!enabled) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') void reload();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [enabled, reload]);
  return { list: q.data ?? [], reload, loading: q.loading };
}
