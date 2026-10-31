import { useCallback, useEffect, useRef, useState } from 'react';

export interface Loaded<T> {
  data: T | null;
  loading: boolean;
  error: unknown;
  reload: () => void;
}

/** Runs `fn` on mount and whenever `reload()` is called; ignores answers that arrive after a newer call. */
export function useLoad<T>(fn: () => Promise<T>): Loaded<T> {
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: unknown }>({
    data: null,
    loading: true,
    error: null,
  });
  const [tick, setTick] = useState(0);
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });
  useEffect(() => {
    let live = true;
    fnRef.current().then(
      data => live && setState({ data, loading: false, error: null }),
      error => live && setState(s => ({ ...s, loading: false, error })),
    );
    return () => {
      live = false;
    };
  }, [tick]);
  const reload = useCallback(() => {
    setState(s => ({ ...s, loading: true, error: null }));
    setTick(t => t + 1);
  }, []);
  return { ...state, reload };
}
