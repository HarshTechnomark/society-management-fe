import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast';
import { setMe } from '@/lib/auth';
import { member } from '@/test/accessFixtures';
import { err, mockApi, ok, resetAll, sampleMe } from '@/test/helpers';
import {
  COMMITTEE_FEATURES,
  COMMITTEE_PERMS,
  draftRaw,
  draftTermRaw,
  overviewRaw,
  seatRaw,
  termRaw,
} from '@/test/committeeFixtures';
import { flat } from '@/test/residentsFixtures';
import { page } from '@/test/societyFixtures';
import { CommitteeTab } from './CommitteeTab';

type Routes = Parameters<typeof mockApi>[0];
const EMPTY = { 'GET /committee': ok(overviewRaw({ current: null })) };
function renderIt(routes: Routes = {}) {
  setMe(sampleMe({ permissions: COMMITTEE_PERMS, features: COMMITTEE_FEATURES }));
  const api = mockApi({
    ...EMPTY,
    'GET /members': ok(
      [
        member({
          userId: 11,
          name: 'Rajesh Kulkarni',
          locationLabel: 'A-501',
          role: { id: 1, key: 'owner', name: 'Owner' },
        }),
        member({ userId: 55, name: 'Dev Shah', role: { id: 2, key: 'accountant', name: 'Accountant' } }),
        member({ userId: 66, name: 'Gone Away', status: 'SUSPENDED' }),
      ],
      'OK',
      page(3),
    ),
    'GET /residents/units': ok([flat({ unitId: 501, unitLabel: 'A-501' })], 'OK', page(1)),
    ...routes,
  });
  render(
    <ToastProvider>
      <CommitteeTab />
    </ToastProvider>,
  );
  return api;
}

const openNew = async () => {
  await userEvent.click(await screen.findByRole('button', { name: 'Add committee' }));
  return screen.findByRole('form', { name: 'Add committee' });
};
const fillTerm = async (form: HTMLElement) => {
  await userEvent.type(within(form).getByLabelText(/^Name/), 'Managing Committee 2026-2031');
  fireEvent.change(within(form).getByLabelText(/Start date/), { target: { value: '2026-04-01' } });
  fireEvent.change(within(form).getByLabelText(/End date/), { target: { value: '2031-03-31' } });
};
const pickHolder = async (row: HTMLElement, text: string, name: string) => {
  await userEvent.type(within(row).getByLabelText(/^(Person|Change person)/), text);
  await userEvent.click(await within(row).findByRole('button', { name: `Choose ${name}` }));
};

beforeEach(resetAll);

