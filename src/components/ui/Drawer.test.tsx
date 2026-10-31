import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Drawer } from './Drawer';

describe('Drawer', () => {
  it('renders a labelled dialog, focuses inside, closes on Esc, overlay and the close button', async () => {
    const onClose = vi.fn();
    render(
      <>
        <button>opener</button>
        <Drawer open onClose={onClose} title="Meera Iyer" size={640}>
          <button>inside</button>
        </Drawer>
      </>,
    );
    const dlg = screen.getByRole('dialog', { name: 'Meera Iyer' });
    expect(dlg).toHaveClass('max-w-[640px]');
    expect(dlg).toContainElement(document.activeElement as HTMLElement);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(2);
    await userEvent.click(screen.getByTestId('drawer-overlay'));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('renders nothing when closed and keeps Tab inside', async () => {
    const { rerender } = render(
      <Drawer open={false} onClose={() => {}} title="T">
        <button>a</button>
      </Drawer>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    rerender(
      <Drawer open onClose={() => {}} title="T">
        <button>a</button>
      </Drawer>,
    );
    for (let i = 0; i < 4; i++) {
      await userEvent.tab();
      expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement);
    }
  });
});
