'use client';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Switch } from '@/components/ui/Switch';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { ErrorState } from '@/components/common/ErrorState';
import { useLoad } from '@/hooks/useLoad';
import { ApiError } from '@/lib/apiClient';
import { shortDate } from '@/lib/money';
import { committeeService } from '@/services/committee.service';
import type { ActivationResult } from '@/types/committee';
import { committeeErrorFull, committeeError, plainError, skippedText, today } from './format';
import { PlanView } from './PlanView';

const iso = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

type Step = 'plan' | 'confirm' | 'done';

/**
 * Activation wizard (spec 11.4): step 1 "What will change" (the preview plan), step 2 "Confirm" (date, resolution,
 * reason, announce), then the result. The API asks for a fresh sign in on activate; the API client opens it.
 * `COMMITTEE_PREVIEW_STALE` reloads step 1 with the updated plan.
 */
export function ActivationWizard({
  termId,
  termName,
  startDate,
  draftVersion,
  ending,
  onClose,
  onDone,
}: {
  termId: number;
  termName: string;
  startDate: string | null;
  draftVersion: number;
  ending?: { name: string; endDate: string } | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [step, setStep] = useState<Step>('plan');
  const [gen, setGen] = useState(0);
  const [stale, setStale] = useState(false);
  const preview = useLoad(() => committeeService.activationPreview(termId), `${termId}-${gen}`);
  const plan = preview.data;
  const [tookChargeOn, setTook] = useState(today());
  const [resolutionRef, setResolution] = useState('');
  const [reason, setReason] = useState('');
  const [announce, setAnnounce] = useState(true);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ActivationResult | null>(null);

  const blocked = !plan || plan.blockers.length > 0;
  const finish = () => {
    if (result) onDone();
    else onClose();
  };

  const activate = async () => {
    if (!plan) return;
    setProblem(null);
    const e: Record<string, string> = {};
    if (!iso(tookChargeOn)) e.tookChargeOn = 'Choose the date the committee takes charge.';
    else if (tookChargeOn > today()) e.tookChargeOn = 'The date cannot be in the future.';
    else if (startDate && tookChargeOn < startDate)
      e.tookChargeOn = `The committee starts on ${shortDate(startDate)}. Choose that date or later.`;
    const res = resolutionRef.trim();
    if (res.length < 3 || res.length > 100)
      e.resolutionRef = 'Enter the resolution reference (3 to 100 characters).';
    const why = reason.trim();
    if (why.length < 5 || why.length > 500) e.reason = 'Enter a reason of 5 to 500 characters.';
    setErrs(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const r = await committeeService.activate(termId, {
        version: plan.termVersion || draftVersion,
        previewHash: plan.previewHash,
        tookChargeOn,
        resolutionRef: res,
        reason: why,
        announceToResidents: announce,
      });
      setResult(r);
      setStep('done');
      toast.show('The new committee has taken charge.');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'COMMITTEE_PREVIEW_STALE') {
        setStale(true);
        setStep('plan');
        setGen(g => g + 1);
      } else {
        setProblem(committeeErrorFull(err));
      }
    } finally {
      setBusy(false);
    }
  };

  const title =
    step === 'plan'
      ? 'Activate committee: what will change'
      : step === 'confirm'
        ? 'Confirm activation'
        : 'Done';
  const footer =
    step === 'plan' ? (
      <>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={blocked || preview.loading} onClick={() => setStep('confirm')}>
          Continue
        </Button>
      </>
    ) : step === 'confirm' ? (
      <>
        <Button variant="ghost" disabled={busy} onClick={() => setStep('plan')}>
          Back
        </Button>
        <Button loading={busy} disabled={blocked || reason.trim().length < 5} onClick={() => void activate()}>
          Activate committee
        </Button>
      </>
    ) : (
      <Button onClick={finish}>Done</Button>
    );

  return (
    <Modal
      open
      wide
      sticky={step === 'done' ? false : busy}
      onClose={finish}
      title={title}
      description={step === 'done' ? undefined : `${termName}. Step ${step === 'plan' ? 1 : 2} of 2.`}
      footer={footer}
    >
      {step === 'plan' && (
        <>
          {stale && (
            <Alert tone="warn">{committeeError(new ApiError(409, 'COMMITTEE_PREVIEW_STALE', ''))}</Alert>
          )}
          {preview.error ? (
            <ErrorState
              error={plainError(preview.error)}
              action={
                <Button size="sm" onClick={preview.reload}>
                  Try again
                </Button>
              }
            />
          ) : preview.loading || !plan ? (
            <div aria-busy="true" aria-label="Loading">
              {[0, 1, 2].map(i => (
                <div key={i} className="skeleton mb-3 h-12 w-full" data-testid="skeleton-row" />
              ))}
            </div>
          ) : (
            <PlanView plan={plan} ending={ending} />
          )}
        </>
      )}
      {step === 'confirm' && (
        <>
          {problem && <Alert tone="bad">{problem}</Alert>}
          <Input
            label="Took charge on"
            type="date"
            value={tookChargeOn}
            error={errs.tookChargeOn}
            max={today()}
            min={startDate ?? undefined}
            onChange={e => setTook(e.target.value)}
          />
          <Input
            label="Resolution reference"
            value={resolutionRef}
            error={errs.resolutionRef}
            hint="For example the number of the general body or committee resolution."
            onChange={e => setResolution(e.target.value)}
            required
          />
          <Textarea
            label="Reason"
            value={reason}
            error={errs.reason}
            hint="Kept in the audit trail. You will be asked to confirm it is you."
            onChange={e => setReason(e.target.value)}
            required
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-[14px] font-semibold">Announce to residents</span>
            <Switch checked={announce} onChange={setAnnounce} label="Announce to residents" />
          </div>
        </>
      )}
      {step === 'done' && result && (
        <div role="status" data-testid="activation-result">
          <p className="mb-3 text-[16px] font-bold">The new committee has taken charge.</p>
          <ul className="list-disc space-y-1 pl-5 text-[14px]">
            <li>
              {result.summary.roleChanges} {result.summary.roleChanges === 1 ? 'role' : 'roles'} changed
            </li>
            {result.summary.membershipsEnded > 0 && (
              <li>{result.summary.membershipsEnded} memberships ended</li>
            )}
            <li>
              {result.summary.handoverDelegationsCreated} hand-over{' '}
              {result.summary.handoverDelegationsCreated === 1 ? 'delegation' : 'delegations'} created
            </li>
            {result.endedTerm && (
              <li>
                The earlier committee ended
                {result.endedTerm.actualEndDate ? ` on ${shortDate(result.endedTerm.actualEndDate)}` : ''}.
              </li>
            )}
          </ul>
          {result.summary.handoverDelegationsSkipped.length > 0 && (
            <Alert tone="warn" className="mt-3">
              Hand-over was skipped for: {skippedText(result.summary.handoverDelegationsSkipped)}.
            </Alert>
          )}
        </div>
      )}
    </Modal>
  );
}
