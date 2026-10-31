import { useSyncExternalStore } from 'react';

/** Follows a CSS media query. False on the server and where `matchMedia` does not exist. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    notify => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {};
      const m = window.matchMedia(query);
      m.addEventListener('change', notify);
      return () => m.removeEventListener('change', notify);
    },
    () => (typeof window !== 'undefined' && !!window.matchMedia ? window.matchMedia(query).matches : false),
    () => false,
  );
}

export const useIsPhone = () => useMediaQuery('(max-width: 700px)');
