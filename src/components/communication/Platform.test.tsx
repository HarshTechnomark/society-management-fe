import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { err, mockApi, sampleMe, navigationMock, ok, resetAll } from '@/test/helpers';
import { ToastProvider } from '@/components/ui/Toast';
import { PLATFORM_COMM_PERMS, templateRaw } from '@/test/communicationResidentFixtures';
import { setMe } from '@/lib/auth';
import { DeliveriesScreen } from './platform/DeliveriesScreen';
import { TemplateDrawer, patchOf } from './platform/TemplateDrawer';
import { TemplatesScreen } from './platform/TemplatesScreen';
import { mapTemplateDetail } from '@/services/platformCommunicationMappers';

vi.mock('next/navigation', () => navigationMock());
beforeEach(resetAll);

type Routes = Parameters<typeof mockApi>[0];
const page = { page: 1, limit: 50, total: 1, totalPages: 1 };
function show(ui: React.ReactElement, routes: Routes, perms = PLATFORM_COMM_PERMS) {
  setMe(sampleMe({ platformPermissions: perms, permissions: [] }));
  const api = mockApi(routes);
  render(<ToastProvider>{ui}</ToastProvider>);
  return api;
}

describe('patchOf', () => {
  const t = mapTemplateDetail(templateRaw());
  const form = (over: object = {}) => ({ ...t, whatsappParams: '', ...over });
  it('sends only what changed, empty text as null', () => {
    expect(patchOf(t, form())).toEqual({ version: 3 });
    expect(patchOf(t, form({ pushTitle: 'Hello' }))).toEqual({ version: 3, pushTitle: 'Hello' });
    expect(patchOf(t, form({ inAppBody: '' }))).toEqual({ version: 3, inAppBody: null });
    expect(patchOf(t, form({ whatsappParams: 'name, amount' }))).toEqual({
      version: 3,
      whatsappParams: ['name', 'amount'],
    });
  });
});

