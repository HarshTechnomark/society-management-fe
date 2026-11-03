import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast';
import { configureApiClient } from '@/lib/apiClient';
import { setMe } from '@/lib/auth';
import { member } from '@/test/accessFixtures';
import { err, mockApi, ok, resetAll, sampleMe } from '@/test/helpers';
import {
  COMMITTEE_FEATURES,
  COMMITTEE_PERMS,
  changesSummaryRaw,
  overviewRaw,
  planRaw,
  seatRaw,
  termRaw,
} from '@/test/committeeFixtures';
import { flat } from '@/test/residentsFixtures';
import { page } from '@/test/societyFixtures';
import { CommitteeTab } from './CommitteeTab';

type Routes = Parameters<typeof mockApi>[0];
const PREVIEW = 'POST /committee/terms/12/changes/preview';
const APPLY = 'POST /committee/terms/12/changes';

function renderIt(routes: Routes = {}, perms = COMMITTEE_PERMS, features = COMMITTEE_FEATURES) {
  setMe(sampleMe({ permissions: perms, features }));
  const api = mockApi({
    'GET /committee': ok(overviewRaw()),
    'GET /committee/terms/12': ok(termRaw()),
    'GET /members': ok(
      [
        member({
          userId: 61,
          name: 'Farhan Qureshi',
          locationLabel: 'C-601',
          role: { id: 1, key: 'owner', name: 'Owner' },
        }),
      ],
      'OK',
      page(1),
    ),
    'GET /residents/units': ok([flat({ unitId: 601, unitLabel: 'C-601' })], 'OK', page(1)),
    [PREVIEW]: ok(planRaw({ termId: 12, termVersion: 4 })),
    [APPLY]: ok({ ...termRaw({ version: 5 }), summary: changesSummaryRaw() }),
    ...routes,
  });
  render(
    <ToastProvider>
      <CommitteeTab />
    </ToastProvider>,
  );
  return api;
}

const openDialog = async (name = 'Make changes') => {
  await screen.findByText('Rajesh Kulkarni');
  await userEvent.click(screen.getByRole('button', { name }));
  return screen.findByRole('dialog');
};
const pickSeat = async (row: HTMLElement, seatName: RegExp | string) => {
  const sel = within(row).getByLabelText('Seat') as HTMLSelectElement;
  const opt = within(sel).getByRole('option', { name: seatName }) as HTMLOptionElement;
  fireEvent.change(sel, { target: { value: opt.value } });
};
const rowsOf = (d: HTMLElement) => within(d).getAllByTestId('change-row');

beforeEach(resetAll);

