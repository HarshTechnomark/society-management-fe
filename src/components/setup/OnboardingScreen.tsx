'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { ConfirmReason } from '@/components/common/ConfirmReason';
import { ErrorState } from '@/components/common/ErrorState';
import { Alert } from '@/components/ui/Alert';
import { Button, buttonClasses } from '@/components/ui/Button';
import { PERMISSIONS } from '@/constants/permissions';
import { cx } from '@/components/ui/cx';
import { ApiError } from '@/lib/apiClient';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { societySetupService } from '@/services/society-setup.service';
import type { Onboarding, SocietyProfile, StepKey } from '@/types/societySetup';
import { Gate } from './Gate';
import {
  BillingStep,
  ExternalStep,
  GoLiveStep,
  ProfileStep,
  StructureStep,
  UnitsStep,
  stepError,
  type StepProps,
} from './OnboardingSteps';
import { STEP_LABEL } from './format';

/** The onboarding wizard (spec 11.1): progress, 8 steps, skip with a reason, go live. Needs no plan feature. */
export function OnboardingScreen() {
  return (
    <Gate view={PERMISSIONS.settings.society.view} title="Setup">
      <Inner />
    </Gate>
  );
}

function Inner() {
  const canEdit = usePermission(PERMISSIONS.settings.society.edit);
  const ob = useLoad(() => societySetupService.onboarding());
  const society = useLoad(() => societySetupService.society());
  if (ob.error || society.error)
    return (
      <Page>
        <PageHead title="Set up your society" />
        <Card>
          <ErrorState
            error={ob.error ?? society.error}
            action={
              <button
                className="underline"
                onClick={() => {
                  ob.reload();
                  society.reload();
                }}
              >
                Try again
              </button>
            }
          />
        </Card>
      </Page>
    );
  if (!ob.data || !society.data)
    return (
      <Page>
        <PageHead title="Set up your society" />
        <div className="grid gap-4 md:grid-cols-[260px_1fr]" aria-busy="true">
          <div className="skeleton h-72 w-full" />
          <div className="skeleton h-72 w-full" />
        </div>
      </Page>
    );
  return <Wizard initial={ob.data} initialSociety={society.data} canEdit={canEdit} />;
}

