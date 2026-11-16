'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { loadMe, sessionStore } from '@/lib/auth';
import { noSessionUrl } from '@/lib/apiClient';
import { APP_HOME, useHydrated, useIsUnified } from '@/lib/clientApp';
import type { ClientApp } from '@/types/auth';

/**
 * On the single sign-in address every app lives under one host, so the address no longer keeps a resident out of /admin. This sends a
 * signed-in person to the home of their own app, and a person who is not signed in to the sign-in page. On a per-role address it
 * does nothing, and asks the API for nothing (the host already picked the app). The page renders only after hydration, once the
 * gate knows which address this is. A person who never signed in is sent to a plain sign-in page, not "your session expired".
 */
export function AppGate({ app, children }: { app: ClientApp; children: ReactNode }) {
  const hydrated = useHydrated();
  const unified = useIsUnified();
  const router = useRouter();
  // read the store directly: `useMe` would load the session even where this gate has nothing to do
  const me = useSyncExternalStore(sessionStore.subscribe, sessionStore.get, () => null);
  const wrong = unified && me !== null && me.session.clientApp !== app;

  useEffect(() => {
    if (!unified) return;
    void loadMe().then(m => {
      if (!m) router.replace(noSessionUrl(window.location.pathname + window.location.search));
    });
  }, [unified, router]);

  useEffect(() => {
    if (wrong && me) router.replace(APP_HOME[me.session.clientApp]);
  }, [wrong, me, router]);

  // Until hydration the address is unknown (`useIsUnified` is false on the server): render nothing, so a page of the wrong app
  // never mounts and calls the API before the gate has decided.
  if (!hydrated || (unified && (me === null || wrong)))
    return <div aria-busy="true" className="min-h-screen" />;
  return <>{children}</>;
}
