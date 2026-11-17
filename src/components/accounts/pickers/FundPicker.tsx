'use client';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useLoad } from '@/hooks/useLoad';
import { accountsFundsService } from '@/services/accountsFunds.service';

interface Props {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  /** Adds a first "General (not earmarked)" choice with the value `general`. */
  includeGeneral?: boolean;
  /** A fund that must not be offered (the other side of a transfer). */
  excludeId?: number | null;
}

/**
 * Chooses an active fund from `GET /accounts/funds`. When that list is not available (404, or no funds yet) the
 * fund number is typed instead, so older deployments keep working.
 */
export function FundPicker({
  value,
  onChange,
  label = 'Fund',
  hint = 'The money collected lands in this fund.',
  error,
  required,
  includeGeneral,
  excludeId,
}: Props) {
  const funds = useLoad(() => accountsFundsService.options());
  const list = (funds.data ?? []).filter(f => f.id !== excludeId);
  if (funds.loading)
    return (
      <Select
        label={label}
        value=""
        onChange={() => {}}
        options={[{ value: '', label: 'Loading funds' }]}
        disabled
      />
    );
  if (list.length === 0 && !includeGeneral)
    return (
      <Input
        label="Fund number"
        inputMode="numeric"
        value={value}
        error={error}
        hint="The list of funds is not available yet. Enter the number of the fund the money goes to."
        onChange={e => onChange(e.target.value.replace(/\D/g, ''))}
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
        { value: '', label: 'Choose a fund' },
        ...(includeGeneral ? [{ value: 'general', label: 'General (not earmarked)' }] : []),
        ...list.map(f => ({ value: String(f.id), label: f.label })),
      ]}
      required={required}
    />
  );
}
