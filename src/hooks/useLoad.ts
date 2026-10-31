import { useCallback, useEffect, useRef, useState } from 'react';

export interface Loaded<T> {
  data: T | null;
  loading: boolean;
  error: unknown;
  reload: () => void;
}

interface State<T> {
  key: unknown;
  data: T | null;
  loading: boolean;
  error: unknown;
}

/**
 * Runs `fn` on mount, whenever `reload()` is called and whenever `key` changes; ignores answers that arrive
 * after a newer call. While `key` has changed and the new answer is not in yet, `data` is null.
 */
export function useLoad<T>(fn: () => Promise<T>, key: unknown = null): Loaded<T> {
  const [state, setState] = useState<State<T>>({ key, data: null, loading: true, error: null });
  const [tick, setTick] = useState(0);
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });
  useEffect(() => {
    let live = true;
    fnRef.current().then(
      data => live && setState({ key, data, loading: false, error: null }),
      error => live && setState({ key, data: null, loading: false, error }),
    );
    return () => {
      live = false;
    };
  }, [tick, key]);
  const reload = useCallback(() => {
    setState(s => ({ ...s, loading: true, error: null }));
    setTick(t => t + 1);
  }, []);
  const current = state.key === key;
  return {
    data: current ? state.data : null,
    loading: !current || state.loading,
    error: current ? state.error : null,
    reload,
  };
}
