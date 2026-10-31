/**
 * What the plan of the active society includes (module 04, `GET /subscription/entitlements`). The last answer is
 * kept in memory next to the `/auth/me` session; until it arrives `useFeature` falls back to `me.features`, which
 * the API builds from the same service. The live event `entitlements.changed` calls `loadEntitlements(true)`.
 */
import { useEffect, useSyncExternalStore } from 'react';
import { sessionStore } from '@/lib/auth';
import { subscriptionsService } from '@/services/subscriptions.service';
import type { Entitlements } from '@/types/subscriptions';

let current: Entitlements | null = null;
let loading: Promise<Entitlements | null> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

export const entitlementsStore = {
  get: () => current,
  set(next: Entitlements | null) {
    current = next;
    emit();
  },
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

/** Loads the entitlements once and shares the result; `force` reloads (after a plan change). */
export function loadEntitlements(force = false): Promise<Entitlements | null> {
  if (current && !force) return Promise.resolve(current);
  loading ??= subscriptionsService
    .entitlements({ activity: false })
    .then(e => {
      entitlementsStore.set(e);
      return e;
    })
    .catch(() => null)
    .finally(() => {
      loading = null;
    });
  return loading;
}

const subscribeBoth = (fn: () => void) => {
  const a = sessionStore.subscribe(fn);
  const b = entitlementsStore.subscribe(fn);
  return () => {
    a();
    b();
  };
};

export function hasFeature(key: string): boolean {
  const e = entitlementsStore.get();
  if (e) return e.features.includes(key);
  return !!sessionStore.get()?.features.includes(key);
}

/** The resolved entitlements; loads them once a user is signed in. */
export function useEntitlements(): Entitlements | null {
  const e = useSyncExternalStore(entitlementsStore.subscribe, entitlementsStore.get, () => null);
  const signedIn = useSyncExternalStore(
    sessionStore.subscribe,
    () => !!sessionStore.get(),
    () => false,
  );
  useEffect(() => {
    if (signedIn && !e) void loadEntitlements();
  }, [signedIn, e]);
  return e;
}

export function useFeatureState(key: string): boolean {
  return useSyncExternalStore(
    subscribeBoth,
    () => hasFeature(key),
    () => false,
  );
}

export function useFlag(key: string): boolean {
  return useSyncExternalStore(
    entitlementsStore.subscribe,
    () => !!entitlementsStore.get()?.flags[key],
    () => false,
  );
}