describe('Term editor: new committee', () => {
  it('checks the form before sending and shows inline errors', async () => {
    const api = renderIt();
    const form = await openNew();
    await userEvent.click(within(form).getByRole('button', { name: 'Save draft committee' }));
    expect(await within(form).findByText('Check the highlighted fields.')).toBeInTheDocument();
    expect(within(form).getByText('Enter a name of 3 to 120 characters.')).toBeInTheDocument();
    expect(within(form).getByText('Choose the start date.')).toBeInTheDocument();
    expect(within(form).getByText('Choose the person.')).toBeInTheDocument();
    expect(api.last('POST', '/committee/terms')).toBeUndefined();
  });

  it('searches a holder, picks the flat and saves the draft with the spec body', async () => {
    const api = renderIt({ 'POST /committee/terms': { status: 201, data: draftTermRaw() } });
    const form = await openNew();
    await fillTerm(form);
    const row = within(form).getByTestId('seat-row');
    await pickHolder(row, 'raj', 'Rajesh Kulkarni');
    expect(within(row).getByText('Now: Owner')).toBeInTheDocument();
    await userEvent.type(within(row).getByLabelText('Search flat'), 'A-5');
    await waitFor(() => expect(within(row).getByRole('option', { name: 'A-501' })).toBeInTheDocument());
    await userEvent.selectOptions(within(row).getByLabelText('Flat'), 'A-501');
    await userEvent.click(within(row).getByLabelText('Legal'));
    await userEvent.click(within(form).getByRole('button', { name: 'Save draft committee' }));
    await waitFor(() => expect(api.last('POST', '/committee/terms')).toBeTruthy());
    expect(api.last('POST', '/committee/terms')!.body).toEqual({
      name: 'Managing Committee 2026-2031',
      kind: 'ELECTED',
      source: 'MANUAL',
      startDate: '2026-04-01',
      endDate: '2031-03-31',
      strength: 5,
      seats: [
        {
          userId: 11,
          designation: 'CHAIRMAN',
          joinMode: 'ELECTED',
          unitId: expect.any(Number),
          portfolios: ['LEGAL'],
          showOnResidentPage: true,
          replaceExistingRole: false,
        },
      ],
    });
    expect(await screen.findByText('Draft committee saved.')).toBeInTheDocument();
  });

  it('shows "Replace current role" only for a staff role and sends it', async () => {
    const api = renderIt({ 'POST /committee/terms': { status: 201, data: draftTermRaw() } });
    const form = await openNew();
    await fillTerm(form);
    const row = within(form).getByTestId('seat-row');
    await pickHolder(row, 'raj', 'Rajesh Kulkarni');
    expect(within(row).queryByLabelText(/Replace current role/)).toBeNull();
    await pickHolder(row, 'dev', 'Dev Shah');
    const box = within(row).getByLabelText(/Replace current role/);
    expect(
      within(row).getByText(/Their Accountant access ends while they are on the committee/),
    ).toBeInTheDocument();
    await userEvent.click(box);
    await userEvent.type(within(row).getByLabelText('Search flat'), 'A-5');
    await waitFor(() => expect(within(row).getByRole('option', { name: 'A-501' })).toBeInTheDocument());
    await userEvent.selectOptions(within(row).getByLabelText('Flat'), 'A-501');
    await userEvent.click(within(form).getByRole('button', { name: 'Save draft committee' }));
    await waitFor(() => expect(api.last('POST', '/committee/terms')).toBeTruthy());
    const body = api.last('POST', '/committee/terms')!.body as { seats: Record<string, unknown>[] };
    expect(body.seats[0]).toMatchObject({ userId: 55, replaceExistingRole: true });
  });

  it('does not let a suspended member be chosen', async () => {
    renderIt();
    const form = await openNew();
    const row = within(form).getByTestId('seat-row');
    await userEvent.type(within(row).getByLabelText('Person'), 'gone');
    expect(await within(row).findByRole('button', { name: 'Choose Gone Away' })).toBeDisabled();
  });

  it('adds and removes seats and stops adding at the strength', async () => {
    renderIt();
    const form = await openNew();
    fireEvent.change(within(form).getByLabelText(/Strength/), { target: { value: '3' } });
    const add = within(form).getByRole('button', { name: 'Add seat' });
    await userEvent.click(add);
    await userEvent.click(add);
    expect(within(form).getAllByTestId('seat-row')).toHaveLength(3);
    expect(add).toBeDisabled();
    await userEvent.click(within(form).getByRole('button', { name: 'Remove seat 3' }));
    expect(within(form).getAllByTestId('seat-row')).toHaveLength(2);
    expect(add).toBeEnabled();
  });

  it.each([
    ['COMMITTEE_DESIGNATION_DUPLICATE', 'Only one Chairman, Secretary and Treasurer per committee.'],
    ['COMMITTEE_HOLDER_NOT_MEMBER', 'Not on the app yet. Invite them as a resident first.'],
    ['COMMITTEE_HOLDER_INELIGIBLE', 'Only flat owners can be on the committee.'],
    ['COMMITTEE_TERM_DATES_INVALID', 'The dates are not valid'],
    ['COMMITTEE_STRENGTH_INVALID', 'The number of seats is not valid'],
  ])('maps %s to plain words', async (code, text) => {
    renderIt({ 'POST /committee/terms': err(422, code, [{ field: 'seats[0]', message: 'x' }]) });
    const form = await openNew();
    await fillTerm(form);
    const row = within(form).getByTestId('seat-row');
    await pickHolder(row, 'raj', 'Rajesh Kulkarni');
    await userEvent.type(within(row).getByLabelText('Search flat'), 'A-5');
    await waitFor(() => expect(within(row).getByRole('option', { name: 'A-501' })).toBeInTheDocument());
    await userEvent.selectOptions(within(row).getByLabelText('Flat'), 'A-501');
    await userEvent.click(within(form).getByRole('button', { name: 'Save draft committee' }));
    expect((await within(form).findAllByText(new RegExp(text.replace('.', '\\.')))).length).toBeGreaterThan(
      0,
    );
  });

  it('offers the existing draft when one already exists', async () => {
    renderIt({
      'POST /committee/terms': err(409, 'COMMITTEE_DRAFT_EXISTS', [{ field: 'termId', message: '20' }]),
      'GET /committee/terms/20': ok(draftTermRaw()),
    });
    const form = await openNew();
    await fillTerm(form);
    const row = within(form).getByTestId('seat-row');
    await pickHolder(row, 'raj', 'Rajesh Kulkarni');
    await userEvent.type(within(row).getByLabelText('Search flat'), 'A-5');
    await waitFor(() => expect(within(row).getByRole('option', { name: 'A-501' })).toBeInTheDocument());
    await userEvent.selectOptions(within(row).getByLabelText('Flat'), 'A-501');
    await userEvent.click(within(form).getByRole('button', { name: 'Save draft committee' }));
    await userEvent.click(await within(form).findByRole('button', { name: 'Open the existing draft' }));
    expect(await screen.findByRole('form', { name: 'Edit draft committee' })).toBeInTheDocument();
    expect(await screen.findByDisplayValue('Managing Committee 2029-2034')).toBeInTheDocument();
  });

  it('cancel returns to the tab', async () => {
    renderIt();
    const form = await openNew();
    await userEvent.click(within(form).getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByText(/No committee recorded yet/)).toBeInTheDocument();
  });
});

