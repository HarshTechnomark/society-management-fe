'use client';
import { useState } from 'react';
import { ConfirmReason } from '@/components/common/ConfirmReason';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { Gate } from '@/components/setup/Gate';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { shortDate } from '@/lib/money';
import { residentsService } from '@/services/residents.service';
import type { JoinRequest, MoveRequest } from '@/types/residents';
import { Empty, Loading, useRun } from '../common';
import { RELATION_LABEL, docLabel } from '../format';

const H = PERMISSIONS.resident.household;

/** Confirm requests (spec 11.2): join requests and tenant move NOCs waiting for the owner. */
export function ConfirmScreen() {
  return (
    <Gate view={H.view} feature="residents.invitation_and_self_registration" title="Confirm requests">
      <Inner />
    </Gate>
  );
}

function Inner() {
  const run = useRun();
  const [declineJoin, setDeclineJoin] = useState<JoinRequest | null>(null);
  const [declineMove, setDeclineMove] = useState<MoveRequest | null>(null);
  const joins = useLoad(() => residentsService.confirmations(), 'j');
  const moves = useLoad(() => residentsService.myMoves().catch(() => [] as MoveRequest[]), 'm');
  const waiting = (moves.data ?? []).filter(m => m.status === 'PENDING_OWNER');
  const reload = () => {
    joins.reload();
    moves.reload();
  };
  const empty = joins.data?.length === 0 && waiting.length === 0;
  return (
    <Page>
      <PageHead
        title="Confirm requests"
        sub="People who want to join your flat, and moves that need your NOC."
      />
      <Loading load={joins} rows={2}>
        {list => (
          <>
            {empty && (
              <Card>
                <Empty title="Nothing to confirm" text="Requests from tenants and family appear here." />
              </Card>
            )}
            <ul className="grid gap-3">
              {list.map(j => (
                <li key={`j${j.id}`}>
                  <Card>
                    <p className="text-[16px] font-bold">
                      {j.requesterName ?? j.name} <Chip>{RELATION_LABEL[j.relation]}</Chip>
                    </p>
                    <p className="text-[14px] text-muted">
                      wants to join {j.unitLabel}
                      {j.mobile ? ` · ${j.mobile}` : ''}
                    </p>
                    {j.documents && j.documents.length > 0 && (
                      <p className="mt-1 text-[13.5px]">
                        Documents: {j.documents.map(d => d.title ?? docLabel(d.docType)).join(', ')}
                      </p>
                    )}
                    <div className="mt-3 flex gap-2">
                      <Button
                        onClick={async () => {
                          if (
                            await run(
                              () => residentsService.confirmJoin(j.id, j.version ?? 1),
                              'Confirmed. The committee decides next.',
                            )
                          )
                            reload();
                        }}
                      >
                        Confirm
                      </Button>
                      <Button variant="danger-soft" onClick={() => setDeclineJoin(j)}>
                        Decline
                      </Button>
                    </div>
                  </Card>
                </li>
              ))}
              {waiting.map(m => (
                <li key={`m${m.id}`}>
                  <Card>
                    <p className="text-[16px] font-bold">
                      {m.type === 'MOVE_IN' ? 'Move-in' : 'Move-out'} NOC · {m.unitLabel}
                    </p>
                    <p className="text-[14px] text-muted">
                      {shortDate(m.moveDate)} · {m.slotStart} to {m.slotEnd}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <Button
                        onClick={async () => {
                          if (
                            await run(
                              () =>
                                residentsService.myMoveAction(m.id, 'owner-confirm', { version: m.version }),
                              'NOC given',
                            )
                          )
                            reload();
                        }}
                      >
                        Confirm
                      </Button>
                      <Button variant="danger-soft" onClick={() => setDeclineMove(m)}>
                        Decline
                      </Button>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          </>
        )}
      </Loading>
      <ConfirmReason
        open={!!declineJoin}
        title="Decline this request?"
        description="The person sees your reason."
        confirmLabel="Decline"
        onCancel={() => setDeclineJoin(null)}
        onConfirm={async reason => {
          if (
            declineJoin &&
            (await run(
              () => residentsService.declineJoin(declineJoin.id, declineJoin.version ?? 1, reason),
              'Request declined',
            ))
          ) {
            setDeclineJoin(null);
            reload();
          }
        }}
      />
      <ConfirmReason
        open={!!declineMove}
        title="Decline this move?"
        description="The tenant sees your reason."
        confirmLabel="Decline"
        onCancel={() => setDeclineMove(null)}
        onConfirm={async reason => {
          if (
            declineMove &&
            (await run(
              () =>
                residentsService.myMoveAction(declineMove.id, 'owner-decline', {
                  reason,
                  version: declineMove.version,
                }),
              'Move declined',
            ))
          ) {
            setDeclineMove(null);
            reload();
          }
        }}
      />
    </Page>
  );
}
