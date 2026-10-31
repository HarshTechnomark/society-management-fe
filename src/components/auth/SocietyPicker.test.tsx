import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { err, mockApi, navigationMock, ok, resetAll, router, sampleMe } from '@/test/helpers';
import { SocietyPicker } from './SocietyPicker';
import type { Membership } from '@/types/auth';

vi.mock('next/navigation', () => navigationMock());

const m = (over: Partial<Membership>): Membership => ({
  societyId: 1,
  societyName: 'Sky Heights CHS',
  city: 'Pune',
  societyStatus: 'ACTIVE',
  memberId: 11,
  roleKey: 'chairman',
  roleName: 'Chairman',
  roleScope: 'society',
  status: 'ACTIVE',
  ...over,
});
const me = sampleMe({
  needsSocietyPick: true,
  memberships: [
    m({}),
    m({
      societyId: 2,
      societyName: 'Green Park CHS',
      city: 'Thane',
      roleName: 'Secretary',
      roleKey: 'secretary',
    }),
    m({ societyId: 3, societyName: 'Tulip CHS', status: 'SUSPENDED' }),
  ],
});

beforeEach(resetAll);

describe('SocietyPicker', () => {
  it('lists societies with role chips and greys out suspended ones', async () => {
    mockApi({ 'GET /auth/me': ok(me) });
    render(<SocietyPicker />);
    expect(await screen.findByText('Green Park CHS')).toBeInTheDocument();
    expect(screen.getByText('Secretary')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tulip CHS/ })).toBeDisabled();
    expect(screen.getByText('Suspended')).toBeInTheDocument();
  });

  it('switches society and lands on the app home', async () => {
    const api = mockApi({
      'GET /auth/me': ok(me),
      'POST /auth/switch-society': ok(sampleMe({ activeSocietyId: 2 })),
    });
    render(<SocietyPicker />);
    await userEvent.click(await screen.findByRole('button', { name: /Green Park CHS/ }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/admin'));
    expect(api.last('POST', '/auth/switch-society')?.body).toEqual({ societyId: 2 });
  });

  it('shows the API error when the switch is refused', async () => {
    mockApi({
      'GET /auth/me': ok(me),
      'POST /auth/switch-society': err(403, 'MEMBERSHIP_NOT_ACTIVE', undefined, 'Not active'),
    });
    render(<SocietyPicker />);
    await userEvent.click(await screen.findByRole('button', { name: /Sky Heights CHS/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Not active');
  });

  it('sends a signed-out visitor to sign in', async () => {
    mockApi({ 'GET /auth/me': err(401, 'UNAUTHENTICATED') });
    render(<SocietyPicker />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/login?r=expired'));
  });
});