function Wizard({
  initial,
  initialSociety,
  canEdit,
}: {
  initial: Onboarding;
  initialSociety: SocietyProfile;
  canEdit: boolean;
}) {
  const [ob, setOb] = useState(initial);
  const [society, setSociety] = useState(initialSociety);
  const [active, setActive] = useState<StepKey>(initial.currentStep);
  const [skipFor, setSkipFor] = useState<StepKey | null>(null);
  const [goBusy, setGoBusy] = useState(false);
  const [goError, setGoError] = useState<string | null>(null);
  const [failing, setFailing] = useState<{ stepKey: string; message: string }[]>([]);
  const [reopenError, setReopenError] = useState<string | null>(null);

  const refresh = async () => setOb(await societySetupService.onboarding());

  if (ob.isLive)
    return (
      <Page>
        <Card>
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <h1 className="text-[22px] font-bold">{society.name} is live</h1>
            <p className="text-[14px] text-muted">Setup is complete.</p>
            <Link href="/admin" className={cx(buttonClasses('primary', 'md'), 'mt-3')}>
              Go to Today
            </Link>
          </div>
        </Card>
      </Page>
    );

  const steps = ob.steps;
  const idx = Math.max(
    0,
    steps.findIndex(s => s.stepKey === active),
  );
  const step = steps[idx];
  const prev = idx > 0 ? steps[idx - 1].stepKey : null;
  const next = idx < steps.length - 1 ? steps[idx + 1].stepKey : null;

  const finish = async () => {
    if (step.status === 'PENDING') setOb(await societySetupService.completeStep(step.stepKey));
    if (next) setActive(next);
  };

  const props: StepProps = {
    ob,
    step,
    society,
    canEdit,
    finish,
    back: prev ? () => setActive(prev) : null,
    skip: step.skippable && canEdit ? () => setSkipFor(step.stepKey) : null,
    reload: () => void refresh(),
    onSociety: setSociety,
  };

  const goLive = async () => {
    setGoBusy(true);
    setGoError(null);
    setFailing([]);
    try {
      setOb(await societySetupService.goLive());
    } catch (e) {
      setGoError(stepError(e));
      if (e instanceof ApiError && e.code === 'ONBOARDING_NOT_READY')
        setFailing((e.errors ?? []).map(x => ({ stepKey: x.field, message: x.message })));
      void refresh().catch(() => undefined);
    } finally {
      setGoBusy(false);
    }
  };

  const reopen = async () => {
    setReopenError(null);
    try {
      setOb(await societySetupService.reopenStep(step.stepKey as Exclude<StepKey, 'GO_LIVE'>));
    } catch (e) {
      setReopenError(stepError(e));
    }
  };

  let body;
  switch (step.stepKey) {
    case 'PROFILE':
      body = <ProfileStep key="p" {...props} />;
      break;
    case 'STRUCTURE':
      body = <StructureStep key="s" {...props} />;
      break;
    case 'UNITS':
      body = <UnitsStep key="u" {...props} />;
      break;
    case 'RESIDENTS':
      body = (
        <ExternalStep
          key="r"
          props={props}
          title="Residents"
          text="Add owners and tenants with their mobile numbers so they can receive invites."
        />
      );
      break;
    case 'BILLING':
      body = <BillingStep key="b" {...props} />;
      break;
    case 'PAYMENTS':
      body = (
        <ExternalStep
          key="pay"
          props={props}
          title="Bank account and payments"
          text="Online payments from residents settle to your verified bank account."
        />
      );
      break;
    case 'COMMITTEE':
      body = (
        <ExternalStep
          key="c"
          props={props}
          title="Invite the committee"
          text="Chairman, treasurer and secretary can approve each other's work."
          link={{ href: '/admin/team', label: 'Open team' }}
        />
      );
      break;
    default:
      body = (
        <GoLiveStep
          key="g"
          ob={ob}
          canEdit={canEdit}
          back={props.back}
          onGoLive={goLive}
          failing={failing}
          busy={goBusy}
          error={goError}
        />
      );
  }

  return (
    <Page>
      <PageHead
        title="Set up your society"
        sub={`${society.name} · step ${step.stepNo} of 8. Each step saves on its own and you can resume any time.`}
      />
      <div className="grid gap-4 md:grid-cols-[260px_1fr]">
        <Card>
          <div
            role="progressbar"
            aria-label="Setup progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={ob.progressPercent}
            className="mb-1 h-2 overflow-hidden rounded-full bg-[rgba(20,35,44,0.12)]"
          >
            <div className="h-full rounded-full bg-navy" style={{ width: `${ob.progressPercent}%` }} />
          </div>
          <p className="mb-3 text-[12.5px] text-muted">{ob.progressPercent}% done</p>
          <ol aria-label="Steps">
            {steps.map(s => (
              <li key={s.stepKey}>
                <button
                  type="button"
                  onClick={() => setActive(s.stepKey)}
                  aria-current={s.stepKey === step.stepKey ? 'step' : undefined}
                  className={cx(
                    'flex w-full items-center gap-2.5 rounded-full px-2 py-1.5 text-left text-[14px] font-semibold',
                    s.stepKey === step.stepKey ? 'bg-navy text-[#FDF8EE]' : 'hover:bg-black/5',
                  )}
                >
                  <span
                    className={cx(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px]',
                      s.status === 'DONE'
                        ? 'bg-ok text-white'
                        : s.status === 'SKIPPED'
                          ? 'bg-[rgba(20,35,44,0.25)] text-white'
                          : 'bg-white/80 text-ink',
                    )}
                  >
                    {s.status === 'DONE' ? <span aria-hidden="true">✓</span> : s.stepNo}
                  </span>
                  <span>
                    {STEP_LABEL[s.stepKey]}
                    {s.status === 'DONE' && <span className="sr-only"> (done)</span>}
                    {s.status === 'SKIPPED' && (
                      <span className="ml-1 text-[11.5px] font-medium opacity-70">skipped</span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </Card>
        <Card>
          {step.status !== 'PENDING' && step.stepKey !== 'GO_LIVE' && canEdit && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-[12px] bg-white/55 px-3 py-2 text-[13px]">
              <span>{step.status === 'DONE' ? 'This step is done.' : 'You skipped this step.'}</span>
              <Button size="xs" variant="glass" onClick={reopen}>
                Reopen step
              </Button>
            </div>
          )}
          {goError && step.stepKey !== 'GO_LIVE' && <Alert tone="bad">{goError}</Alert>}
          {reopenError && (
            <p role="alert" className="mb-2 text-[13px] font-medium text-bad">
              {reopenError}
            </p>
          )}
          {body}
        </Card>
      </div>
      <ConfirmReason
        open={skipFor !== null}
        title="Skip this step for now?"
        description="You can finish it later from Settings. The reason is kept in the audit trail."
        confirmLabel="Skip step"
        variant="primary"
        minLength={5}
        onCancel={() => setSkipFor(null)}
        onConfirm={async reason => {
          const key = skipFor!;
          try {
            setOb(await societySetupService.skipStep(key, reason));
            setSkipFor(null);
            const i = steps.findIndex(s => s.stepKey === key);
            if (i < steps.length - 1) setActive(steps[i + 1].stepKey);
          } catch (e) {
            setSkipFor(null);
            setGoError(stepError(e));
          }
        }}
      />
    </Page>
  );
}
