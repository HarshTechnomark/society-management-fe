import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast';
import { configureApiClient } from '@/lib/apiClient';
import { setMe } from '@/lib/auth';
import { err, mockApi, ok, resetAll, sampleMe } from '@/test/helpers';
import {
  COMMITTEE_FEATURES,
  COMMITTEE_PERMS,
  activationRaw,
  draftRaw,
  draftTermRaw,
  overviewRaw,
  planRaw,
  termRaw,
} from '@/test/committeeFixtures';
import { CommitteeTab } from './CommitteeTab';

type Routes = Parameters<typeof mockApi>[0];
function renderIt(routes: Routes = {}, perms = COMMITTEE_PERMS, features = COMMITTEE_FEATURES) {
  setMe(sampleMe({ permissions: perms, features }));
  const api = mockApi({
    'GET /committee': ok(overviewRaw({ draft: draftRaw() })),
    'GET /committee/terms/12': ok(termRaw()),
    'GET /committee/terms/20': ok(draftTermRaw({ startDate: '2026-04-01' })),
    'GET /committee/terms/20/activation-preview': ok(planRaw()),
    ...routes,
  });
  render(
    <ToastProvider>
      <CommitteeTab />
    </ToastProvider>,
  );
  return api;
}

const open = async () => {
  await userEvent.click(await screen.findByRole('button', { name: 'Preview and activate' }));
  return screen.findByRole('dialog');
};
const fillConfirm = async (d: HTMLElement) => {
  await userEvent.type(within(d).getByLabelText(/Resolution reference/), 'CM/2029-30/01');
  await userEvent.type(within(d).getByLabelText(/^Reason/), 'New committee elected');
};

beforeEach(resetAll);

