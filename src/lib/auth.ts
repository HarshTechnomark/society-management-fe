/**
 * Session helpers. The access, refresh and CSRF tokens live in httpOnly cookies set by the API; nothing here
 * stores a token. The only client state is the last `/auth/me` response, held in memory.
 */
import { useEffect, useSyncExternalStore } from 'react';
import { authService } from '@/services/auth.service';
import { configureApiClient, loginUrl } from '@/lib/apiClient';
import { APP_HOME } from '@/lib/clientApp';
import { flow } from '@/lib/authFlow';
import type { ClientApp, Me } from '@/types/auth';

let current: Me | null = null;
let loading: Promise<Me | null> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

export const sessionStore = {
  get: () => current,
  set(me: Me | null) {
    current = me;
    emit();
  },
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

export const setMe = (me: Me | null) => sessionStore.set(me);
export const getMe = () => sessionStore.get();

/** Loads `/auth/me` once and shares the result. Returns null when nobody is signed in. */
export function loadMe(force = false): Promise<Me | null> {
  if (current && !force) return Promise.resolve(current);
  loading ??= authService
    .me({ recover: false })
    .then(me => {
      setMe(me);
      return me;
    })
    .catch(() => null)
    .finally(() => {
      loading = null;
    });
  return loading;
}

export function useMe(): { me: Me | null; ready: boolean } {
  const me = useSyncExternalStore(sessionStore.subscribe, sessionStore.get, () => null);
  useEffect(() => {
    if (!me) void loadMe();
  }, [me]);
  return { me, ready: me !== null };
}

/** Where to go after a successful sign-in. */
export function landingPath(me: Me, app: ClientApp, next: string | null): string {
  if (me.needsSocietyPick && app !== 'PLATFORM')
    return next ? `/login/society?next=${encodeURIComponent(next)}` : '/login/society';
  return next ?? APP_HOME[app];
}

export async function signOut(reason: 'signedout' | 'idle' | 'expired' = 'signedout') {
  try {
    await authService.logout();
  } catch {
    /* the cookies expire on their own; leave anyway */
  }
  setMe(null);
  flow.clear();
  window.location.assign(loginUrl(reason));
}

// When the API client gives up on a session, drop the cached user too.
configureApiClient({ sessionLost: () => setMe(null) });
