'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Drawer } from '@/components/ui/Drawer';
import { Switch } from '@/components/ui/Switch';
import { useToast } from '@/components/ui/Toast';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { ConfirmReason } from '@/components/common/ConfirmReason';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PERMISSIONS } from '@/constants/permissions';
import { useCountdown } from '@/hooks/useCountdown';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { useMe } from '@/lib/auth';
import { societiesService } from '@/services/societies.service';
import type { SupportGrant } from '@/types/societies';
import { GrantChip } from '../bits';
import { emitStatusChanged } from '../events';
import { SCOPE_LABEL, dateTime, firstName, mmss, societyErrorText } from '../format';
import { ReadLog } from './ReadLog';

function Countdown({ endsAt }: { endsAt: string | null }) {
  const left = useCountdown(endsAt);
  return <span className="tabular-nums text-[12.5px] text-muted">{mmss(left)} left</span>;
}

/** A-01 Settings › Support access: consent switch and the society's requests with Approve, Deny and Revoke. */
export function SupportAccessSettings() {
  const { ready } = useMe();
  const toast = useToast();
  const canView = usePermission(PERMISSIONS.settings.supportAccess.view);
  const canApprove = usePermission(PERMISSIONS.settings.supportAccess.approve);
  const settings = useLoad(
    () => (canView ? societiesService.supportSettings() : Promise.resolve(null)),
    canView,
  );
  const grants = useLoad(() => (canView ? societiesService.societyGrants() : Promise.resolve(null)), canView);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [denying, setDenying] = useState<SupportGrant | null>(null);
  const [revoking, setRevoking] = useState<SupportGrant | null>(null);
  const [viewing, setViewing] = useState<SupportGrant | null>(null);

  const changed = () => {
    grants.reload();
    emitStatusChanged();
  };

  const toggleConsent = async (next: boolean) => {
    if (!settings.data) return;
    setSaving(true);
    try {
      await societiesService.updateSupportSettings({
        requiresSupportConsent: next,
        version: settings.data.version,
      });
      toast.show(
        next
          ? 'Support now needs your consent.'
          : 'Support can start without asking. Approvers are notified.',
      );
      settings.reload();
    } catch (e) {
      toast.show(societyErrorText(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  const approve = async (g: SupportGrant) => {
    setBusyId(g.id);
    try {
      await societiesService.approveGrant(g.id, g.version);
      toast.show(`Support access approved for ${g.durationMinutes} minutes`);
      changed();
    } catch (e) {
      toast.show(societyErrorText(e), 'error');
      grants.reload();
    } finally {
      setBusyId(null);
    }
  };

  if (ready && !canView)
    return (
      <Page>
        <PageHead title="Support access" />
        <Card>
          <EmptyState
            title="No access"
            text="Only the chairman, secretary and society admin can see support access."
          />
        </Card>
      </Page>
    );

  const rows = grants.data?.data ?? [];

  return (
    <Page>
      <PageHead
        title="Support access"
        sub="Let SocietyApp support look at your society to fix a problem. It is time-boxed, and everything they do is in your audit trail."
      />
      <div className="flex flex-col gap-4">
        <Card>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-[16px] font-bold">
                Require our consent before SocietyApp support can view our data
              </h2>
              <p className="text-[13px] text-muted">
                When this is off, support can start at once and approvers are told. Support cannot approve
                money, change roles or see members’ unmasked contact details.
              </p>
            </div>
            {settings.data ? (
              <Switch
                label="Require our consent before SocietyApp support can view our data"
                checked={settings.data.requiresSupportConsent}
                disabled={!canApprove || saving}
                onChange={toggleConsent}
              />
            ) : (
              <div className="skeleton h-7 w-12" />
            )}
          </div>
        </Card>
        <Card title="Requests">
          {grants.error ? (
            <ErrorState error={grants.error} />
          ) : grants.loading ? (
            <div className="skeleton h-24 w-full" />
          ) : rows.length === 0 ? (
            <EmptyState title="No support requests yet." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-[14px]">
                <caption className="sr-only">Support access requests</caption>
                <thead>
                  <tr className="border-b border-[var(--line)] text-[12px] font-semibold uppercase tracking-wide text-muted">
                    <th className="px-3 py-2">Requested by</th>
                    <th className="px-3 py-2">Scope</th>
                    <th className="px-3 py-2">Duration</th>
                    <th className="px-3 py-2">Reason</th>
                    <th className="px-3 py-2">Ticket</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Requested at</th>
                    <th className="px-3 py-2">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(g => {
                    const decide = canApprove && g.canDecide !== false;
                    const ended = !['PENDING_CONSENT', 'ACTIVE'].includes(g.status);
                    return (
                      <tr key={g.id} className="border-b border-[var(--line)] align-top last:border-0">
                        <td className="px-3 py-2.5">
                          <b>{firstName(g.requester.name)}</b>
                          <div className="text-[12.5px] text-muted">SocietyApp Support</div>
                        </td>
                        <td className="px-3 py-2.5">
                          <Chip tone={g.scope === 'READ_WRITE' ? 'warn' : 'info'}>
                            {SCOPE_LABEL[g.scope]}
                          </Chip>
                          {g.isEmergency && (
                            <Chip tone="bad" className="ml-1">
                              Emergency
                            </Chip>
                          )}
                        </td>
                        <td className="px-3 py-2.5">{g.durationMinutes} min</td>
                        <td className="max-w-[240px] px-3 py-2.5 text-muted">{g.reason}</td>
                        <td className="px-3 py-2.5">{g.ticketRef ?? '-'}</td>
                        <td className="px-3 py-2.5">
                          <GrantChip status={g.status} />
                          {g.status === 'ACTIVE' && (
                            <div>
                              <Countdown endsAt={g.endsAt} />
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-muted">{dateTime(g.createdAt ?? g.startedAt)}</td>
                        <td className="px-3 py-2.5">
                          <span className="flex flex-wrap justify-end gap-1">
                            {g.status === 'PENDING_CONSENT' && decide && (
                              <>
                                <Button size="xs" loading={busyId === g.id} onClick={() => approve(g)}>
                                  Approve
                                </Button>
                                <Button size="xs" variant="glass" onClick={() => setDenying(g)}>
                                  Deny
                                </Button>
                              </>
                            )}
                            {g.status === 'PENDING_CONSENT' && (
                              <Link
                                href={`/admin/support-access/${g.id}`}
                                className="self-center text-[12.5px] text-navy underline"
                              >
                                Open
                              </Link>
                            )}
                            {g.status === 'ACTIVE' && decide && (
                              <Button size="xs" variant="danger-soft" onClick={() => setRevoking(g)}>
                                Revoke
                              </Button>
                            )}
                            {(ended || g.status === 'ACTIVE') && (
                              <Button size="xs" variant="ghost" onClick={() => setViewing(g)}>
                                What they viewed
                              </Button>
                            )}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
      <ConfirmReason
        open={!!denying}
        title="Deny this request?"
        description="Support is told that you said no. Give a short reason."
        confirmLabel="Deny"
        onCancel={() => setDenying(null)}
        onConfirm={async reason => {
          if (!denying) return;
          try {
            await societiesService.denyGrant(denying.id, { reason, version: denying.version });
            toast.show('Request denied');
            changed();
          } catch (e) {
            toast.show(societyErrorText(e), 'error');
          }
          setDenying(null);
        }}
      />
      <ConfirmReason
        open={!!revoking}
        title="End support access now?"
        description="Support loses access at once."
        confirmLabel="Revoke"
        onCancel={() => setRevoking(null)}
        onConfirm={async reason => {
          if (!revoking) return;
          try {
            await societiesService.revokeGrant(revoking.id, { reason, version: revoking.version });
            toast.show('Support access ended');
            changed();
          } catch (e) {
            toast.show(societyErrorText(e), 'error');
          }
          setRevoking(null);
        }}
      />
      <Drawer
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing ? `${viewing.code} · what support viewed` : 'Read log'}
        description={
          viewing
            ? `${firstName(viewing.requester.name)}, ${SCOPE_LABEL[viewing.scope].toLowerCase()}`
            : undefined
        }
      >
        {viewing && <ReadLog grantId={viewing.id} />}
      </Drawer>
      {!canApprove && ready && canView && (
        <Alert tone="info" className="mt-4">
          Only the chairman and society admin can approve or end support access.
        </Alert>
      )}
    </Page>
  );
}
