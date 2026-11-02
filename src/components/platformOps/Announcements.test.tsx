import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast';
import { setMe } from '@/lib/auth';
import { err, mockApi, navigationMock, ok, resetAll, sampleMe } from '@/test/helpers';
import { announcement } from '@/test/opsFixtures';
import { page } from '@/test/societyFixtures';
import { AnnouncementBanners } from './announcements/AnnouncementBanners';
import { AnnouncementsScreen } from './announcements/AnnouncementsScreen';

vi.mock('next/navigation', () => navigationMock());

const ALL = ['platform.announcements.view', 'platform.announcements.create', 'platform.announcements.edit'];

function renderIt(routes: Parameters<typeof mockApi>[0] = {}, perms = ALL) {
  setMe(sampleMe({ platformPermissions: perms }));
  const api = mockApi({
    'GET /platform/announcements': ok(
      [announcement(), announcement({ id: 32, title: 'Live now', status: 'PUBLISHED', recipientCount: 61 })],
      'OK',
      page(2),
    ),
    'GET /platform/plans': ok([
      { code: 'PREMIUM', name: 'Premium', activeSubscriptions: 3 },
      { code: 'STANDARD', name: 'Standard', activeSubscriptions: 5 },
    ]),
    'POST /platform/announcements/audience-preview': ok({ societies: 18, recipients: 61 }),
    ...routes,
  });
  render(
    <ToastProvider>
      <AnnouncementsScreen />
    </ToastProvider>,
  );
  return api;
}

describe('Announcements (11.5)', () => {
  beforeEach(resetAll);

  it('lists announcements with status, audience, expiry (IST) and recipients', async () => {
    renderIt();
    const table = await screen.findByRole('table', { name: 'Announcements' });
    expect(within(table).getByText('Scheduled maintenance on Sunday')).toBeInTheDocument();
    expect(within(table).getByText('Draft')).toBeInTheDocument();
    expect(within(table).getByText('Published')).toBeInTheDocument();
    expect(within(table).getAllByText('Plans: premium')).toHaveLength(2);
    expect(within(table).getByText('61')).toBeInTheDocument();
  });

  it('shows the live reach line, locks Dismissible for Critical and WhatsApp for other kinds', async () => {
    renderIt();
    await userEvent.click(await screen.findByRole('button', { name: 'New announcement' }));
    const drawer = await screen.findByRole('dialog');
    expect(within(drawer).getByText('Choose an audience to see who it reaches.')).toBeInTheDocument();
    await userEvent.selectOptions(within(drawer).getByRole('combobox', { name: 'Audience' }), 'ALL');
    expect(await within(drawer).findByText('Will reach 18 societies · 61 people')).toBeInTheDocument();
    expect(within(drawer).getByRole('checkbox', { name: /WhatsApp/ })).toBeDisabled();
    const dismiss = within(drawer).getByRole('switch', { name: 'Dismissible' });
    expect(dismiss).toBeEnabled();
    await userEvent.selectOptions(within(drawer).getByRole('combobox', { name: 'Severity' }), 'CRITICAL');
    expect(dismiss).toBeDisabled();
    expect(dismiss).toHaveAttribute('aria-checked', 'false');
    expect(within(drawer).getByRole('checkbox', { name: /WhatsApp/ })).toBeEnabled();
  });

  it('counts the message characters', async () => {
    renderIt();
    await userEvent.click(await screen.findByRole('button', { name: 'New announcement' }));
    const drawer = await screen.findByRole('dialog');
    await userEvent.type(within(drawer).getByRole('textbox', { name: 'Message' }), 'Hello world');
    expect(within(drawer).getByText('11 of 2000 characters')).toBeInTheDocument();
  });

  it('saves a draft with IST times converted to UTC', async () => {
    const api = renderIt({ 'POST /platform/announcements': ok(announcement({ id: 40 })) });
    await userEvent.click(await screen.findByRole('button', { name: 'New announcement' }));
    const drawer = await screen.findByRole('dialog');
    await userEvent.type(within(drawer).getByRole('textbox', { name: 'Title' }), 'Billing notice');
    await userEvent.type(
      within(drawer).getByRole('textbox', { name: 'Message' }),
      'Invoices go out on the first.',
    );
    await userEvent.selectOptions(within(drawer).getByRole('combobox', { name: 'Audience' }), 'ALL');
    await userEvent.type(within(drawer).getByLabelText('Expires at (IST)'), '2030-11-03T06:00');
    await userEvent.click(within(drawer).getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(api.last('POST', '/platform/announcements')).toBeTruthy());
    expect(api.last('POST', '/platform/announcements')!.body).toMatchObject({
      title: 'Billing notice',
      audienceType: 'ALL',
      audienceRoleKeys: ['chairman', 'secretary', 'treasurer', 'society_admin'],
      expiresAt: '2030-11-03T00:30:00.000Z',
      publishAt: null,
      isDismissible: true,
    });
  });

  it('publishes a draft only after a confirmation, saving first and then publishing the new version', async () => {
    const api = renderIt({
      'GET /platform/announcements/31': ok(announcement()),
      'PATCH /platform/announcements/31': ok(announcement({ version: 3 })),
      'POST /platform/announcements/31/publish': ok(
        announcement({ status: 'PUBLISHED', version: 4, recipientCount: 61 }),
      ),
    });
    await userEvent.click(
      await screen.findByRole('button', { name: 'Open Scheduled maintenance on Sunday' }),
    );
    const drawer = await screen.findByRole('dialog');
    await userEvent.click(within(drawer).getByRole('button', { name: 'Publish' }));
    const confirm = (await screen.findAllByRole('dialog')).at(-1)!;
    expect(within(confirm).getByText('Publish this announcement?')).toBeInTheDocument();
    expect(api.last('POST', '/platform/announcements/31/publish')).toBeUndefined();
    await userEvent.click(within(confirm).getByRole('button', { name: 'Publish' }));
    await waitFor(() => expect(api.last('POST', '/platform/announcements/31/publish')).toBeTruthy());
    expect(api.last('POST', '/platform/announcements/31/publish')!.body).toEqual({ version: 3 });
    expect(await screen.findByText('Announcement published.')).toBeInTheDocument();
  });

  it('explains WHATSAPP_NOT_ALLOWED and CTA_URL_NOT_ALLOWED from the API', async () => {
    renderIt({ 'PATCH /platform/announcements/31': err(400, 'CTA_URL_NOT_ALLOWED') });
    await userEvent.click(
      await screen.findByRole('button', { name: 'Open Scheduled maintenance on Sunday' }),
    );
    const drawer = await screen.findByRole('dialog');
    await userEvent.click(within(drawer).getByRole('button', { name: 'Save draft' }));
    expect(await within(drawer).findByText(/must start with https/)).toBeInTheDocument();
  });

  it('cancels a published announcement with a reason and shows fan-out progress', async () => {
    const api = renderIt({
      'GET /platform/announcements': ok(
        [announcement({ id: 32, status: 'PUBLISHED', recipientCount: null })],
        'OK',
        page(1),
      ),
      'POST /platform/announcements/32/cancel': ok(announcement({ id: 32, status: 'CANCELLED' })),
    });
    await userEvent.click(
      await screen.findByRole('button', { name: 'Open Scheduled maintenance on Sunday' }),
    );
    const drawer = await screen.findByRole('dialog');
    expect(within(drawer).getByText('Sending to recipients...')).toBeInTheDocument();
    expect(within(drawer).getByRole('textbox', { name: 'Title' }).closest('fieldset')).toBeDisabled();
    await userEvent.click(within(drawer).getByRole('button', { name: 'Cancel announcement' }));
    const reason = (await screen.findAllByRole('dialog')).at(-1)!;
    await userEvent.type(within(reason).getByRole('textbox', { name: 'Reason' }), 'Wrong audience');
    await userEvent.click(within(reason).getByRole('button', { name: 'Cancel announcement' }));
    await waitFor(() => expect(api.last('POST', '/platform/announcements/32/cancel')).toBeTruthy());
    expect(api.last('POST', '/platform/announcements/32/cancel')!.body).toEqual({
      version: 2,
      reason: 'Wrong audience',
    });
  });

  it('hides New announcement without the create permission', async () => {
    renderIt({}, ['platform.announcements.view']);
    await screen.findByRole('table', { name: 'Announcements' });
    expect(screen.queryByRole('button', { name: 'New announcement' })).not.toBeInTheDocument();
  });
});

