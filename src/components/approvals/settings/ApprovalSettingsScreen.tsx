'use client';
import { useState } from 'react';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { Loading } from '@/components/residents/common';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { approvalsRulesService } from '@/services/approvalsRules.service';
import type { ApprovalSettings } from '@/types/approvalsRules';
import { rulesError, toPaise } from '../rules/rulesFormat';

const MIN = 100000;
const MAX = 1_000_000_000_000;
const check = (v: string): string | null => {
  if (!/^\d+(\.\d{1,2})?$/.test(v.trim())) return 'Enter an amount in rupees.';
  const p = toPaise(v);
  return p < MIN || p > MAX ? 'Enter from ₹1,000 up to ₹10,000,00,000.' : null;
};

/** Society approval settings (spec 8.17, 7.6): the amount for a fresh code and the bulk-approve limit. */
export function ApprovalSettingsScreen() {
  const canEdit = usePermission(PERMISSIONS.settings.approvalRules.edit);
  const load = useLoad(() => approvalsRulesService.settings(), 'settings');
  return (
    <Page>
      <PageHead title="Approval settings" sub="Limits that apply to every approval in the society." />
      <Loading load={load}>
        {s => (
          <SettingsForm
            key={`${s.stepUpAbovePaise}-${s.bulkApproveBelowPaise}`}
            initial={s}
            canEdit={canEdit}
            onSaved={load.reload}
          />
        )}
      </Loading>
    </Page>
  );
}

function SettingsForm({
  initial,
  canEdit,
  onSaved,
}: {
  initial: ApprovalSettings;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [stepUp, setStepUp] = useState(String(initial.stepUpAbovePaise / 100));
  const [bulk, setBulk] = useState(String(initial.bulkApproveBelowPaise / 100));
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const e1 = check(stepUp);
  const e2 = check(bulk);
  const dirty =
    !e1 &&
    !e2 &&
    (toPaise(stepUp) !== initial.stepUpAbovePaise || toPaise(bulk) !== initial.bulkApproveBelowPaise);

  const save = async () => {
    setTouched(true);
    setError(null);
    if (e1 || e2) return;
    const body: Partial<ApprovalSettings> = {};
    if (toPaise(stepUp) !== initial.stepUpAbovePaise) body.stepUpAbovePaise = toPaise(stepUp);
    if (toPaise(bulk) !== initial.bulkApproveBelowPaise) body.bulkApproveBelowPaise = toPaise(bulk);
    if (Object.keys(body).length === 0) return;
    setBusy(true);
    try {
      await approvalsRulesService.saveSettings(body);
      toast.show('Settings saved. They apply to requests sent from now on.');
      onSaved();
    } catch (err) {
      setError(rulesError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      {!canEdit && (
        <Alert tone="info" className="mb-3">
          You can look at these settings but not change them.
        </Alert>
      )}
      {error && (
        <Alert tone="bad" className="mb-3">
          {error}
        </Alert>
      )}
      <fieldset disabled={!canEdit || busy} className="grid max-w-md gap-4 border-0 p-0">
        <Input
          label="Ask for a fresh code above (₹)"
          hint="The approver confirms it is them for money above this amount."
          inputMode="decimal"
          value={stepUp}
          onChange={ev => setStepUp(ev.target.value)}
          error={touched ? e1 : null}
        />
        <Input
          label="Bulk approve only items below (₹)"
          hint="Items of this amount or more must be approved one by one."
          inputMode="decimal"
          value={bulk}
          onChange={ev => setBulk(ev.target.value)}
          error={touched ? e2 : null}
        />
        {canEdit && (
          <div>
            <Button loading={busy} disabled={!dirty} onClick={() => void save()}>
              Save settings
            </Button>
          </div>
        )}
      </fieldset>
    </Card>
  );
}