describe('Make changes: vacate and redesignate', () => {
  it('vacates a seat with a reason, previews, then applies with the hash and a reason', async () => {
    const api = renderIt();
    const d = await openDialog();
    await userEvent.click(within(d).getByRole('button', { name: 'Vacate a seat' }));
    const row = rowsOf(d)[0];
    await pickSeat(row, /Meera Iyer/);
    fireEvent.change(within(row).getByLabelText('Reason for leaving'), { target: { value: 'RESIGNED' } });
    await userEvent.type(within(row).getByLabelText('Note'), 'Moved abroad');
    await userEvent.click(within(d).getByRole('button', { name: 'Preview' }));
    expect(await within(d).findByTestId('change-summary')).toHaveTextContent(
      'Meera Iyer (Member) leaves the committee (Resigned).',
    );
    expect(api.last('POST', '/committee/terms/12/changes/preview')!.body).toMatchObject({
      version: 4,
      changes: [{ op: 'VACATE', seatId: 'S3', exitReason: 'RESIGNED', note: 'Moved abroad' }],
    });
    expect(within(d).getByRole('region', { name: 'Joining' })).toBeInTheDocument();
    await userEvent.click(within(d).getByRole('button', { name: 'Apply changes' }));
    expect(await within(d).findByText('Enter a reason of 5 to 500 characters.')).toBeInTheDocument();
    await userEvent.type(within(d).getByLabelText(/Reason/), 'Resignation letter received');
    await userEvent.click(within(d).getByRole('button', { name: 'Apply changes' }));
    expect(await within(d).findByTestId('changes-result')).toHaveTextContent('The committee is updated.');
    expect(api.last('POST', '/committee/terms/12/changes')!.body).toMatchObject({
      version: 4,
      previewHash: 'a'.repeat(64),
      reason: 'Resignation letter received',
      changes: [{ op: 'VACATE', seatId: 'S3', exitReason: 'RESIGNED' }],
    });
    await userEvent.click(within(d).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('shows skipped hand-over pairs after applying', async () => {
    renderIt({
      [APPLY]: ok({
        ...termRaw({ version: 5 }),
        summary: changesSummaryRaw({
          handoverDelegationsSkipped: [
            { designation: 'TREASURER', fromUserId: 22, toUserId: 64, skippedBecause: 'DELEGATION_OVERLAP' },
          ],
        }),
      }),
    });
    const d = await openDialog();
    await userEvent.click(within(d).getByRole('button', { name: 'Vacate a seat' }));
    await pickSeat(rowsOf(d)[0], /Meera Iyer/);
    await userEvent.click(within(d).getByRole('button', { name: 'Preview' }));
    await within(d).findByTestId('change-summary');
    await userEvent.type(within(d).getByLabelText(/Reason/), 'Resignation letter received');
    await userEvent.click(within(d).getByRole('button', { name: 'Apply changes' }));
    expect(await within(d).findByTestId('changes-result')).toHaveTextContent(
      'Hand-over was skipped for: Treasurer (a hand-over already runs for this person).',
    );
  });

  it('shows the backend message and the seat of a refused change set', async () => {
    renderIt({
      [PREVIEW]: err(422, 'COMMITTEE_CHANGE_INVALID', [
        { field: 'changes', message: 'Pick a different designation', seatIds: ['S3'] },
      ]),
    });
    const d = await openDialog();
    await userEvent.click(within(d).getByRole('button', { name: 'Vacate a seat' }));
    await pickSeat(rowsOf(d)[0], /Meera Iyer/);
    await userEvent.click(within(d).getByRole('button', { name: 'Preview' }));
    expect(await within(d).findByText(/Meera Iyer \(Member\)\./)).toHaveTextContent(
      'Seats: Meera Iyer (Member).',
    );
  });

  it('changes a designation and refuses the same designation', async () => {
    const api = renderIt();
    const d = await openDialog();
    await userEvent.click(within(d).getByRole('button', { name: 'Change designation' }));
    const row = rowsOf(d)[0];
    await pickSeat(row, /Meera Iyer/);
    fireEvent.change(within(row).getByLabelText('New designation'), { target: { value: 'MEMBER' } });
    await userEvent.click(within(d).getByRole('button', { name: 'Preview' }));
    expect(await within(d).findByText('Choose a different designation.')).toBeInTheDocument();
    fireEvent.change(within(row).getByLabelText('New designation'), { target: { value: 'TREASURER' } });
    await userEvent.click(within(d).getByRole('button', { name: 'Preview' }));
    expect(await within(d).findByTestId('change-summary')).toHaveTextContent(
      'Meera Iyer (Member) becomes Treasurer.',
    );
    expect(api.last('POST', '/committee/terms/12/changes/preview')!.body).toMatchObject({
      changes: [{ op: 'REDESIGNATE', seatId: 'S3', designation: 'TREASURER' }],
    });
  });

  it('requires a new chairman when the Chairman is vacated and offers to add one', async () => {
    const api = renderIt();
    const d = await openDialog();
    await userEvent.click(within(d).getByRole('button', { name: 'Vacate a seat' }));
    await pickSeat(rowsOf(d)[0], /Rajesh Kulkarni/);
    expect(await within(d).findByText(/the Chairman steps down/)).toBeInTheDocument();
    await userEvent.click(within(d).getByRole('button', { name: 'Preview' }));
    expect(
      await within(d).findByText('Pick the new chairman before the current one steps down.'),
    ).toBeInTheDocument();
    expect(api.last('POST', '/committee/terms/12/changes/preview')).toBeUndefined();
    await userEvent.click(within(d).getByRole('button', { name: 'Add a new chairman' }));
    expect(rowsOf(d)).toHaveLength(2);
    expect(within(rowsOf(d)[1]).getByLabelText('Designation')).toHaveValue('CHAIRMAN');
    expect(within(d).queryByText(/the Chairman steps down/)).toBeNull();
  });

  it('shows the server message when it still answers COMMITTEE_CHAIRMAN_REQUIRED', async () => {
    renderIt({ [PREVIEW]: err(422, 'COMMITTEE_CHAIRMAN_REQUIRED') });
    const d = await openDialog();
    await userEvent.click(within(d).getByRole('button', { name: 'Vacate a seat' }));
    await pickSeat(rowsOf(d)[0], /Meera Iyer/);
    await userEvent.click(within(d).getByRole('button', { name: 'Preview' }));
    expect(await within(d).findByRole('alert')).toHaveTextContent('Pick the new chairman');
  });

  it('checks the form before sending: no changes, no seat, the same seat twice', async () => {
    const api = renderIt();
    const d = await openDialog();
    await userEvent.click(within(d).getByRole('button', { name: 'Preview' }));
    expect(await within(d).findByText('Add at least one change.')).toBeInTheDocument();
    await userEvent.click(within(d).getByRole('button', { name: 'Vacate a seat' }));
    await userEvent.click(within(d).getByRole('button', { name: 'Change designation' }));
    await userEvent.click(within(d).getByRole('button', { name: 'Preview' }));
    expect(within(d).getAllByText('Choose the seat.')).toHaveLength(2);
    await pickSeat(rowsOf(d)[0], /Meera Iyer/);
    await pickSeat(rowsOf(d)[1], /Meera Iyer/);
    await userEvent.click(within(d).getByRole('button', { name: 'Preview' }));
    expect(await within(d).findByText('This seat is already in another change.')).toBeInTheDocument();
    expect(api.last('POST', '/committee/terms/12/changes/preview')).toBeUndefined();
  });
});

describe('Make changes: add (co-opt, nominate)', () => {
  const choose = async (row: HTMLElement) => {
    await userEvent.type(within(row).getByLabelText(/^Person/), 'Farhan');
    await userEvent.click(await within(row).findByRole('button', { name: 'Choose Farhan Qureshi' }));
    await userEvent.type(await within(row).findByLabelText('Search flat'), 'C-6');
    await waitFor(() => expect(within(row).getByRole('option', { name: 'C-601' })).toBeInTheDocument());
    await userEvent.selectOptions(within(row).getByLabelText('Flat'), 'C-601');
  };

  it('fills a vacancy from its Fill button with the designation preset', async () => {
    const api = renderIt();
    const d = await openDialog('Fill Vacant: Treasurer');
    const row = rowsOf(d)[0];
    expect(within(row).getByLabelText('Designation')).toHaveValue('TREASURER');
    expect(within(row).getByLabelText('How they join')).toHaveValue('CO_OPTED');
    await userEvent.click(within(d).getByRole('button', { name: 'Preview' }));
    expect(await within(d).findByText('Choose the person.')).toBeInTheDocument();
    expect(within(d).getByText('Enter the resolution reference (3 to 100 characters).')).toBeInTheDocument();
    await choose(row);
    await userEvent.type(within(row).getByLabelText(/Resolution reference/), 'CM/2026-27/14');
    await userEvent.click(within(d).getByRole('button', { name: 'Preview' }));
    expect(await within(d).findByTestId('change-summary')).toHaveTextContent(
      'Farhan Qureshi joins as Treasurer (Co-opted).',
    );
    expect(api.last('POST', '/committee/terms/12/changes/preview')!.body).toMatchObject({
      changes: [
        {
          op: 'ADD',
          userId: 61,
          designation: 'TREASURER',
          joinMode: 'CO_OPTED',
          unitId: 601,
          resolutionRef: 'CM/2026-27/14',
        },
      ],
    });
  });

  it('nominates a member through Make changes and does not need a resolution for an appointment', async () => {
    const api = renderIt();
    const d = await openDialog();
    await userEvent.click(within(d).getByRole('button', { name: 'Add a member' }));
    const row = rowsOf(d)[0];
    await choose(row);
    fireEvent.change(within(row).getByLabelText('How they join'), { target: { value: 'APPOINTED' } });
    await userEvent.click(within(d).getByRole('button', { name: 'Preview' }));
    await within(d).findByTestId('change-summary');
    expect(api.last('POST', '/committee/terms/12/changes/preview')!.body).toMatchObject({
      changes: [{ op: 'ADD', joinMode: 'APPOINTED', designation: 'MEMBER' }],
    });
  });

  it.each([
    ['COMMITTEE_STRENGTH_INVALID', 422, /number of seats is not valid/],
    ['COMMITTEE_COOPTION_NOT_ALLOWED', 422, /do not allow co-opting/],
    ['COMMITTEE_ROLE_CONFLICT', 422, /staff or custom role/],
    ['USAGE_LIMIT_EXCEEDED', 402, /staff seats are used/],
    ['COMMITTEE_HOLDER_INELIGIBLE', 422, /Only flat owners/],
  ])('shows %s from the preview in plain words', async (code, status, text) => {
    renderIt({ [PREVIEW]: err(status, code) });
    const d = await openDialog('Fill Vacant: Treasurer');
    const row = rowsOf(d)[0];
    await choose(row);
    await userEvent.type(within(row).getByLabelText(/Resolution reference/), 'CM/1');
    await userEvent.click(within(d).getByRole('button', { name: 'Preview' }));
    expect(await within(d).findByRole('alert')).toHaveTextContent(text);
  });
});

describe('Make changes: preview states and apply', () => {
  const vacateAndPreview = async () => {
    const d = await openDialog();
    await userEvent.click(within(d).getByRole('button', { name: 'Vacate a seat' }));
    await pickSeat(rowsOf(d)[0], /Meera Iyer/);
    await userEvent.click(within(d).getByRole('button', { name: 'Preview' }));
    await within(d).findByTestId('change-summary');
    return d;
  };

  it('shows blockers in words and disables Apply', async () => {
    renderIt({
      [PREVIEW]: ok(
        planRaw({ blockers: [{ code: 'NO_FREE_SEAT', message: 'No staff seat is free for Meera.' }] }),
      ),
    });
    const d = await vacateAndPreview();
    expect(within(d).getByTestId('plan-blockers')).toHaveTextContent(
      'Cannot apply yet: No staff seat is free',
    );
    expect(within(d).getByTestId('plan-blockers')).toHaveTextContent(
      'How to fix: Free one staff seat or upgrade.',
    );
    expect(within(d).getByRole('button', { name: 'Apply changes' })).toBeDisabled();
  });

  it('reloads the plan with a notice when it went stale', async () => {
    const api = renderIt({
      [PREVIEW]: [ok(planRaw()), ok(planRaw({ previewHash: 'b'.repeat(64) }))],
      [APPLY]: [err(409, 'COMMITTEE_PREVIEW_STALE'), ok(termRaw({ version: 5 }))],
    });
    const d = await vacateAndPreview();
    await userEvent.type(within(d).getByLabelText(/Reason/), 'Resignation received');
    await userEvent.click(within(d).getByRole('button', { name: 'Apply changes' }));
    expect(
      await within(d).findByText('Something changed since you opened this. Review the updated plan.'),
    ).toBeInTheDocument();
    await waitFor(() => expect(api.calls.filter(c => c.path.endsWith('/changes/preview'))).toHaveLength(2));
    await userEvent.click(within(d).getByRole('button', { name: 'Apply changes' }));
    expect(await within(d).findByTestId('changes-result')).toBeInTheDocument();
    expect(api.last('POST', '/committee/terms/12/changes')!.body).toMatchObject({
      previewHash: 'b'.repeat(64),
    });
  });

  it('asks for a fresh sign in on apply and retries', async () => {
    const stepUp = vi.fn().mockResolvedValue(true);
    const api = renderIt({ [APPLY]: [err(401, 'REAUTH_REQUIRED'), ok(termRaw({ version: 5 }))] });
    configureApiClient({ stepUp });
    const d = await vacateAndPreview();
    await userEvent.type(within(d).getByLabelText(/Reason/), 'Resignation received');
    await userEvent.click(within(d).getByRole('button', { name: 'Apply changes' }));
    expect(await within(d).findByTestId('changes-result')).toBeInTheDocument();
    expect(stepUp).toHaveBeenCalledOnce();
    expect(api.calls.filter(c => c.path === '/committee/terms/12/changes')).toHaveLength(2);
  });

  it.each([
    ['LAST_CHAIRMAN', 409, /at least one active chairman/],
    ['COMMITTEE_SEAT_NOT_FOUND', 404, /not in the committee any more/],
    ['CANNOT_GRANT_UNHELD_PERMISSION', 403, /more access than yours/],
    ['STALE_VERSION', 409, /Someone else changed this/],
  ])('shows %s on apply in plain words', async (code, status, text) => {
    renderIt({ [APPLY]: err(status, code) });
    const d = await vacateAndPreview();
    await userEvent.type(within(d).getByLabelText(/Reason/), 'Resignation received');
    await userEvent.click(within(d).getByRole('button', { name: 'Apply changes' }));
    expect(await within(d).findByRole('alert')).toHaveTextContent(text);
    expect(within(d).getByRole('button', { name: 'Apply changes' })).toBeEnabled();
  });

  it('goes back to edit and keeps the rows', async () => {
    renderIt();
    const d = await vacateAndPreview();
    await userEvent.click(within(d).getByRole('button', { name: 'Back' }));
    expect(rowsOf(d)).toHaveLength(1);
  });

  it('closes without calling the server on Cancel', async () => {
    const api = renderIt();
    const d = await openDialog();
    await userEvent.click(within(d).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(api.calls.some(c => c.method === 'POST')).toBe(false);
  });
});

describe('Make changes: permission and plan gates', () => {
  it('hides Make changes and Fill without settings.members.edit', async () => {
    renderIt({}, ['settings.members.view']);
    await screen.findByText('Rajesh Kulkarni');
    expect(screen.queryByRole('button', { name: 'Make changes' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Fill/ })).toBeNull();
    expect(screen.getAllByTestId('vacant-seat').length).toBeGreaterThan(0);
  });

  it('disables Make changes with a visible reason when office bearers are not in the plan', async () => {
    renderIt({}, COMMITTEE_PERMS, ['governance.committee_terms']);
    await screen.findByText('Rajesh Kulkarni');
    expect(screen.getByRole('button', { name: 'Make changes' })).toBeDisabled();
    expect(screen.getAllByText(/Office bearers are not part of your plan/).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /Fill/ })).toBeNull();
  });

  it('keeps seats other than the seated ones out of the seat lists', async () => {
    renderIt({
      'GET /committee/terms/12': ok(
        termRaw({
          seats: [
            seatRaw(),
            seatRaw({ seatId: 'S9', userId: 19, name: 'Old Member', status: 'LEFT', designation: 'MEMBER' }),
          ],
        }),
      ),
    });
    const d = await openDialog();
    await userEvent.click(within(d).getByRole('button', { name: 'Vacate a seat' }));
    const sel = within(rowsOf(d)[0]).getByLabelText('Seat');
    expect(within(sel).queryByRole('option', { name: /Old Member/ })).toBeNull();
  });
});
