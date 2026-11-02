'use client';
import type { ReactNode } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { Page } from '@/components/common/PageHead';
import { FeatureGate, PlanLocked } from '@/components/subscription/FeatureGate';
import type { PermissionKey } from '@/constants/permissions';
import { usePermission } from '@/hooks/usePermission';
import { useMe } from '@/lib/auth';

/**
 * Wraps a module 08 screen: the view permission first (hiding is a convenience, the API decides), then the plan
 * entitlement (`FeatureGate` shows "Not in your plan").
 */
export function Gate({
  view,
  feature,
  title,
  children,
}: {
  view: PermissionKey;
  feature?: string;
  title: string;
  children: ReactNode;
}) {
  const { ready } = useMe();
  const can = usePermission(view);
  if (!ready)
    return (
      <Page>
        <div className="skeleton h-40 w-full" />
      </Page>
    );
  if (!can)
    return (
      <Page>
        <EmptyState
          title="You do not have access"
          text={`Ask your chairman or secretary for access to ${title}.`}
        />
      </Page>
    );
  if (!feature) return <>{children}</>;
  return (
    <FeatureGate
      feature={feature}
      title={title}
      fallback={
        <Page>
          <PlanLocked title={title} />
        </Page>
      }
    >
      {children}
    </FeatureGate>
  );
}
