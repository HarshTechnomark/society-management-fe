import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { err, mockApi, navigationMock, ok, resetAll, router, sampleMe } from '@/test/helpers';
import { getMe } from '@/lib/auth';
import { SwitchAppButton } from './SwitchAppButton';

vi.mock('next/navigation', () => navigationMock());

beforeEach(() => {
  resetAll();
  vi.stubEnv('NEXT_PUBLIC_CLIENT_APP', '');
});
afterEach(() => vi.unstubAllEnvs());

describe('SwitchAppButton', () => {
  it('offers one button per other app the sign-in can open', async () => {
    mockApi({ 'GET /auth/apps': ok({ current: 'ADMIN', available: ['PLATFORM', 'RESIDENT'] }) });
    render(<SwitchAppButton />);
    expect(await screen.findByRole('button', { name: 'Open Platform console' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Resident app' })).toBeInTheDocument();
  });

  it('switches: sends the app, keeps the new session in memory and goes to its home', async () => {
    const me = sampleMe();
    me.session.clientApp = 'RESIDENT';
    const api = mockApi({
      'GET /auth/apps': ok({ current: 'ADMIN', available: ['RESIDENT'] }),
      'POST /auth/switch-app': ok(me),
    });
    render(<SwitchAppButton />);
    await userEvent.click(await screen.findByRole('button', { name: 'Open Resident app' }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/resident'));
    expect(api.last('POST', '/auth/switch-app')?.body).toEqual({ app: 'RESIDENT' });
    expect(getMe()?.session.clientApp).toBe('RESIDENT');
  });

  it('shows nothing when there is no other app', async () => {
    const api = mockApi({ 'GET /auth/apps': ok({ current: 'ADMIN', available: [] }) });
    const { container } = render(<SwitchAppButton />);
    await waitFor(() => expect(api.fn).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('shows nothing, and asks nothing, on a role address', () => {
    vi.stubEnv('NEXT_PUBLIC_CLIENT_APP', 'ADMIN');
    const api = mockApi({});
    const { container } = render(<SwitchAppButton />);
    expect(container).toBeEmptyDOMElement();
    expect(api.fn).not.toHaveBeenCalled();
  });

  it('shows nothing when the list cannot be loaded', async () => {
    const api = mockApi({ 'GET /auth/apps': err(500, 'INTERNAL_ERROR') });
    const { container } = render(<SwitchAppButton />);
    await waitFor(() => expect(api.fn).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('stays on the page and lets the person try again when the switch is refused', async () => {
    mockApi({
      'GET /auth/apps': ok({ current: 'ADMIN', available: ['PLATFORM'] }),
      'POST /auth/switch-app': err(400, 'LOGIN_METHOD_NOT_ALLOWED'),
    });
    render(<SwitchAppButton />);
    await userEvent.click(await screen.findByRole('button', { name: 'Open Platform console' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Open Platform console' })).toBeEnabled());
    expect(router.push).not.toHaveBeenCalled();
  });
});
