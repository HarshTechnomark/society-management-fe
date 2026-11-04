'use client';
import { useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { Chip, type Tone } from '@/components/ui/Chip';
import { Alert } from '@/components/ui/Alert';
import { useToast } from '@/components/ui/Toast';
import { ConfirmReason } from '@/components/common/ConfirmReason';
import { DataTable, type Column } from '@/components/common/DataTable';
import { EmptyState } from '@/components/common/EmptyState';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { useHeldKeys, usePermission } from '@/hooks/usePermission';
import { useMe } from '@/lib/auth';
import { ApiError } from '@/lib/apiClient';
import { accessControlService } from '@/services/access-control.service';
import { subscriptionsService } from '@/services/subscriptions.service';
import { UsageWarnings } from '@/components/subscription/UsageBanners';
import type { Invitation, MemberRow } from '@/types/accessControl';
import { CommitteeTab } from '@/components/committee/CommitteeTab';
import { Tabs } from '@/components/residents/common';
import { TermBanner } from '@/components/committee/TermBanner';
import { COMMITTEE_ROLE_KEYS, useCommitteeSeats } from '@/components/committee/useCommitteeSeats';
import { FLAG_LABEL, seatLabel } from '@/components/committee/format';
import { StaffTab } from './StaffTab';
import { Avatar } from '../Avatar';
import { RowActions, type RowAction } from '../RowActions';
import { SeatMeter } from '../SeatMeter';
import { SOCIETY_CAPABILITIES, hasCapability } from '../capabilities';
import { accessErrorText, lastSeen } from '../format';
import { assignableRoles, useRoleDetails } from '../useRoleDetails';
import { InviteModal } from './InviteModal';
import { MemberDrawer } from './MemberDrawer';
import { RoleChangeDialog } from './RoleChangeDialog';

type TeamRow = { id: string; kind: 'member'; m: MemberRow } | { id: string; kind: 'invite'; inv: Invitation };

type Dialog =
  | { type: 'suspend' | 'reactivate' | 'end' | 'mfa' | 'signout'; m: MemberRow }
  | { type: 'revoke'; inv: Invitation }
  | null;

const name = (r: TeamRow) => (r.kind === 'member' ? r.m.name : r.inv.name);
const email = (r: TeamRow) => (r.kind === 'member' ? r.m.email : r.inv.email);
const roleName = (r: TeamRow) => (r.kind === 'member' ? r.m.role.name : r.inv.role.name);
const statusOf = (r: TeamRow) => (r.kind === 'member' ? r.m.status : 'INVITED');
const STATUS: Record<string, { label: string; tone: Tone }> = {
  ACTIVE: { label: 'Active', tone: 'ok' },
  SUSPENDED: { label: 'Suspended', tone: 'warn' },
  INVITED: { label: 'Invited', tone: 'info' },
};
const YOURSELF = 'You cannot change yourself';

type TabKey = 'all' | 'committee' | 'staff';
const tabFrom = (value: string | null | undefined): TabKey =>
  value === 'committee' || value === 'staff' ? value : 'all';

/** Spec 11.1: "Committee and team" with its tabs (All, Committee, Staff and admins; module 10 spec 11.1 to 11.8). */
export function TeamScreen() {
  const { ready } = useMe();
  const canView = usePermission(PERMISSIONS.settings.members.view);
  // `useSearchParams` gives the same value on the server and in the browser, so the first render matches
  const params = useSearchParams();
  const [tab, setTab] = useState<TabKey>(() => tabFrom(params?.get('tab')));
  const choose = (k: TabKey) => {
    setTab(k);
    const url = new URL(window.location.href);
    if (k === 'all') url.searchParams.delete('tab');
    else url.searchParams.set('tab', k);
    window.history.replaceState(window.history.state, '', url);
  };
  const tabs = (
    <Tabs
      label="Team sections"
      value={tab}
      onChange={choose}
      tabs={[
        { key: 'all', label: 'All' },
        { key: 'committee', label: 'Committee' },
        { key: 'staff', label: 'Staff and admins' },
      ]}
    />
  );
  if (tab === 'committee' && ready && canView)
    return (
      <Page>
        <PageHead
          title="Committee and team"
          sub="Everyone who can sign in to manage this society. Two-step sign-in is required."
        />
        {tabs}
        <div role="tabpanel" id="panel-committee" aria-labelledby="tab-committee">
          <CommitteeTab />
        </div>
      </Page>
    );
  if (tab === 'staff' && ready && canView)
    return (
      <Page>
        <PageHead
          title="Committee and team"
          sub="Everyone who can sign in to manage this society. Two-step sign-in is required."
        />
        {tabs}
        <StaffTab onOpenCommittee={() => choose('committee')} />
      </Page>
    );
  return <TeamAll tabs={tabs} onOpenCommittee={() => choose('committee')} />;
}

function TeamAll({ tabs, onOpenCommittee }: { tabs: ReactNode; onOpenCommittee: () => void }) {
  const seats = useCommitteeSeats();
  const { ready } = useMe();
  const canView = usePermission(PERMISSIONS.settings.members.view);
  const canCreate = usePermission(PERMISSIONS.settings.members.create);
  const canEdit = usePermission(PERMISSIONS.settings.members.edit);
  const canDelete = usePermission(PERMISSIONS.settings.members.delete);
  const canExport = usePermission(PERMISSIONS.settings.members.export);
  const canSeePlan = usePermission(PERMISSIONS.settings.subscription.view);
  const held = useHeldKeys();
  const toast = useToast();

  const members = useLoad(() => accessControlService.members({ limit: 100, sortBy: 'name' }));
  const invitations = useLoad(() => accessControlService.invitations({ status: 'PENDING' }));
  const roles = useLoad(() => accessControlService.roles({ limit: 100 }));
  const usage = useLoad(
    () => (canSeePlan ? subscriptionsService.usage() : Promise.resolve(null)),
    canSeePlan,
  );
  const details = useRoleDetails(roles.data?.data);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [roleFor, setRoleFor] = useState<MemberRow | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);

  const reload = () => {
    members.reload();
    invitations.reload();
    roles.reload();
    usage.reload();
  };

  const rows = useMemo<TeamRow[]>(
    () => [
      ...(members.data?.data ?? []).map(m => ({ id: `m${m.id}`, kind: 'member' as const, m })),
      ...(invitations.data?.data ?? [])
        .filter(i => i.status === 'PENDING')
        .map(inv => ({ id: `i${inv.id}`, kind: 'invite' as const, inv })),
    ],
    [members.data, invitations.data],
  );

  const roleList = useMemo(() => roles.data?.data ?? [], [roles.data]);
  const offered = useMemo(() => assignableRoles(roleList, details, held), [roleList, details, held]);
  // Seats come from the plan's usage counter (`limit.admin_seats`), so the numbers match what the API enforces.
  const seatItem = usage.data?.items.find(u => u.limitKey === 'limit.admin_seats') ?? null;

  const fail = (e: unknown) => {
    if (e instanceof ApiError && e.code === 'LAST_CHAIRMAN') toast.show(accessErrorText(e), 'warning');
    else toast.show(accessErrorText(e), 'error');
    if (e instanceof ApiError && e.code === 'STALE_VERSION') reload();
  };
  const run = async (fn: () => Promise<unknown>, done: string) => {
    try {
      await fn();
      toast.show(done);
      setDialog(null);
      reload();
    } catch (e) {
      fail(e);
    }
  };

  const resend = async (inv: Invitation | number) => {
    const id = typeof inv === 'number' ? inv : inv.id;
    try {
      await accessControlService.resendInvitation(id);
      toast.show(`Invitation sent again${typeof inv === 'number' ? '.' : ` to ${inv.name}.`}`);
      invitations.reload();
    } catch (e) {
      fail(e);
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const file = await accessControlService.exportMembers();
      window.location.assign(file.downloadUrl);
    } catch (e) {
      fail(e);
    } finally {
      setExporting(false);
    }
  };

  const actionsFor = (r: TeamRow): RowAction[] => {
    if (r.kind === 'invite') {
      if (!canCreate) return [];
      return [
        { key: 'resend', label: 'Resend', run: () => void resend(r.inv) },
        {
          key: 'revoke',
          label: 'Revoke',
          danger: true,
          run: () => setDialog({ type: 'revoke', inv: r.inv }),
        },
      ];
    }
    const { m } = r;
    const own = m.isSelf;
    const base = { disabled: own, why: own ? YOURSELF : undefined };
    const list: RowAction[] = [];
    if (canEdit) {
      list.push({ key: 'role', label: 'Role', run: () => setRoleFor(m), ...base });
      list.push({
        key: 'mfa',
        label: 'Reset MFA',
        run: () => setDialog({ type: 'mfa', m }),
        disabled: own || !m.mfaEnabled,
        why: own ? YOURSELF : 'No authenticator to reset',
      });
      list.push({
        key: 'signout',
        label: 'Sign out everywhere',
        run: () => setDialog({ type: 'signout', m }),
        ...base,
      });
      list.push(
        m.status === 'SUSPENDED'
          ? { key: 'enable', label: 'Enable', run: () => setDialog({ type: 'reactivate', m }), ...base }
          : {
              key: 'disable',
              label: 'Disable',
              danger: true,
              run: () => setDialog({ type: 'suspend', m }),
              ...base,
            },
      );
    }
    if (canDelete)
      list.push({
        key: 'end',
        label: 'End membership',
        danger: true,
        run: () => setDialog({ type: 'end', m }),
        ...base,
      });
    return list;
  };

  const columns: Column<TeamRow>[] = [
    {
      key: 'name',
      label: 'Member',
      sortValue: name,
      render: r => (
        <span className="flex items-center gap-3">
          <Avatar name={name(r)} />
          <span className="min-w-0">
            <span className="block font-semibold">
              {name(r)} {r.kind === 'member' && r.m.isSelf && <Chip tone="gold">You</Chip>}
            </span>
            <span className="block break-all text-[12.5px] text-muted">{email(r) ?? ''}</span>
          </span>
        </span>
      ),
    },
    { key: 'role', label: 'Role', sortValue: roleName, render: r => <Chip tone="gold">{roleName(r)}</Chip> },
    {
      key: 'flat',
      label: 'Flat',
      sortValue: r => (r.kind === 'member' ? (r.m.locationLabel ?? '') : ''),
      render: r => (r.kind === 'member' ? (r.m.locationLabel ?? '') : ''),
    },
    ...(seats.enabled
      ? [
          {
            key: 'seat',
            label: 'Committee seat',
            sortValue: (r: TeamRow) => {
              const seat = r.kind === 'member' ? seats.seatByUser.get(r.m.userId) : undefined;
              return seat ? seatLabel(seat.designation, seat.joinMode) : '';
            },
            render: (r: TeamRow) => {
              if (r.kind !== 'member') return <span aria-label="No committee seat">-</span>;
              const seat = seats.seatByUser.get(r.m.userId);
              if (seat)
                return (
                  <span className="flex flex-wrap gap-1">
                    <Chip tone="gold">{seatLabel(seat.designation, seat.joinMode)}</Chip>
                    {seat.flags.map(f => (
                      <Chip key={f} tone="warn">
                        Check: {FLAG_LABEL[f] ?? f}
                      </Chip>
                    ))}
                  </span>
                );
              if (COMMITTEE_ROLE_KEYS.includes(r.m.role.key) && !seats.loading)
                return <Chip tone="warn">No committee seat</Chip>;
              return <span aria-label="No committee seat">-</span>;
            },
          } satisfies Column<TeamRow>,
        ]
      : []),
    {
      key: 'status',
      label: 'Status',
      sortValue: statusOf,
      render: r => <Chip tone={STATUS[statusOf(r)].tone}>{STATUS[statusOf(r)].label}</Chip>,
    },
    {
      key: 'mfa',
      label: 'MFA',
      render: r => (r.kind === 'member' ? (r.m.mfaEnabled ? 'On' : 'Not yet') : ''),
    },
    {
      key: 'last',
      label: 'Last sign in',
      sortValue: r => (r.kind === 'member' ? (r.m.lastLoginAt ?? '') : ''),
      render: r => (r.kind === 'member' ? lastSeen(r.m.lastLoginAt) : 'Never'),
    },
    {
      key: 'act',
      label: 'Actions',
      hideLabel: true,
      className: 'text-right',
      render: r => <RowActions name={name(r)} actions={actionsFor(r)} />,
    },
  ];

  if (ready && !canView)
    return (
      <Page>
        <PageHead title="Committee and team" />
        <Card>
          <EmptyState
            title="You do not have access to this page"
            text="Ask your chairman for the Committee and team permission."
          />
        </Card>
      </Page>
    );

  const usedRoles = roleList.filter(r => r.scope === 'society' && (!r.isSystem || r.memberCount > 0));

  return (
    <Page>
      <PageHead
        title="Committee and team"
        sub="Everyone who can sign in to manage this society. Two-step sign-in is required."
        actions={
          <>
            {canExport && (
              <Button variant="glass" size="sm" loading={exporting} onClick={exportCsv}>
                Export
              </Button>
            )}
            {canCreate && (
              <Button size="sm" onClick={() => setInviteOpen(true)}>
                Invite member
              </Button>
            )}
          </>
        }
      />
      {tabs}
      <div role="tabpanel" id="panel-all" aria-labelledby="tab-all">
        <TermBanner banner={seats.banner} onOpen={onOpenCommittee} />
        {usage.data && <UsageWarnings items={usage.data.items} />}
        <Card>
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            {seatItem && <SeatMeter used={seatItem.used} limit={seatItem.limit} />}
          </div>
          {roles.error ? (
            <Alert tone="warn">Roles could not be loaded. Some actions are limited.</Alert>
          ) : null}
          <DataTable
            caption="Committee and team"
            columns={columns}
            rows={rows}
            rowKey={r => r.id}
            loading={members.loading && !members.data}
            error={members.error}
            onRetry={reload}
            searchText={r => `${name(r)} ${email(r) ?? ''} ${roleName(r)}`}
            searchLabel="Search members"
            initialSort={{ key: 'name', dir: 'asc' }}
            onRowClick={r => r.kind === 'member' && setOpenId(r.m.id)}
            rowLabel={name}
            empty={{
              title: 'Only you so far. Invite your committee.',
              action: canCreate ? (
                <Button onClick={() => setInviteOpen(true)}>Invite member</Button>
              ) : undefined,
            }}
          />
        </Card>

        <Card
          className="mt-4"
          title="What each role can do"
          sub="Permissions are enforced on the server. The interface only hides what you cannot use."
        >
          {!details ? (
            <div className="skeleton h-24 w-full" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-[14px]">
                <caption className="sr-only">What each role can do</caption>
                <thead>
                  <tr className="border-b border-[var(--line)] text-left text-[12px] uppercase text-muted">
                    <th scope="col" className="px-3 py-2">
                      Capability
                    </th>
                    {usedRoles.map(r => (
                      <th key={r.id} scope="col" className="px-3 py-2 text-center">
                        {r.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SOCIETY_CAPABILITIES.map(c => (
                    <tr key={c.label} className="border-b border-[var(--line)] last:border-0">
                      <td className="px-3 py-2">{c.label}</td>
                      {usedRoles.map(r => {
                        const yes = hasCapability(details.get(r.id)?.permissionKeys ?? [], c);
                        return (
                          <td key={r.id} className="px-3 py-2 text-center">
                            {yes ? (
                              <span className="font-bold text-ok" aria-label="Yes">
                                ✓
                              </span>
                            ) : (
                              <span className="text-faint" aria-label="No">
                                -
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <InviteModal
        open={inviteOpen}
        roles={offered}
        onClose={() => setInviteOpen(false)}
        onResend={resend}
        onLimit={() => usage.reload()}
        onInvited={inv => {
          setInviteOpen(false);
          toast.show(`Invitation sent to ${inv.name}.`);
          reload();
        }}
      />
      <RoleChangeDialog
        member={roleFor}
        roles={offered}
        onClose={() => setRoleFor(null)}
        onDone={msg => {
          setRoleFor(null);
          toast.show(msg);
          reload();
        }}
      />
      <MemberDrawer memberId={openId} onClose={() => setOpenId(null)} onChanged={reload} />

      {dialog && (
        <ConfirmReason
          key={`${dialog.type}-${dialog.type === 'revoke' ? dialog.inv.id : dialog.m.id}`}
          open
          {...dialogConfig(dialog, run)}
          onCancel={() => setDialog(null)}
        />
      )}
    </Page>
  );
}

type Run = (fn: () => Promise<unknown>, done: string) => Promise<void>;

/** Title, text and call of each reason dialog (spec 11.1 and 11.4). */
function dialogConfig(d: NonNullable<Dialog>, run: Run) {
  if (d.type === 'revoke')
    return {
      title: `Revoke the invite for ${d.inv.name}?`,
      description: 'The link in the message stops working.',
      confirmLabel: 'Revoke invite',
      onConfirm: (reason: string) =>
        run(() => accessControlService.revokeInvitation(d.inv.id, reason), 'Invite revoked.'),
    };
  const { m } = d;
  const body = { version: m.version };
  switch (d.type) {
    case 'suspend':
      return {
        title: `Disable ${m.name}?`,
        description: 'They are signed out of this society and cannot use it until enabled.',
        confirmLabel: 'Disable',
        onConfirm: (reason: string) =>
          run(() => accessControlService.suspend(m.id, { ...body, reason }), 'Member disabled.'),
      };
    case 'reactivate':
      return {
        title: `Enable ${m.name}?`,
        description: 'They can use this society again.',
        confirmLabel: 'Enable',
        variant: 'primary' as const,
        onConfirm: (reason: string) =>
          run(() => accessControlService.reactivate(m.id, { ...body, reason }), 'Member enabled.'),
      };
    case 'end':
      return {
        title: `End ${m.name}'s membership?`,
        description: 'They lose access to this society. Their records stay.',
        confirmLabel: 'End membership',
        onConfirm: (reason: string) =>
          run(() => accessControlService.endMembership(m.id, { ...body, reason }), 'Membership ended.'),
      };
    case 'mfa':
      return {
        title: `Reset MFA for ${m.name}?`,
        description: 'They must add their authenticator again at next sign in. Verify their identity first.',
        confirmLabel: 'Reset MFA',
        onConfirm: (reason: string) =>
          run(
            () => accessControlService.resetMfa(m.id, reason),
            'MFA reset. They will add it at next sign in.',
          ),
      };
    case 'signout':
      return {
        title: `Sign ${m.name} out everywhere?`,
        description: 'Every device they are signed in on is signed out now.',
        confirmLabel: 'Sign out',
        onConfirm: (reason: string) =>
          run(() => accessControlService.revokeSessions(m.id, reason), `${m.name} is signed out everywhere.`),
      };
  }
}
