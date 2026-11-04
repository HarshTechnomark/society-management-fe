'use client';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { PERMISSIONS } from '@/constants/permissions';
import { usePermission } from '@/hooks/usePermission';
import { inr, shortDate } from '@/lib/money';
import { approvalsPageHref } from '@/services/residents.service';
import { billingSetupService } from '@/services/billingSetup.service';
import { societySetupService } from '@/services/society-setup.service';
import type { BillingRule, ChargeHead, CycleKey, SimulateItem, SplitRule } from '@/types/billingSetup';
import { ScopePicker, allUnits, scopeFromApi, scopeToApi, type ScopeState } from './ScopePicker';
import { VersionFields } from './VersionFields';
import { CYCLE_MONTHS, billingSetupError, describeRate, fieldErrors, nextMonthStart } from './format';
import {
  buildVersion,
  emptyVersionForm,
  formFrom,
  previewVersion,
  type VersionErrors,
  type VersionForm,
} from './versionForm';

/** Create a rule with its first version, or add a new version ("Change rate") to a rule (spec 8.2, 11.5). */
export function RateDrawer({
  rule,
  heads,
  splitRules,
  onClose,
  onSaved,
}: {
  /** The rule to change, or null to create a rule. */
  rule: BillingRule | null;
  heads: ChargeHead[];
  splitRules: SplitRule[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const canSimulate = usePermission(PERMISSIONS.settings.billingRules.view);
  const hasApproved = !!(rule?.currentVersion || rule?.nextVersion);
  const usable = heads.filter(h => h.status === 'ACTIVE' && !h.isSystem);
  const [headId, setHeadId] = useState(rule ? String(rule.chargeHeadId) : '');
  const [name, setName] = useState(rule?.name ?? '');
  const [scope, setScope] = useState<ScopeState>(
    rule ? scopeFromApi(rule.scopeType, rule.scopeValues) : allUnits,
  );
  const [scopeError, setScopeError] = useState<string>();
  const [form, setForm] = useState<VersionForm>(
    rule ? formFrom(rule.currentVersion, nextMonthStart()) : emptyVersionForm(nextMonthStart()),
  );
  const [errors, setErrors] = useState<VersionErrors & { head?: string; name?: string }>({});
  const [cycle, setCycle] = useState<CycleKey>('MONTHLY');
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sim, setSim] = useState<{ items: SimulateItem[] } | { error: string } | 'loading' | null>(null);

  const head = heads.find(h => h.id === Number(headId));
  const headName = (id: number) => heads.find(h => h.id === id)?.name;
  const splitName = (id: number) => splitRules.find(s => s.id === id)?.name;
  const built = buildVersion(form, head, false);
  const months = CYCLE_MONTHS[cycle];
  const pending = rule?.pendingVersion;

  const simulate = async () => {
    const b = buildVersion(form, head);
    const e = { ...b.errors };
    delete e.reason;
    if (!head || !built.input) {
      setErrors(e);
      return;
    }
    setSim('loading');
    try {
      const units = await societySetupService.units({ status: 'ACTIVE', limit: 5 });
      const items = await billingSetupService.simulate({
        chargeHeadId: head.id,
        version: built.input,
        unitIds: units.items.map(u => u.id),
        periodStart: form.effectiveFrom,
      });
      setSim({ items });
    } catch (x) {
      setSim({ error: billingSetupError(x) });
    }
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setFormError(null);
    const e: VersionErrors & { head?: string; name?: string } = { ...buildVersion(form, head).errors };
    if (!rule) {
      if (!head) e.head = 'Pick a charge head.';
      if (name.trim().length < 2 || name.trim().length > 100) e.name = 'Enter 2 to 100 characters.';
    }
    const sc = rule ? {} : scopeToApi(scope);
    setScopeError(sc.error);
    setErrors(e);
    if (Object.keys(e).length || sc.error) return;
    const input = buildVersion(form, head).input;
    if (!input) return;
    setBusy(true);
    try {
      if (rule) {
        const v = await billingSetupService.addVersion(rule.id, input);
        toast.show(
          v?.status === 'APPROVED'
            ? 'New rate saved. It starts on the date you chose.'
            : 'Rate change sent for approval.',
        );
      } else {
        await billingSetupService.createRule({
          chargeHeadId: head!.id,
          name: name.trim(),
          scopeType: scope.type,
          ...(sc.values ? { scopeValues: sc.values } : {}),
          firstVersion: input,
        });
        toast.show('Rate saved.');
      }
      onSaved();
    } catch (x) {
      const fe = fieldErrors(x);
      setErrors(s => ({ ...s, ...fe }));
      setFormError(billingSetupError(x));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      open
      onClose={onClose}
      size={640}
      title={rule ? `Change rate: ${rule.chargeHeadName ?? rule.name}` : 'Add a rate'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="rate-form" loading={busy} disabled={!!pending}>
            {rule ? 'Save new rate' : 'Save rate'}
          </Button>
        </>
      }
    >
      {formError && <Alert tone="bad">{formError}</Alert>}
      {pending && (
        <Alert tone="warn">
          A change from {shortDate(pending.effectiveFrom)} is waiting for approval. You can add another change
          after it is decided.{' '}
          <a className="font-semibold underline" href={approvalsPageHref()}>
            Open in approvals
          </a>
        </Alert>
      )}
      {rule?.currentVersion && (
        <p className="mb-4 text-[13.5px]">
          Now: <b>{describeRate(rule.currentVersion, { splitName, headName })}</b> since{' '}
          {shortDate(rule.currentVersion.effectiveFrom)}
        </p>
      )}
      <form id="rate-form" onSubmit={submit} noValidate>
        {!rule && (
          <>
            <Select
              label="Charge head"
              value={headId}
              onChange={e => {
                setHeadId(e.target.value);
                const h = heads.find(x => x.id === Number(e.target.value));
                if (h && !name) setName(`${h.name} - all flats`);
                if (h?.headType === 'NON_OCCUPANCY') setForm(f => ({ ...f, rateType: 'PERCENT_OF_HEADS' }));
              }}
              error={errors.head}
              options={[
                { value: '', label: 'Pick a charge head' },
                ...usable.map(h => ({ value: String(h.id), label: h.name })),
              ]}
              required
            />
            <Input
              label="Rule name"
              value={name}
              onChange={e => setName(e.target.value)}
              error={errors.name}
              required
            />
            <ScopePicker value={scope} onChange={setScope} error={scopeError} disabled={hasApproved} />
          </>
        )}
        <VersionFields
          form={form}
          onChange={setForm}
          errors={errors}
          head={head}
          heads={heads}
          splitRules={splitRules}
          cycle={cycle}
          onCycle={setCycle}
        />
        {built.input && (
          <p className="mb-4 rounded-[14px] bg-white/60 p-3 text-[13.5px]">
            New rate: <b>{describeRate(previewVersion(built.input), { months, splitName, headName })}</b> from{' '}
            {shortDate(form.effectiveFrom)}
          </p>
        )}
        {canSimulate && (
          <div className="mb-4">
            <Button variant="glass" size="sm" onClick={simulate} loading={sim === 'loading'} disabled={!head}>
              Simulate on flats
            </Button>
            {sim && sim !== 'loading' && 'error' in sim && (
              <p className="mt-2 text-[13px] font-medium text-bad">{sim.error}</p>
            )}
            {sim && sim !== 'loading' && 'items' in sim && (
              <table className="mt-3 w-full text-[13.5px]">
                <caption className="sr-only">Simulated amounts</caption>
                <thead>
                  <tr className="text-left text-[12px] uppercase text-muted">
                    <th scope="col">Flat</th>
                    <th scope="col" className="text-right">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sim.items.map(i => (
                    <tr key={i.unitId}>
                      <td className="py-1">{i.unitLabel}</td>
                      <td className="py-1 text-right">
                        {i.exceptionCode ? `Cannot compute (${i.exceptionCode})` : inr(i.amountPaise)}
                      </td>
                    </tr>
                  ))}
                  {sim.items.length === 0 && (
                    <tr>
                      <td colSpan={2} className="py-1 text-muted">
                        No flats to simulate on.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}
      </form>
    </Drawer>
  );
}