describe('Activation wizard: step 1, what will change', () => {
  it('shows skeleton rows while the preview loads', async () => {
    renderIt();
    fireEvent.click(await screen.findByRole('button', { name: 'Preview and activate' }));
    expect(screen.getAllByTestId('skeleton-row').length).toBeGreaterThan(0);
    expect(await screen.findByRole('region', { name: 'Joining' })).toBeInTheDocument();
  });

  it('groups people as Joining, Continuing and Leaving with role now and role after', async () => {
    renderIt();
    const d = await open();
    expect(await within(d).findByRole('region', { name: 'Joining' })).toBeInTheDocument();
    const rows = within(d)
      .getAllByTestId('plan-row')
      .map(r => r.textContent ?? '');
    expect(rows.find(r => r.includes('Farhan Qureshi'))).toMatch(/Owner.*Chairman.*Role change/);
    expect(rows.find(r => r.includes('Meera Iyer'))).toMatch(/Treasurer.*Owner/);
    expect(
      within(within(d).getByRole('region', { name: 'Continuing' })).getByText('No role change'),
    ).toBeInTheDocument();
    expect(
      within(within(d).getByRole('region', { name: 'Leaving' })).getByText('Meera Iyer'),
    ).toBeInTheDocument();
    expect(
      within(d).getByText('Lata Menon can act on approvals waiting on Meera Iyer for 30 days.'),
    ).toBeInTheDocument();
    expect(within(d).queryByTestId('plan-staff-seats')).toBeNull();
    expect(within(d).getByRole('button', { name: 'Continue' })).toBeEnabled();
  });

  it('shows the staff seat effect only when a staff seat moves', async () => {
    renderIt({
      'GET /committee/terms/20/activation-preview': ok(
        planRaw({
          staffSeats: { limit: 8, used: 3, delta: -1 },
          actions: [
            {
              kind: 'CHANGE_ROLE',
              step: 'B',
              userId: 55,
              memberId: 1,
              name: 'Dev Shah',
              fromRoleKey: 'accountant',
              toRoleKey: 'treasurer',
              seatDelta: -1,
              reason: 'INCOMING',
            },
          ],
        }),
      ),
    });
    const d = await open();
    expect(await within(d).findByTestId('plan-staff-seats')).toHaveTextContent(
      'Staff seats: 3 → 2 of 8 (one released)',
    );
    expect(within(d).getByText('Frees a staff seat')).toBeInTheDocument();
  });

  it('shows warnings and blockers with the fix in words and disables Continue', async () => {
    renderIt({
      'GET /committee/terms/20/activation-preview': ok(
        planRaw({
          warnings: [{ code: 'MEMBERSHIP_WILL_END', message: 'Rajesh has no flat linked.' }],
          blockers: [
            { code: 'HOLDER_NOT_MEMBER', message: 'Kiran Patel is not on the app.', seatIds: ['S4'] },
          ],
        }),
      ),
    });
    const d = await open();
    const blockers = await within(d).findByTestId('plan-blockers');
    expect(blockers).toHaveTextContent('Cannot activate yet: Kiran Patel is not on the app.');
    expect(blockers).toHaveTextContent('How to fix: Invite them to the app as a resident first.');
    expect(within(d).getByTestId('plan-warnings')).toHaveTextContent('Note: Rajesh has no flat linked.');
    expect(within(d).getByRole('button', { name: 'Continue' })).toBeDisabled();
  });

  it('names the committee that will end and the hand-over note', async () => {
    renderIt();
    const d = await open();
    const line = await within(d).findByTestId('plan-ending');
    expect(line).toHaveTextContent('Managing Committee 2024-2029 will end on 31 Mar 2029.');
    expect(within(d).getByTestId('plan-handover')).toHaveTextContent(/handed over/);
  });

  it('shows raw dates in server messages as readable dates', async () => {
    renderIt({
      'GET /committee/terms/20/activation-preview': ok(
        planRaw({
          blockers: [{ code: 'TERM_NOT_STARTED', message: 'This committee starts on 2029-04-01.' }],
          warnings: [{ code: 'X', message: 'Ends 2029-03-31 and 2030-01-05.' }],
        }),
      ),
    });
    const d = await open();
    expect(await within(d).findByTestId('plan-blockers')).toHaveTextContent('starts on 1 Apr 2029.');
    expect(within(d).getByTestId('plan-warnings')).toHaveTextContent('Ends 31 Mar 2029 and 5 Jan 2030.');
  });

  it('shows an error with the reference and retries', async () => {
    const api = renderIt({
      'GET /committee/terms/20/activation-preview': [err(409, 'INVALID_STATE'), ok(planRaw())],
    });
    const d = await open();
    expect(await within(d).findByText(/not allowed in the current state/)).toBeInTheDocument();
    expect(within(d).getByText('Reference:')).toBeInTheDocument();
    await userEvent.click(within(d).getByRole('button', { name: 'Try again' }));
    expect(await within(d).findByRole('region', { name: 'Joining' })).toBeInTheDocument();
    expect(api.calls.filter(c => c.path.endsWith('activation-preview'))).toHaveLength(2);
  });

  it('opens from the draft-from-election banner', async () => {
    renderIt({
      'GET /committee': ok(
        overviewRaw({
          draft: draftRaw({ source: 'ELECTION', electionId: 31 }),
          banner: { code: 'DRAFT_FROM_ELECTION', draftId: 20, electionId: 31 },
        }),
      ),
    });
    const banner = await screen.findByText(/Election results are in/);
    await userEvent.click(
      within(banner.parentElement as HTMLElement).getByRole('button', { name: 'Preview and activate' }),
    );
    expect(await screen.findByRole('dialog', { name: /Activate committee/ })).toBeInTheDocument();
  });
});

