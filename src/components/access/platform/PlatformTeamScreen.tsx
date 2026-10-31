'use client';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Chip, type Tone } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Alert } from '@/components/ui/Alert';
import { useToast } from '@/components/ui/Toast';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { ConfirmReason } from '@/components/common/ConfirmReason';
import { DataTable, type Column } from '@/components/common/DataTable';
import { EmptyState } from '@/components/common/EmptyState';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { useMe } from '@/lib/auth';
import { accessControlService } from '@/services/access-control.service';
import type { PlatformTeamItem } from '@/types/accessControl';
import { Avatar } from '../Avatar';
import { RowActions, type RowAction } from '../RowActions';
import { PLATFORM_CAPABILITIES, hasCapability } from '../capabilities';
import { accessErrorText, lastSeen } from '../format';
import { PlatformInviteModal } from './PlatformInviteModal';

type User = Extract<PlatformTeamItem, { kind: 'USER' }>;
type Dialog =
  | { type: 'disable' | 'enable' | 'mfa' | 'remove'; u: User }
  | { type: 'revoke'; id: number; name: string }
  | null;

const rowId = (r: PlatformTeamItem) => (r.kind === 'USER' ? `u${r.userId}` : `i${r.invitationId}`);
const STATUS: Record<string, { label: string; tone: Tone }> = {
  ACTIVE: { label: 'Active', tone: 'ok' },
  DISABLED: { label: 'Disabled', tone: 'bad' },
  INVITED: { label: 'Invited', tone: 'info' },
};
const YOURSELF = 'You cannot change yourself';

