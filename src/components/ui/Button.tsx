import type { ButtonHTMLAttributes } from 'react';
import { cx } from './cx';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'gold' | 'glass' | 'ghost' | 'danger' | 'danger-soft';
export type ButtonSize = 'md' | 'sm' | 'xs';

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-navy text-[#FDF8EE] hover:bg-[#1d4358]',
  gold: 'bg-[#c9a961] text-[#2b2210] hover:bg-[#d3b673]',
  glass: 'bg-white/60 text-ink border border-white/80 hover:bg-white/80',
  ghost: 'bg-transparent text-navy hover:bg-black/5',
  danger: 'bg-bad text-white hover:bg-[#9a1f18]',
  'danger-soft': 'bg-[#f6dcda] text-[#8a1d17] hover:bg-[#f1c9c6]',
};
const SIZE: Record<ButtonSize, string> = {
  md: 'h-11 px-5 text-[14.5px]',
  sm: 'h-9 px-4 text-[13.5px]',
  xs: 'h-[30px] px-3 text-[12.5px]',
};

export function buttonClasses(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', block = false) {
  return cx(
    'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors',
    'disabled:cursor-not-allowed disabled:opacity-55 aria-disabled:opacity-55',
    VARIANT[variant],
    SIZE[size],
    block && 'w-full',
  );
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  loading?: boolean;
}

/** While `loading` the label is replaced by a spinner and the button is disabled. */
export function Button({
  variant,
  size,
  block,
  loading,
  disabled,
  children,
  className,
  type = 'button',
  ...rest
}: Props) {
  return (
    <button
      type={type}
      className={cx(buttonClasses(variant, size, block), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <>
          <Spinner />
          <span className="sr-only">Please wait</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
