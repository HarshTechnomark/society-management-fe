import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Loads `fn` now and then every `everyMs` while `active`; keeps the last good answer when a refresh fails.
 * Background calls should pass `activity: false` so the idle timer is not bumped.
 */
export function usePolling<T>(fn: () => Promise<T>, everyMs: number, active = true) {
  const [state, setState] = useState<{ data: T | null; error: unknown; loading: boolean }>({
    data: null,
    error: null,
    loading: true,
  });
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });
  const run = useCallback(() => {
    return fnRef.current().then(
      data => setState({ data, error: null, loading: false }),
      error => setState(s => ({ data: s.data, error, loading: false })),
    );
  }, []);
  useEffect(() => {
    void run();
  }, [run]);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => void run(), everyMs);
    return () => clearInterval(t);
  }, [run, everyMs, active]);
  return { ...state, reload: run };
}