/** Spec 11.10: "Platform team" in the super admin console. */
export function PlatformTeamScreen() {
  const { ready } = useMe();
  const canView = usePermission(PERMISSIONS.platform.team.view);
  const canCreate = usePermission(PERMISSIONS.platform.team.create);
  const canEdit = usePermission(PERMISSIONS.platform.team.edit);
  const canDelete = usePermission(PERMISSIONS.platform.team.delete);
  const toast = useToast();

  const team = useLoad(() => accessControlService.platformTeam({ status: 'ALL' }));
  const roles = useLoad(() => accessControlService.platformRoles());
  const [inviteOpen, setInviteOpen] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [roleFor, setRoleFor] = useState<User | null>(null);

  const rows = useMemo(() => team.data?.data ?? [], [team.data]);
  const roleList = useMemo(() => roles.data ?? [], [roles.data]);

  const fail = (e: unknown) =>
    toast.show(accessErrorText(e), accessErrorText(e).includes('Super Admin') ? 'warning' : 'error');
  const run = async (fn: () => Promise<unknown>, done: string) => {
    try {
      await fn();
      toast.show(done);
      setDialog(null);
      team.reload();
    } catch (e) {
      fail(e);
    }
  };
  const resend = async (id: number, name: string) => {
    try {
      await accessControlService.platformResend(id);
      toast.show(`Invitation sent again to ${name}.`);
      team.reload();
    } catch (e) {
      fail(e);
    }
  };

  const actionsFor = (r: PlatformTeamItem): RowAction[] => {
    if (r.kind === 'INVITATION') {
      if (!canCreate) return [];
      return [
        { key: 'resend', label: 'Resend invite', run: () => void resend(r.invitationId, r.name) },
        {
          key: 'revoke',
          label: 'Revoke',
          danger: true,
          run: () => setDialog({ type: 'revoke', id: r.invitationId, name: r.name }),
        },
      ];
    }
    const base = { disabled: r.isSelf, why: r.isSelf ? YOURSELF : undefined };
    const out: RowAction[] = [];
    if (canEdit) {
      out.push({ key: 'role', label: 'Role', run: () => setRoleFor(r), ...base });
      out.push(
        r.status === 'DISABLED'
          ? { key: 'enable', label: 'Enable', run: () => setDialog({ type: 'enable', u: r }), ...base }
          : {
              key: 'disable',
              label: 'Disable',
              danger: true,
              run: () => setDialog({ type: 'disable', u: r }),
              ...base,
            },
      );
      out.push({
        key: 'mfa',
        label: 'Reset MFA',
        run: () => setDialog({ type: 'mfa', u: r }),
        disabled: r.isSelf || !r.mfaEnabled,
        why: r.isSelf ? YOURSELF : 'No authenticator to reset',
      });
    }
    if (canDelete)
      out.push({
        key: 'remove',
        label: 'Remove',
        danger: true,
        run: () => setDialog({ type: 'remove', u: r }),
        ...base,
      });
    return out;
  };

  const columns: Column<PlatformTeamItem>[] = [
    {
      key: 'name',
      label: 'Name',
      sortValue: r => r.name,
      render: r => (
        <span className="flex items-center gap-3">
          <Avatar name={r.name} />
          <span className="min-w-0">
            <span className="block font-semibold">
              {r.name} {r.kind === 'USER' && r.isSelf && <Chip tone="gold">You</Chip>}
            </span>
            <span className="block break-all text-[12.5px] text-muted">{r.email ?? ''}</span>
          </span>
        </span>
      ),
    },
    {
      key: 'role',
      label: 'Role',
      sortValue: r => r.role.name,
      render: r => <Chip tone="gold">{r.role.name}</Chip>,
    },
    {
      key: 'status',
      label: 'Status',
      sortValue: r => r.status,
      render: r => <Chip tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Chip>,
    },
    {
      key: 'mfa',
      label: 'MFA',
      render: r => (r.kind === 'USER' ? (r.mfaEnabled ? 'Enrolled' : 'Not yet') : ''),
    },
    {
      key: 'last',
      label: 'Last sign in',
      sortValue: r => (r.kind === 'USER' ? (r.lastLoginAt ?? '') : ''),
      render: r => (r.kind === 'USER' ? lastSeen(r.lastLoginAt) : 'Never'),
    },
    {
      key: 'act',
      label: 'Actions',
      hideLabel: true,
      className: 'text-right',
      render: r => <RowActions name={r.name} actions={actionsFor(r)} />,
    },
  ];

  if (ready && !canView)
    return (
      <Page>
        <PageHead title="Platform team" />
        <Card>
          <EmptyState title="You do not have access to this page" />
        </Card>
      </Page>
    );

  return (
    <Page>
      <PageHead
        title="Platform team"
        sub="Operators of the console. MFA is mandatory for everyone."
        actions={
          canCreate && (
            <Button size="sm" onClick={() => setInviteOpen(true)}>
              Invite teammate
            </Button>
          )
        }
      />
      <Card>
        <DataTable
          caption="Platform team"
          columns={columns}
          rows={rows}
          rowKey={rowId}
          loading={team.loading && !team.data}
          error={team.error}
          onRetry={team.reload}
          searchText={r => `${r.name} ${r.email ?? ''} ${r.role.name}`}
          searchLabel="Search teammates"
          initialSort={{ key: 'name', dir: 'asc' }}
          empty={{ title: 'No teammates' }}
        />
      </Card>

      <Card
        className="mt-4"
        title="What each role can do"
        sub="Permissions are enforced on the server. The interface only hides what you cannot use."
      >
        {roles.loading && !roles.data ? (
          <div className="skeleton h-24 w-full" />
        ) : roles.error ? (
          <Alert tone="warn">The role list could not be loaded.</Alert>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-[14px]">
              <caption className="sr-only">What each platform role can do</caption>
              <thead>
                <tr className="border-b border-[var(--line)] text-left text-[12px] uppercase text-muted">
                  <th scope="col" className="px-3 py-2">
                    Capability
                  </th>
                  {roleList.map(r => (
                    <th key={r.id} scope="col" className="px-3 py-2 text-center">
                      {r.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PLATFORM_CAPABILITIES.map(c => (
                  <tr key={c.label} className="border-b border-[var(--line)] last:border-0">
                    <td className="px-3 py-2">{c.label}</td>
                    {roleList.map(r => (
                      <td key={r.id} className="px-3 py-2 text-center">
                        {hasCapability(r.permissionKeys ?? [], c) ? (
                          <span className="font-bold text-ok" aria-label="Yes">
                            ✓
                          </span>
                        ) : (
                          <span className="text-faint" aria-label="No">
                            -
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <PlatformInviteModal
        open={inviteOpen}
        roles={roleList}
        onClose={() => setInviteOpen(false)}
        onInvited={inv => {
          setInviteOpen(false);
          toast.show(`Invitation sent to ${inv.name}.`);
          team.reload();
        }}
      />
      <PlatformRoleDialog
        user={roleFor}
        roles={roleList}
        onClose={() => setRoleFor(null)}
        onDone={msg => {
          setRoleFor(null);
          toast.show(msg);
          team.reload();
        }}
      />
      {dialog && (
        <ConfirmReason
          key={`${dialog.type}-${dialog.type === 'revoke' ? dialog.id : dialog.u.userId}`}
          open
          {...config(dialog, run)}
          onCancel={() => setDialog(null)}
        />
      )}
    </Page>
  );
}

type Run = (fn: () => Promise<unknown>, done: string) => Promise<void>;

function config(d: NonNullable<Dialog>, run: Run) {
  if (d.type === 'revoke')
    return {
      title: `Revoke the invite for ${d.name}?`,
      description: 'The link in the message stops working.',
      confirmLabel: 'Revoke invite',
      onConfirm: (reason: string) =>
        run(() => accessControlService.platformRevoke(d.id, reason), 'Invite revoked.'),
    };
  const { u } = d;
  switch (d.type) {
    case 'disable':
      return {
        title: `Disable ${u.name}?`,
        description: 'They are signed out everywhere and cannot sign in until enabled.',
        confirmLabel: 'Disable',
        onConfirm: (reason: string) =>
          run(() => accessControlService.platformDisable(u.userId, reason), 'Teammate disabled.'),
      };
    case 'enable':
      return {
        title: `Enable ${u.name}?`,
        description: 'They can sign in again.',
        confirmLabel: 'Enable',
        variant: 'primary' as const,
        onConfirm: (reason: string) =>
          run(() => accessControlService.platformEnable(u.userId, reason), 'Teammate enabled.'),
      };
    case 'mfa':
      return {
        title: `Reset MFA for ${u.name}?`,
        description:
          'They are signed out and must add their authenticator again at next sign in. Verify their identity first.',
        confirmLabel: 'Reset MFA',
        onConfirm: (reason: string) =>
          run(
            () => accessControlService.platformResetMfa(u.userId, reason),
            'MFA reset. They will add it at next sign in.',
          ),
      };
    case 'remove':
      return {
        title: `Remove ${u.name} from the platform team?`,
        description: 'They lose access to the console. Their account and society memberships stay.',
        confirmLabel: 'Remove',
        onConfirm: (reason: string) =>
          run(() => accessControlService.platformRemove(u.userId, reason), 'Teammate removed.'),
      };
  }
}

function PlatformRoleDialog({
  user,
  roles,
  onClose,
  onDone,
}: {
  user: User | null;
  roles: { id: number; name: string }[];
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  if (!user) return null;
  return <RoleBody key={user.userId} user={user} roles={roles} onClose={onClose} onDone={onDone} />;
}

function RoleBody({
  user,
  roles,
  onClose,
  onDone,
}: {
  user: User;
  roles: { id: number; name: string }[];
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [roleId, setRoleId] = useState(String(user.role.id));
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<{ role?: string; reason?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const f: typeof errors = {};
    if (Number(roleId) === user.role.id) f.role = 'Pick a different role.';
    const r = reason.trim();
    if (r.length < 5 || r.length > 500) f.reason = 'Enter between 5 and 500 characters.';
    setErrors(f);
    setError(null);
    if (f.role || f.reason) return;
    setBusy(true);
    try {
      await accessControlService.platformChangeRole(user.userId, { roleId: Number(roleId), reason: r });
      onDone(`${user.name} is now ${roles.find(x => x.id === Number(roleId))?.name ?? 'updated'}.`);
    } catch (e) {
      setError(accessErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Change role for ${user.name}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={submit}>
            Change role
          </Button>
        </>
      }
    >
      {error && <Alert tone="bad">{error}</Alert>}
      <Select
        label="New role"
        value={roleId}
        onChange={e => setRoleId(e.target.value)}
        error={errors.role}
        options={roles.map(r => ({ value: String(r.id), label: r.name }))}
      />
      <Input
        label="Reason"
        value={reason}
        onChange={e => setReason(e.target.value)}
        error={errors.reason}
        required
      />
    </Modal>
  );
}
