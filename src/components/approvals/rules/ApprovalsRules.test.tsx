import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { err, mockApi, navigationMock, ok, resetAll } from '@/test/helpers';
import { signInAs } from '@/test/residentsHelpers';
import { listOf, typesRaw } from '@/test/approvalsFixtures';
import { currentRaw, overviewRaw, seatRaw, termRaw } from '@/test/committeeFixtures';
import { delegationRaw, rolesPage, ruleRaw, smallRuleRaw } from '@/test/approvalsRulesFixtures';
import { ToastProvider } from '@/components/ui/Toast';
import { RulesScreen } from './RulesScreen';
import { ApprovalSettingsScreen } from '../settings/ApprovalSettingsScreen';
import { DelegationsScreen } from '../delegations/DelegationsScreen';

vi.mock('next/navigation', () => navigationMock());
beforeEach(resetAll);

const VIEW = ['settings.approval_rules.view'];
const EDIT = ['settings.approval_rules.view', 'settings.approval_rules.edit', 'approvals.inbox.view'];
const ROLES = rolesPage([
  { key: 'chairman', name: 'Chairman' },
  { key: 'treasurer', name: 'Treasurer' },
]);
const base = (routes: Parameters<typeof mockApi>[0] = {}) =>
  mockApi({
    'GET /approvals/types': ok(typesRaw()),
    'GET /approvals/rules': ok([smallRuleRaw(), ruleRaw()]),
    'GET /roles': ROLES,
    'GET /committee': ok(overviewRaw({ current: currentRaw() })),
    'GET /committee/terms/12': ok(
      termRaw({
        seats: [
          seatRaw(),
          seatRaw({ seatId: 'S2', userId: 12, name: 'Arjun Shah', designation: 'SECRETARY' }),
        ],
      }),
    ),
    ...routes,
  });
const renderIt = (ui: React.ReactElement) => render(<ToastProvider>{ui}</ToastProvider>);

