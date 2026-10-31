import { useEffect, useState } from 'react';

/** Seconds left until `target` (ISO string, epoch ms or null). Ticks once a second. */
export function useCountdown(target: string | number | null | undefined): number {
  const t = target == null ? null : typeof target === 'number' ? target : Date.parse(target);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (t === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [t]);
  return t === null ? 0 : Math.max(0, Math.ceil((t - now) / 1000));
}
