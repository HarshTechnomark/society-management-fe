'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/common/PageHead';
import { DataTable, type Column } from '@/components/common/DataTable';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { useToast } from '@/components/ui/Toast';
import { TermBanner } from '@/components/committee/TermBanner';
import { useCommitteeSeats } from '@/components/committee/useCommitteeSeats';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { useHeldKeys, usePermission } from '@/hooks/usePermission';
import { accessControlService } from '@/services/access-control.service';
import { committeeService } from '@/services/committee.service';
import { committeeError } from '@/components/committee/format';
import type { SeatUsage, StaffMember } from '@/types/committee';
import { Avatar } from '../Avatar';
import { assignableRoles, useRoleDetails } from '../useRoleDetails';
import { InviteModal } from './InviteModal';
import { Loading } from '@/components/residents/common';

const NO_SEATS = 'No free staff seats';
const STATUS_WORD: Record<string, string> = { ACTIVE: 'Active', SUSPENDED: 'Suspended', INVITED: 'Invited' };

/** Seat meter of the Staff and admins tab (spec 11.1): amber from 80 percent, red when full. Always states it in words. */
export function StaffSeatMeter({ usage, canSeePlan }: { usage: SeatUsage; canSeePlan: boolean }) {
  const { used, limit } = usage;
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const full = limit !== null && used >= limit;
  const near = limit !== null && !full && used / limit >= 0.8;
  return (
    <div className="min-w-[220px]" data-testid="staff-seat-meter">
      <p className="text-[13.5px] font-semibold">
        {limit !== null ? `Staff seats: ${used} of ${limit} used` : `Staff seats in use: ${used}`}
        {full && ' (full)'}
        {near && ' (almost full)'}
      </p>
      {limit !== null && (
        <div
          role="progressbar"
          aria-label="Staff seats used"
          aria-valuemin={0}
          aria-valuemax={limit}
          aria-valuenow={Math.min(used, limit)}
          className="mt-1 h-2 overflow-hidden rounded-full bg-[rgba(20,35,44,0.12)]"
        >
          <div
            className={`h-full rounded-full ${full ? 'bg-bad' : near ? 'bg-[#c98a1b]' : 'bg-navy'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      <p className="mt-1 text-[12px] text-muted">
        Committee roles do not use a seat.
        {usage.pendingStaffInvitations > 0 &&
          ` ${usage.pendingStaffInvitations} ${usage.pendingStaffInvitations === 1 ? 'invitation is' : 'invitations are'} waiting.`}
      </p>
      {full && (
        <p className="mt-1 text-[13px] font-semibold text-bad" role="status">
          {canSeePlan ? (
            <>
              <Link href="/admin/settings/subscription" className="underline">
                Upgrade or free a seat
              </Link>
            </>
          ) : (
            'Free a seat to invite more staff.'
          )}
        </p>
      )}
    </div>
  );
}

/** Staff and admins tab (spec 11.8): staff table, seat meter and invite presets for the staff roles (BR-10-29). */
export function StaffTab({ onOpenCommittee }: { onOpenCommittee: () => void }) {
  const canCreate = usePermission(PERMISSIONS.settings.members.create);
  const canSeePlan = usePermission(PERMISSIONS.settings.subscription.view);
  const held = useHeldKeys();
  const toast = useToast();
  const { banner } = useCommitteeSeats();
  const [tick, setTick] = useState(0);
  const usage = useLoad(() => committeeService.seatUsage(), tick);
  const roles = useLoad(() => accessControlService.roles({ limit: 100 }));
  const roleList = useMemo(() => roles.data?.data ?? [], [roles.data]);
  const details = useRoleDetails(roles.data?.data);
  const [invite, setInvite] = useState<{ roleId?: number; n: number } | null>(null);

  return (
    <div role="tabpanel" id="panel-staff" aria-labelledby="tab-staff">
      <TermBanner banner={banner} onOpen={onOpenCommittee} />
      <Loading load={usage} rows={3}>
        {u => {
          const keys = new Set(u.staffRoles.map(r => r.roleKey));
          const offered = assignableRoles(
            roleList.filter(r => keys.has(r.key)),
            details,
            held,
          );
          const noSeats = u.free === 0;
          const columns: Column<StaffMember>[] = [
            {
              key: 'name',
              label: 'Name',
              sortValue: m => m.name ?? '',
              render: m => (
                <span className="flex items-center gap-3">
                  <Avatar name={m.name ?? '?'} />
                  <span className="font-semibold">{m.name ?? 'Unnamed'}</span>
                </span>
              ),
            },
            {
              key: 'role',
              label: 'Role',
              sortValue: m => m.roleName,
              render: m => <Chip tone="gold">{m.roleName}</Chip>,
            },
            {
              key: 'status',
              label: 'Status',
              sortValue: m => m.status,
              render: m => (
                <Chip tone={m.status === 'ACTIVE' ? 'ok' : 'warn'}>{STATUS_WORD[m.status] ?? m.status}</Chip>
              ),
            },
            {
              key: 'seat',
              label: 'Staff seat',
              render: m => (
                <Chip tone={m.consumesSeat ? 'info' : 'neutral'}>
                  {m.consumesSeat ? 'Uses a seat' : 'No seat'}
                </Chip>
              ),
            },
          ];
          return (
            <Card>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <StaffSeatMeter usage={u} canSeePlan={canSeePlan} />
                {canCreate && (
                  <Button
                    size="sm"
                    disabled={noSeats || offered.length === 0}
                    title={noSeats ? NO_SEATS : undefined}
                    onClick={() => setInvite({ n: Date.now() })}
                  >
                    Invite staff
                  </Button>
                )}
              </div>
              {canCreate && noSeats && (
                <Alert tone="warn">{NO_SEATS}. Free one staff seat or upgrade your plan.</Alert>
              )}
              {canCreate && offered.length > 0 && (
                <div className="mb-4" role="group" aria-label="Invite presets">
                  <p className="mb-1.5 text-[13px] font-semibold">Quick invite</p>
                  <div className="flex flex-wrap gap-2">
                    {offered.map(r => {
                      const seat = u.staffRoles.find(x => x.roleKey === r.key)?.consumesSeat ?? true;
                      const blocked = noSeats && seat;
                      return (
                        <Button
                          key={r.id}
                          size="xs"
                          variant="glass"
                          disabled={blocked}
                          title={blocked ? NO_SEATS : undefined}
                          onClick={() => setInvite({ roleId: r.id, n: Date.now() })}
                        >
                          Invite {r.name}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}
              <DataTable
                caption="Staff and admins"
                columns={columns}
                rows={u.staff}
                rowKey={m => String(m.memberId)}
                searchText={m => `${m.name ?? ''} ${m.roleName}`}
                searchLabel="Search staff"
                initialSort={{ key: 'name', dir: 'asc' }}
                rowLabel={m => m.name ?? 'Staff member'}
                empty={{
                  title: 'No staff accounts yet. Invite your society manager or accountant.',
                  action:
                    canCreate && !noSeats && offered.length > 0 ? (
                      <Button onClick={() => setInvite({ n: Date.now() })}>Invite staff</Button>
                    ) : undefined,
                }}
              />
              {invite && (
                <InviteModal
                  key={invite.n}
                  open
                  title="Invite staff"
                  presetRoleId={invite.roleId}
                  roles={offered}
                  onClose={() => setInvite(null)}
                  onResend={async id => {
                    try {
                      await accessControlService.resendInvitation(id);
                      toast.show('Invitation sent again.');
                    } catch (e) {
                      toast.show(committeeError(e), 'error');
                    }
                  }}
                  onLimit={() => setTick(t => t + 1)}
                  onInvited={inv => {
                    setInvite(null);
                    toast.show(`Invitation sent to ${inv.name}.`);
                    setTick(t => t + 1);
                  }}
                />
              )}
            </Card>
          );
        }}
      </Loading>
      {!!roles.error && <Alert tone="warn">Roles could not be loaded. Inviting is limited.</Alert>}
    </div>
  );
}
