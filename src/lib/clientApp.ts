import { useSyncExternalStore } from 'react';
import type { ClientApp } from '@/types/auth';

const BY_SUBDOMAIN: Record<string, ClientApp> = {
  platform: 'PLATFORM',
  admin: 'ADMIN',
  my: 'RESIDENT',
  gate: 'GATE',
  work: 'WORK',
};

const VALID = new Set<string>(['PLATFORM', 'ADMIN', 'RESIDENT', 'GATE', 'WORK']);

/**
 * Which app this browser tab is, from the host (`admin.societyapp.in` is ADMIN). The API decides from `Origin`
 * on its own; this only picks the screens. On localhost use `NEXT_PUBLIC_CLIENT_APP` (default ADMIN) or `?app=GATE`.
 */
export function resolveClientApp(host: string, search = ''): ClientApp {
  const sub = host.split(':')[0].split('.')[0];
  if (BY_SUBDOMAIN[sub]) return BY_SUBDOMAIN[sub];
  const q = new URLSearchParams(search).get('app')?.toUpperCase();
  if (q && VALID.has(q)) return q as ClientApp;
  const env = process.env.NEXT_PUBLIC_CLIENT_APP?.toUpperCase();
  return env && VALID.has(env) ? (env as ClientApp) : 'ADMIN';
}

const hostLabel = (host: string) => host.split(':')[0].split('.')[0];

/**
 * The single sign-in address: a host whose first label is not a role label (`app.societyapp.in`, `localhost`). Everybody signs in
 * there and the API chooses the app after sign-in. A forced app (`NEXT_PUBLIC_CLIENT_APP`, or `?app=` in development) keeps the
 * per-app screens, as does every role host (`admin.societyapp.in` and so on).
 */
export function isUnifiedHost(host: string, search = ''): boolean {
  if (BY_SUBDOMAIN[hostLabel(host)]) return false;
  if (process.env.NEXT_PUBLIC_CLIENT_APP) return false;
  const q = new URLSearchParams(search).get('app')?.toUpperCase();
  return !(q && VALID.has(q));
}

// The app of the signed-in session. On the single sign-in address it replaces the host as the answer to "which app is this?".
let sessionApp: ClientApp | null = null;
const appListeners = new Set<() => void>();
export function setSessionApp(app: ClientApp | null) {
  if (sessionApp === app) return;
  sessionApp = app;
  appListeners.forEach(l => l());
}
const subscribeApp = (fn: () => void) => {
  appListeners.add(fn);
  return () => {
    appListeners.delete(fn);
  };
};

const noop = () => () => {};
const snapshot = (): ClientApp => {
  const { host, search } = window.location;
  return sessionApp && isUnifiedHost(host, search) ? sessionApp : resolveClientApp(host, search);
};

/** The app of this tab: the host's on a role host, the session's on the single sign-in address (ADMIN before sign-in). */
export function useClientApp(): ClientApp {
  return useSyncExternalStore(subscribeApp, snapshot, () => 'ADMIN');
}

/** True on the single sign-in address (false on the server and during hydration). */
export function useIsUnified(): boolean {
  return useSyncExternalStore(
    noop,
    () => isUnifiedHost(window.location.host, window.location.search),
    () => false,
  );
}

/** The signed-in session's app, or null before sign-in. */
export function useSessionApp(): ClientApp | null {
  return useSyncExternalStore(
    subscribeApp,
    () => sessionApp,
    () => null,
  );
}

export const APP_LABEL: Record<ClientApp, string> = {
  PLATFORM: 'PLATFORM CONSOLE',
  ADMIN: 'SOCIETY ADMIN',
  RESIDENT: 'RESIDENT APP',
  GATE: 'GATE CONSOLE',
  WORK: 'WORK APP',
};

export const APP_HOME: Record<ClientApp, string> = {
  PLATFORM: '/platform',
  ADMIN: '/admin',
  RESIDENT: '/resident',
  GATE: '/gate',
  WORK: '/work',
};

/** Names and one-line descriptions for the "where do you want to go" screen and the switch buttons. */
export const APP_CHOICE: Record<ClientApp, { name: string; text: string }> = {
  PLATFORM: { name: 'Platform console', text: 'Manage societies, plans and support' },
  ADMIN: { name: 'Society admin', text: 'Run your society: billing, residents and approvals' },
  RESIDENT: { name: 'Resident app', text: 'Your flat, bills, visitors and notices' },
  GATE: { name: 'Gate console', text: 'Log visitors and check passes' },
  WORK: { name: 'Work app', text: 'Your tasks and visits' },
};

export const allowsMobileLogin = (a: ClientApp) => a !== 'PLATFORM';
export const allowsPasswordLogin = (a: ClientApp) => a === 'ADMIN' || a === 'PLATFORM';
export const allowsPasskey = (a: ClientApp) => a !== 'GATE';

/** False while rendering on the server and during hydration, true afterwards. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
