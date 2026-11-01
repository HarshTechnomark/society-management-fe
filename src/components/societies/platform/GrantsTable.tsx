'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { useToast } from '@/components/ui/Toast';
import { ConfirmReason } from '@/components/common/ConfirmReason';
import { DataTable, type Column } from '@/components/common/DataTable';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { useMe } from '@/lib/auth';
import { societiesService } from '@/services/societies.service';
import type { GrantStatus, SupportGrant } from '@/types/societies';
import { GrantChip } from '../bits';
import { emitGrantChanged, onGrantChanged } from '../events';
import { GRANT_STATUS_LABEL, SCOPE_LABEL, grantWindow, societyErrorText } from '../format';

const STATUS_FILTERS: (GrantStatus | 'ALL')[] = [
  'ALL',
  'PENDING_CONSENT',
  'ACTIVE',
  'EXPIRED',
  'ENDED',
  'REVOKED',
  'DENIED',
  'CANCELLED',
  'CONSENT_EXPIRED',
];

/** Support access grants (P-06 table), for every society or for one society's Support tab. */
export function GrantsTable({ societyId }: { societyId?: number }) {
  const { me } = useMe();
  const toast = useToast();
  const canRevoke = usePermission(PERMISSIONS.platform.supportAccess.approve);
  const [status, setStatus] = useState<GrantStatus | 'ALL'>('ALL');
  const [revoking, setRevoking] = useState<SupportGrant | null>(null);
  const query = { societyId, status: status === 'ALL' ? undefined : status, limit: 100 };
  const grants = useLoad(() => societiesService.grants(query), JSON.stringify(query));
  const { reload } = grants;
  useEffect(() => onGrantChanged(reload), [reload]);

  const mine = (g: SupportGrant) => !!me && g.requester.id === me.user.id;

  const act = async (fn: () => Promise<unknown>, done: string) => {
    try {
      await fn();
      toast.show(done);
      emitGrantChanged();
    } catch (e) {
      toast.show(societyErrorText(e), 'error');
    }
  };

  const columns: Column<SupportGrant>[] = [
    {
      key: 'code',
      label: 'Grant',
      render: g => <span className="font-semibold">{g.code}</span>,
      sortValue: g => g.id,
    },
    ...(societyId
      ? []
      : [
          {
            key: 'society',
            label: 'Society',
            render: (g: SupportGrant) => (
              <Link
                className="font-semibold text-navy underline"
                href={`/platform/societies/${g.society.id}`}
              >
                {g.society.name}
              </Link>
            ),
            sortValue: (g: SupportGrant) => g.society.name,
          },
        ]),
    { key: 'by', label: 'Requested by', render: g => g.requester.name, sortValue: g => g.requester.name },
    {
      key: 'scope',
      label: 'Scope',
      render: g => (
        <span className="flex flex-wrap gap-1">
          <Chip tone={g.scope === 'READ_WRITE' ? 'warn' : 'info'}>{SCOPE_LABEL[g.scope]}</Chip>
          {g.isEmergency && <Chip tone="bad">Emergency</Chip>}
        </span>
      ),
    },
    {
      key: 'reason',
      label: 'Reason',
      render: g => (
        <span className="line-clamp-2 max-w-[260px] text-muted" title={g.reason}>
          {g.ticketRef ? `${g.ticketRef} · ` : ''}
          {g.reason}
        </span>
      ),
    },
    { key: 'window', label: 'Window', render: g => <span className="text-muted">{grantWindow(g)}</span> },
    {
      key: 'status',
      label: 'Status',
      render: g => <GrantChip status={g.status} />,
      sortValue: g => g.status,
    },
    {
      key: 'actions',
      label: 'Actions',
      hideLabel: true,
      render: g => (
        <span className="flex justify-end gap-1">
          {mine(g) && g.status === 'PENDING_CONSENT' && (
            <Button
              size="xs"
              variant="glass"
              onClick={() => act(() => societiesService.cancelGrant(g.id), 'Request withdrawn')}
            >
              Cancel
            </Button>
          )}
          {mine(g) && g.status === 'ACTIVE' && (
            <Button
              size="xs"
              variant="danger-soft"
              onClick={() => act(() => societiesService.endGrant(g.id), 'Support access ended')}
            >
              End
            </Button>
          )}
          {canRevoke && (g.status === 'ACTIVE' || g.status === 'PENDING_CONSENT') && (
            <Button size="xs" variant="danger-soft" onClick={() => setRevoking(g)}>
              Revoke
            </Button>
          )}
        </span>
      ),
    },
  ];

  return (
    <>
      <DataTable
        caption="Support access grants"
        columns={columns}
        rows={grants.data?.data ?? []}
        rowKey={g => g.id}
        loading={grants.loading}
        error={grants.error}
        onRetry={grants.reload}
        searchText={g => `${g.code} ${g.society.name} ${g.requester.name} ${g.reason} ${g.ticketRef ?? ''}`}
        searchLabel="Search grants"
        empty={{ title: 'No support access grants', text: 'Requests and their history appear here.' }}
        toolbar={
          <select
            aria-label="Filter by status"
            value={status}
            onChange={e => setStatus(e.target.value as GrantStatus | 'ALL')}
            className="h-10 rounded-full border-[1.5px] border-[rgba(20,35,44,0.16)] bg-white/80 px-4 text-[14px] focus:border-navy focus:outline-none"
          >
            {STATUS_FILTERS.map(s => (
              <option key={s} value={s}>
                {s === 'ALL' ? 'All statuses' : GRANT_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        }
      />
      <ConfirmReason
        open={!!revoking}
        title={`Revoke ${revoking?.code ?? 'grant'}?`}
        description="Access ends at once and the society is told."
        confirmLabel="Revoke"
        onCancel={() => setRevoking(null)}
        onConfirm={async reason => {
          if (!revoking) return;
          await act(
            () => societiesService.revokeGrantPlatform(revoking.id, { reason, version: revoking.version }),
            'Support access revoked',
          );
          setRevoking(null);
        }}
      />
    </>
  );
}