describe('Announcement banners in the admin app', () => {
  beforeEach(resetAll);
  const banner = (over: object = {}) => ({
    id: 31,
    title: 'Maintenance Sunday',
    body: 'App is down 1 to 2 am.',
    kind: 'MAINTENANCE',
    severity: 'WARNING',
    isDismissible: true,
    ctaLabel: 'View status',
    ctaUrl: 'https://status.societyapp.in',
    publishedAt: '2026-10-30T05:00:00.000Z',
    expiresAt: '2030-11-03T00:30:00.000Z',
    ...over,
  });

  it('shows the banner with its button and dismisses it', async () => {
    const api = mockApi({
      'GET /platform-announcements': ok({ items: [banner()] }),
      'POST /platform-announcements/31/dismiss': { status: 204 },
    });
    render(<AnnouncementBanners />);
    expect(await screen.findByText('Maintenance Sunday')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View status' })).toHaveAttribute(
      'href',
      'https://status.societyapp.in',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    await waitFor(() => expect(screen.queryByText('Maintenance Sunday')).not.toBeInTheDocument());
    expect(api.last('POST', '/platform-announcements/31/dismiss')).toBeTruthy();
  });

  it('cannot dismiss a critical announcement', async () => {
    mockApi({
      'GET /platform-announcements': ok({ items: [banner({ severity: 'CRITICAL', isDismissible: false })] }),
    });
    render(<AnnouncementBanners />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Maintenance Sunday');
    expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument();
  });

  it('stays silent when the request fails', async () => {
    mockApi({ 'GET /platform-announcements': err(500, 'INTERNAL_ERROR') });
    const { container } = render(<AnnouncementBanners />);
    await new Promise(r => setTimeout(r, 50));
    expect(container).toBeEmptyDOMElement();
  });
});
