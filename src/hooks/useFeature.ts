import { useSyncExternalStore } from 'react';
import { sessionStore } from '@/lib/auth';

/** Placeholder (module 04 replaces it): reads the feature keys of the last `/auth/me` response. */
export function useFeature(key: string): boolean {
  return useSyncExternalStore(
    sessionStore.subscribe,
    () => !!sessionStore.get()?.features.includes(key),
    () => false,
  );
}
