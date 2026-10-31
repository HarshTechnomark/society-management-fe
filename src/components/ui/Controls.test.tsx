import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';
import { Input } from './Input';
import { PasswordInput } from './PasswordInput';
import { Switch } from './Switch';
import { Checkbox } from './Checkbox';
import { Select } from './Select';
import { ToastProvider, useToast } from './Toast';
import { ErrorState } from '@/components/common/ErrorState';
import { ApiError } from '@/lib/apiClient';
import { ConfirmReason } from '@/components/common/ConfirmReason';

describe('Button', () => {
  it('replaces the label with a spinner and disables while loading', async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    );
    const b = screen.getByRole('button');
    expect(b).toBeDisabled();
    expect(b).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByText('Save')).toBeNull();
    await userEvent.click(b);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('Input', () => {
  it('wires label, hint, error, aria-invalid and aria-describedby', () => {
    const { rerender } = render(<Input label="Name" hint="As on your ID" />);
    expect(screen.getByLabelText('Name')).toHaveAccessibleDescription('As on your ID');
    expect(screen.getByLabelText('Name')).not.toHaveAttribute('aria-invalid');
    rerender(<Input label="Name" hint="As on your ID" error="Required" />);
    expect(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Name')).toHaveAccessibleDescription('Required');
  });
});

describe('PasswordInput', () => {
  it('toggles visibility with aria-pressed', async () => {
    render(<PasswordInput label="Password" />);
    const field = screen.getByLabelText('Password', { selector: 'input' });
    expect(field).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(field).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('Switch, Checkbox, Select', () => {
  it('Switch exposes role switch and toggles', async () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} label="Remember" />);
    await userEvent.click(screen.getByRole('switch', { name: 'Remember' }));
    expect(onChange).toHaveBeenCalledWith(true);
  });
  it('Checkbox shows an error with aria-invalid', () => {
    render(<Checkbox label="Agree" error="Tick this" />);
    expect(screen.getByLabelText('Agree')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Agree')).toHaveAccessibleDescription('Tick this');
  });
  it('Select renders options', () => {
    render(
      <Select
        label="Language"
        options={[
          { value: 'en', label: 'English' },
          { value: 'hi', label: 'Hindi' },
        ]}
      />,
    );
    expect(screen.getByRole('combobox', { name: 'Language' })).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(2);
  });
});

describe('Toast', () => {
  it('shows a message and removes it after 4 seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    function Fire() {
      const t = useToast();
      return <button onClick={() => t.show('Saved')}>go</button>;
    }
    render(
      <ToastProvider>
        <Fire />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByText('go'));
    expect(screen.getByText('Saved')).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3900);
    });
    expect(screen.getByText('Saved')).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(screen.queryByText('Saved')).toBeNull();
    vi.useRealTimers();
  });
});

describe('ErrorState', () => {
  it('shows the request id', () => {
    render(<ErrorState error={new ApiError(500, 'INTERNAL_ERROR', 'Boom', undefined, 'req_abc')} />);
    expect(screen.getByText('Boom')).toBeInTheDocument();
    expect(screen.getByText('req_abc')).toBeInTheDocument();
  });
});

describe('ConfirmReason', () => {
  it('needs a reason of at least 5 characters', async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmReason open title="Remove" onCancel={() => {}} onConfirm={onConfirm} confirmLabel="Remove" />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/Reason/)).toHaveAttribute('aria-invalid', 'true');
    await userEvent.type(screen.getByLabelText(/Reason/), 'no longer needed');
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onConfirm).toHaveBeenCalledWith('no longer needed');
  });
});