describe('rules screen', () => {
  it('lists rules per type with range, steps and open requests', async () => {
    signInAs(EDIT, []);
    base();
    renderIt(<RulesScreen />);
    const exp = await screen.findByTestId('type-EXPENSE');
    expect(within(exp).getByText('Expenses above ₹25,000')).toBeInTheDocument();
    expect(within(exp).getByText('Up to ₹25,000 · Treasurer')).toBeInTheDocument();
    expect(within(exp).getByText('2 open requests')).toBeInTheDocument();
    expect(within(exp).getAllByText('Default')).toHaveLength(2);
  });
  it('is read-only without the edit permission', async () => {
    signInAs(VIEW, []);
    base();
    renderIt(<RulesScreen />);
    await screen.findByTestId('type-EXPENSE');
    expect(screen.queryByRole('button', { name: 'Add rule' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reset to defaults' })).toBeNull();
    expect(screen.getByRole('switch', { name: 'Expenses above ₹25,000 active' })).toBeDisabled();
  });
  it('switches a rule off with its version', async () => {
    signInAs(EDIT, []);
    const api = base({ 'PATCH /approvals/rules/300': ok(smallRuleRaw({ isActive: false })) });
    renderIt(<RulesScreen />);
    await userEvent.click(await screen.findByRole('switch', { name: 'Expenses up to ₹25,000 active' }));
    await waitFor(() =>
      expect(api.last('PATCH', '/approvals/rules/300')?.body).toEqual({ isActive: false, version: 1 }),
    );
  });
  it('shows the delete confirmation and sends the reason', async () => {
    signInAs(EDIT, []);
    const api = base({ 'DELETE /approvals/rules/300': ok({ warnings: [] }) });
    renderIt(<RulesScreen />);
    await userEvent.click(await screen.findByRole('button', { name: 'Delete Expenses up to ₹25,000' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.type(within(dlg).getByLabelText(/Reason/), 'Replaced by a new rule');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Delete rule' }));
    await waitFor(() =>
      expect(api.last('DELETE', '/approvals/rules/300')?.body).toEqual({
        version: 1,
        reason: 'Replaced by a new rule',
      }),
    );
  });
  it('resets a type to defaults after confirming', async () => {
    signInAs(EDIT, []);
    const api = base({ 'POST /approvals/rules/reset-defaults': ok([ruleRaw()]) });
    renderIt(<RulesScreen />);
    const exp = await screen.findByTestId('type-EXPENSE');
    await userEvent.click(within(exp).getByRole('button', { name: 'Reset to defaults' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.type(within(dlg).getByLabelText(/Reason/), 'Start again');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Reset to defaults' }));
    await waitFor(() =>
      expect(api.last('POST', '/approvals/rules/reset-defaults')?.body).toEqual({
        type: 'EXPENSE',
        reason: 'Start again',
      }),
    );
  });
  it('checks the rule before sending and shows the API warnings after saving', async () => {
    signInAs(EDIT, []);
    const api = base({
      'POST /approvals/rules': ok({
        ...ruleRaw({ id: 400, name: 'Lift jobs' }),
        warnings: [{ code: 'COVERAGE_GAP', message: 'No active EXPENSE rule covers ₹5,000.01 to ₹10,000' }],
      }),
    });
    renderIt(<RulesScreen />);
    const exp = await screen.findByTestId('type-EXPENSE');
    await userEvent.click(within(exp).getByRole('button', { name: 'Add rule' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Add rule' }));
    expect(within(dlg).getByText('Enter 3 to 80 characters.')).toBeInTheDocument();
    expect(api.last('POST', '/approvals/rules')).toBeUndefined();
    await userEvent.type(within(dlg).getByLabelText(/^Name/), 'Lift jobs');
    await userEvent.type(within(dlg).getByLabelText('Step 1 name'), 'Treasurer review');
    const step1 = within(dlg).getByRole('group', { name: 'Step 1' });
    await userEvent.click(await within(step1).findByRole('checkbox', { name: 'Treasurer' }));
    await userEvent.click(within(dlg).getByRole('button', { name: 'Add rule' }));
    await waitFor(() => expect(api.last('POST', '/approvals/rules')).toBeDefined());
    expect(api.last('POST', '/approvals/rules')?.body).toMatchObject({
      type: 'EXPENSE',
      name: 'Lift jobs',
      maxAmountPaise: null,
      steps: [{ stepNo: 1, mode: 'ANY_OF', roleKeys: ['treasurer'] }],
    });
    expect(await screen.findByText(/No active EXPENSE rule covers/)).toBeInTheDocument();
  });
  it('shows a server rule error in words', async () => {
    signInAs(EDIT, []);
    base({ 'PATCH /approvals/rules/300': err(409, 'RULE_NAME_TAKEN') });
    renderIt(<RulesScreen />);
    await userEvent.click(await screen.findAllByRole('button', { name: 'Edit' }).then(b => b[0]));
    const dlg = await screen.findByRole('dialog');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Save rule' }));
    expect(
      await within(dlg).findByText('Another rule of this type already has this name.'),
    ).toBeInTheDocument();
  });
  it('simulates and shows the matched rule and approvers', async () => {
    signInAs(EDIT, []);
    const api = base({
      'POST /approvals/rules/simulate': ok({
        matchedRuleId: 301,
        ruleName: 'Expenses above ₹25,000',
        routing: 'REQUIRE_APPROVAL',
        stepUpRequired: true,
        steps: [
          {
            stepNo: 1,
            name: 'Two of three',
            mode: 'N_OF',
            eligibleNow: [{ userId: 11, name: 'Rajesh Kulkarni', roleKey: 'chairman', via: 'ROLE' }],
            vacantSlots: ['Treasurer'],
          },
        ],
      }),
    });
    renderIt(<RulesScreen />);
    await userEvent.selectOptions(await screen.findByLabelText('Type'), 'EXPENSE');
    await userEvent.type(screen.getByLabelText('Amount (₹)'), '30000');
    await userEvent.click(screen.getByRole('button', { name: 'Check who approves' }));
    const out = await screen.findByTestId('simulation');
    expect(within(out).getByText('Expenses above ₹25,000')).toBeInTheDocument();
    expect(within(out).getByText(/Rajesh Kulkarni/)).toBeInTheDocument();
    expect(within(out).getByText(/Empty seats: Treasurer/)).toBeInTheDocument();
    expect(api.last('POST', '/approvals/rules/simulate')?.body).toEqual({
      type: 'EXPENSE',
      amountPaise: 3000000,
    });
  });
});

describe('settings screen', () => {
  it('shows values in rupees and saves only what changed', async () => {
    signInAs(EDIT, []);
    const api = mockApi({
      'GET /approvals/settings': ok({ stepUpAbovePaise: 2500000, bulkApproveBelowPaise: 2500000 }),
      'PATCH /approvals/settings': ok({ stepUpAbovePaise: 5000000, bulkApproveBelowPaise: 2500000 }),
    });
    renderIt(<ApprovalSettingsScreen />);
    const f = await screen.findByLabelText(/fresh code above/);
    expect(f).toHaveValue('25000');
    expect(screen.getByRole('button', { name: 'Save settings' })).toBeDisabled();
    await userEvent.clear(f);
    await userEvent.type(f, '50000');
    await userEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    await waitFor(() =>
      expect(api.last('PATCH', '/approvals/settings')?.body).toEqual({ stepUpAbovePaise: 5000000 }),
    );
  });
  it('rejects an amount below the minimum and is read-only for viewers', async () => {
    signInAs(EDIT, []);
    mockApi({ 'GET /approvals/settings': ok({ stepUpAbovePaise: 2500000, bulkApproveBelowPaise: 2500000 }) });
    const { unmount } = renderIt(<ApprovalSettingsScreen />);
    const f = await screen.findByLabelText(/fresh code above/);
    await userEvent.clear(f);
    await userEvent.type(f, '10');
    expect(screen.getByRole('button', { name: 'Save settings' })).toBeDisabled();
    unmount();
    signInAs(VIEW, []);
    renderIt(<ApprovalSettingsScreen />);
    expect(await screen.findByLabelText(/fresh code above/)).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save settings' })).toBeNull();
  });
});

describe('delegations screen', () => {
  const del = (routes: Parameters<typeof mockApi>[0] = {}) =>
    base({
      'GET /approvals/delegations': listOf([
        delegationRaw(),
        delegationRaw({
          id: 89,
          delegator: { userId: 5, name: 'Meera Iyer' },
          delegate: { userId: 101, name: 'Rajesh Kulkarni' },
          displayStatus: 'ACTIVE',
        }),
      ]),
      ...routes,
    });
  it('lists delegations with status and lets the delegator revoke', async () => {
    signInAs(EDIT, ['iam.approval_delegation']);
    const api = del({
      'POST /approvals/delegations/88/revoke': ok(delegationRaw({ displayStatus: 'REVOKED' })),
    });
    renderIt(<DelegationsScreen />);
    expect(await screen.findByText('Scheduled')).toBeInTheDocument();
    expect(screen.getByText('Given to me')).toBeInTheDocument();
    // not mine, no edit right needed here because EDIT includes it; revoke 88 (mine)
    await userEvent.click(screen.getByRole('button', { name: 'Revoke delegation to Priya Nair' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.type(within(dlg).getByLabelText(/Reason/), 'Back early');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Revoke' }));
    await waitFor(() =>
      expect(api.last('POST', '/approvals/delegations/88/revoke')?.body).toEqual({
        version: 1,
        reason: 'Back early',
      }),
    );
  });
  it('hides revoke for a delegate without edit rights', async () => {
    signInAs(['approvals.inbox.view'], ['iam.approval_delegation']);
    del();
    renderIt(<DelegationsScreen />);
    await screen.findByText('Given to me');
    expect(screen.queryByRole('button', { name: /Revoke delegation to Rajesh/ })).toBeNull();
  });
  it('shows the upgrade prompt below the plan and no create button', async () => {
    signInAs(EDIT, []);
    del();
    renderIt(<DelegationsScreen />);
    expect(await screen.findByText(/Not in your plan/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delegate my approvals' })).toBeNull();
  });
  it('validates and creates a delegation in India time', async () => {
    signInAs(EDIT, ['iam.approval_delegation']);
    const api = del({ 'POST /approvals/delegations': ok(delegationRaw()) });
    renderIt(<DelegationsScreen />);
    await userEvent.click(await screen.findByRole('button', { name: 'Delegate my approvals' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Create delegation' }));
    expect(within(dlg).getByText('Choose who covers for you.')).toBeInTheDocument();
    expect(api.last('POST', '/approvals/delegations')).toBeUndefined();
    await userEvent.selectOptions(await within(dlg).findByLabelText('Delegate'), '12');
    await userEvent.type(within(dlg).getByLabelText(/Reason/), 'On leave');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Create delegation' }));
    await waitFor(() => expect(api.last('POST', '/approvals/delegations')).toBeDefined());
    expect(api.last('POST', '/approvals/delegations')?.body).toMatchObject({
      delegateUserId: 12,
      types: null,
      maxAmountPaise: null,
      reason: 'On leave',
    });
  });
  it('explains an overlap error', async () => {
    signInAs(EDIT, ['iam.approval_delegation']);
    del({ 'POST /approvals/delegations': err(409, 'DELEGATION_OVERLAP') });
    renderIt(<DelegationsScreen />);
    await userEvent.click(await screen.findByRole('button', { name: 'Delegate my approvals' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.selectOptions(await within(dlg).findByLabelText('Delegate'), '12');
    await userEvent.type(within(dlg).getByLabelText(/Reason/), 'On leave');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Create delegation' }));
    expect(
      await within(dlg).findByText('This person already has a delegation in these dates.'),
    ).toBeInTheDocument();
  });
});
