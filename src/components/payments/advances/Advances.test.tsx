import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { err, mockApi, ok, resetAll } from '@/test/helpers';
import { advancesRaw } from '@/test/paymentsOpsFixtures';
import { AdvancePanel } from './AdvancePanel';

beforeEach(resetAll);

describe('AdvancePanel', () => {
  it('shows the balance and the history with entry types in words', async () => {
    const api = mockApi({ 'GET /units/51/advances': ok(advancesRaw()) });
    render(<AdvancePanel unitId={51} />);
    expect(await screen.findByText('₹1,200')).toBeInTheDocument();
    expect(screen.getByText('Excess of a payment')).toBeInTheDocument();
    expect(screen.getByText('Used on a bill')).toBeInTheDocument();
    expect(screen.getByText('+₹1,500')).toBeInTheDocument();
    expect(screen.getByText('-₹300')).toBeInTheDocument();
    expect(api.fn.mock.calls.length).toBe(1);
  });
  it('says so when there is no advance', async () => {
    mockApi({ 'GET /units/51/advances': ok({ unitId: 51, balancePaise: 0, entries: [] }) });
    render(<AdvancePanel unitId={51} />);
    expect(await screen.findByText('No advance payments yet.')).toBeInTheDocument();
  });
  it('shows the first five entries and the rest on request', async () => {
    const entries = Array.from({ length: 7 }, (_, i) => ({ ...advancesRaw().entries[0], id: i + 1 }));
    mockApi({ 'GET /units/51/advances': ok({ unitId: 51, balancePaise: 100, entries }) });
    render(<AdvancePanel unitId={51} />);
    expect(await screen.findAllByText('Excess of a payment')).toHaveLength(5);
    await userEvent.click(screen.getByRole('button', { name: 'Show all 7' }));
    expect(screen.getAllByText('Excess of a payment')).toHaveLength(7);
  });
  it('shows an error with a retry', async () => {
    mockApi({ 'GET /units/51/advances': err(404, 'UNIT_NOT_FOUND') });
    render(<AdvancePanel unitId={51} />);
    expect(await screen.findByText(/This flat was not found/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
