'use client';
import { useState, type InputHTMLAttributes } from 'react';
import { Input } from './Input';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'> {
  label: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
}

/** Password field with a show/hide button (`aria-pressed`). */
export function PasswordInput(props: Props) {
  const [shown, setShown] = useState(false);
  return (
    <Input
      {...props}
      type={shown ? 'text' : 'password'}
      trailing={
        <button
          type="button"
          onClick={() => setShown(s => !s)}
          aria-pressed={shown}
          aria-label={shown ? 'Hide password' : 'Show password'}
          className="h-9 rounded-full px-3 text-[12.5px] font-semibold text-navy hover:bg-black/5"
        >
          {shown ? 'Hide' : 'Show'}
        </button>
      }
    />
  );
}
