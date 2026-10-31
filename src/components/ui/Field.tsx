import { useId, type ReactNode } from 'react';
import { cx } from './cx';

export interface FieldProps {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
}

/** Shared wiring: label above, hint below, inline error with icon, aria-invalid and aria-describedby. */
export function useField({ hint, error }: Pick<FieldProps, 'hint' | 'error'>) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;
  return { id, hintId, errorId, describedBy, invalid: error ? true : undefined };
}

export function FieldShell({
  id,
  label,
  hint,
  hintId,
  error,
  errorId,
  required,
  children,
  className,
}: FieldProps & { id: string; hintId?: string; errorId?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cx('mb-4', className)}>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-semibold text-ink">
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {children}
      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-[12.5px] text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1.5 flex items-start gap-1.5 text-[12.5px] font-medium text-bad">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            className="mt-0.5 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v6M12 16.5v.5" strokeLinecap="round" />
          </svg>
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

export const inputBase =
  'w-full h-12 rounded-[16px] border-[1.5px] bg-white/80 px-4 text-[15px] text-ink ' +
  'focus:border-navy focus:bg-white focus:outline-none focus:ring-4 focus:ring-[rgba(20,48,65,0.12)] disabled:opacity-60';
