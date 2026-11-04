'use client';
import { useState } from 'react';
import { ConfirmReason } from '@/components/common/ConfirmReason';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { useToast } from '@/components/ui/Toast';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { shortDate } from '@/lib/money';
import { approvalsPageHref } from '@/services/residents.service';
import { billingSetupService } from '@/services/billingSetup.service';
import type { BillingRule } from '@/types/billingSetup';
import { RateDrawer } from './RateDrawer';
import { RuleHistory } from './RuleHistory';
import { billingSetupError, describeRate, plainError } from './format';
import { scopeText } from './versionForm';

/** Settings > Billing > Rates: per head the current rate, the next approved rate with its date and a pending chip. */
export function RatesTab() {
  const toast = useToast();
  const canEdit = usePermission(PERMISSIONS.settings.billingRules.edit);
  const { data, loading, error, reload } = useLoad(async () => {
    const [rules, heads, splits] = await Promise.all([
      billingSetupService.rules(),
      billingSetupService.chargeHeads({ status: 'ALL' }),
      billingSetupService.splitRules().catch(() => []),
    ]);
    return { rules, heads, splits };
  });
  const [changing, setChanging] = useState<BillingRule | 'new' | null>(null);
  const [history, setHistory] = useState<BillingRule | null>(null);
  const [removing, setRemoving] = useState<BillingRule | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (error)
    return (
      <ErrorState
        error={plainError(error)}
        action={
          <button className="underline" onClick={reload}>
            Try again
          </button>
        }
      />
    );
  if (loading || !data)
    return (
      <div className="space-y-3" aria-busy="true">
        <div className="skeleton h-24 w-full" />
        <div className="skeleton h-24 w-full" />
      </div>
    );

  const { rules, heads, splits } = data;
  const ctx = {
    splitName: (id: number) => splits.find(s => s.id === id)?.name,
    headName: (id: number) => heads.find(h => h.id === id)?.name,
  };
  const done = () => {
    setChanging(null);
    reload();
  };

  return (
    <div>
      {notice && <Alert tone="bad">{notice}</Alert>}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13.5px] text-muted">
          Rates are stated per month. A change starts on the date you pick and never alters bills already
          issued.
        </p>
        {canEdit && <Button onClick={() => setChanging('new')}>Add rate</Button>}
      </div>
      {rules.length === 0 ? (
        <EmptyState
          title="No rates yet"
          text="Add a rate for maintenance, sinking fund or water before your first billing run."
          action={canEdit ? <Button onClick={() => setChanging('new')}>Add rate</Button> : undefined}
        />
      ) : (
        <ul className="space-y-3">
          {rules.map(r => (
            <li key={r.id} className="rounded-[18px] bg-white/60 p-4" data-testid="rule-card">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-[16px] font-bold">
                    {r.chargeHeadName ?? heads.find(h => h.id === r.chargeHeadId)?.name ?? r.name}
                  </h3>
                  <p className="text-[13px] text-muted">
                    {r.name} · {scopeText(r)}
                  </p>
                </div>
                {r.pendingVersion && <Chip tone="warn">Waiting for approval</Chip>}
              </div>
              <dl className="mt-3 grid gap-2 text-[14px] sm:grid-cols-2">
                <div>
                  <dt className="text-[12px] font-semibold uppercase text-muted">Current rate</dt>
                  <dd className="font-semibold">
                    {r.currentVersion ? describeRate(r.currentVersion, ctx) : 'Not set yet'}
                    {r.currentVersion && (
                      <span className="block text-[12.5px] font-normal text-muted">
                        since {shortDate(r.currentVersion.effectiveFrom)}
                      </span>
                    )}
                  </dd>
                </div>
                {r.nextVersion && (
                  <div>
                    <dt className="text-[12px] font-semibold uppercase text-muted">Next rate</dt>
                    <dd className="font-semibold">
                      {describeRate(r.nextVersion, ctx)}
                      <span className="block text-[12.5px] font-normal text-muted">
                        from {shortDate(r.nextVersion.effectiveFrom)}
                      </span>
                    </dd>
                  </div>
                )}
                {r.pendingVersion && (
                  <div>
                    <dt className="text-[12px] font-semibold uppercase text-muted">Waiting for approval</dt>
                    <dd className="font-semibold">
                      {describeRate(r.pendingVersion, ctx)}
                      <span className="block text-[12.5px] font-normal text-muted">
                        from {shortDate(r.pendingVersion.effectiveFrom)} ·{' '}
                        <a className="underline" href={approvalsPageHref()}>
                          Open in approvals
                        </a>
                      </span>
                    </dd>
                  </div>
                )}
              </dl>
              <div className="mt-3 flex flex-wrap gap-2">
                {canEdit && (
                  <Button size="sm" aria-label={`Change rate of ${r.name}`} onClick={() => setChanging(r)}>
                    Change rate
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="glass"
                  aria-label={`History of ${r.name}`}
                  onClick={() => setHistory(r)}
                >
                  History
                </Button>
                {canEdit && !r.currentVersion && !r.nextVersion && (
                  <Button
                    size="sm"
                    variant="danger-soft"
                    aria-label={`Delete ${r.name}`}
                    onClick={() => setRemoving(r)}
                  >
                    Delete rule
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {changing && (
        <RateDrawer
          rule={changing === 'new' ? null : changing}
          heads={heads}
          splitRules={splits}
          onClose={() => setChanging(null)}
          onSaved={done}
        />
      )}
      {history && <RuleHistory rule={history} ctx={ctx} onClose={() => setHistory(null)} />}
      <ConfirmReason
        open={removing !== null}
        title={`Delete ${removing?.name ?? 'rule'}?`}
        description="Only a rule that never had an approved rate can be deleted. To stop a live rate, add a 'No charge' version."
        confirmLabel="Delete rule"
        onCancel={() => setRemoving(null)}
        onConfirm={async reason => {
          if (!removing) return;
          try {
            await billingSetupService.archiveRule(removing.id, reason, removing.version);
            toast.show('Rule deleted.');
            setNotice(null);
            reload();
          } catch (e) {
            setNotice(billingSetupError(e));
          }
          setRemoving(null);
        }}
      />
    </div>
  );
}
