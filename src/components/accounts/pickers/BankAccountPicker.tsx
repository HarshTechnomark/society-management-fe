'use client';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useLoad } from '@/hooks/useLoad';
import { accountsBankService } from '@/services/accountsBank.service';

interface Props {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
}

/**
 * Chooses an active bank account from `GET /accounts/bank-accounts`. When that list is not available (404, or
 * empty) the account number known to the books is typed instead.
 */
export function BankAccountPicker({ value, onChange, label = 'Bank account', hint, error, required }: Props) {
  const banks = useLoad(() => accountsBankService.options());
  const list = banks.data ?? [];
  if (banks.error != null || (!banks.loading && list.length === 0))
    return (
      <Input
        label="Bank account ID"
        inputMode="numeric"
        value={value}
        error={error}
        onChange={e => onChange(e.target.value.replace(/\D/g, ''))}
        hint="The bank account list is not available yet."
        required={required}
      />
    );
  return (
    <Select
      label={label}
      value={value}
      error={error}
      hint={hint}
      onChange={e => onChange(e.target.value)}
      options={[
        { value: '', label: banks.loading ? 'Loading...' : 'Choose a bank account' },
        ...list.map(b => ({ value: String(b.id), label: b.label })),
      ]}
      required={required}
    />
  );
}
