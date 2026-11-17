import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { err, mockApi, navigationMock, ok, resetAll, search } from '@/test/helpers';
import { signInAs } from '@/test/residentsHelpers';
import { countsRaw, detailRaw, listOf, requestRaw, rowRaw, typesRaw } from '@/test/approvalsFixtures';
import { ToastProvider } from '@/components/ui/Toast';
import { ApprovalsScreen } from './inbox/ApprovalsScreen';
import { ResidentApprovalsScreen } from './resident/ResidentApprovalsScreen';
import { TYPE_LABEL, summaryLine, typeLabel } from './format';

vi.mock('next/navigation', () => navigationMock());
beforeEach(resetAll);

const PERMS = ['approvals.inbox.view'];
const ROWS = [
  rowRaw(),
  rowRaw({
    id: 5013,
    title: 'Credit note for A-101',
    type: 'CREDIT_NOTE',
    typeLabel: '',
    amountPaise: 50000,
    summary: 'Flat A-101 · wrong meter reading',
  }),
  rowRaw({
    id: 5014,
    title: 'Notice about water',
    type: 'NOTICE_PUBLISH',
    bulkEligible: false,
    myAction: { canAct: false, reason: 'MAKER_CHECKER' },
    amountPaise: null,
  }),
];
function inbox(routes: Parameters<typeof mockApi>[0] = {}, perms = PERMS) {
  signInAs(perms, []);
  const api = mockApi({
    'GET /approvals': listOf(ROWS),
    'GET /approvals/submitted': listOf([rowRaw({ id: 6001, title: 'My own request' })]),
    'GET /approvals/counts': ok(countsRaw()),
    'GET /approvals/types': ok(typesRaw()),
    ...routes,
  });
  render(
    <ToastProvider>
      <ApprovalsScreen />
    </ToastProvider>,
  );
  return api;
}

/** The drawer is a dialog too: the decision dialog is the second one. */
const topDialog = async () => {
  await waitFor(() => expect(screen.getAllByRole('dialog')).toHaveLength(2));
  return screen.getAllByRole('dialog')[1];
};

describe('labels', () => {
  it('names every type the development page knows', () => {
    for (const t of [
      'BILLING_RUN_PUBLISH',
      'BILLING_RULE_CHANGE',
      'LATE_FEE_POLICY_CHANGE',
      'CREDIT_NOTE',
      'WRITE_OFF',
      'INVOICE_CANCEL',
      'OFFLINE_PAYMENT',
      'PAYMENT_REFUND',
      'COLLECTION_PUBLISH',
      'JOIN_REQUEST',
      'MOVE_IN',
      'MOVE_OUT',
      'RENOVATION_PERMIT',
      'OWNERSHIP_TRANSFER',
    ])
      expect(TYPE_LABEL[t], t).toBeTruthy();
    expect(typeLabel('SOME_NEW_TYPE')).toBe('Some new type');
  });
  it('builds a summary line with title, API summary and amount', () => {
    expect(summaryLine({ title: 'Refund', summary: 'Flat A-1 · bank transfer', amountPaise: 250000 })).toBe(
      'Refund · Flat A-1 · bank transfer · ₹2,500',
    );
  });
});