describe('Activation wizard: step 2 and result', () => {
  it('checks the confirm form, then activates with the hash and shows the result', async () => {
    const api = renderIt({
      'POST /committee/terms/20/activate': ok(activationRaw()),
      'GET /committee': [ok(overviewRaw({ draft: draftRaw() })), ok(overviewRaw())],
    });
    const d = await open();
    await userEvent.click(await within(d).findByRole('button', { name: 'Continue' }));
    const activate = within(d).getByRole('button', { name: 'Activate committee' });
    expect(activate).toBeDisabled();
    await userEvent.type(within(d).getByLabelText(/Reason/), 'Hmm');
    expect(activate).toBeDisabled();
    await userEvent.type(within(d).getByLabelText(/Reason/), ' ok');
    expect(activate).toBeEnabled();
    await userEvent.click(activate);
    expect(within(d).getByText('Enter the resolution reference (3 to 100 characters).')).toBeInTheDocument();
    await userEvent.clear(within(d).getByLabelText(/Reason/));
    expect(api.last('POST', '/committee/terms/20/activate')).toBeUndefined();
    await fillConfirm(d);
    await userEvent.click(within(d).getByRole('switch', { name: 'Announce to residents' }));
    await userEvent.click(within(d).getByRole('button', { name: 'Activate committee' }));
    expect(await within(d).findByTestId('activation-result')).toHaveTextContent(
      'The new committee has taken charge.',
    );
    expect(within(d).getByText('4 roles changed')).toBeInTheDocument();
    expect(within(d).getByText('2 hand-over delegations created')).toBeInTheDocument();
    const body = api.last('POST', '/committee/terms/20/activate')!.body as Record<string, unknown>;
    expect(body).toMatchObject({
      version: 2,
      previewHash: 'a'.repeat(64),
      resolutionRef: 'CM/2029-30/01',
      reason: 'New committee elected',
      announceToResidents: false,
    });
    expect(body.tookChargeOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    await userEvent.click(within(d).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(screen.queryByText('Preview and activate')).toBeNull());
  });

  it('refuses a date before the start of the term', async () => {
    renderIt();
    const d = await open();
    await userEvent.click(await within(d).findByRole('button', { name: 'Continue' }));
    fireEvent.change(within(d).getByLabelText('Took charge on'), { target: { value: '2020-01-01' } });
    await fillConfirm(d);
    await userEvent.click(within(d).getByRole('button', { name: 'Activate committee' }));
    expect(await within(d).findByText(/The committee starts on/)).toBeInTheDocument();
  });

  it('lets the API client ask for a fresh sign in and retries once confirmed', async () => {
    const stepUp = vi.fn().mockResolvedValue(true);
    const api = renderIt({
      'POST /committee/terms/20/activate': [err(401, 'REAUTH_REQUIRED'), ok(activationRaw())],
    });
    configureApiClient({ stepUp });
    const d = await open();
    await userEvent.click(await within(d).findByRole('button', { name: 'Continue' }));
    await fillConfirm(d);
    await userEvent.click(within(d).getByRole('button', { name: 'Activate committee' }));
    expect(await within(d).findByTestId('activation-result')).toBeInTheDocument();
    expect(stepUp).toHaveBeenCalledOnce();
    expect(api.calls.filter(c => c.path.endsWith('/activate'))).toHaveLength(2);
  });

  it('shows the reason in plain words when the sign in is declined', async () => {
    renderIt({ 'POST /committee/terms/20/activate': err(401, 'REAUTH_REQUIRED') });
    configureApiClient({ stepUp: vi.fn().mockResolvedValue(false) });
    const d = await open();
    await userEvent.click(await within(d).findByRole('button', { name: 'Continue' }));
    await fillConfirm(d);
    await userEvent.click(within(d).getByRole('button', { name: 'Activate committee' }));
    expect(await within(d).findByText('Confirm it is you to continue.')).toBeInTheDocument();
  });

  it('names the seat holder and the missing access in a blocker', async () => {
    renderIt({
      'GET /committee/terms/20/activation-preview': ok(
        planRaw({
          blockers: [
            { code: 'HOLDER_INELIGIBLE', message: 'Not an owner.', seatIds: ['S1'], userIds: [33] },
            { code: 'UNHELD_PERMISSION', message: 'Too much access.', permissionKeys: ['finance.edit'] },
          ],
        }),
      ),
    });
    const d = await open();
    const blockers = await within(d).findByTestId('plan-blockers');
    expect(blockers).toHaveTextContent('For: Farhan Qureshi, Arjun Shah.');
    expect(blockers).toHaveTextContent('Access you do not have: finance.edit.');
  });

  it('shows skipped hand-over pairs in words and the real error detail of a refused activation', async () => {
    renderIt({
      'POST /committee/terms/20/activate': ok(
        activationRaw({
          summary: {
            roleChanges: 4,
            membershipsEnded: 0,
            handoverDelegationsCreated: 1,
            handoverDelegationsSkipped: [
              {
                designation: 'TREASURER',
                fromUserId: 22,
                toUserId: 64,
                skippedBecause: 'DELEGATION_OVERLAP',
              },
            ],
          },
        }),
      ),
    });
    const d = await open();
    await userEvent.click(await within(d).findByRole('button', { name: 'Continue' }));
    await fillConfirm(d);
    await userEvent.click(within(d).getByRole('button', { name: 'Activate committee' }));
    expect(await within(d).findByTestId('activation-result')).toHaveTextContent(
      'Hand-over was skipped for: Treasurer (a hand-over already runs for this person).',
    );
  });

  it('reloads step 1 with a notice when the plan went stale', async () => {
    const api = renderIt({
      'POST /committee/terms/20/activate': err(409, 'COMMITTEE_PREVIEW_STALE'),
      'GET /committee/terms/20/activation-preview': [
        ok(planRaw()),
        ok(planRaw({ previewHash: 'b'.repeat(64) })),
      ],
    });
    const d = await open();
    await userEvent.click(await within(d).findByRole('button', { name: 'Continue' }));
    await fillConfirm(d);
    await userEvent.click(within(d).getByRole('button', { name: 'Activate committee' }));
    expect(
      await within(d).findByText('Something changed since you opened this. Review the updated plan.'),
    ).toBeInTheDocument();
    await waitFor(() => expect(api.calls.filter(c => c.path.endsWith('activation-preview'))).toHaveLength(2));
    expect(await within(d).findByRole('region', { name: 'Joining' })).toBeInTheDocument();
  });

  it.each([
    ['USAGE_LIMIT_EXCEEDED', 402, /staff seats are used/],
    ['COMMITTEE_OFFICE_BEARERS_REQUIRED', 422, /needs a Chairman, a Secretary and a Treasurer/],
    ['STALE_VERSION', 409, /Someone else changed this/],
    ['SELF_CHANGE_NOT_ALLOWED', 403, /cannot change your own role/],
  ])('shows %s in plain words and stays on the confirm step', async (code, status, text) => {
    renderIt({ 'POST /committee/terms/20/activate': err(status, code) });
    const d = await open();
    await userEvent.click(await within(d).findByRole('button', { name: 'Continue' }));
    await fillConfirm(d);
    await userEvent.click(within(d).getByRole('button', { name: 'Activate committee' }));
    expect(await within(d).findByRole('alert')).toHaveTextContent(text);
    expect(within(d).getByRole('button', { name: 'Activate committee' })).toBeEnabled();
  });
});

describe('Activation wizard: permission and plan gates', () => {
  it('hides Preview and activate without settings.members.edit', async () => {
    renderIt({}, ['settings.members.view']);
    await screen.findByText('Managing Committee 2029-2034');
    expect(screen.queryByRole('button', { name: 'Preview and activate' })).toBeNull();
  });

  it('disables it with a visible reason when office bearers are not in the plan', async () => {
    renderIt({}, COMMITTEE_PERMS, ['governance.committee_terms']);
    const b = await screen.findByRole('button', { name: 'Preview and activate' });
    expect(b).toBeDisabled();
    expect(screen.getAllByText(/Office bearers are not part of your plan/).length).toBeGreaterThan(0);
  });
});
