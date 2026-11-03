import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast';
import { err, mockApi, navigationMock, ok, resetAll } from '@/test/helpers';
import { holiday, setting } from '@/test/setupFixtures';
import { signIn } from '@/test/setupHelpers';
import { HolidaysScreen } from './HolidaysScreen';

vi.mock('next/navigation', () => navigationMock());

const year = new Date().getFullYear();
const OFFICE = [
  setting('office.weeklyOffDays', { namespace: 'office', type: 'JSON', value: [0], version: 1, rules: {} }),
  setting('office.openTime', { namespace: 'office', type: 'TIME', value: '09:00', version: 0, rules: {} }),
  setting('office.closeTime', { namespace: 'office', type: 'TIME', value: '18:00', version: 0, rules: {} }),
];

function renderIt(routes: Parameters<typeof mockApi>[0] = {}, perms?: string[], features?: string[]) {
  signIn(perms, features);
  const api = mockApi({
    'GET /holidays': ok({ items: [holiday({ holidayDate: `${year}-11-08` })], weeklyOffDays: [0] }),
    'GET /society/settings': ok({ items: OFFICE }),
    ...routes,
  });
  render(
    <ToastProvider>
      <HolidaysScreen />
    </ToastProvider>,
  );
  return api;
}

describe('Holidays (11.9)', () => {
  beforeEach(resetAll);

  it('lists holidays with type and office closed chip', async () => {
    renderIt();
    const table = await screen.findByRole('table', { name: 'Holidays' });
    expect(within(table).getByText('Diwali (Lakshmi Puja)')).toBeInTheDocument();
    expect(within(table).getByText('Festival')).toBeInTheDocument();
    expect(within(table).getByText('Closed')).toBeInTheDocument();
  });

  it('shows the empty state and the error state', async () => {
    renderIt({ 'GET /holidays': ok({ items: [], weeklyOffDays: [0] }) });
    expect(await screen.findByText(`No holidays in ${year}`)).toBeInTheDocument();
  });

  it('shows the error with its reference', async () => {
    renderIt({ 'GET /holidays': err(500, 'INTERNAL_ERROR') });
    expect((await screen.findAllByText('req_test')).length).toBeGreaterThan(0);
  });

  it('loads another year', async () => {
    const api = renderIt();
    await screen.findByRole('table', { name: 'Holidays' });
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Year' }), String(year + 1));
    await waitFor(() => expect(api.calls.filter(c => c.path === '/holidays').length).toBe(2));
  });

  it('adds a holiday', async () => {
    const api = renderIt({ 'POST /holidays': ok(holiday()) });
    await userEvent.click(await screen.findByRole('button', { name: 'Add holiday' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.type(within(dlg).getByRole('textbox', { name: 'Name' }), 'Society day');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Add holiday' }));
    await waitFor(() => expect(api.last('POST', '/holidays')).toBeTruthy());
    expect(api.last('POST', '/holidays')!.body).toMatchObject({
      name: 'Society day',
      holidayType: 'SOCIETY',
      isOfficeClosed: true,
    });
  });

  it('shows HOLIDAY_DATE_TAKEN', async () => {
    renderIt({ 'POST /holidays': err(409, 'HOLIDAY_DATE_TAKEN') });
    await userEvent.click(await screen.findByRole('button', { name: 'Add holiday' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.type(within(dlg).getByRole('textbox', { name: 'Name' }), 'Another');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Add holiday' }));
    expect(await screen.findByText('This date is already a holiday.')).toBeInTheDocument();
  });

  it('adds suggested holidays in bulk and skips those already added', async () => {
    const api = renderIt({
      'GET /holidays/suggestions': ok({
        items: [
          {
            holidayDate: `${year}-01-26`,
            name: 'Republic Day',
            holidayType: 'NATIONAL',
            alreadyAdded: false,
          },
          {
            holidayDate: `${year}-08-15`,
            name: 'Independence Day',
            holidayType: 'NATIONAL',
            alreadyAdded: true,
          },
        ],
      }),
      'POST /holidays/bulk': ok({ created: 1, skipped: [] }),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Add suggested holidays' }));
    const dlg = await screen.findByRole('dialog');
    expect(await within(dlg).findByRole('checkbox', { name: /Independence Day/ })).toBeDisabled();
    await userEvent.click(within(dlg).getByRole('checkbox', { name: /Republic Day/ }));
    await userEvent.click(within(dlg).getByRole('button', { name: 'Add selected (1)' }));
    await waitFor(() => expect(api.last('POST', '/holidays/bulk')).toBeTruthy());
    expect(api.last('POST', '/holidays/bulk')!.body).toEqual({
      items: [
        { holidayDate: `${year}-01-26`, name: 'Republic Day', holidayType: 'NATIONAL', isOfficeClosed: true },
      ],
    });
  });

  it('reads suggestions the way the API sends them (date, not holidayDate)', async () => {
    const api = renderIt({
      'GET /holidays/suggestions': ok({
        items: [
          {
            date: `${year}-01-26`,
            name: 'Republic Day',
            holidayType: 'NATIONAL',
            isOfficeClosed: true,
            alreadyAdded: false,
          },
        ],
      }),
      'POST /holidays/bulk': ok({ created: 1, skipped: [] }),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Add suggested holidays' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.click(await within(dlg).findByRole('checkbox', { name: /Republic Day/ }));
    await userEvent.click(within(dlg).getByRole('button', { name: 'Add selected (1)' }));
    await waitFor(() => expect(api.last('POST', '/holidays/bulk')).toBeTruthy());
    expect(api.last('POST', '/holidays/bulk')!.body).toEqual({
      items: [
        { holidayDate: `${year}-01-26`, name: 'Republic Day', holidayType: 'NATIONAL', isOfficeClosed: true },
      ],
    });
  });

  it('deletes a holiday after confirmation', async () => {
    const api = renderIt({ 'DELETE /holidays/1': { status: 204 } });
    await userEvent.click(await screen.findByRole('button', { name: 'Delete Diwali (Lakshmi Puja)' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(api.last('DELETE', '/holidays/1')).toBeTruthy());
  });

  it('saves weekly off days and office hours through office.* settings', async () => {
    const api = renderIt({ 'PATCH /society/settings': ok({ items: [] }) });
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Saturday' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save office hours' }));
    await waitFor(() => expect(api.last('PATCH', '/society/settings')).toBeTruthy());
    expect(api.last('PATCH', '/society/settings')!.body).toEqual({
      changes: [{ key: 'office.weeklyOffDays', value: [0, 6], version: 1 }],
    });
  });

  it('allows at most two weekly off days', async () => {
    renderIt();
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Saturday' }));
    expect(screen.getByRole('checkbox', { name: 'Monday' })).toBeDisabled();
  });

  it('is read only without the edit permission', async () => {
    renderIt({}, ['settings.society.view']);
    await screen.findByRole('table', { name: 'Holidays' });
    expect(screen.queryByRole('button', { name: 'Add holiday' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Delete Diwali/ })).not.toBeInTheDocument();
    expect(await screen.findByRole('checkbox', { name: 'Sunday' })).toBeDisabled();
  });

  it('shows the plan lock without property.society_settings', async () => {
    renderIt({}, undefined, []);
    expect(await screen.findByText('Not available in your plan')).toBeInTheDocument();
  });
});
