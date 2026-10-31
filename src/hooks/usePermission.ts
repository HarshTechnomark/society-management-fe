import { useSyncExternalStore } from 'react';
import { sessionStore } from '@/lib/auth';
import type { PermissionKey } from '@/constants/permissions';
import type { Me } from '@/types/auth';

const subscribe = sessionStore.subscribe;

/** True when the last `/auth/me` response lists the key, as a society or as a platform permission. */
export function hasPermission(me: Me | null, key: PermissionKey): boolean {
  return !!me && (me.permissions.includes(key) || me.platformPermissions.includes(key));
}

/**
 * Reads the permission keys of the last `/auth/me` response (module 02 loads it, the live `access.changed`
 * event reloads it). Hiding a control is only a convenience; the API decides.
 */
export function usePermission(key: PermissionKey): boolean {
  return useSyncExternalStore(
    subscribe,
    () => hasPermission(sessionStore.get(), key),
    () => false,
  );
}

/** True when the user holds at least one of the keys. */
export function useAnyPermission(...keys: PermissionKey[]): boolean {
  const joined = keys.join(',');
  return useSyncExternalStore(
    subscribe,
    () => joined.split(',').some(k => hasPermission(sessionStore.get(), k as PermissionKey)),
    () => false,
  );
}

/** The society keys the signed-in user holds; used to grey out what they cannot hand to someone else. */
export function useHeldKeys(): ReadonlySet<string> {
  const me = useSyncExternalStore(subscribe, sessionStore.get, () => null);
  return new Set([...(me?.permissions ?? []), ...(me?.platformPermissions ?? [])]);
}
