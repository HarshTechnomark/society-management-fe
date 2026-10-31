import { useEffect, useState } from 'react';

/** Seconds left until `target` (ISO string, epoch ms or null). Re-renders once a second while it is running. */
/** The wall clock; a function so render code reads it through one place tests can control. */
const clock = () => Date.now();

export function useCountdown(target: string | number | null | undefined): number {
  const t = target == null ? null : typeof target === 'number' ? target : Date.parse(target);
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (t === null) return;
    const id = setInterval(() => setNow(clock()), 1000);
    return () => clearInterval(id);
  }, [t]);
  // `now` only triggers the re-render; the value is always computed from the clock.
  void now;
  return t === null ? 0 : Math.max(0, Math.ceil((t - clock()) / 1000));
}
