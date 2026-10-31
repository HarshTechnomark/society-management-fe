'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { useToast } from '@/components/ui/Toast';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { ConfirmReason } from '@/components/common/ConfirmReason';
import { DataTable, type Column } from '@/components/common/DataTable';
import { EmptyState } from '@/components/common/EmptyState';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { useAnyPermission, usePermission } from '@/hooks/usePermission';
import { useMe } from '@/lib/auth';
import { accessControlService } from '@/services/access-control.service';
import type { RoleSummary } from '@/types/accessControl';
import { RowActions, type RowAction } from '../RowActions';
import { accessErrorText } from '../format';

const SCOPE: Record<string, string> = {
  society: 'Society',
  resident: 'Resident',
  gate: 'Gate',
  work: 'Work',
  platform: 'Platform',
};

function LockIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      role="img"
      aria-label="Locked"
    >
      <title>Locked</title>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

/** Spec 11.6: Settings, Roles. */
export function RolesScreen() {
  const { ready } = useMe();
  const canSee = useAnyPermission(PERMISSIONS.settings.roles.view, PERMISSIONS.settings.members.view);
  const canCreate = usePermission(PERMISSIONS.settings.roles.create);
  const canDelete = usePermission(PERMISSIONS.settings.roles.delete);
  const router = useRouter();
  const toast = useToast();
  const roles = useLoad(() => accessControlService.roles({ limit: 100 }));
  const [deleting, setDeleting] = useState<RoleSummary | null>(null);

  const list = useMemo(() => roles.data?.data ?? [], [roles.data]);
  const custom = list.filter(r => !r.isSystem).length;

  if (ready && !canSee)
    return (
      <Page>
        <PageHead title="Roles" />
        <Card>
          <EmptyState title="You do not have access to this page" />
        </Card>
      </Page>
    );

  const actionsFor = (r: RoleSummary): RowAction[] => {
    const inUse = r.memberCount + r.pendingInvitationCount;
    const out: RowAction[] = [
      { key: 'open', label: r.isLocked ? 'View' : 'Open', run: () => router.push(`/admin/roles/${r.id}`) },
    ];
    if (canCreate && r.scope !== 'resident' && r.scope !== 'platform')
      out.push({ key: 'clone', label: 'Clone', run: () => router.push(`/admin/roles/new?from=${r.id}`) });
    if (canDelete && !r.isSystem)
      out.push({
        key: 'delete',
        label: 'Delete',
        danger: true,
        run: () => setDeleting(r),
        disabled: inUse > 0,
        why:
          inUse > 0
            ? `In use by ${r.memberCount} member(s) and ${r.pendingInvitationCount} pending invitation(s)`
            : undefined,
      });
    return out;
  };

  const columns: Column<RoleSummary>[] = [
    {
      key: 'name',
      label: 'Role',
      sortValue: r => r.name,
      render: r => (
        <span className="flex items-center gap-2">
          <span>
            <span className="block font-semibold">{r.name}</span>
            {r.description && <span className="block text-[12.5px] text-muted">{r.description}</span>}
          </span>
          {r.isLocked && <LockIcon />}
        </span>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      sortValue: r => (r.isSystem ? 'System' : 'Custom'),
      render: r => <Chip tone={r.isSystem ? 'neutral' : 'gold'}>{r.isSystem ? 'System' : 'Custom'}</Chip>,
    },
    { key: 'scope', label: 'Scope', sortValue: r => r.scope, render: r => SCOPE[r.scope] ?? r.scope },
    {
      key: 'members',
      label: 'Members',
      sortValue: r => r.memberCount,
      render: r =>
        r.pendingInvitationCount
          ? `${r.memberCount} (+${r.pendingInvitationCount} invited)`
          : String(r.memberCount),
    },
    {
      key: 'perms',
      label: 'Permissions',
      sortValue: r => r.permissionCount,
      render: r => String(r.permissionCount),
    },
    {
      key: 'act',
      label: 'Actions',
      hideLabel: true,
      className: 'text-right',
      render: r => <RowActions name={r.name} actions={actionsFor(r)} />,
    },
  ];

  return (
    <Page>
      <PageHead
        title="Roles"
        sub="What each role can do in this society. System roles can be tuned; custom roles are yours."
        actions={
          canCreate && (
            <Button size="sm" onClick={() => router.push('/admin/roles/new')}>
              New role
            </Button>
          )
        }
      />
      {roles.data && (
        <p className="mb-3 text-[13.5px] text-muted" data-testid="custom-usage">
          {custom === 1 ? '1 custom role' : `${custom} custom roles`}
        </p>
      )}
      <Card>
        <DataTable
          caption="Roles"
          columns={columns}
          rows={list}
          rowKey={r => r.id}
          loading={roles.loading && !roles.data}
          error={roles.error}
          onRetry={roles.reload}
          searchText={r => `${r.name} ${r.description ?? ''}`}
          searchLabel="Search roles"
          initialSort={{ key: 'name', dir: 'asc' }}
          onRowClick={r => router.push(`/admin/roles/${r.id}`)}
          rowLabel={r => r.name}
          empty={{ title: 'No roles yet' }}
          pageSize={20}
        />
      </Card>
      {deleting && (
        <ConfirmReason
          key={deleting.id}
          open
          title={`Delete ${deleting.name}?`}
          description="This cannot be undone. A role that members still use cannot be deleted."
          confirmLabel="Delete role"
          onCancel={() => setDeleting(null)}
          onConfirm={async reason => {
            try {
              await accessControlService.deleteRole(deleting.id, { version: deleting.version, reason });
              toast.show('Role deleted.');
              setDeleting(null);
              roles.reload();
            } catch (e) {
              toast.show(accessErrorText(e), 'error');
            }
          }}
        />
      )}
    </Page>
  );
}
