import { vi } from 'vitest';
import { configureApiClient } from '@/lib/apiClient';
import { flow } from '@/lib/authFlow';
import { setMe } from '@/lib/auth';
import { entitlementsStore } from '@/lib/entitlements';
import type { Me } from '@/types/auth';

export const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() };
export const search = { current: new URLSearchParams() };

/** Call inside `vi.mock('next/navigation', ...)` factories through `navigationMock()`. */
export const navigationMock = () => ({
  useRouter: () => router,
  useSearchParams: () => search.current,
  usePathname: () => '/',
  redirect: vi.fn(),
});

export type Reply = {
  status?: number;
  data?: unknown;
  code?: string;
  message?: string;
  errors?: { field: string; message: string }[];
  extra?: object;
};
export const ok = (data: unknown = null, message = 'OK', extra: object = {}): Reply => ({
  data,
  message,
  extra,
});
export const err = (
  status: number,
  code: string,
  errors?: { field: string; message: string }[],
  message = `msg ${code}`,
): Reply => ({
  status,
  code,
  message,
  errors,
});

export interface Call {
  method: string;
  path: string;
  body: unknown;
}

/**
 * Mocks `fetch` for the API. Keys are `"METHOD /path"` (query string ignored). A value is a reply or a function
 * returning one; an array is consumed one reply per call, and its last item repeats.
 */
export function mockApi(routes: Record<string, Reply | ((body: unknown) => Reply) | Reply[]>) {
  const calls: Call[] = [];
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    const u = new URL(url);
    const path = u.pathname.replace(/^\/api\/v1/, '');
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, path, body });
    const r = routes[`${method} ${path}`];
    if (!r) throw new Error(`Unmocked request: ${method} ${path}`);
    const reply =
      typeof r === 'function' ? r(body) : Array.isArray(r) ? (r.length > 1 ? r.shift()! : r[0]) : r;
    const status = reply.status ?? 200;
    const json = reply.code
      ? {
          success: false,
          code: reply.code,
          message: reply.message,
          errors: reply.errors,
          requestId: 'req_test',
        }
      : { success: true, data: reply.data, message: reply.message ?? 'OK', ...reply.extra };
    return {
      ok: status < 400,
      status,
      headers: new Headers(),
      json: async () => json,
    } as unknown as Response;
  });
  vi.stubGlobal('fetch', fn);
  return {
    fn,
    calls,
    last: (m: string, p: string) => [...calls].reverse().find(c => c.method === m && c.path === p),
  };
}

export function resetAll() {
  router.push.mockReset();
  router.replace.mockReset();
  search.current = new URLSearchParams();
  flow.clear();
  setMe(null);
  entitlementsStore.set(null);
  configureApiClient({ redirect: vi.fn(), stepUp: null, suspended: null, paymentRequired: null });
  window.history.replaceState(null, '', '/');
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
}

export const futureIso = (seconds: number) => new Date(Date.now() + seconds * 1000).toISOString();

export const sampleMe = (over: Partial<Me> = {}, user: Partial<Me['user']> = {}): Me => ({
  user: {
    id: 101,
    name: 'Rajesh Kulkarni',
    mobile: '9820011111',
    email: 'chairman@skyheights.in',
    emailVerified: true,
    photoFileId: null,
    locale: 'en-IN',
    status: 'ACTIVE',
    hasPassword: true,
    mfaEnabled: true,
    mfaMandatory: true,
    passkeyCount: 0,
    recoveryCodesRemaining: 9,
    needsProfile: false,
    deletionScheduledFor: null,
    version: 4,
    ...user,
  },
  session: {
    id: 5531,
    clientApp: 'ADMIN',
    authTime: new Date().toISOString(),
    idleTimeoutMinutes: 30,
    stepUpMinutes: 5,
    absoluteExpiresAt: futureIso(3600),
    amr: ['OTP', 'TOTP'],
  },
  memberships: [],
  activeSocietyId: 1,
  needsSocietyPick: false,
  platformRole: null,
  permissions: [],
  platformPermissions: [],
  features: [],
  supportGrant: null,
  ...over,
});

export const otpChallenge = (over: object = {}) => ({
  challengeId: 'otp_k3mzq7wd2xa5hn4pbc6rtyv2',
  maskedMobile: '98XXXXX222',
  channel: 'SMS',
  expiresAt: futureIso(300),
  resendAvailableAt: futureIso(30),
  resendsLeft: 3,
  ...over,
});