describe('Inbox', () => {
  it('lists pending items with type, requester, amount and chips, and badges from counts', async () => {
    inbox();
    const rows = await screen.findAllByTestId('approval-row');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('Expense · Meera Iyer');
    expect(rows[0]).toHaveTextContent('₹48,000');
    expect(rows[0]).toHaveTextContent('1 of 2 approvals');
    expect(rows[1]).toHaveTextContent('Credit note');
    expect(rows[2]).toHaveTextContent('You created this');
    expect(screen.getByRole('button', { name: /Pending for me\s*3/ })).toBeInTheDocument();
  });
  it('switches tabs and reloads from the matching endpoint', async () => {
    const api = inbox();
    await screen.findAllByTestId('approval-row');
    await userEvent.click(screen.getByRole('button', { name: /Submitted by me/ }));
    expect(await screen.findByText('My own request')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'History' }));
    await waitFor(() => expect(api.calls.some(c => c.path === '/approvals')).toBe(true));
    await waitFor(() => expect(String(api.fn.mock.calls.at(-1)?.[0])).toContain('view=DECIDED'));
  });
  it('shows only Sent by me to a maker without inbox access', async () => {
    inbox({}, ['finance.expenses.create']);
    expect(await screen.findByText('My own request')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Pending for me/ })).toBeNull();
  });
  it('opens filtered by the type in the link (?type=)', async () => {
    search.current = new URLSearchParams('type=EXPENSE');
    const api = inbox();
    await screen.findAllByTestId('approval-row');
    expect(String(api.fn.mock.calls.find(c => String(c[0]).includes('/approvals?'))?.[0])).toContain(
      'type=EXPENSE',
    );
  });
  it('shows an empty state when nothing waits', async () => {
    inbox({ 'GET /approvals': listOf([]) });
    expect(await screen.findByText('All caught up')).toBeInTheDocument();
  });
  it('warns when approvals cannot be routed', async () => {
    inbox({ 'GET /approvals/counts': ok(countsRaw({ stuck: 2 })) });
    expect(await screen.findByText(/2 approvals cannot be routed/)).toBeInTheDocument();
  });
  it('bulk approves the selected items and shows a result per item', async () => {
    const api = inbox({
      'POST /approvals/bulk-approve': ok({
        approved: 1,
        skipped: 1,
        results: [
          { id: 5012, ok: true, status: 'APPROVED', version: 4 },
          { id: 5013, ok: false, code: 'BULK_NOT_ALLOWED', message: 'Needs a fresh code' },
        ],
      }),
    });
    await screen.findAllByTestId('approval-row');
    expect(screen.queryByRole('checkbox', { name: 'Select Notice about water' })).toBeNull();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select Shree Ganesh Lift Services' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select Credit note for A-101' }));
    await userEvent.click(screen.getByRole('button', { name: 'Approve 2 selected' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Approve 2' }));
    const res = await within(dlg).findByTestId('bulk-results');
    expect(res).toHaveTextContent('Approved: Shree Ganesh Lift Services');
    expect(res).toHaveTextContent('Skipped: Credit note for A-101');
    expect(res).toHaveTextContent('approve it on its own');
    expect(api.last('POST', '/approvals/bulk-approve')?.body).toEqual({
      items: [
        { id: 5012, version: 3 },
        { id: 5013, version: 3 },
      ],
    });
  });
});

