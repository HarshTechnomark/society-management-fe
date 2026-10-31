import { useSyncExternalStore } from 'react';
import { sessionStore } from '@/lib/auth';

const subscribe = sessionStore.subscribe;

/**
 * Placeholder (module 03 replaces it): reads the permission keys of the last `/auth/me` response.
 * Hiding a control is only a convenience; the API decides.
 */
export function usePermission(key: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => {
      const me = sessionStore.get();
      return !!me && (me.permissions.includes(key) || me.platformPermissions.includes(key));
    },
    () => false,
  );
}
