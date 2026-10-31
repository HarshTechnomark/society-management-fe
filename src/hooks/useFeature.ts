import { useSyncExternalStore } from 'react';
import { sessionStore } from '@/lib/auth';

/** True when the plan of the active society includes the entitlement key (`features` of `/auth/me`). */
export function useFeature(key: string): boolean {
  return useSyncExternalStore(
    sessionStore.subscribe,
    () => !!sessionStore.get()?.features.includes(key),
    () => false,
  );
}
