import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cx } from './cx';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'> {
  label: ReactNode;
  error?: string | null;
}

export function Checkbox({ label, error, className, ...rest }: Props) {
  const id = useId();
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className={cx('mb-4', className)}>
      <label htmlFor={id} className="flex cursor-pointer items-start gap-2.5 text-[14px] text-ink">
        <input
          id={id}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[#143041]"
          {...rest}
        />
        <span>{label}</span>
      </label>
      {error && (
        <p id={errorId} className="mt-1 text-[12.5px] font-medium text-bad">
          {error}
        </p>
      )}
    </div>
  );
}
