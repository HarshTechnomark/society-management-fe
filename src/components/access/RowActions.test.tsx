import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RowActions } from './RowActions';

const run = vi.fn();
const actions = [
  { key: 'a', label: 'Role', run },
  { key: 'b', label: 'Disable', run, danger: true, disabled: true, why: 'You cannot change yourself' },
];

afterEach(() => {
  vi.unstubAllGlobals();
  run.mockReset();
});

describe('RowActions', () => {
  it('shows inline buttons on desktop', async () => {
    render(<RowActions name="Meera" actions={actions} />);
    await userEvent.click(screen.getByRole('button', { name: 'Role Meera' }));
    expect(run).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Disable Meera' })).toBeDisabled();
  });

  it('collapses into a "more actions" bottom sheet on phones', async () => {
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: true,
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    render(<RowActions name="Meera" actions={actions} />);
    expect(screen.queryByRole('button', { name: 'Role Meera' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'More actions for Meera' }));
    const sheet = screen.getByRole('dialog', { name: 'Meera' });
    expect(sheet).toBeInTheDocument();
    expect(screen.getByText('You cannot change yourself')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Role' }));
    expect(run).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