describe('Templates registry', () => {
  it('lists templates with registration chips and asks for the missing filter', async () => {
    const api = show(<TemplatesScreen />, {
      'GET /platform/notification-templates': ok([templateRaw()], 'OK', { pagination: page }),
    });
    expect(await screen.findByRole('button', { name: 'payments.receipt' })).toBeInTheDocument();
    expect(screen.getByText('No DLT')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Missing'), 'SMS_DLT');
    await waitFor(() =>
      expect(api.calls.filter(c => c.path === '/platform/notification-templates')).toHaveLength(2),
    );
    const urls = api.fn.mock.calls.map(c => String(c[0]));
    expect(urls.some(u => u.includes('missing=SMS_DLT'))).toBe(true);
  });
  it('is hidden without platform.settings.view', async () => {
    show(<TemplatesScreen />, {}, ['platform.health.view']);
    expect(await screen.findByText('You do not have access to templates')).toBeInTheDocument();
  });
  it('edits the SMS text, warns about the DLT id, previews and saves a minimal patch', async () => {
    const api = show(<TemplateDrawer id={5} canEdit onClose={() => {}} onSaved={() => {}} />, {
      'GET /platform/notification-templates/5': ok(templateRaw()),
      'PATCH /platform/notification-templates/5': ok(templateRaw({ version: 4, smsBody: 'Got {{amount}}.' })),
      'POST /platform/notification-templates/5/preview': ok({
        sms: { text: 'Got Rs 100.', segments: 1, encoding: 'GSM-7' },
        inApp: { title: 'Payment received', body: 'We received Rs 100.' },
      }),
    });
    await userEvent.click(await screen.findByRole('tab', { name: 'SMS' }));
    const sms = screen.getByLabelText('SMS text');
    await userEvent.clear(sms);
    await userEvent.type(sms, 'Got {{{{amount}}.');
    expect(screen.getByText(/enter its new DLT id/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Preview with sample data' }));
    expect(await screen.findByText(/Got Rs 100\./)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('DLT template id'), '110700001234');
    await userEvent.click(screen.getByRole('button', { name: 'Save template' }));
    await waitFor(() =>
      expect(api.last('PATCH', '/platform/notification-templates/5')?.body).toEqual({
        version: 3,
        smsBody: 'Got {{amount}}.',
        smsDltTemplateId: '110700001234',
      }),
    );
  });
  it('shows the server wording for an invalid template', async () => {
    show(<TemplateDrawer id={5} canEdit onClose={() => {}} onSaved={() => {}} />, {
      'GET /platform/notification-templates/5': ok(templateRaw()),
      'PATCH /platform/notification-templates/5': err(422, 'TEMPLATE_INVALID'),
    });
    await userEvent.type(await screen.findByLabelText('In-app title'), '!');
    await userEvent.click(screen.getByRole('button', { name: 'Save template' }));
    expect(await screen.findByText(/unknown placeholder/)).toBeInTheDocument();
  });
  it('shows the specific template error the server sends', async () => {
    show(<TemplateDrawer id={5} canEdit onClose={() => {}} onSaved={() => {}} />, {
      'GET /platform/notification-templates/5': ok(templateRaw()),
      'PATCH /platform/notification-templates/5': err(422, 'TEMPLATE_INVALID', [
        { field: 'smsBody', message: 'Unknown placeholder {{foo}}; SMS is 3 segments, the limit is 2.' },
      ]),
    });
    await userEvent.type(await screen.findByLabelText('In-app title'), '!');
    await userEvent.click(screen.getByRole('button', { name: 'Save template' }));
    expect(await screen.findByText(/Unknown placeholder \{\{foo\}\}; SMS is 3 segments/)).toBeInTheDocument();
  });
  it('shows legacy templates read only with a note and sends only DLT edits', async () => {
    const api = show(<TemplateDrawer id={5} canEdit onClose={() => {}} onSaved={() => {}} />, {
      'GET /platform/notification-templates/5': ok(
        templateRaw({ templateKey: 'access.grant_added', inAppTitle: null, inAppBody: null, smsBody: null }),
      ),
      'PATCH /platform/notification-templates/5': ok(templateRaw()),
    });
    expect(await screen.findByText(/Legacy template: the text is fixed in code/)).toBeInTheDocument();
    expect(screen.getByLabelText('In-app title')).toBeDisabled();
    expect(screen.getByLabelText('In-app body')).toBeDisabled();
    await userEvent.click(screen.getByRole('tab', { name: 'SMS' }));
    expect(screen.getByLabelText('SMS text')).toBeDisabled();
    await userEvent.type(screen.getByLabelText('DLT template id'), '110700001234');
    await userEvent.click(screen.getByRole('button', { name: 'Save template' }));
    await waitFor(() =>
      expect(api?.last('PATCH', '/platform/notification-templates/5')?.body).toEqual({
        version: 3,
        smsDltTemplateId: '110700001234',
      }),
    );
  });
  it('counts SMS segments live while typing', async () => {
    show(<TemplateDrawer id={5} canEdit onClose={() => {}} onSaved={() => {}} />, {
      'GET /platform/notification-templates/5': ok(templateRaw()),
    });
    await userEvent.click(await screen.findByRole('tab', { name: 'SMS' }));
    const box = screen.getByLabelText('SMS text');
    await userEvent.clear(box);
    await userEvent.type(box, 'नमस्ते');
    expect(screen.getByText(/6 characters · 1 segment \(UCS-2\)/)).toBeInTheDocument();
  });
  it('is read only without platform.settings.edit', async () => {
    show(<TemplateDrawer id={5} canEdit={false} onClose={() => {}} onSaved={() => {}} />, {
      'GET /platform/notification-templates/5': ok(templateRaw()),
    });
    expect(await screen.findByLabelText('In-app title')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save template' })).toBeNull();
  });
});

describe('Deliveries', () => {
  const row = {
    id: 1,
    societyId: 4,
    templateKey: 'payments.receipt',
    channel: 'SMS',
    destinationMasked: '98XXXXX111',
    status: 'FAILED',
    skipReason: null,
    attempts: 3,
    providerKey: 'msg91',
    lastErrorCode: 'DLT_REJECTED',
    limitBypassed: false,
    createdAt: '2026-11-18T05:00:00.000Z',
    sentAt: null,
    deliveredAt: null,
  };
  it('searches by recipient and shows masked destinations without message text', async () => {
    const api = show(<DeliveriesScreen />, {
      'GET /platform/notification-deliveries': ok([row], 'OK', { pagination: page }),
    });
    expect(await screen.findByText('98XXXXX111')).toBeInTheDocument();
    expect(screen.getByText('DLT_REJECTED')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Recipient'), '9820011111');
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(api.calls).toHaveLength(2));
    expect(String(api.fn.mock.calls[1][0])).toContain('recipient=9820011111');
  });
  it('needs platform.health.view', async () => {
    show(<DeliveriesScreen />, {}, ['platform.settings.view']);
    expect(await screen.findByText('You do not have access to the delivery log')).toBeInTheDocument();
  });
});
