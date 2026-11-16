import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockApi, navigationMock, ok, resetAll, router, sampleMe } from '@/test/helpers';
import { setMe } from '@/lib/auth';
import { ResidentNav } from './ResidentNav';

vi.mock('next/navigation', () => navigationMock());

const assign = vi.fn();
beforeEach(() => {
  resetAll();
  vi.stubEnv('NEXT_PUBLIC_CLIENT_APP', '');
  vi.stubGlobal('location', { ...window.location, assign });
  const me = sampleMe();
  me.session.clientApp = 'RESIDENT';
  setMe(me);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  assign.mockReset();
});

describe('ResidentNav', () => {
  it('offers the way back to the society admin on the single sign-in address', async () => {
    const admin = sampleMe();
    const api = mockApi({
      'GET /auth/apps': ok({ current: 'RESIDENT', available: ['ADMIN'] }),
      'POST /auth/switch-app': ok(admin),
    });
    render(<ResidentNav>page</ResidentNav>);
    await userEvent.click(await screen.findByRole('button', { name: 'Open Society admin' }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/admin'));
    expect(api.last('POST', '/auth/switch-app')?.body).toEqual({ app: 'ADMIN' });
  });

  it('has Sign out on every screen size', async () => {
    const api = mockApi({
      'GET /auth/apps': ok({ current: 'RESIDENT', available: [] }),
      'POST /auth/logout': ok(null),
    });
    render(<ResidentNav>page</ResidentNav>);
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('/login?r=signedout'));
    expect(api.last('POST', '/auth/logout')).toBeTruthy();
    expect(localStorage.getItem('sa_signed_in')).toBeNull();
  });
});
