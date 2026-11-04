'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/lib/apiClient';
import { billingRunsService } from '@/services/billingRuns.service';
import type { Run } from '@/types/billingRuns';
import { BUSY } from './format';

/** How often a run that is computing or issuing is read again. Tests set it low. */
export const runPolling = { intervalMs: 3000 };

/**
 * Loads one run and, while it is computing, queued or issuing, reads it again every few seconds (the realtime event
 * `billing.run.updated` of the spec is not needed for this). Background reads do not bump the idle timer. A failed
 * background read keeps what is on screen, unless the run is gone.
 */
export function useRunData(id: number | null) {
  const [run, setRun] = useState<Run | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(id !== null);
  const live = useRef(true);

  const load = useCallback(
    async (poll = false) => {
      if (id === null) return null;
      try {
        const r = await billingRunsService.run(id, poll);
        if (!live.current) return null;
        setRun(r);
        setError(null);
        return r;
      } catch (e) {
        if (!live.current) return null;
        if (!poll || (e instanceof ApiError && e.status !== 0 && e.status < 500)) setError(e);
        return null;
      } finally {
        if (live.current) setLoading(false);
      }
    },
    [id],
  );

  useEffect(() => {
    live.current = true;
    if (id !== null)
      billingRunsService.run(id).then(
        r => {
          if (!live.current) return;
          setRun(r);
          setError(null);
          setLoading(false);
        },
        e => {
          if (!live.current) return;
          setError(e);
          setLoading(false);
        },
      );
    return () => {
      live.current = false;
    };
  }, [id]);

  const busy = !!run && BUSY.includes(run.status);
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => void load(true), runPolling.intervalMs);
    return () => clearInterval(t);
  }, [busy, load]);

  const reload = useCallback(() => {
    setLoading(true);
    return load();
  }, [load]);

  return { run, setRun, error, loading, reload, refresh: load };
}
