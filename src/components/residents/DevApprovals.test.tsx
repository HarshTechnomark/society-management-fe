import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DevApprovals } from '@/components/residents/DevApprovals';
import { ToastProvider } from '@/components/ui/Toast';
import { mockApi, navigationMock, ok, resetAll } from '@/test/helpers';
import { signInAs } from '@/test/residentsHelpers';

vi.mock('next/navigation', () => navigationMock());

function renderIt(routes: Parameters<typeof mockApi>[0]) {
  signInAs();
  const api = mockApi(routes);
  render(
    <ToastProvider>
      <DevApprovals />
    </ToastProvider>,
  );
  return api;
}

beforeEach(() => resetAll());

describe('DevApprovals', () => {
  it('lists waiting requests and approves one through the development route', async () => {
    const api = renderIt({
      'GET /dev/approvals': ok([
        { id: 9000, type: 'RENOVATION_PERMIT', entityId: 1, societyId: 1, status: 'PENDING' },
      ]),
      'POST /dev/approvals/9000/approve': ok({ id: 9000, status: 'APPROVED' }),
    });
    expect(await screen.findByText('Renovation permit')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Approve request 9000' }));
    await waitFor(() => expect(api.last('POST', '/dev/approvals/9000/approve')).toBeTruthy());
  });

  it('says nothing is waiting when the list is empty', async () => {
    renderIt({ 'GET /dev/approvals': ok([]) });
    expect(await screen.findByText('Nothing is waiting for a decision.')).toBeInTheDocument();
  });
});