describe('Detail and decisions', () => {
  async function open(detail = detailRaw(), routes: Parameters<typeof mockApi>[0] = {}) {
    const api = inbox({ 'GET /approvals/5012': ok(detail), ...routes });
    await userEvent.click(await screen.findByRole('button', { name: 'Open Shree Ganesh Lift Services' }));
    await screen.findByTestId('approval-detail');
    return api;
  }
  it('shows facts, steps and the timeline from the API', async () => {
    await open();
    const d = screen.getByTestId('approval-detail');
    expect(within(d).getByText('Payee')).toBeInTheDocument();
    expect(within(d).getByTestId('approval-step')).toHaveTextContent('Chairman, Treasurer');
    expect(within(d).getByTestId('approval-step')).toHaveTextContent('approved by Sanjay Patil');
    expect(within(d).getByTestId('approval-timeline')).toHaveTextContent('Matches contract');
  });
  it('approves with an optional comment and the current version', async () => {
    const api = await open(detailRaw(), {
      'POST /approvals/5012/approve': ok({ id: 5012, status: 'APPROVED', stepCompleted: true, version: 4 }),
    });
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }));
    const dlg = await topDialog();
    await userEvent.type(within(dlg).getByLabelText(/Comment/), 'Fine');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Approve' }));
    await waitFor(() =>
      expect(api.last('POST', '/approvals/5012/approve')?.body).toEqual({ version: 3, comment: 'Fine' }),
    );
  });
  it('needs a reason of 5 characters to reject', async () => {
    const api = await open(detailRaw(), {
      'POST /approvals/5012/reject': ok({ id: 5012, status: 'REJECTED', version: 4 }),
    });
    await userEvent.click(screen.getByRole('button', { name: 'Reject' }));
    const dlg = await topDialog();
    await userEvent.type(within(dlg).getByLabelText(/Reason/), 'no');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Reject' }));
    expect(within(dlg).getByText('Enter at least 5 characters.')).toBeInTheDocument();
    expect(api.last('POST', '/approvals/5012/reject')).toBeUndefined();
    await userEvent.type(within(dlg).getByLabelText(/Reason/), ' way too high');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Reject' }));
    await waitFor(() =>
      expect(api.last('POST', '/approvals/5012/reject')?.body).toEqual({
        version: 3,
        reason: 'no way too high',
      }),
    );
  });
  it('hides buttons the API did not allow and explains why', async () => {
    await open(
      detailRaw({
        myAction: {
          canApprove: false,
          canReject: false,
          canRequestChanges: false,
          canCancel: true,
          onBehalfOptions: [],
          reason: 'MAKER_CHECKER',
        },
      }),
    );
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
    expect(
      within(screen.getByTestId('approval-detail')).getByText(
        'You created this. A different person must approve.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel request' })).toBeInTheDocument();
  });
  it('says so and reloads when the item changed meanwhile', async () => {
    const api = await open(detailRaw(), { 'POST /approvals/5012/approve': err(409, 'STALE_VERSION') });
    const before = api.calls.filter(c => c.path === '/approvals/5012' && c.method === 'GET').length;
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }));
    const dlg = await topDialog();
    await userEvent.click(within(dlg).getByRole('button', { name: 'Approve' }));
    expect(await screen.findByText('This item changed. Showing the latest.')).toBeInTheDocument();
    await waitFor(() =>
      expect(
        api.calls.filter(c => c.path === '/approvals/5012' && c.method === 'GET').length,
      ).toBeGreaterThan(before),
    );
  });
  it('offers Reassign only to rule editors', async () => {
    signInAs([...PERMS, 'settings.approval_rules.edit'], []);
    mockApi({
      'GET /approvals': listOf(ROWS),
      'GET /approvals/counts': ok(countsRaw()),
      'GET /approvals/types': ok(typesRaw()),
      'GET /approvals/5012': ok(detailRaw()),
    });
    render(<ApprovalsScreen />);
    await userEvent.click(await screen.findByRole('button', { name: 'Open Shree Ganesh Lift Services' }));
    expect(await screen.findByRole('button', { name: 'Reassign' })).toBeInTheDocument();
  });
});

describe('Resident requests', () => {
  it('shows status, reason and timeline, and withdraws with a reason', async () => {
    signInAs([], []);
    const api = mockApi({
      'GET /me/approval-requests': listOf([
        requestRaw(),
        requestRaw({
          id: 5102,
          title: 'Renovation',
          status: 'REJECTED',
          statusLabel: 'Rejected',
          reason: 'Needs a permit',
          canCancel: false,
        }),
      ]),
      'POST /me/approval-requests/5101/cancel': ok({ id: 5101, status: 'CANCELLED' }),
    });
    render(<ResidentApprovalsScreen />);
    const cards = await screen.findAllByTestId('request-card');
    expect(cards[0]).toHaveTextContent('Waiting for Secretary');
    expect(cards[1]).toHaveTextContent('Needs a permit');
    expect(within(cards[1]).queryByRole('button', { name: 'Withdraw' })).toBeNull();
    await userEvent.click(within(cards[0]).getByRole('button', { name: 'Withdraw' }));
    const dlg = await screen.findByRole('dialog');
    await userEvent.type(within(dlg).getByLabelText(/Reason/), 'Plans changed');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Withdraw' }));
    await waitFor(() =>
      expect(api.last('POST', '/me/approval-requests/5101/cancel')?.body).toEqual({
        version: 1,
        reason: 'Plans changed',
      }),
    );
  });
});
