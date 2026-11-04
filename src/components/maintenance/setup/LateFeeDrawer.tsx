'use client';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { billingSetupService } from '@/services/billingSetup.service';
import type { InterestFrom, LateFeePolicy, PolicyType } from '@/types/billingSetup';
import { POLICY_TYPE_LABEL, billingSetupError, fieldErrors, nextMonthStart, opts } from './format';
import { MAX_INTEREST, buildLateFee, lateFeeFormFrom, type LateFeeErrors, type LateFeeForm } from './lateFee';

/** "Change policy" form (spec 8.4, 11.5): interest per year (max 21), flat fee or none, grace days, start month, reason. */
export function LateFeeDrawer({
  current,
  onClose,
  onSaved,
}: {
  current: LateFeePolicy | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [f, setF] = useState<LateFeeForm>(lateFeeFormFrom(current, nextMonthStart()));
  const [errors, setErrors] = useState<LateFeeErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof LateFeeForm>(k: K, v: LateFeeForm[K]) => setF(s => ({ ...s, [k]: v }));

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setFormError(null);
    const { input, errors: e } = buildLateFee(f, new Date().toISOString().slice(0, 8) + '01');
    setErrors(e);
    if (!input) return;
    setBusy(true);
    try {
      const p = await billingSetupService.createLateFeePolicy(input);
      toast.show(p.status === 'ACTIVE' ? 'Late fee policy saved.' : 'Policy change sent for approval.');
      onSaved();
    } catch (x) {
      setErrors(s => ({ ...s, ...(fieldErrors(x) as LateFeeErrors) }));
      setFormError(billingSetupError(x));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title="Change late fee policy"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="late-fee-form" loading={busy}>
            Save policy
          </Button>
        </>
      }
    >
      {formError && <Alert tone="bad">{formError}</Alert>}
      <form id="late-fee-form" onSubmit={submit} noValidate>
        <Select
          label="Late fee"
          value={f.policyType}
          onChange={e => set('policyType', e.target.value as PolicyType)}
          options={opts(POLICY_TYPE_LABEL)}
        />
        {f.policyType === 'SIMPLE_INTEREST' && (
          <>
            <Input
              label="Interest (% per year)"
              inputMode="decimal"
              value={f.rate}
              onChange={e => set('rate', e.target.value)}
              error={errors.rate}
              hint={`The law allows at most ${MAX_INTEREST} percent a year.`}
              required
            />
            <Select
              label="Interest counts from"
              value={f.interestFrom}
              onChange={e => set('interestFrom', e.target.value as InterestFrom)}
              options={[
                { value: 'DUE_DATE', label: 'The due date' },
                { value: 'GRACE_END', label: 'The end of the grace days' },
              ]}
            />
          </>
        )}
        {f.policyType === 'FLAT' && (
          <Input
            label="Flat fee per late bill (₹)"
            inputMode="decimal"
            value={f.flat}
            onChange={e => set('flat', e.target.value)}
            error={errors.flat}
            required
          />
        )}
        <Input
          label="Grace days"
          type="number"
          min={0}
          max={30}
          value={f.grace}
          onChange={e => set('grace', e.target.value)}
          error={errors.grace}
          hint="A bill paid within the grace days never gets interest or a late fee."
          required
        />
        {f.policyType !== 'NONE' && (
          <Input
            label="Smallest charge to post (₹)"
            inputMode="decimal"
            value={f.minCharge}
            onChange={e => set('minCharge', e.target.value)}
            error={errors.minCharge}
            hint="Interest below this amount is carried to the next month."
          />
        )}
        <Input
          label="Effective from"
          type="date"
          value={f.effectiveFrom}
          onChange={e => set('effectiveFrom', e.target.value)}
          error={errors.effectiveFrom}
          hint="The first day of a month."
          required
        />
        <Textarea
          label="Reason"
          value={f.reason}
          onChange={e => set('reason', e.target.value)}
          error={errors.reason}
          required
        />
        <Input
          label="Resolution reference (optional)"
          value={f.resolutionRef}
          onChange={e => set('resolutionRef', e.target.value)}
          error={errors.resolutionRef}
        />
      </form>
    </Drawer>
  );
}
