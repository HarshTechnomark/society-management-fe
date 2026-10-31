/**
 * The single fetch wrapper (module 01, section 11.4). Module 02 owns: CSRF header, one silent refresh on
 * 401 UNAUTHENTICATED, redirect to sign in, step-up on 401 REAUTH_REQUIRED and the 423 banner hook.
 * Module 12 adds idempotency keys, module 04 the 402 prompt.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly errors?: { field: string; message: string }[],
    public readonly requestId?: string,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Reads a numeric or text detail the API puts in `errors[]`, for example `attemptsLeft`. */
  meta(field: string): string | undefined {
    return this.errors?.find(e => e.field === field)?.message;
  }
  metaNumber(field: string): number | undefined {
    const v = this.meta(field);
    return v !== undefined && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : undefined;
  }
}

const BASE = process.env.NEXT_PUBLIC_API_URL ?? '/api/v1';
const WRITE_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

export interface Options {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  signal?: AbortSignal;
  /** Set false for background polling so the session idle timer is not bumped (`X-User-Activity: 0`). */
  activity?: boolean;
  /** Set false to skip refresh, redirect and step-up handling (probes such as "am I signed in?"). */
  recover?: boolean;
  /** Sends an `Idempotency-Key` (one new key per call, kept across the silent refresh and step-up retries). */
  idempotent?: boolean;
  /** Set by `request()` from `idempotent`. */
  idempotencyKey?: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface Hooks {
  /** Navigates to the sign-in page. Replaced in tests. */
  redirect: (url: string) => void;
  /** Asks the user to confirm it is them; resolves true when the step-up succeeded. */
  stepUp: (() => Promise<boolean>) | null;
  /** Called on 423 (society suspended). */
  suspended: ((message: string) => void) | null;
  /** Called when the session is gone, so in-memory session state is dropped. */
  sessionLost: (() => void) | null;
}

const hooks: Hooks = {
  redirect: url => window.location.assign(url),
  stepUp: null,
  suspended: null,
  sessionLost: null,
};

export function configureApiClient(next: Partial<Hooks>) {
  Object.assign(hooks, next);
}

export function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  for (const part of document.cookie.split('; ')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i) === name) return decodeURIComponent(part.slice(i + 1));
  }
  return null;
}

function buildUrl(path: string, query?: Options['query']) {
  const qs = query
    ? new URLSearchParams(
        Object.entries(query)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)]),
      ).toString()
    : '';
  return `${BASE}${path}${qs ? '?' + qs : ''}`;
}

interface Envelope {
  success: boolean;
  data?: unknown;
  message?: string;
  pagination?: Pagination;
  code?: string;
  errors?: { field: string; message: string }[];
  requestId?: string;
}

async function send(path: string, opts: Options): Promise<Envelope | null> {
  const method = opts.method ?? 'GET';
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (WRITE_METHODS.has(method)) {
    const csrf = readCookie('sa_csrf');
    if (csrf) headers['X-CSRF-Token'] = csrf;
  }
  if (opts.activity === false) headers['X-User-Activity'] = '0';
  if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;
  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.query), {
      method,
      credentials: 'include',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server. Check your connection and try again.');
  }
  if (res.status === 204) return { success: true, data: undefined };
  const json = (await res.json().catch(() => null)) as Envelope | null;
  if (!res.ok || !json?.success) {
    const header = Number(res.headers?.get?.('Retry-After'));
    throw new ApiError(
      res.status,
      json?.code ?? 'INTERNAL_ERROR',
      json?.message ?? 'Something went wrong',
      json?.errors,
      json?.requestId,
      Number.isFinite(header) && header > 0 ? header : undefined,
    );
  }
  return json;
}

export function loginUrl(reason?: string, next?: string) {
  const q = new URLSearchParams();
  if (reason) q.set('r', reason);
  if (next) q.set('next', next);
  const s = q.toString();
  return `/login${s ? '?' + s : ''}`;
}

function currentPath() {
  return typeof window === 'undefined' ? '/' : window.location.pathname + window.location.search;
}

let refreshing: Promise<boolean> | null = null;
/** Counts completed refreshes, so a request that failed before one finished knows it only has to retry. */
let refreshEpoch = 0;

/** One refresh at a time; every request that hit a 401 meanwhile waits for the same result. */
function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      await send('/auth/refresh', { method: 'POST', body: {} });
      refreshEpoch++;
      return true;
    } catch (e) {
      // Another tab refreshed a moment ago: the new cookies are already in place.
      if (e instanceof ApiError && e.code === 'REFRESH_SUPERSEDED') {
        refreshEpoch++;
        return true;
      }
      return false;
    }
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

function goToLogin(reason: string): never {
  hooks.sessionLost?.();
  hooks.redirect(loginUrl(reason, currentPath()));
  throw new ApiError(401, reason === 'idle' ? 'SESSION_EXPIRED' : 'UNAUTHENTICATED', 'Please sign in again.');
}

const NO_REFRESH = ['/auth/refresh', '/auth/logout'];

const newKey = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `k-${Date.now()}-${Math.random().toString(36).slice(2)}`;

async function request(path: string, options: Options): Promise<Envelope | null> {
  const opts =
    options.idempotent && !options.idempotencyKey ? { ...options, idempotencyKey: newKey() } : options;
  if (opts.recover === false) return send(path, opts);
  let refreshed = false;
  let steppedUp = false;
  let epoch = refreshEpoch;
  for (;;) {
    try {
      return await send(path, opts);
    } catch (e) {
      if (!(e instanceof ApiError)) throw e;
      if (e.status === 401 && e.code === 'UNAUTHENTICATED' && !refreshed && !NO_REFRESH.includes(path)) {
        refreshed = true;
        if (refreshEpoch !== epoch || (await refreshSession())) {
          epoch = refreshEpoch;
          continue;
        }
        goToLogin('expired');
      }
      if (e.status === 401 && (e.code === 'SESSION_EXPIRED' || e.code === 'SESSION_REVOKED')) {
        goToLogin(e.code === 'SESSION_EXPIRED' && e.meta('reason') === 'IDLE' ? 'idle' : 'expired');
      }
      if (e.status === 401 && e.code === 'REAUTH_REQUIRED' && !steppedUp && hooks.stepUp) {
        steppedUp = true;
        if (await hooks.stepUp()) continue;
      }
      if (e.status === 423) hooks.suspended?.(e.message);
      throw e;
    }
  }
}

/** Returns `data` of the envelope or throws `ApiError`. */
export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  const json = await request(path, opts);
  return json?.data as T;
}

/** For list endpoints that return `pagination` next to `data`. */
export async function apiList<T>(
  path: string,
  opts: Options = {},
): Promise<{ data: T[]; pagination: Pagination }> {
  const json = await request(path, opts);
  return { data: (json?.data ?? []) as T[], pagination: json?.pagination as Pagination };
}
