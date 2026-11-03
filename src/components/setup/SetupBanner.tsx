'use client';
import Link from 'next/link';
import { Alert } from '@/components/ui/Alert';
import { buttonClasses } from '@/components/ui/Button';
import { PERMISSIONS } from '@/constants/permissions';
import { useAnyPermission } from '@/hooks/usePermission';
import { useLoad } from '@/hooks/useLoad';
import { societySetupService } from '@/services/society-setup.service';

/** "Setup in progress" on Today until the society is live (spec 11.1). Hidden when the status cannot be read. */
export function SetupBanner() {
  const can = useAnyPermission(PERMISSIONS.settings.society.view, PERMISSIONS.settings.society.edit);
  const { data } = useLoad(() => (can ? societySetupService.onboarding() : Promise.resolve(null)), can);
  if (!can || !data || data.isLive) return null;
  const step = data.steps.find(s => s.stepKey === data.currentStep);
  return (
    <Alert tone="info">
      <span className="flex flex-wrap items-center gap-3">
        <span>
          Setup in progress: step {step?.stepNo ?? 1} of 8, {data.progressPercent}% done.
        </span>
        <Link href="/admin/setup" className={buttonClasses('glass', 'xs')}>
          Continue setup
        </Link>
      </span>
    </Alert>
  );
}
