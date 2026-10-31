'use client';
import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react';
import { cx } from './cx';

interface Props {
  value: string;
  onChange: (value: string) => void;
  /** Called once when the sixth digit is entered (typed or pasted). */
  onComplete?: (code: string) => void;
  length?: number;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
  label?: string;
  describedBy?: string;
}

/** Six numeric boxes: paste fills all, the last digit auto-submits, Backspace moves back, arrows move. */
export function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
  disabled,
  invalid,
  autoFocus,
  label = 'Verification code',
  describedBy,
}: Props) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const focus = (i: number) => refs.current[Math.max(0, Math.min(length - 1, i))]?.focus();

  const commit = (next: string) => {
    onChange(next);
    if (next.length === length) onComplete?.(next);
  };

  const setAt = (i: number, digits: string) => {
    const chars = value.padEnd(length, ' ').split('');
    let at = i;
    for (const d of digits) {
      if (at >= length) break;
      chars[at++] = d;
    }
    commit(chars.join('').replace(/ +$/, '').replace(/ /g, ''));
    focus(Math.min(at, length - 1));
  };

  const onInput = (i: number, raw: string) => {
    let digits = raw.replace(/\D/g, '');
    // Typing into a filled box: keep only the new digit.
    if (value[i] && digits.length === 2) digits = digits.replace(value[i], '');
    if (!digits) return;
    setAt(i, digits);
  };

  const onKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (value[i]) onChange(value.slice(0, i) + value.slice(i + 1));
      else if (i > 0) {
        onChange(value.slice(0, i - 1) + value.slice(i));
        focus(i - 1);
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focus(i - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      focus(i + 1);
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!digits) return;
    e.preventDefault();
    commit(digits);
    focus(digits.length >= length ? length - 1 : digits.length);
  };

  return (
    <div
      role="group"
      aria-label={label}
      aria-describedby={describedBy}
      className={cx('my-1.5 mb-3.5 flex justify-between gap-2.5 max-[700px]:gap-1.5', invalid && 'otp-shake')}
    >
      {Array.from({ length }, (_, i) => (
        <input
          key={i}
          ref={el => {
            refs.current[i] = el;
          }}
          value={value[i] ?? ''}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={length}
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          autoFocus={autoFocus && i === 0}
          disabled={disabled}
          aria-label={`Digit ${i + 1} of ${length}`}
          aria-invalid={invalid || undefined}
          onChange={e => onInput(i, e.target.value)}
          onKeyDown={e => onKeyDown(i, e)}
          onPaste={onPaste}
          onFocus={e => e.target.select()}
          className={cx(
            'h-[60px] w-full min-w-0 rounded-[16px] border-[1.5px] bg-white/80 text-center text-[26px] font-bold tabular-nums caret-gold max-[700px]:h-[54px] max-[700px]:text-[22px]',
            'focus:border-navy focus:bg-white focus:outline-none focus:ring-4 focus:ring-[rgba(20,48,65,0.12)] disabled:opacity-60',
            invalid ? 'border-bad' : 'border-[rgba(20,35,44,0.16)]',
          )}
        />
      ))}
    </div>
  );
}
