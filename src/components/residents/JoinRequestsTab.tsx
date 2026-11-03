'use client';
import { useState } from 'react';
import { ConfirmReason } from '@/components/common/ConfirmReason';
import { Card } from '@/components/common/PageHead';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { residentsService } from '@/services/residents.service';
import type { JoinRequest } from '@/types/residents';
import { Empty, Loading, StatusChip, useRun } from './common';
import { JOIN_LABEL, JOIN_TONE, RELATION_LABEL, ageText } from './format';

/** The Join requests tab (spec 11.1): cards that approve or reject through module 14. */
export function JoinRequestsTab({ refreshKey, onChanged }: { refreshKey: number; onChanged: () => void }) {
  const canApprove = usePermission(PERMISSIONS.residents.requests.approve);
  const run = useRun();
  const [rejecting, setRejecting] = useState<JoinRequest | null>(null);
  const load = useLoad(() => residentsService.joinRequests({ limit: 50 }), refreshKey);
  const changed = () => {
    load.reload();
    onChanged();
  };
  return (
    <>
      <ConfirmReason
        open={!!rejecting}
        title="Reject this join request?"
        description="The person sees the reason."
        confirmLabel="Reject"
        onCancel={() => setRejecting(null)}
        onConfirm={async text => {
          if (
            rejecting &&
            (await run(
              () => residentsService.approvalReject(rejecting.approvalRequestId!, text),
              'Join request rejected',
            ))
          ) {
            setRejecting(null);
            changed();
          }
        }}
      />
      <Loading load={load}>
        {data =>
          data.items.length === 0 ? (
            <Card>
              <Empty title="No join requests" text="New residents who sign up appear here for approval." />
            </Card>
          ) : (
            <ul className="grid gap-3">
              {data.items.map(j => {
                const waitingOwner = j.status === 'PENDING_OWNER';
                const eligible = j.status === 'PENDING_ADMIN' && !!j.approvalRequestId;
                const reason = !canApprove
                  ? 'You need permission to approve resident requests.'
                  : waitingOwner
                    ? 'Waiting for the owner to confirm first.'
                    : !eligible
                      ? 'This request is not waiting for your approval.'
                      : '';
                return (
                  <li key={j.id}>
                    <Card>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[16px] font-bold">
                            {j.requesterName ?? j.name ?? 'New resident'}{' '}
                            <Chip>{RELATION_LABEL[j.relation]}</Chip>
                          </p>
                          <p className="text-[14px] text-muted">
                            wants to join {j.unitLabel}
                            {j.mobile ? ` · ${j.mobile}` : ''}
                            {j.createdAt ? ` · ${ageText(j.createdAt)} ago` : ''}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <StatusChip status={j.status} labels={JOIN_LABEL} tones={JOIN_TONE} />
                            {(j.documentsReceived || (j.documents && j.documents.length > 0)) && (
                              <Chip tone="ok">Agreement and ID received</Chip>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            disabled={!!reason}
                            title={reason || undefined}
                            onClick={async () => {
                              if (
                                await run(
                                  () => residentsService.approvalApprove(j.approvalRequestId!),
                                  'Join request approved',
                                )
                              )
                                changed();
                            }}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="danger-soft"
                            disabled={!!reason}
                            title={reason || undefined}
                            onClick={() => setRejecting(j)}
                          >
                            Reject
                          </Button>
                        </div>
                      </div>
                      {reason && <p className="mt-2 text-[13px] text-muted">{reason}</p>}
                    </Card>
                  </li>
                );
              })}
            </ul>
          )
        }
      </Loading>
    </>
  );
}
