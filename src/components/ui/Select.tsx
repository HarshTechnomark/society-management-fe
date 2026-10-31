import type { SelectHTMLAttributes } from 'react';
import { cx } from './cx';
import { FieldShell, inputBase, useField, type FieldProps } from './Field';

interface Props extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'>, FieldProps {
  options: { value: string; label: string }[];
}

export function Select({ label, hint, error, required, options, className, ...rest }: Props) {
  const f = useField({ hint, error });
  return (
    <FieldShell
      id={f.id}
      label={label}
      hint={hint}
      hintId={f.hintId}
      error={error}
      errorId={f.errorId}
      required={required}
    >
      <select
        id={f.id}
        required={required}
        aria-invalid={f.invalid}
        aria-describedby={f.describedBy}
        className={cx(inputBase, error ? 'border-bad' : 'border-[rgba(20,35,44,0.16)]', className)}
        {...rest}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}
