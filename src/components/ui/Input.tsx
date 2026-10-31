import type { InputHTMLAttributes, ReactNode, Ref } from 'react';
import { cx } from './cx';
import { FieldShell, inputBase, useField, type FieldProps } from './Field';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'>, FieldProps {
  /** A control placed inside the right edge, for example the show/hide button. */
  trailing?: ReactNode;
  ref?: Ref<HTMLInputElement>;
}

export function Input({ label, hint, error, required, trailing, className, ref, ...rest }: Props) {
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
      <div className="relative">
        <input
          ref={ref}
          id={f.id}
          required={required}
          aria-invalid={f.invalid}
          aria-describedby={f.describedBy}
          className={cx(
            inputBase,
            error ? 'border-bad' : 'border-[rgba(20,35,44,0.16)]',
            !!trailing && 'pr-12',
            className,
          )}
          {...rest}
        />
        {trailing && <div className="absolute inset-y-0 right-1.5 flex items-center">{trailing}</div>}
      </div>
    </FieldShell>
  );
}
