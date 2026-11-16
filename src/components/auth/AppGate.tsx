'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { loadMe, sessionStore } from '@/lib/auth';
import { loginUrl } from '@/lib/apiClient';
import { APP_HOME, useIsUnified } from '@/lib/clientApp';
import type { ClientApp } from '@/types/auth';

/**
 * On the single sign-in address every app lives under one host, so the address no longer keeps a resident out of /admin. This sends a
 * signed-in person to the home of their own app, and a person who is not signed in to the sign-in page. On a per-role address it
 * does nothing, and asks the API for nothing (the host already picked the app).
 */
export function AppGate({ app, children }: { app: ClientApp; children: ReactNode }) {
  const unified = useIsUnified();
  const router = useRouter();
  // read the store directly: `useMe` would load the session even where this gate has nothing to do
  const me = useSyncExternalStore(sessionStore.subscribe, sessionStore.get, () => null);
  const wrong = unified && me !== null && me.session.clientApp !== app;

  useEffect(() => {
    if (!unified) return;
    void loadMe().then(m => {
      if (!m) router.replace(loginUrl('expired', window.location.pathname + window.location.search));
    });
  }, [unified, router]);

  useEffect(() => {
    if (wrong && me) router.replace(APP_HOME[me.session.clientApp]);
  }, [wrong, me, router]);

  if (unified && (me === null || wrong)) return <div aria-busy="true" className="min-h-screen" />;
  return <>{children}</>;
}
