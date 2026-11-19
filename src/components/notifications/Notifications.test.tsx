import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { notificationRaw, pagination, prefsRaw } from '@/test/communicationFixtures';
import { err, mockApi, navigationMock, ok, resetAll, router } from '@/test/helpers';
import { signInAs } from '@/test/residentsHelpers';
import { ToastProvider } from '@/components/ui/Toast';
import { AdminNav, ADMIN_NAV, visibleAdminNav } from '@/components/setup/AdminNav';
import { sampleMe } from '@/test/helpers';
import { setMe } from '@/lib/auth';
import { NotificationBell } from './NotificationBell';
import { NotificationsScreen } from './NotificationsScreen';
import { NotificationSettingsScreen } from './NotificationSettingsScreen';
import { adminLink, linkFor, residentLink } from './format';
import { draftOf, quietProblem, toBody } from './prefs';
import { mapPreferences } from '@/services/notificationsMappers';

vi.mock('next/navigation', () => ({
  ...navigationMock(),
  usePathname: () => '/admin',
}));
beforeEach(() => {
  resetAll();
  signInAs([], []);
});

const wrap = (ui: React.ReactElement) => render(<ToastProvider>{ui}</ToastProvider>);
const inbox = (items: unknown[]) => ({ data: items, extra: { pagination: pagination(items.length) } });

