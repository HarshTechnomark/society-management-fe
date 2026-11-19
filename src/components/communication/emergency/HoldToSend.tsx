'use client';
import { useEffect, useRef, useState } from 'react';
import { cx } from '@/components/ui/cx';

/**
 * Press and hold for 1.5 seconds (spec 11.4; the same control is used on phones instead of a slide).
 * Keyboard: hold Enter or Space. Releasing early cancels. The fill bar shows the progress.
 */
export function HoldToSend({
  label,
  onConfirm,
  disabled,
  holdMs = 1500,
}: {
  label: string;
  onConfirm: () => void;
  disabled?: boolean;
  holdMs?: number;
}) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirmRef = useRef(onConfirm);
  useEffect(() => {
    confirmRef.current = onConfirm;
  });
  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
  };
  const start = () => {
    if (disabled || timer.current) return;
    setHolding(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      setHolding(false);
      confirmRef.current();
    }, holdMs);
  };
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return (
    <button
      type="button"
      disabled={disabled}
      aria-describedby="hold-hint"
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onKeyDown={e => {
        if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
          e.preventDefault();
          start();
        }
      }}
      onKeyUp={e => {
        if (e.key === 'Enter' || e.key === ' ') stop();
      }}
      onBlur={stop}
      className={cx(
        'relative h-11 select-none touch-none overflow-hidden rounded-full bg-bad px-5 text-[14.5px] font-semibold text-white',
        'disabled:cursor-not-allowed disabled:opacity-55',
      )}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 bg-[#5c0f0b]/60"
        style={{ width: holding ? '100%' : '0%', transition: holding ? `width ${holdMs}ms linear` : 'none' }}
      />
      <span className="relative">{label}</span>
      <span id="hold-hint" className="sr-only">
        Press and hold for one and a half seconds to send
      </span>
    </button>
  );
}
