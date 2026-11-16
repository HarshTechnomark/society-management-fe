import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { err, mockApi, navigationMock, ok, resetAll, router, sampleMe } from '@/test/helpers';
import { setMe } from '@/lib/auth';
import { AppGate } from './AppGate';

vi.mock('next/navigation', () => navigationMock());

beforeEach(() => {
  resetAll();
  vi.stubEnv('NEXT_PUBLIC_CLIENT_APP', '');
});
afterEach(() => vi.unstubAllEnvs());

const sessionOf = (clientApp: 'PLATFORM' | 'ADMIN' | 'RESIDENT') => {
  const me = sampleMe();
  me.session.clientApp = clientApp;
  return me;
};
const page = (app: 'PLATFORM' | 'ADMIN' | 'RESIDENT') => (
  <AppGate app={app}>
    <p>inside</p>
  </AppGate>
);

describe('AppGate on the single sign-in address', () => {
  it('shows the app to a person signed in to it', async () => {
    setMe(sessionOf('ADMIN'));
    mockApi({ 'GET /auth/me': ok(sessionOf('ADMIN')) });
    render(page('ADMIN'));
    expect(await screen.findByText('inside')).toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('sends a person signed in to another app to their own home, and shows nothing of this one', async () => {
    setMe(sessionOf('RESIDENT'));
    mockApi({ 'GET /auth/me': ok(sessionOf('RESIDENT')) });
    render(page('ADMIN'));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/resident'));
    expect(screen.queryByText('inside')).toBeNull();
  });

  it('sends a platform session away from a society area, and a society session away from the platform', async () => {
    setMe(sessionOf('PLATFORM'));
    mockApi({ 'GET /auth/me': ok(sessionOf('PLATFORM')) });
    const { unmount } = render(page('ADMIN'));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/platform'));
    unmount();
    router.replace.mockReset();
    setMe(sessionOf('ADMIN'));
    render(page('PLATFORM'));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/admin'));
  });

  it('sends a person who is not signed in to the sign-in page, remembering where they wanted to go', async () => {
    mockApi({ 'GET /auth/me': err(401, 'UNAUTHENTICATED') });
    render(page('ADMIN'));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/login?r=expired&next=%2F'));
    expect(screen.queryByText('inside')).toBeNull();
  });

  it('shows nothing until the session is known', async () => {
    mockApi({ 'GET /auth/me': ok(sessionOf('ADMIN')) });
    render(page('ADMIN'));
    expect(screen.queryByText('inside')).toBeNull();
    expect(await screen.findByText('inside')).toBeInTheDocument();
  });
});

describe('AppGate on a role address', () => {
  it('does nothing: the host already picked the app', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLIENT_APP', 'ADMIN');
    const api = mockApi({});
    render(page('ADMIN'));
    expect(await screen.findByText('inside')).toBeInTheDocument();
    expect(api.fn).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });
});
