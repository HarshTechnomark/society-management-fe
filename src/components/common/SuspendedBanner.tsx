'use client';
import { useEffect, useState } from 'react';
import { configureApiClient } from '@/lib/apiClient';

/** Shown when the API answers 423 (society suspended). */
export function SuspendedBanner() {
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    configureApiClient({ suspended: m => setMessage(m || 'This society is suspended.') });
    return () => configureApiClient({ suspended: null });
  }, []);
  if (!message) return null;
  return (
    <div
      role="alert"
      className="sticky top-0 z-40 bg-[#6f4200] px-4 py-2 text-center text-[13.5px] font-semibold text-white"
    >
      {message} Ask your society admin or SocietyApp support.
    </div>
  );
}