describe('Term editor: past committee', () => {
  it('records names without roles or flats and needs a resolution reference', async () => {
    const api = renderIt({
      'POST /committee/terms': { status: 201, data: termRaw({ status: 'ENDED', source: 'HISTORICAL' }) },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Record a past committee' }));
    const form = await screen.findByRole('form', { name: 'Record a past committee' });
    expect(within(form).queryByLabelText('Search flat')).toBeNull();
    expect(within(form).queryByLabelText(/Replace current role/)).toBeNull();
    await userEvent.type(within(form).getAllByLabelText(/^Name/)[0], 'Managing Committee 2019-2024');
    fireEvent.change(within(form).getByLabelText(/Start date/), { target: { value: '2019-04-01' } });
    fireEvent.change(within(form).getByLabelText(/End date/), { target: { value: '2024-03-31' } });
    await userEvent.type(within(form).getByLabelText('Name of the member'), 'Suresh Rao');
    await userEvent.click(within(form).getByRole('button', { name: 'Save past committee' }));
    expect(
      await within(form).findByText('Enter the resolution reference (3 to 100 characters).'),
    ).toBeInTheDocument();
    await userEvent.type(within(form).getByLabelText(/Resolution reference/), 'GBM/2024/3');
    await userEvent.click(within(form).getByRole('button', { name: 'Save past committee' }));
    await waitFor(() => expect(api.last('POST', '/committee/terms')).toBeTruthy());
    expect(api.last('POST', '/committee/terms')!.body).toMatchObject({
      source: 'HISTORICAL',
      resolutionRef: 'GBM/2024/3',
      seats: [{ name: 'Suresh Rao', designation: 'CHAIRMAN' }],
    });
    expect(await screen.findByText('Past committee saved.')).toBeInTheDocument();
  });
});

describe('Term editor: edit a draft', () => {
  const draftRoutes = (term = draftTermRaw()) => ({
    'GET /committee': ok(overviewRaw({ draft: draftRaw({ source: term.source as string }) })),
    'GET /committee/terms/12': ok(termRaw()),
    'GET /committee/terms/20': ok(term),
  });

  it('loads the draft, keeps seat ids and sends the whole form in a PATCH with the version', async () => {
    const api = renderIt({ ...draftRoutes(), 'PATCH /committee/terms/20': ok(draftTermRaw({ version: 3 })) });
    await userEvent.click(await screen.findByRole('button', { name: 'Edit draft' }));
    const form = await screen.findByRole('form', { name: 'Edit draft committee' });
    await waitFor(() =>
      expect(within(form).getByDisplayValue('Managing Committee 2029-2034')).toBeInTheDocument(),
    );
    const name = within(form).getByLabelText(/^Name/);
    await userEvent.clear(name);
    await userEvent.type(name, 'Managing Committee 2029-2034 (new)');
    await userEvent.click(within(form).getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(api.last('PATCH', '/committee/terms/20')).toBeTruthy());
    const body = api.last('PATCH', '/committee/terms/20')!.body as Record<string, unknown>;
    expect(body).toMatchObject({ version: 2, name: 'Managing Committee 2029-2034 (new)', strength: 5 });
    expect((body.seats as Record<string, unknown>[])[0]).toMatchObject({
      seatId: 'S1',
      userId: 21,
      unitId: 601,
    });
    expect(await screen.findByText('Draft saved.')).toBeInTheDocument();
  });

  it('locks the holder of an election draft and does not allow adding or removing seats', async () => {
    renderIt(
      draftRoutes(
        draftTermRaw({
          source: 'ELECTION',
          seats: [
            seatRaw({ seatId: 'S1', name: 'Farhan Qureshi', status: 'PLANNED' }),
            seatRaw({
              seatId: 'S2',
              userId: 5,
              name: 'Lata Menon',
              designation: 'MEMBER',
              status: 'PLANNED',
            }),
          ],
        }),
      ),
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Edit draft' }));
    const form = await screen.findByRole('form', { name: 'Edit draft committee' });
    await within(form).findAllByTestId('seat-row');
    expect(within(form).getAllByText('Elected members come from the election result.').length).toBe(2);
    expect(within(form).queryByLabelText('Person')).toBeNull();
    expect(within(form).queryByRole('button', { name: 'Add seat' })).toBeNull();
    expect(within(form).queryByRole('button', { name: /Remove seat/ })).toBeNull();
  });

  it('shows COMMITTEE_ELECTED_SEATS_LOCKED and STALE_VERSION in plain words', async () => {
    renderIt({
      ...draftRoutes(),
      'PATCH /committee/terms/20': [err(422, 'COMMITTEE_ELECTED_SEATS_LOCKED'), err(409, 'STALE_VERSION')],
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Edit draft' }));
    const form = await screen.findByRole('form', { name: 'Edit draft committee' });
    await within(form).findAllByTestId('seat-row');
    await userEvent.click(within(form).getByRole('button', { name: 'Save draft' }));
    expect(
      await within(form).findByText(/Elected members come from the election result and cannot/),
    ).toBeInTheDocument();
    await userEvent.click(within(form).getByRole('button', { name: 'Save draft' }));
    expect(await within(form).findByText(/Someone else changed this/)).toBeInTheDocument();
  });

  it('shows an error when the draft cannot be loaded', async () => {
    renderIt({
      ...draftRoutes(),
      'GET /committee/terms/20': [ok(draftTermRaw()), err(404, 'COMMITTEE_TERM_NOT_FOUND')],
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Edit draft' }));
    expect(await screen.findByText('Reference:')).toBeInTheDocument();
  });
});
