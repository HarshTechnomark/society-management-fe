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

const noop = () => () => {};
const snapshot = () => resolveClientApp(window.location.host, window.location.search);

export function useClientApp(): ClientApp {
  return useSyncExternalStore(noop, snapshot, () => 'ADMIN');
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
