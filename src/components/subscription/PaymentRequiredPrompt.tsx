'use client';
import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button, buttonClasses } from '@/components/ui/Button';
import { ApiError, configureApiClient } from '@/lib/apiClient';
import { getMe } from '@/lib/auth';
import { PERMISSIONS } from '@/constants/permissions';
import { hasPermission } from '@/hooks/usePermission';
import { describePlanLock, SUBSCRIPTION_PATH, type PlanLock } from './planLock';

/**
 * The global 402 handler (spec 11.4). The API client reports every 402; this shows "Not in your plan" with
 * **See plans** to holders of `settings.subscription.view`, and "Not available in your plan" to everyone else.
 * Residents and guards never see an upgrade prompt.
 */
export function PaymentRequiredPrompt() {
  const [lock, setLock] = useState<{ lock: PlanLock; upgrade: boolean } | null>(null);
  useEffect(() => {
    configureApiClient({
      paymentRequired: (e: ApiError) => {
        const me = getMe();
        const upgrade =
          !!me &&
          me.session.clientApp === 'ADMIN' &&
          hasPermission(me, PERMISSIONS.settings.subscription.view);
        const l = describePlanLock(e, upgrade);
        if (l) setLock({ lock: l, upgrade });
      },
    });
    return () => configureApiClient({ paymentRequired: null });
  }, []);
  if (!lock) return null;
  const close = () => setLock(null);
  return (
    <Modal
      open
      onClose={close}
      title={lock.lock.title}
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Close
          </Button>
          {lock.upgrade && (
            <a href={SUBSCRIPTION_PATH} className={buttonClasses('primary')}>
              See plans
            </a>
          )}
        </>
      }
    >
      <p className="text-[14px]">{lock.lock.text}</p>
    </Modal>
  );
}