describe('Notification bell', () => {
  const routes = (
    items = [
      notificationRaw(),
      notificationRaw({ id: 2, title: 'Paid', tone: 'ok', readAt: 'x', deepLink: null }),
    ],
  ) => ({
    'GET /notifications/unread-count': ok({ count: 3 }),
    'GET /notifications': inbox(items),
  });

  it('shows the unread count on the bell', async () => {
    mockApi(routes());
    wrap(<NotificationBell app="ADMIN" />);
    expect(await screen.findByTestId('bell-badge')).toHaveTextContent('3');
    expect(screen.getByRole('button', { name: 'Notifications, 3 unread' })).toBeInTheDocument();
  });

  it('shows 99+ for a large count and no badge for none', async () => {
    mockApi({ ...routes(), 'GET /notifications/unread-count': ok({ count: 250 }) });
    const { unmount } = wrap(<NotificationBell app="ADMIN" />);
    expect(await screen.findByTestId('bell-badge')).toHaveTextContent('99+');
    unmount();
    mockApi({ ...routes(), 'GET /notifications/unread-count': ok({ count: 0 }) });
    wrap(<NotificationBell app="ADMIN" />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument());
    expect(screen.queryByTestId('bell-badge')).not.toBeInTheDocument();
  });

  it('stays quiet when the count cannot be loaded', async () => {
    mockApi({ ...routes(), 'GET /notifications/unread-count': err(500, 'INTERNAL_ERROR') });
    wrap(<NotificationBell app="ADMIN" />);
    expect(await screen.findByRole('button', { name: 'Notifications' })).toBeInTheDocument();
    expect(screen.queryByTestId('bell-badge')).not.toBeInTheDocument();
  });

  it('lists items on open, marks one read and follows its deep link under /admin', async () => {
    const api = mockApi({ ...routes(), 'POST /notifications/77120/read': ok(null) });
    wrap(<NotificationBell app="ADMIN" />);
    await userEvent.click(await screen.findByRole('button', { name: /Notifications/ }));
    const dlg = await screen.findByRole('dialog', { name: 'Notifications' });
    await userEvent.click(await within(dlg).findByRole('button', { name: /Approval needed: Notice/ }));
    await waitFor(() => expect(api.calls.some(c => c.path === '/notifications/77120/read')).toBe(true));
    expect(router.push).toHaveBeenCalledWith('/admin/approvals/77');
    expect(api.calls.find(c => c.path === '/notifications')).toBeTruthy();
  });

  it('does not mark an already read item again', async () => {
    const api = mockApi(routes());
    wrap(<NotificationBell app="ADMIN" />);
    await userEvent.click(await screen.findByRole('button', { name: /Notifications/ }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.click(await within(dlg).findByRole('button', { name: /Paid/ }));
    expect(api.calls.some(c => c.path === '/notifications/2/read')).toBe(false);
    expect(router.push).not.toHaveBeenCalled();
  });

  it('marks all read and refreshes the count', async () => {
    const api = mockApi({
      ...routes(),
      'GET /notifications/unread-count': [ok({ count: 3 }), ok({ count: 0 })],
      'POST /notifications/read-all': ok({ updated: 3 }),
    });
    wrap(<NotificationBell app="ADMIN" />);
    await userEvent.click(await screen.findByRole('button', { name: /Notifications/ }));
    const dlg = await screen.findByRole('dialog');
    await within(dlg).findByRole('button', { name: /Approval needed/ });
    await userEvent.click(within(dlg).getByRole('button', { name: 'Mark all read' }));
    await waitFor(() => expect(api.last('POST', '/notifications/read-all')?.body).toEqual({}));
    await waitFor(() => expect(screen.queryByTestId('bell-badge')).not.toBeInTheDocument());
  });

  it('shows the empty state and an error with retry', async () => {
    mockApi({ ...routes(), 'GET /notifications': inbox([]) });
    wrap(<NotificationBell app="ADMIN" />);
    await userEvent.click(await screen.findByRole('button', { name: /Notifications/ }));
    expect(await screen.findByText('All caught up')).toBeInTheDocument();
  });
  it('retries a failed list', async () => {
    mockApi({ ...routes(), 'GET /notifications': [err(500, 'INTERNAL_ERROR'), inbox([notificationRaw()])] });
    wrap(<NotificationBell app="ADMIN" />);
    await userEvent.click(await screen.findByRole('button', { name: /Notifications/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('button', { name: /Approval needed/ })).toBeInTheDocument();
  });

  it('is hidden without an active society', () => {
    setMe(sampleMe({ activeSocietyId: null }));
    mockApi({});
    wrap(<NotificationBell app="ADMIN" />);
    expect(screen.queryByRole('button', { name: /Notifications/ })).not.toBeInTheDocument();
  });
});

describe('Notifications page', () => {
  it('filters unread and pages', async () => {
    const api = mockApi({
      'GET /notifications': { data: [notificationRaw()], extra: { pagination: pagination(30, 2) } },
    });
    wrap(<NotificationsScreen app="ADMIN" />);
    await screen.findByRole('button', { name: /Approval needed/ });
    await userEvent.click(screen.getByRole('button', { name: 'Unread' }));
    await waitFor(() =>
      expect(new URL(String(api.fn.mock.calls.at(-1)![0])).searchParams.get('unread')).toBe('true'),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() =>
      expect(new URL(String(api.fn.mock.calls.at(-1)![0])).searchParams.get('page')).toBe('2'),
    );
  });
});

describe('Notification settings', () => {
  const open = async (prefs = prefsRaw(), extra: Record<string, never> = {}) => {
    const api = mockApi({
      'GET /me/notification-preferences': ok(prefs),
      'GET /me/push-subscriptions': ok([]),
      ...extra,
    });
    wrap(<NotificationSettingsScreen app="ADMIN" />);
    await screen.findByRole('table');
    return api;
  };

  it('shows the matrix with Emergency locked and always on', async () => {
    await open();
    const row = screen.getByRole('row', { name: /Emergency/ });
    expect(within(row).getByText('Always on')).toBeInTheDocument();
    for (const b of within(row).getAllByRole('checkbox')) {
      expect(b).toBeChecked();
      expect(b).toBeDisabled();
    }
    expect(screen.getByRole('checkbox', { name: 'Notices by SMS' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Payments by Push' })).toBeChecked();
  });

  it('saves the changed matrix with the version and without locked categories', async () => {
    const api = await open(prefsRaw(), {
      'PUT /me/notification-preferences': ok(prefsRaw({ version: 5 })) as never,
    });
    await userEvent.click(screen.getByRole('checkbox', { name: 'Notices by SMS' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Payments by Email' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(api.last('PUT', '/me/notification-preferences')).toBeTruthy());
    expect(api.last('PUT', '/me/notification-preferences')?.body).toEqual({
      version: 4,
      locale: null,
      categories: {
        PAYMENTS: { PUSH: true, SMS: true, WHATSAPP: true, EMAIL: false },
        NOTICES: { PUSH: true, SMS: true, WHATSAPP: true, EMAIL: true },
      },
      quietHours: { mode: 'SOCIETY_DEFAULT' },
      whatsappOptIn: false,
    });
  });

  it('sends custom quiet hours, language and the WhatsApp opt-in, and checks start differs from end', async () => {
    const api = await open(prefsRaw(), { 'PUT /me/notification-preferences': ok(prefsRaw()) as never });
    await userEvent.click(screen.getByRole('button', { name: 'Custom' }));
    const until = screen.getByLabelText('Until');
    await userEvent.clear(until);
    await userEvent.type(until, '22:00');
    expect(screen.getByText('The start and end time must be different.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    await userEvent.clear(until);
    await userEvent.type(until, '06:30');
    await userEvent.selectOptions(screen.getByLabelText('Language of alerts'), 'mr-IN');
    await userEvent.click(screen.getByRole('switch', { name: 'WhatsApp alerts' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(api.last('PUT', '/me/notification-preferences')).toBeTruthy());
    expect(api.last('PUT', '/me/notification-preferences')?.body).toMatchObject({
      locale: 'mr-IN',
      quietHours: { mode: 'CUSTOM', start: '22:00', end: '06:30' },
      whatsappOptIn: true,
    });
  });

  it('disables WhatsApp when the plan has none', async () => {
    await open(prefsRaw({ whatsapp: { optIn: false, optInAt: null, available: false } }));
    expect(screen.getByRole('switch', { name: 'WhatsApp alerts' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Payments by WhatsApp' })).toBeDisabled();
  });

  it('shows the API text for a stale version and reloads on request', async () => {
    const api = await open(prefsRaw(), {
      'PUT /me/notification-preferences': err(409, 'STALE_VERSION') as never,
    });
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText(/changed somewhere else/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reload settings' }));
    await waitFor(() =>
      expect(
        api.calls.filter(c => c.path === '/me/notification-preferences' && c.method === 'GET').length,
      ).toBeGreaterThan(1),
    );
  });

  it('warns about a bounced e-mail address', async () => {
    await open(prefsRaw({ email: { address: 'r****@mail.in', bounced: true } }));
    expect(screen.getByText(/E-mail to r\*\*\*\*@mail.in bounced/)).toBeInTheDocument();
  });

  it('says so when this browser cannot receive push', async () => {
    await open();
    expect(await screen.findByText('This browser cannot receive push alerts.')).toBeInTheDocument();
  });
});

describe('Admin menu', () => {
  it('lists Notices and Surveys by permission and plan, and the notification pages for everyone', () => {
    const me = sampleMe({
      permissions: ['communication.notices.view', 'communication.surveys.view'],
      features: ['communication.surveys_with_analytics'],
    });
    setMe(me);
    const links = visibleAdminNav(me).flatMap(g => g.items.map(i => i.href));
    expect(links).toEqual(
      expect.arrayContaining([
        '/admin/notices',
        '/admin/surveys',
        '/admin/notifications',
        '/admin/settings/notifications',
      ]),
    );
    const bare = sampleMe({ permissions: ['communication.surveys.view'], features: [] });
    setMe(bare);
    const noPlan = visibleAdminNav(bare).flatMap(g => g.items.map(i => i.href));
    expect(noPlan).not.toContain('/admin/surveys');
    expect(
      visibleAdminNav(sampleMe({ permissions: [] })).flatMap(g => g.items.map(i => i.href)),
    ).not.toContain('/admin/notices');
    expect(ADMIN_NAV.some(g => g.title === 'Communication')).toBe(true);
  });

  it('renders the bell in the sidebar and the mobile header', async () => {
    signInAs(['communication.notices.view'], []);
    mockApi({ 'GET /notifications/unread-count': ok({ count: 2 }) });
    render(
      <ToastProvider>
        <AdminNav>x</AdminNav>
      </ToastProvider>,
    );
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: 'Notifications, 2 unread' })).toHaveLength(2),
    );
  });
});

const withUnread = (items: unknown[], unreadCount: number) => ({
  data: items,
  extra: { pagination: pagination(items.length), unreadCount },
});

describe('Inbox in the resident and platform apps', () => {
  it('lists items with the unread count, marks one read and opens its resident link', async () => {
    const api = mockApi({
      'GET /notifications': withUnread([notificationRaw({ deepLink: '/notices/12' })], 3),
      'POST /notifications/77120/read': ok(),
    });
    wrap(<NotificationsScreen app="RESIDENT" />);
    expect(await screen.findByText('3 unread')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Inbox' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Approval needed/ }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/resident/notices/12'));
    expect(api.last('POST', '/notifications/77120/read')).toBeTruthy();
  });
  it('marks all read and reloads', async () => {
    const api = mockApi({
      'GET /notifications': withUnread([notificationRaw()], 1),
      'POST /notifications/read-all': ok({ updated: 1 }),
    });
    wrap(<NotificationsScreen app="RESIDENT" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Mark all read' }));
    await waitFor(() => expect(api.last('POST', '/notifications/read-all')).toBeTruthy());
    await waitFor(() => expect(api.calls.filter(c => c.path === '/notifications')).toHaveLength(2));
  });
  it('the platform app uses the platform routes', async () => {
    const api = mockApi({
      'GET /platform/notifications': withUnread([], 0),
      'GET /platform/notifications/unread-count': ok({ count: 2 }),
    });
    wrap(<NotificationsScreen app="PLATFORM" />);
    expect(await screen.findByText('All caught up')).toBeInTheDocument();
    expect(api.calls[0].path).toBe('/platform/notifications');
    wrap(<NotificationBell app="PLATFORM" />);
    expect(await screen.findByRole('link', { name: 'Notifications, 2 unread' })).toHaveAttribute(
      'href',
      '/platform/notifications',
    );
  });
  it('the resident bell shows the unread count and links to the inbox', async () => {
    mockApi({ 'GET /notifications/unread-count': ok({ count: 4 }) });
    wrap(<NotificationBell app="RESIDENT" />);
    expect(await screen.findByRole('link', { name: 'Notifications, 4 unread' })).toHaveAttribute(
      'href',
      '/resident/inbox',
    );
  });
});

describe('Notification settings in the resident app', () => {
  const routes = (over: Record<string, never> = {}) => ({
    'GET /me/notification-preferences': ok(prefsRaw()),
    'GET /me/push-subscriptions': ok([]),
    ...over,
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'serviceWorker');
  });
  const stubPush = (subscribe = vi.fn()) => {
    vi.stubGlobal('PushManager', class {});
    vi.stubGlobal('Notification', { requestPermission: async () => 'granted' });
    const sub = {
      endpoint: 'https://fcm.googleapis.com/x',
      expirationTime: null,
      getKey: () => new Uint8Array(65).buffer,
      unsubscribe: async () => true,
    };
    subscribe.mockResolvedValue(sub);
    const reg = { pushManager: { getSubscription: async () => null, subscribe } };
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        register: vi.fn(async () => reg),
        ready: Promise.resolve(reg),
        getRegistration: async () => reg,
      },
      configurable: true,
    });
    return subscribe;
  };

  it('saves only switchable categories with the version', async () => {
    const api = mockApi(
      routes({ 'PUT /me/notification-preferences': ok(prefsRaw({ version: 5 })) as never }),
    );
    wrap(<NotificationSettingsScreen app="RESIDENT" />);
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Notices by SMS' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(api.last('PUT', '/me/notification-preferences')?.body).toMatchObject({
        version: 4,
        categories: { NOTICES: { PUSH: true, SMS: true, WHATSAPP: true, EMAIL: true } },
      }),
    );
  });
  it('turns push on for this device with the resident app name', async () => {
    stubPush();
    const api = mockApi(
      routes({
        'GET /public/push/vapid-public-key': ok({ publicKey: 'BAAA' }) as never,
        'POST /me/push-subscriptions': ok({ id: 9, status: 'ACTIVE' }) as never,
      }),
    );
    wrap(<NotificationSettingsScreen app="RESIDENT" />);
    await userEvent.click(await screen.findByRole('switch', { name: 'Push alerts on this device' }));
    await waitFor(() => expect(api.last('POST', '/me/push-subscriptions')).toBeTruthy());
    expect(api.last('POST', '/me/push-subscriptions')?.body).toMatchObject({
      endpoint: 'https://fcm.googleapis.com/x',
      app: 'RESIDENT',
    });
  });
  it('lists this device and other devices, sends a test and removes another device', async () => {
    stubPush();
    const sub = (id: number, isThisDevice: boolean, deviceLabel: string) => ({
      id,
      app: 'RESIDENT',
      deviceLabel,
      status: 'ACTIVE',
      createdAt: 'x',
      lastSuccessAt: null,
      isThisDevice,
    });
    const api = mockApi(
      routes({
        'GET /me/push-subscriptions': ok([sub(8, true, 'Pixel'), sub(9, false, 'Old laptop')]) as never,
        'POST /me/push-subscriptions/8/test': ok({ sent: true }) as never,
        'DELETE /me/push-subscriptions/9': ok(null) as never,
      }),
    );
    wrap(<NotificationSettingsScreen app="RESIDENT" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Send test' }));
    await waitFor(() => expect(api.last('POST', '/me/push-subscriptions/8/test')).toBeTruthy());
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(api.last('DELETE', '/me/push-subscriptions/9')).toBeTruthy());
  });
});

describe('Notification helpers', () => {
  it('maps the backend deep links per app', () => {
    expect(adminLink('/notices/12')).toBe('/admin/notices');
    expect(adminLink('/emergency/3')).toBe('/admin/emergency');
    expect(adminLink('/settings/notifications')).toBe('/admin/settings/notifications');
    expect(residentLink('/notices/12')).toBe('/resident/notices/12');
    expect(residentLink('/surveys/3')).toBe('/resident/surveys/3');
    expect(residentLink('/emergency/3')).toBe('/resident/emergency-alert');
    expect(residentLink('/settings/notifications')).toBe('/resident/notification-settings');
    expect(residentLink(null)).toBeNull();
    expect(linkFor('PLATFORM', '/reports/exports')).toBe('/reports/exports');
    expect(linkFor('PLATFORM', 'https://elsewhere.in')).toBeNull();
    expect(linkFor('RESIDENT', 'https://elsewhere.in')).toBeNull();
  });
  it('puts deep links under /admin once', () => {
    expect(adminLink('/approvals/77')).toBe('/admin/approvals/77');
    expect(adminLink('/admin/issues/4')).toBe('/admin/issues/4');
    expect(adminLink('issues/4')).toBe('/admin/issues/4');
    expect(adminLink('https://elsewhere.in')).toBeNull();
    expect(adminLink(null)).toBeNull();
  });
  it('builds the PUT body from the draft', () => {
    const p = mapPreferences(prefsRaw({ locale: 'hi-IN' }));
    const d = draftOf(p);
    expect(Object.keys(d.categories)).toEqual(['PAYMENTS', 'NOTICES']);
    expect(toBody(d, 4)).toMatchObject({
      version: 4,
      locale: 'hi-IN',
      quietHours: { mode: 'SOCIETY_DEFAULT' },
    });
    expect(quietProblem({ ...d, quietMode: 'CUSTOM', quietStart: '25:00', quietEnd: '07:00' })).toBeTruthy();
    expect(quietProblem({ ...d, quietMode: 'OFF' })).toBeNull();
  });
});
