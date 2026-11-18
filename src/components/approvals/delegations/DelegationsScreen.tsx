'use client';
import { useState } from 'react';
import { ConfirmReason } from '@/components/common/ConfirmReason';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { Empty, Loading, Segments } from '@/components/residents/common';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Chip, type Tone } from '@/components/ui/Chip';
import { useToast } from '@/components/ui/Toast';
import { SUBSCRIPTION_PATH } from '@/components/subscription/planLock';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { useFeatureState } from '@/lib/entitlements';
import { inr } from '@/lib/money';
import { approvalsService } from '@/services/approvals.service';
import { approvalsRulesService } from '@/services/approvalsRules.service';
import { useMe } from '@/lib/auth';
import type { Delegation, DelegationDisplayStatus } from '@/types/approvalsRules';
import { dateTime, typeLabel } from '../format';
import { rulesError } from '../rules/rulesFormat';
import { DelegationDialog } from './DelegationDialog';

const STATUS: Record<DelegationDisplayStatus, { label: string; tone: Tone }> = {
  SCHEDULED: { label: 'Scheduled', tone: 'info' },
  ACTIVE: { label: 'Active', tone: 'ok' },
  REVOKED: { label: 'Revoked', tone: 'neutral' },
  EXPIRED: { label: 'Expired', tone: 'neutral' },
};

type Scope = 'MINE' | 'ALL';

/** Delegations I gave, those given to me and (for rule viewers) everyone's (spec 11.4). */
export function DelegationsScreen() {
  const toast = useToast();
  const { me } = useMe();
  const canViewAll = usePermission(PERMISSIONS.settings.approvalRules.view);
  const canEdit = usePermission(PERMISSIONS.settings.approvalRules.edit);
  const inPlan = useFeatureState('iam.approval_delegation');
  const [scope, setScope] = useState<Scope>('MINE');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<Delegation | null>(null);
  const types = useLoad(() => approvalsService.types().catch(() => []), 'types');
  const active: Scope = canViewAll ? scope : 'MINE';
  const load = useLoad(
    () => approvalsRulesService.delegations({ scope: active, page, limit: 20 }),
    `${active}|${page}`,
  );
  const myId = me?.user.id ?? null;

  const mine = (d: Delegation) => d.delegatorUserId === myId;
  const canRevoke = (d: Delegation) =>
    (d.displayStatus === 'ACTIVE' || d.displayStatus === 'SCHEDULED') && (mine(d) || canEdit);

  return (
    <Page>
      <PageHead
        title="Delegations"
        sub="Let another member approve for you while you are away."
        actions={inPlan && <Button onClick={() => setCreating(true)}>Delegate my approvals</Button>}
      />
      {!inPlan && (
        <Alert tone="warn" className="mb-3">
          <strong>Not in your plan. </strong>
          Delegating approvals comes with the Standard plan and above.{' '}
          <a className="font-semibold underline" href={SUBSCRIPTION_PATH}>
            See plans
          </a>
        </Alert>
      )}
      <Card>
        {canViewAll && (
          <Segments
            label="Delegations"
            value={active}
            onChange={k => {
              setScope(k);
              setPage(1);
            }}
            options={[
              { key: 'MINE', label: 'Mine' },
              { key: 'ALL', label: 'Everyone' },
            ]}
          />
        )}
        <Loading load={load}>
          {d =>
            d.items.length === 0 ? (
              <Empty
                title="No delegations"
                text="Nobody is covering for you and you are not covering for anyone."
              />
            ) : (
              <>
                <ul className="grid gap-2">
                  {d.items.map(x => {
                    const s = STATUS[x.displayStatus] ?? STATUS.ACTIVE;
                    return (
                      <li key={x.id} className="rounded-2xl border border-[rgba(20,35,44,0.12)] p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2 font-semibold">
                              {x.delegatorName} <span aria-hidden>→</span>
                              <span className="sr-only">hands over to</span> {x.delegateName}
                              <Chip tone={s.tone}>{s.label}</Chip>
                              {myId != null && x.delegateUserId === myId && (
                                <Chip tone="gold">Given to me</Chip>
                              )}
                            </div>
                            <p className="mt-1 text-[13.5px] text-muted">
                              {dateTime(x.startsAt)} to {dateTime(x.endsAt)} ·{' '}
                              {x.types ? x.types.map(t => typeLabel(t)).join(', ') : 'All types'} ·{' '}
                              {x.maxAmountPaise == null ? 'Any amount' : `Up to ${inr(x.maxAmountPaise)}`}
                            </p>
                            <p className="text-[13px] text-muted">{x.reason}</p>
                            {x.revokeReason && (
                              <p className="text-[13px] text-muted">Revoked: {x.revokeReason}</p>
                            )}
                          </div>
                          {canRevoke(x) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label={`Revoke delegation to ${x.delegateName}`}
                              onClick={() => setRevoking(x)}
                            >
                              Revoke
                            </Button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {d.totalPages > 1 && (
                  <div className="mt-3 flex items-center gap-2">
                    <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                      Previous
                    </Button>
                    <span className="text-[13px]">
                      Page {page} of {d.totalPages}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={page >= d.totalPages}
                      onClick={() => setPage(page + 1)}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </>
            )
          }
        </Loading>
      </Card>
      {creating && (
        <DelegationDialog
          types={types.data ?? []}
          onCancel={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            toast.show('Delegation created.');
            load.reload();
          }}
        />
      )}
      <ConfirmReason
        open={!!revoking}
        title={`End the delegation to ${revoking?.delegateName ?? ''}?`}
        description="They will no longer be able to approve for you."
        confirmLabel="Revoke"
        onCancel={() => setRevoking(null)}
        onConfirm={async reason => {
          if (!revoking) return;
          try {
            await approvalsRulesService.revokeDelegation(revoking.id, { version: revoking.version, reason });
            toast.show('Delegation revoked.');
            setRevoking(null);
            load.reload();
          } catch (e) {
            toast.show(rulesError(e), 'error');
          }
        }}
      />
    </Page>
  );
}
