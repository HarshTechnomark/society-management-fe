import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast';
import { setMe } from '@/lib/auth';
import { mockApi, navigationMock, ok, resetAll, sampleMe } from '@/test/helpers';
import { grant, page } from '@/test/societyFixtures';
import { PlatformSupportBanner } from './PlatformSupportBanner';
import { SupportScreen } from './SupportScreen';

vi.mock('next/navigation', () => navigationMock());

const me = (perms: string[]) =>
  setMe(sampleMe({ platformPermissions: perms }, { id: 7, name: 'Isha Kapoor' }));

describe('Support access grants (P-06)', () => {
  beforeEach(resetAll);

  const rows = [
    grant(),
    grant({
      id: 44,
      code: 'G-0044',
      status: 'PENDING_CONSENT',
      startedAt: null,
      endsAt: null,
      society: { id: 3, name: 'Tulip Gardens CHS' },
      version: 1,
    }),
    grant({ id: 41, code: 'G-0041', status: 'EXPIRED', requester: { id: 9, name: 'Ravi Nair' } }),
  ];

  it('lists grants with statuses, windows and my actions', async () => {
    me(['platform.support_access.view', 'platform.support_access.create']);
    const api = mockApi({
      'GET /platform/support-access': ok(rows, 'OK', page(3)),
      'POST /platform/support-access/44/cancel': ok(rows[1]),
    });
    render(
      <ToastProvider>
        <SupportScreen />
      </ToastProvider>,
    );
    const table = await screen.findByRole('table', { name: 'Support access grants' });
    expect(within(table).getByText('Waiting for consent')).toBeInTheDocument();
    expect(within(table).getByText('Not started')).toBeInTheDocument();
    expect(within(table).getByText('Expired')).toBeInTheDocument();
    expect(within(table).getAllByRole('link', { name: 'Lake View CHS' })[0]).toHaveAttribute(
      'href',
      '/platform/societies/2',
    );
    // No approve permission: no Revoke; my pending row can be cancelled and my active row ended.
    expect(within(table).queryByRole('button', { name: 'Revoke' })).not.toBeInTheDocument();
    expect(within(table).getByRole('button', { name: 'End' })).toBeInTheDocument();
    await userEvent.click(within(table).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(api.last('POST', '/platform/support-access/44/cancel')).toBeTruthy());
  });

  it('lets an approver revoke with a reason and version', async () => {
    me(['platform.support_access.view', 'platform.support_access.approve']);
    const api = mockApi({
      'GET /platform/support-access': ok([grant({ requester: { id: 9, name: 'Ravi Nair' } })], 'OK', page(1)),
      'POST /platform/support-access/43/revoke': ok(grant({ status: 'REVOKED' })),
    });
    render(
      <ToastProvider>
        <SupportScreen />
      </ToastProvider>,
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Revoke' }));
    await userEvent.type(screen.getByLabelText(/^Reason/), 'Ticket closed already');
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Revoke' }));
    await waitFor(() =>
      expect(api.last('POST', '/platform/support-access/43/revoke')!.body).toEqual({
        reason: 'Ticket closed already',
        version: 2,
      }),
    );
  });

  it('filters by status through the API', async () => {
    me(['platform.support_access.view']);
    const api = mockApi({ 'GET /platform/support-access': ok([], 'OK', page(0)) });
    render(
      <ToastProvider>
        <SupportScreen />
      </ToastProvider>,
    );
    expect(await screen.findByText('No support access grants')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Filter by status' }), 'ACTIVE');
    await waitFor(() =>
      expect(new URL(String(api.fn.mock.calls.at(-1)![0])).searchParams.get('status')).toBe('ACTIVE'),
    );
  });
});

describe('PlatformSupportBanner (P-07)', () => {
  beforeEach(resetAll);

  it('shows my active grant with a countdown and ends it', async () => {
    me(['platform.support_access.create']);
    const api = mockApi({
      'GET /platform/support-access/current': [
        ok({ grant: grant({ scope: 'READ_ONLY' }), secondsLeft: 125 }),
        ok({ grant: null, secondsLeft: null }),
      ],
      'POST /platform/support-access/43/end': ok(grant({ status: 'ENDED' })),
    });
    render(
      <ToastProvider>
        <PlatformSupportBanner />
      </ToastProvider>,
    );
    const bar = await screen.findByText(/Support access active · Lake View CHS · read only · expires/);
    expect(bar.textContent).toMatch(/\(2:0[45]/);
    await userEvent.click(screen.getByRole('button', { name: 'End now' }));
    await waitFor(() => expect(api.last('POST', '/platform/support-access/43/end')).toBeTruthy());
    expect(await screen.findByText('Support access ended')).toBeInTheDocument();
  });

  it('says the access expired when the countdown reaches zero', async () => {
    me(['platform.support_access.create']);
    mockApi({
      'GET /platform/support-access/current': [ok({ grant: grant(), secondsLeft: 1 }), ok(null)],
    });
    render(
      <ToastProvider>
        <PlatformSupportBanner />
      </ToastProvider>,
    );
    await screen.findByText(/Support access active/);
    expect(
      await screen.findByText('Support access to Lake View CHS expired', {}, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Support access active/)).not.toBeInTheDocument();
  });

  it('stays hidden for users who cannot hold a grant', async () => {
    me(['platform.societies.view']);
    const api = mockApi({});
    render(
      <ToastProvider>
        <PlatformSupportBanner />
      </ToastProvider>,
    );
    await new Promise(r => setTimeout(r, 20));
    expect(api.calls).toHaveLength(0);
  });
});
