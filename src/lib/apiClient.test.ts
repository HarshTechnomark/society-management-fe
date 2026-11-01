import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, apiList, ApiError, configureApiClient } from './apiClient';

type Reply = { status?: number; body?: unknown; headers?: Record<string, string> };
const ok = (data: unknown, extra: object = {}): Reply => ({
  body: { success: true, data, message: 'OK', ...extra },
});
const fail = (status: number, code: string, extra: object = {}): Reply => ({
  status,
  body: { success: false, code, message: `msg ${code}`, requestId: 'req_1', ...extra },
});

function mockFetch(replies: Reply[]) {
  const fn = vi.fn(async () => {
    const r = replies.shift();
    if (!r) throw new Error('no more replies');
    const status = r.status ?? 200;
    return {
      ok: status < 400,
      status,
      headers: new Headers(r.headers),
      json: async () => r.body,
    } as unknown as Response;
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}
const call = (fn: ReturnType<typeof mockFetch>, i: number) => ({
  url: (fn.mock.calls[i] as unknown as [string, RequestInit])[0],
  init: (fn.mock.calls[i] as unknown as [string, RequestInit])[1],
});

const redirect = vi.fn();
beforeEach(() => {
  document.cookie = 'sa_csrf=tok123';
  configureApiClient({ redirect, stepUp: null, suspended: null, sessionLost: null });
});
afterEach(() => {
  document.cookie = 'sa_csrf=; max-age=0';
  redirect.mockReset();
  vi.unstubAllGlobals();
});

describe('apiClient', () => {
  it('unwraps the envelope and sends cookies', async () => {
    const f = mockFetch([ok({ a: 1 })]);
    expect(await api('/x')).toEqual({ a: 1 });
    expect(call(f, 0).init.credentials).toBe('include');
  });

  it('sends X-CSRF-Token on writes only', async () => {
    const f = mockFetch([ok(null), ok(null), ok(null), ok(null), ok(null)]);
    await api('/x');
    await api('/x', { method: 'POST', body: {} });
    await api('/x', { method: 'PATCH', body: {} });
    await api('/x', { method: 'PUT', body: {} });
    await api('/x', { method: 'DELETE' });
    const h = (i: number) => call(f, i).init.headers as Record<string, string>;
    expect(h(0)['X-CSRF-Token']).toBeUndefined();
    for (const i of [1, 2, 3, 4]) expect(h(i)['X-CSRF-Token']).toBe('tok123');
  });

  it('sends X-User-Activity: 0 for background calls', async () => {
    const f = mockFetch([ok(null)]);
    await api('/auth/me', { activity: false });
    expect((call(f, 0).init.headers as Record<string, string>)['X-User-Activity']).toBe('0');
  });

  it('normalises errors into ApiError', async () => {
    mockFetch([fail(401, 'OTP_INVALID', { errors: [{ field: 'attemptsLeft', message: '3' }] })]);
    const e = await api('/x', { method: 'POST', body: {} }).catch((x: ApiError) => x);
    expect(e).toBeInstanceOf(ApiError);
    expect(e).toMatchObject({ status: 401, code: 'OTP_INVALID', requestId: 'req_1' });
    expect((e as ApiError).metaNumber('attemptsLeft')).toBe(3);
  });

  it('reads Retry-After from the header', async () => {
    mockFetch([fail(429, 'ACCOUNT_LOCKED', {}) as Reply]);
    mockFetch([{ ...fail(429, 'ACCOUNT_LOCKED'), headers: { 'Retry-After': '900' } }]);
    const e = (await api('/x', { method: 'POST', body: {} }).catch(x => x)) as ApiError;
    expect(e.retryAfterSeconds).toBe(900);
  });

  it('turns a network failure and non-JSON bodies into ApiError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('failed')));
    expect(await api('/x').catch(x => x)).toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
    mockFetch([{ status: 502, body: null }]);
    expect(await api('/x').catch(x => x)).toMatchObject({ status: 502, code: 'INTERNAL_ERROR' });
  });

  it('returns pagination for list calls', async () => {
    mockFetch([ok([{ id: 1 }], { pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } })]);
    const r = await apiList('/me/security/sessions');
    expect(r.data).toHaveLength(1);
    expect(r.pagination.total).toBe(1);
  });

  it('refreshes once on 401 UNAUTHENTICATED and retries the request', async () => {
    const f = mockFetch([fail(401, 'UNAUTHENTICATED'), ok({ accessExpiresAt: 'x' }), ok({ id: 7 })]);
    expect(await api('/me/security')).toEqual({ id: 7 });
    expect(f).toHaveBeenCalledTimes(3);
    expect(call(f, 1).url).toContain('/auth/refresh');
    expect(call(f, 1).init.method).toBe('POST');
    expect((call(f, 1).init.headers as Record<string, string>)['X-CSRF-Token']).toBe('tok123');
    expect(redirect).not.toHaveBeenCalled();
  });

  it('shares one refresh between parallel requests', async () => {
    const f = mockFetch([
      fail(401, 'UNAUTHENTICATED'),
      fail(401, 'UNAUTHENTICATED'),
      ok({}),
      ok('a'),
      ok('b'),
    ]);
    const [a, b] = await Promise.all([api('/a'), api('/b')]);
    expect([a, b]).toEqual(['a', 'b']);
    const refreshes = (f.mock.calls as unknown[][]).filter(c => String(c[0]).includes('/auth/refresh'));
    expect(refreshes).toHaveLength(1);
  });

  it('treats REFRESH_SUPERSEDED as success and retries', async () => {
    mockFetch([fail(401, 'UNAUTHENTICATED'), fail(401, 'REFRESH_SUPERSEDED'), ok('fine')]);
    expect(await api('/x')).toBe('fine');
  });

  it('redirects to login with next when the refresh fails', async () => {
    const lost = vi.fn();
    configureApiClient({ sessionLost: lost });
    mockFetch([fail(401, 'UNAUTHENTICATED'), fail(401, 'REFRESH_TOKEN_INVALID')]);
    await expect(api('/me/security')).rejects.toBeInstanceOf(ApiError);
    expect(redirect).toHaveBeenCalledOnce();
    const url = String(redirect.mock.calls[0][0]);
    expect(url).toMatch(/^\/login\?/);
    expect(url).toContain('r=expired');
    expect(url).toContain('next=');
    expect(lost).toHaveBeenCalled();
  });

  it('does not loop: a second 401 after refresh is returned as an error', async () => {
    const f = mockFetch([fail(401, 'UNAUTHENTICATED'), ok({}), fail(401, 'UNAUTHENTICATED')]);
    await expect(api('/x')).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(f).toHaveBeenCalledTimes(3);
  });

  it('goes to /login?r=idle on SESSION_EXPIRED with reason IDLE', async () => {
    mockFetch([fail(401, 'SESSION_EXPIRED', { errors: [{ field: 'reason', message: 'IDLE' }] })]);
    await api('/x').catch(() => {});
    expect(String(redirect.mock.calls[0][0])).toContain('r=idle');
  });

  it('skips recovery when recover is false', async () => {
    const f = mockFetch([fail(401, 'UNAUTHENTICATED')]);
    await expect(api('/auth/me', { recover: false })).rejects.toBeInstanceOf(ApiError);
    expect(f).toHaveBeenCalledTimes(1);
    expect(redirect).not.toHaveBeenCalled();
  });

  it('opens step-up on 401 REAUTH_REQUIRED and retries after success', async () => {
    const stepUp = vi.fn().mockResolvedValue(true);
    configureApiClient({ stepUp });
    const f = mockFetch([fail(401, 'REAUTH_REQUIRED'), ok({ otherSessionsRevoked: 2 })]);
    expect(await api('/me/security/password', { method: 'POST', body: {} })).toEqual({
      otherSessionsRevoked: 2,
    });
    expect(stepUp).toHaveBeenCalledOnce();
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('throws REAUTH_REQUIRED when step-up is cancelled, and asks only once per request', async () => {
    const stepUp = vi.fn().mockResolvedValue(false);
    configureApiClient({ stepUp });
    mockFetch([fail(401, 'REAUTH_REQUIRED')]);
    await expect(api('/x', { method: 'POST', body: {} })).rejects.toMatchObject({ code: 'REAUTH_REQUIRED' });
    expect(stepUp).toHaveBeenCalledOnce();
  });

  it('calls the suspended hook on 423', async () => {
    const suspended = vi.fn();
    configureApiClient({ suspended });
    mockFetch([fail(423, 'SOCIETY_CLOSED')]);
    await expect(api('/x')).rejects.toMatchObject({ status: 423 });
    expect(suspended).toHaveBeenCalledWith('msg SOCIETY_CLOSED', 'SOCIETY_CLOSED');
  });

  it('sends one Idempotency-Key per call and reuses it when the step-up retry repeats the request', async () => {
    configureApiClient({ stepUp: vi.fn().mockResolvedValue(true) });
    const f = mockFetch([fail(401, 'REAUTH_REQUIRED'), ok(null), ok(null)]);
    await api('/x', { method: 'POST', body: {}, idempotent: true });
    const first = (call(f, 0).init.headers as Record<string, string>)['Idempotency-Key'];
    expect(first).toBeTruthy();
    expect((call(f, 1).init.headers as Record<string, string>)['Idempotency-Key']).toBe(first);
    await api('/x', { method: 'POST', body: {}, idempotent: true });
    expect((call(f, 2).init.headers as Record<string, string>)['Idempotency-Key']).not.toBe(first);
  });
});
