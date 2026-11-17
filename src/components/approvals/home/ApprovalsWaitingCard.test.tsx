import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockApi, navigationMock, ok, resetAll, sampleMe } from '@/test/helpers';
import { countsRaw } from '@/test/approvalsFixtures';
import { signInAs } from '@/test/residentsHelpers';
import { ApprovalsWaitingCard } from './ApprovalsWaitingCard';

vi.mock('next/navigation', () => navigationMock());
beforeEach(resetAll);

const PERMS = ['approvals.inbox.view'];
function renderIt(counts: Record<string, unknown>, perms = PERMS) {
  signInAs(perms, []);
  const api = mockApi({
    'GET /approvals/counts': ok(countsRaw(counts)),
    'GET /auth/me': ok(sampleMe({ permissions: perms })),
  });
  render(<ApprovalsWaitingCard />);
  return api;
}

describe('Approvals waiting for you (admin home)', () => {
  it('shows the count, overdue and links per type to the filtered inbox', async () => {
    renderIt({ forMe: 3, overdueForMe: 1, forMeByType: { EXPENSE: 2, CREDIT_NOTE: 1 } });
    expect(await screen.findByTestId('approvals-waiting')).toHaveTextContent(
      '3 approvals wait for you · 1 overdue',
    );
    expect(screen.getByRole('link', { name: 'Expense: 2' })).toHaveAttribute(
      'href',
      '/admin/approvals?type=EXPENSE',
    );
    expect(screen.getByRole('link', { name: 'Open approvals' })).toHaveAttribute('href', '/admin/approvals');
  });
  it('says all caught up when nothing waits', async () => {
    renderIt({ forMe: 0, overdueForMe: 0, forMeByType: {} });
    expect(await screen.findByText(/All caught up/)).toBeInTheDocument();
  });
  it('is hidden without the inbox permission and calls nothing', async () => {
    const api = renderIt({}, ['finance.expenses.create']);
    await waitFor(() => expect(api.last('GET', '/approvals/counts')).toBeFalsy());
    expect(screen.queryByText('Approvals waiting for you')).toBeNull();
  });
});
