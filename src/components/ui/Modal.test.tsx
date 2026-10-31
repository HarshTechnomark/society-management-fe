import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Modal } from './Modal';

function Harness({ sticky }: { sticky?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open</button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Edit thing"
        sticky={sticky}
        footer={<button>Save</button>}
      >
        <input aria-label="First" />
        <input aria-label="Second" />
      </Modal>
    </>
  );
}

describe('Modal', () => {
  it('is a labelled dialog and focuses the first field', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByText('Open'));
    const dialog = screen.getByRole('dialog', { name: 'Edit thing' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByLabelText('First')).toHaveFocus();
  });

  it('traps Tab inside and wraps both ways', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByText('Open'));
    await userEvent.tab();
    await userEvent.tab();
    expect(screen.getByText('Save')).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByLabelText('First')).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(screen.getByText('Save')).toHaveFocus();
  });

  it('closes on Escape and returns focus to the opener', async () => {
    render(<Harness />);
    const opener = screen.getByText('Open');
    await userEvent.click(opener);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(opener).toHaveFocus();
  });

  it('ignores Escape and outside clicks when sticky', async () => {
    render(<Harness sticky />);
    await userEvent.click(screen.getByText('Open'));
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByTestId('modal-overlay'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('closes on an outside click when not sticky', async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="T">
        <button>x</button>
      </Modal>,
    );
    await userEvent.click(screen.getByTestId('modal-overlay'));
    expect(onClose).toHaveBeenCalled();
  });

  it('uses bottom-sheet classes at 700px or less', () => {
    render(
      <Modal open onClose={() => {}} title="T">
        <button>x</button>
      </Modal>,
    );
    expect(screen.getByTestId('modal-overlay').className).toContain('max-[700px]:items-end');
    expect(screen.getByRole('dialog').className).toContain('max-[700px]:rounded-b-none');
  });
});
