'use client';
import { useEffect } from 'react';
import { useToast } from '@/components/ui/Toast';
import { emitStatusChanged } from '@/components/societies/events';
import { configureApiClient } from '@/lib/apiClient';

/**
 * Answers a 423 from the API (module 05 A-04): `SOCIETY_SUSPENDED` shows the "action is paused" toast; both codes ask
 * the admin shell to reload `/society-status`, which shows the suspended banner or the closed page. Write buttons stay
 * visible; the API decides.
 */
export function SuspendedBanner() {
  const { show } = useToast();
  useEffect(() => {
    configureApiClient({
      suspended: (_message, code) => {
        show(
          code === 'SOCIETY_CLOSED'
            ? 'This society has closed its SocietyApp account.'
            : 'Your society’s account is suspended. This action is paused.',
          'warning',
        );
        emitStatusChanged();
      },
    });
    return () => configureApiClient({ suspended: null });
  }, [show]);
  return null;
}
