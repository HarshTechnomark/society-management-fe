'use client';
import type { ReactNode } from 'react';
import { buttonClasses } from '@/components/ui/Button';
import { useFeature } from '@/hooks/useFeature';
import { usePermission } from '@/hooks/usePermission';
import { PERMISSIONS } from '@/constants/permissions';
import { useMe } from '@/lib/auth';
import { SUBSCRIPTION_PATH } from './planLock';

/** What a locked area shows: a prompt with **See plans** for holders of `settings.subscription.view`. */
export function PlanLocked({ title }: { title?: string }) {
  const canSee = usePermission(PERMISSIONS.settings.subscription.view);
  return (
    <div role="status" className="glass flex flex-col items-center gap-2 p-6 text-center">
      <h2 className="text-[17px] font-bold">{canSee ? 'Not in your plan' : 'Not available in your plan'}</h2>
      <p className="max-w-sm text-[14px] text-muted">
        {canSee
          ? `${title ?? 'This feature'} is not part of your current plan. Compare plans to unlock it.`
          : `${title ?? 'This feature'} is not available in your plan.`}
      </p>
      {canSee && (
        <a href={SUBSCRIPTION_PATH} className={buttonClasses('primary', 'sm')}>
          See plans
        </a>
      )}
    </div>
  );
}

/** Renders `children` when the plan includes `feature`; otherwise `fallback` (default: the locked prompt). */
export function FeatureGate({
  feature,
  title,
  fallback,
  children,
}: {
  feature: string;
  title?: string;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const on = useFeature(feature);
  const { ready } = useMe();
  if (!ready) return null;
  if (on) return <>{children}</>;
  return <>{fallback ?? <PlanLocked title={title} />}</>;
}
