import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { OtpInput } from './OtpInput';

function Harness({ onComplete }: { onComplete?: (c: string) => void }) {
  const [v, setV] = useState('');
  return <OtpInput value={v} onChange={setV} onComplete={onComplete} />;
}
const box = (i: number) => screen.getByLabelText(`Digit ${i} of 6`) as HTMLInputElement;

describe('OtpInput', () => {
  it('renders six numeric boxes with one-time-code on the first', () => {
    render(<Harness />);
    expect(screen.getAllByRole('textbox')).toHaveLength(6);
    expect(box(1)).toHaveAttribute('autocomplete', 'one-time-code');
    expect(box(2)).toHaveAttribute('autocomplete', 'off');
    expect(box(1)).toHaveAttribute('inputmode', 'numeric');
  });

  it('moves focus forward while typing and auto-submits on the sixth digit', async () => {
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    await userEvent.click(box(1));
    await userEvent.keyboard('12345');
    expect(box(6)).toHaveFocus();
    expect(onComplete).not.toHaveBeenCalled();
    await userEvent.keyboard('6');
    expect(onComplete).toHaveBeenCalledExactlyOnceWith('123456');
  });

  it('ignores non-digits', async () => {
    render(<Harness />);
    await userEvent.click(box(1));
    await userEvent.keyboard('a-b');
    expect(box(1).value).toBe('');
  });

  it('paste fills all boxes and submits once', async () => {
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    await userEvent.click(box(1));
    await userEvent.paste('482 913');
    expect([1, 2, 3, 4, 5, 6].map(i => box(i).value).join('')).toBe('482913');
    expect(onComplete).toHaveBeenCalledExactlyOnceWith('482913');
  });

  it('Backspace on an empty box moves back and clears the previous digit', async () => {
    render(<Harness />);
    await userEvent.click(box(1));
    await userEvent.keyboard('123');
    expect(box(4)).toHaveFocus();
    await userEvent.keyboard('{Backspace}');
    expect(box(3)).toHaveFocus();
    expect(box(3).value).toBe('');
    expect(box(2).value).toBe('2');
  });

  it('marks boxes invalid when asked', () => {
    render(<OtpInput value="" onChange={() => {}} invalid />);
    expect(box(1)).toHaveAttribute('aria-invalid', 'true');
  });
});
