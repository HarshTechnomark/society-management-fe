import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamScreen } from '@/components/access/team/TeamScreen';
import { ToastProvider } from '@/components/ui/Toast';
import { setMe } from '@/lib/auth';
import { err, mockApi, ok, resetAll, sampleMe, search } from '@/test/helpers';
import {
  COMMITTEE_FEATURES,
  COMMITTEE_PERMS,
  currentRaw,
  draftRaw,
  draftTermRaw,
  listItemRaw,
  overviewRaw,
  termRaw,
} from '@/test/committeeFixtures';
import { page } from '@/test/societyFixtures';
import { CommitteeTab } from './CommitteeTab';

vi.mock('next/navigation', async () => (await import('@/test/helpers')).navigationMock());

type Routes = Parameters<typeof mockApi>[0];
function renderIt(routes: Routes = {}, perms = COMMITTEE_PERMS, features = COMMITTEE_FEATURES) {
  setMe(sampleMe({ permissions: perms, features }));
  const api = mockApi({
    'GET /committee': ok(overviewRaw()),
    'GET /committee/terms/12': ok(termRaw()),
    ...routes,
  });
  render(
    <ToastProvider>
      <CommitteeTab />
    </ToastProvider>,
  );
  return api;
}

beforeEach(resetAll);

describe('Committee tab: states and gates', () => {
  it('shows skeleton rows while loading', () => {
    renderIt();
    expect(screen.getAllByTestId('skeleton-row').length).toBeGreaterThan(0);
  });

  it('shows an error with the reference and retries', async () => {
    const api = renderIt({ 'GET /committee': [err(500, 'INTERNAL_ERROR'), ok(overviewRaw())] });
    expect(await screen.findByText('Reference:')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Managing Committee 2024-2029')).toBeInTheDocument();
    expect(api.calls.filter(c => c.path === '/committee')).toHaveLength(2);
  });

  it('shows the empty state with both actions for a user who can create', async () => {
    renderIt({ 'GET /committee': ok(overviewRaw({ current: null, banner: { code: 'NO_COMMITTEE' } })) });
    expect(await screen.findByText(/No committee recorded yet/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add committee' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Record a past committee' })).toBeInTheDocument();
  });

  it('offers Plan next committee when a current term exists and no draft', async () => {
    renderIt({ 'GET /committee': ok(overviewRaw({ draft: null })) });
    await screen.findByText('Rajesh Kulkarni');
    await userEvent.click(screen.getByRole('button', { name: 'Plan next committee' }));
    expect(await screen.findByRole('button', { name: /Save/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Back|Cancel/ })).toBeInTheDocument();
  });

  it('hides Plan next committee when a draft exists or create is not allowed', async () => {
    renderIt({ 'GET /committee': ok(overviewRaw({ draft: draftRaw() })) });
    await screen.findByText('Rajesh Kulkarni');
    expect(screen.queryByRole('button', { name: 'Plan next committee' })).toBeNull();
  });

  it('hides Plan next committee without settings.members.create', async () => {
    renderIt({ 'GET /committee': ok(overviewRaw({ draft: null })) }, ['settings.members.view']);
    await screen.findByText('Rajesh Kulkarni');
    expect(screen.queryByRole('button', { name: 'Plan next committee' })).toBeNull();
  });

  it('hides the create actions without settings.members.create', async () => {
    renderIt({ 'GET /committee': ok(overviewRaw({ current: null })) }, ['settings.members.view']);
    expect(await screen.findByText(/No committee recorded yet/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add committee' })).toBeNull();
  });

  it('shows the plan lock when the plan has no committee terms', async () => {
    renderIt({}, COMMITTEE_PERMS, []);
    expect(await screen.findByText(/Not (in|available in) your plan/)).toBeInTheDocument();
  });

  it('shows the current term card, seats in designation order, flags and vacancies', async () => {
    renderIt();
    expect(await screen.findByText('Managing Committee 2024-2029')).toBeInTheDocument();
    expect(await screen.findByText('Rajesh Kulkarni')).toBeInTheDocument();
    expect(screen.getByText('3 of 5 seats filled')).toBeInTheDocument();
    expect(screen.getByText('882 days left')).toBeInTheDocument();
    expect(screen.getByText('CM/2024-25/01')).toBeInTheDocument();
    expect(screen.getByText(/9 of 10 done/)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '9');
    const names = screen.getAllByTestId('seat-card').map(c => c.textContent ?? '');
    expect(names[0]).toContain('Rajesh Kulkarni');
    expect(names[1]).toContain('Arjun Shah');
    expect(names[2]).toContain('Meera Iyer');
    expect(names[2]).toContain('Co-opted');
    expect(names[1]).toContain('Check: Role does not match the seat');
    expect(names[0]).toContain('98XXXXX111');
    const vacant = screen.getAllByTestId('vacant-seat').map(v => v.textContent);
    expect(vacant[0]).toContain('Vacant: Treasurer');
    expect(vacant[1]).toContain('Vacant seat');
    expect(
      within(screen.getAllByTestId('vacant-seat')[0]).getByRole('button', { name: /Fill/ }),
    ).toBeEnabled();
  });

  it('shows the overdue chip and the caretaker banner', async () => {
    renderIt({
      'GET /committee': ok(
        overviewRaw({
          current: currentRaw({ status: 'EXPIRED', isOverdue: true, daysLeft: -4 }),
          banner: { code: 'CARETAKER', endedOn: '2029-03-31' },
        }),
      ),
    });
    expect(await screen.findByText('Overdue by 4 days')).toBeInTheDocument();
    expect(screen.getByText(/The committee continues as caretaker/)).toBeInTheDocument();
    expect(screen.getByText('Caretaker committee')).toBeInTheDocument();
  });

  it('shows the term ending banner', async () => {
    renderIt({
      'GET /committee': ok(overviewRaw({ banner: { code: 'TERM_ENDING', daysLeft: 28 } })),
    });
    expect(await screen.findByText('Term ends in 28 days. Plan the election.')).toBeInTheDocument();
  });
});

describe('Committee tab: edit term of the current committee', () => {
  it('sends only the changed fields with a reason when the end date is extended', async () => {
    const api = renderIt({ 'PATCH /committee/terms/12': ok(termRaw({ version: 5 })) });
    await screen.findByText('Rajesh Kulkarni');
    await userEvent.click(screen.getByRole('button', { name: 'Edit term' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('End date'), { target: { value: '2029-06-30' } });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await within(dialog).findByText('Enter a reason of 5 to 500 characters.')).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText(/Reason/), 'Elections are delayed');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.last('PATCH', '/committee/terms/12')).toBeTruthy());
    expect(api.last('PATCH', '/committee/terms/12')!.body).toEqual({
      version: 4,
      endDate: '2029-06-30',
      reason: 'Elections are delayed',
    });
    expect(await screen.findByText('The end date is extended.')).toBeInTheDocument();
  });

  it('refuses a strength below the filled seats', async () => {
    renderIt();
    await screen.findByText('Rajesh Kulkarni');
    await userEvent.click(screen.getByRole('button', { name: 'Edit term' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Strength/), { target: { value: '3' } });
    await userEvent.type(within(dialog).getByLabelText(/Reason/), 'Fewer seats now');
    fireEvent.change(within(dialog).getByLabelText(/Strength/), { target: { value: '2' } });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await within(dialog).findByText('Choose 3 to 25 seats.')).toBeInTheDocument();
  });

  it('shows a plain message when the server says the version is stale', async () => {
    renderIt({ 'PATCH /committee/terms/12': err(409, 'STALE_VERSION') });
    await screen.findByText('Rajesh Kulkarni');
    await userEvent.click(screen.getByRole('button', { name: 'Edit term' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.clear(within(dialog).getByLabelText('Name'));
    await userEvent.type(within(dialog).getByLabelText('Name'), 'New name for it');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await within(dialog).findByText(/Someone else changed this/)).toBeInTheDocument();
  });

  it('hides Edit term and Make changes without settings.members.edit', async () => {
    renderIt({}, ['settings.members.view']);
    await screen.findByText('Rajesh Kulkarni');
    expect(screen.queryByRole('button', { name: 'Edit term' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Make changes' })).toBeNull();
  });
});

describe('Committee tab: draft', () => {
  const withDraft = {
    'GET /committee': ok(overviewRaw({ draft: draftRaw() })),
    'GET /committee/terms/20': ok(draftTermRaw()),
  };

  it('shows the draft card with seats and its actions', async () => {
    renderIt(withDraft);
    expect(await screen.findByText('Managing Committee 2029-2034')).toBeInTheDocument();
    expect(await screen.findByText('Farhan Qureshi')).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(screen.getByText('Manual')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit draft' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Preview and activate' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Delete draft' })).toBeInTheDocument();
  });

  it('marks a draft from an election and offers to review it', async () => {
    renderIt({
      'GET /committee': ok(
        overviewRaw({
          draft: draftRaw({ source: 'ELECTION', electionId: 31 }),
          banner: { code: 'DRAFT_FROM_ELECTION', draftId: 20, electionId: 31 },
        }),
      ),
      'GET /committee/terms/20': ok(draftTermRaw({ source: 'ELECTION', electionId: 31 })),
    });
    expect(await screen.findByText('Election results are in. Review the new committee.')).toBeInTheDocument();
    expect(screen.getAllByText('From election').length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: 'Review the draft' }));
    expect(await screen.findByText('Elected members come from the election result.')).toBeInTheDocument();
  });

  it('deletes a draft with a reason and reloads', async () => {
    const api = renderIt({
      ...withDraft,
      'DELETE /committee/terms/20': { status: 204, data: null },
      'GET /committee': [ok(overviewRaw({ draft: draftRaw() })), ok(overviewRaw())],
    });
    await screen.findByText('Farhan Qureshi');
    await userEvent.click(screen.getByRole('button', { name: 'Delete draft' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/Reason/), 'Wrong dates entered');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete draft' }));
    await waitFor(() => expect(api.last('DELETE', '/committee/terms/20')).toBeTruthy());
    expect(api.last('DELETE', '/committee/terms/20')!.body).toEqual({
      version: 2,
      reason: 'Wrong dates entered',
    });
    await waitFor(() => expect(screen.queryByText('Farhan Qureshi')).toBeNull());
  });

  it('hides Delete draft without settings.members.delete', async () => {
    renderIt(withDraft, ['settings.members.view', 'settings.members.edit']);
    await screen.findByText('Farhan Qureshi');
    expect(screen.queryByRole('button', { name: 'Delete draft' })).toBeNull();
  });
});

describe('Committee history', () => {
  const ended = termRaw({
    id: 11,
    name: 'Managing Committee 2019-2024',
    status: 'ENDED',
    seats: [
      termRaw().seats[0],
      {
        ...termRaw().seats[1],
        status: 'LEFT',
        toDate: '2022-06-30',
        exitReason: 'RESIGNED',
        exitNote: 'Moved abroad',
      },
    ],
  });

  it('lists past terms newest first and opens a read-only detail with Left seats', async () => {
    const api = renderIt({
      'GET /committee/terms': ok([listItemRaw()], 'OK', page(1, 1, 10)),
      'GET /committee/terms/11': ok(ended),
    });
    await screen.findByText('Rajesh Kulkarni');
    await userEvent.click(screen.getByRole('button', { name: 'Past committees' }));
    expect(await screen.findByText('Managing Committee 2019-2024')).toBeInTheDocument();
    const q = api.fn.mock.calls.map(c => String(c[0])).find(u => u.includes('/committee/terms?'))!;
    expect(q).toContain('status=ENDED');
    expect(q).toContain('sortOrder=desc');
    const item = screen.getByTestId('history-item');
    expect(within(item).getByText('Chairman:')).toBeInTheDocument();
    expect(within(item).getByText('Manual')).toBeInTheDocument();
    const bearers = within(item)
      .getAllByRole('listitem')
      .map(l => l.textContent);
    expect(bearers).toEqual(['Chairman: Suresh Rao', 'Treasurer: Lata Menon']);
    await userEvent.click(screen.getByRole('button', { name: 'View Managing Committee 2019-2024' }));
    expect(await screen.findByText('Left the committee')).toBeInTheDocument();
    expect(screen.getByText(/Resigned: Moved abroad/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Back to past committees' }));
    expect(await screen.findByTestId('history-item')).toBeInTheDocument();
  });

  it('shows an empty state and goes back', async () => {
    renderIt({ 'GET /committee/terms': ok([], 'OK', page(0, 1, 10)) });
    await screen.findByText('Rajesh Kulkarni');
    await userEvent.click(screen.getByRole('button', { name: 'Past committees' }));
    expect(await screen.findByText('No past committees yet')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Back to committee' }));
    expect(await screen.findByText('Rajesh Kulkarni')).toBeInTheDocument();
  });

  it('shows an error for the list', async () => {
    renderIt({ 'GET /committee/terms': err(500, 'INTERNAL_ERROR') });
    await screen.findByText('Rajesh Kulkarni');
    await userEvent.click(screen.getByRole('button', { name: 'Past committees' }));
    expect(await screen.findByText('Reference:')).toBeInTheDocument();
  });
});

describe('Team screen tabs', () => {
  it('keeps the All tab and opens the Committee tab', async () => {
    setMe(sampleMe({ permissions: COMMITTEE_PERMS, features: COMMITTEE_FEATURES }));
    mockApi({
      'GET /members': ok([], 'OK', page(0)),
      'GET /invitations': ok([], 'OK', page(0)),
      'GET /roles': ok([], 'OK', page(0)),
      'GET /committee': ok(overviewRaw()),
      'GET /committee/terms/12': ok(termRaw()),
    });
    render(
      <ToastProvider>
        <TeamScreen />
      </ToastProvider>,
    );
    expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'true');
    await userEvent.click(screen.getByRole('tab', { name: 'Committee' }));
    expect(await screen.findByText('Rajesh Kulkarni')).toBeInTheDocument();
    expect(window.location.search).toContain('tab=committee');
    await userEvent.click(screen.getByRole('tab', { name: 'All' }));
    expect(window.location.search).not.toContain('tab=');
  });

  it('opens on the Committee tab from ?tab=committee', async () => {
    search.current = new URLSearchParams('tab=committee');
    setMe(sampleMe({ permissions: COMMITTEE_PERMS, features: COMMITTEE_FEATURES }));
    mockApi({ 'GET /committee': ok(overviewRaw()), 'GET /committee/terms/12': ok(termRaw()) });
    render(
      <ToastProvider>
        <TeamScreen />
      </ToastProvider>,
    );
    expect(await screen.findByText('Rajesh Kulkarni')).toBeInTheDocument();
  });

  it('does not show the committee to a user without settings.members.view', async () => {
    search.current = new URLSearchParams('tab=committee');
    setMe(sampleMe({ permissions: [], features: COMMITTEE_FEATURES }));
    mockApi({});
    render(
      <ToastProvider>
        <TeamScreen />
      </ToastProvider>,
    );
    expect(await screen.findByText('You do not have access to this page')).toBeInTheDocument();
  });
});
