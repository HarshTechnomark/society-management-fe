import type { Ref, TextareaHTMLAttributes } from 'react';
import { cx } from './cx';
import { FieldShell, useField, type FieldProps } from './Field';

interface Props extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'>, FieldProps {
  ref?: Ref<HTMLTextAreaElement>;
}

/** Multi-line text with the same label, hint and error wiring as `Input`. */
export function Textarea({ label, hint, error, required, className, rows = 3, ref, ...rest }: Props) {
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
      <textarea
        ref={ref}
        id={f.id}
        rows={rows}
        required={required}
        aria-invalid={f.invalid}
        aria-describedby={f.describedBy}
        className={cx(
          'w-full rounded-[16px] border-[1.5px] bg-white/80 px-4 py-3 text-[15px] text-ink',
          'focus:border-navy focus:bg-white focus:outline-none focus:ring-4 focus:ring-[rgba(20,48,65,0.12)] disabled:opacity-60',
          error ? 'border-bad' : 'border-[rgba(20,35,44,0.16)]',
          className,
        )}
        {...rest}
      />
    </FieldShell>
  );
}
