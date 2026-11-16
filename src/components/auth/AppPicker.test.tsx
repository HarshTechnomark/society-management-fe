import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { err, mockApi, navigationMock, ok, resetAll, router, sampleMe, search } from '@/test/helpers';
import { flow } from '@/lib/authFlow';
import { AppPicker } from './AppPicker';

vi.mock('next/navigation', () => navigationMock());

beforeEach(() => {
  resetAll();
  vi.stubEnv('NEXT_PUBLIC_CLIENT_APP', '');
});
afterEach(() => vi.unstubAllEnvs());

const waiting = () =>
  flow.set({ appChoice: { challengeToken: 'lc_app', apps: ['ADMIN', 'RESIDENT'], expiresAt: 'x' } });

describe('AppPicker (where do you want to go?)', () => {
  it('lists the apps that were offered, with what each is for', async () => {
    waiting();
    render(<AppPicker />);
    expect(await screen.findByRole('button', { name: /Society admin/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Resident app/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Platform console/ })).toBeNull();
    expect(screen.getByText(/Run your society/)).toBeInTheDocument();
  });

  it('opens the chosen app: sends the pick with the challenge and lands in that app', async () => {
    waiting();
    const me = sampleMe();
    me.session.clientApp = 'RESIDENT';
    const api = mockApi({ 'POST /auth/app/choose': ok({ status: 'SIGNED_IN', me }) });
    render(<AppPicker />);
    await userEvent.click(await screen.findByRole('button', { name: /Resident app/ }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/resident'));
    expect(api.last('POST', '/auth/app/choose')?.body).toEqual({ challengeToken: 'lc_app', app: 'RESIDENT' });
    expect(flow.get().appChoice).toBeUndefined();
  });

  it('goes on to the second step when the chosen app needs one', async () => {
    waiting();
    mockApi({
      'POST /auth/app/choose': ok({
        status: 'MFA_REQUIRED',
        challengeToken: 'lc_mfa',
        methods: ['TOTP'],
        expiresAt: 'x',
      }),
    });
    render(<AppPicker />);
    await userEvent.click(await screen.findByRole('button', { name: /Society admin/ }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/login/mfa'));
    expect(flow.get().mfa?.challengeToken).toBe('lc_mfa');
    expect(flow.get().appChoice).toBeUndefined();
  });

  it('keeps next', async () => {
    waiting();
    search.current = new URLSearchParams('next=/admin/billing/dues');
    mockApi({
      'POST /auth/app/choose': ok({
        status: 'MFA_REQUIRED',
        challengeToken: 'lc_mfa',
        methods: ['TOTP'],
        expiresAt: 'x',
      }),
    });
    render(<AppPicker />);
    await userEvent.click(await screen.findByRole('button', { name: /Society admin/ }));
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith('/login/mfa?next=%2Fadmin%2Fbilling%2Fdues'),
    );
  });

  it('shows a refused choice in words and lets the person pick again', async () => {
    waiting();
    mockApi({ 'POST /auth/app/choose': err(401, 'CHALLENGE_INVALID') });
    render(<AppPicker />);
    await userEvent.click(await screen.findByRole('button', { name: /Society admin/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/too long|start again/i);
    expect(screen.getByRole('button', { name: /Society admin/ })).toBeEnabled();
  });

  it('sends the person back to sign in when the challenge was lost (a page reload)', async () => {
    render(<AppPicker />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/login?r=challenge'));
  });
});
