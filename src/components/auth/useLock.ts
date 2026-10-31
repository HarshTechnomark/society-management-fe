'use client';
import { useState } from 'react';
import { useCountdown } from '@/hooks/useCountdown';

/** Tracks an `ACCOUNT_LOCKED` lockout: `lock(seconds)` starts it, `left` counts down, `locked` is true until zero. */
export function useLock() {
  const [until, setUntil] = useState<number | null>(null);
  const left = useCountdown(until);
  return { left, locked: left > 0, lock: (seconds: number) => setUntil(Date.now() + seconds * 1000) };
}
