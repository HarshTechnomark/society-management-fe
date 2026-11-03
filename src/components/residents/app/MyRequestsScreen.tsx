'use client';
import { useState } from 'react';
import { ConfirmReason } from '@/components/common/ConfirmReason';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { Gate } from '@/components/setup/Gate';
import { Button, buttonClasses } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { PERMISSIONS } from '@/constants/permissions';
import { useFeature } from '@/hooks/useFeature';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { inr, shortDate } from '@/lib/money';
import { residentsService } from '@/services/residents.service';
import type { MoveRequest, Permit, PermitStatus, Transfer } from '@/types/residents';
import { Empty, Loading, Segments, StatusChip, useRun } from '../common';
import {
  MOVE_LABEL,
  MOVE_TONE,
  PERMIT_LABEL,
  PERMIT_TONE,
  TRANSFER_LABEL,
  TRANSFER_TONE,
  TRANSFER_TYPE_LABEL,
  WORK_LABEL,
  docLabel,
} from '../format';
import { MoveForm, PermitForm, TransferForm } from '../RequestForms';

const RQ = PERMISSIONS.resident.requests;
type Sub = 'moves' | 'renovation' | 'transfers';

/** Requests (spec 11.2): moves, renovation permits and, for owners, ownership transfers. */
export function MyRequestsScreen() {
  return (
    <Gate view={RQ.view} title="Requests">
      <Inner />
    </Gate>
  );
}

function Inner() {
  const house = useLoad(() => residentsService.household(), 'h');
  const moveIn = useFeature('residents.move_in_workflow');
  const moveOut = useFeature('residents.move_out_workflow');
  const moveOn = moveIn || moveOut;
  const permitOn = useFeature('residents.renovation_permits');
  const transferOn = useFeature('residents.ownership_transfer');
  const [sub, setSub] = useState<Sub>('moves');
  const units = (house.data?.units ?? []).map(u => ({ unitId: u.unitId, unitLabel: u.unitLabel }));
  const owned = (house.data?.units ?? [])
    .filter(u => u.myRelation === 'OWNER' || u.myRelation === 'CO_OWNER')
    .map(u => ({ unitId: u.unitId, unitLabel: u.unitLabel }));
  const primaryOwner = (house.data?.units ?? []).some(u => u.myRelation === 'OWNER');
  const options = [
    ...(moveOn ? [{ key: 'moves' as const, label: 'Moves' }] : []),
    ...(permitOn ? [{ key: 'renovation' as const, label: 'Renovation' }] : []),
    ...(transferOn && primaryOwner ? [{ key: 'transfers' as const, label: 'Ownership transfer' }] : []),
  ];
  const current = options.some(o => o.key === sub) ? sub : options[0]?.key;
  return (
    <Page>
      <PageHead title="Requests" sub="Move in or out, renovation permits and ownership transfers." />
      {options.length === 0 ? (
        <Card>
          <p className="text-[14px] text-muted">Requests are not part of your society plan.</p>
        </Card>
      ) : (
        <>
          <Segments label="Request kind" options={options} value={current!} onChange={setSub} />
          {current === 'moves' && <Moves units={units} />}
          {current === 'renovation' && <Permits units={owned} />}
          {current === 'transfers' && <Transfers units={owned} />}
        </>
      )}
    </Page>
  );
}

type Units = { unitId: number; unitLabel: string }[];

function Moves({ units }: { units: Units }) {
  const canCreate = usePermission(RQ.create);
  const run = useRun();
  const [adding, setAdding] = useState(false);
  const [cancel, setCancel] = useState<MoveRequest | null>(null);
  const load = useLoad(() => residentsService.myMoves(), 'm');
  return (
    <>
      {canCreate && (
        <Button className="mb-3" onClick={() => setAdding(true)}>
          Request a move
        </Button>
      )}
      <Loading load={load} rows={2}>
        {list =>
          list.length === 0 ? (
            <Card>
              <Empty title="No move requests" text="Book your move-in or move-out here." />
            </Card>
          ) : (
            <ul className="grid gap-3">
              {list.map(m => (
                <li key={m.id}>
                  <Card>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-[17px] font-bold">
                        {m.type === 'MOVE_IN' ? 'Move in' : 'Move out'} · {m.unitLabel}
                      </p>
                      <StatusChip status={m.status} labels={MOVE_LABEL} tones={MOVE_TONE} />
                    </div>
                    <p className="mt-1 text-[14px]">
                      {shortDate(m.moveDate)} · {m.slotStart} to {m.slotEnd}
                      {m.liftLabel ? ` · ${m.liftLabel}` : ''}
                    </p>
                    {(m.vehicleNumber || m.moverCompany) && (
                      <p className="text-[13.5px] text-muted">
                        {[m.vehicleNumber, m.moverCompany].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    {m.status === 'BLOCKED_DUES' && (
                      <p className="mt-2 text-[14px] font-semibold">Dues to pay: {inr(m.duesBalancePaise)}</p>
                    )}
                    {m.status === 'PENDING_DEPOSIT' && (
                      <p className="mt-2 text-[14px] font-semibold">Deposit to pay: {inr(m.depositPaise)}</p>
                    )}
                    {m.gatePassCode && (m.status === 'APPROVED' || m.status === 'IN_PROGRESS') && (
                      <div className="mt-3 rounded-[16px] bg-[rgba(201,169,97,0.25)] p-3 text-center">
                        <p className="text-[12.5px] font-semibold uppercase text-muted">Gate pass code</p>
                        <p className="text-[26px] font-bold tracking-[0.2em]">{m.gatePassCode}</p>
                        <p className="text-[12.5px] text-muted">
                          Show this code to the guard when the truck arrives.
                        </p>
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {m.status === 'BLOCKED_DUES' && (
                        <>
                          <a
                            className={buttonClasses('primary', 'md')}
                            href={m.next?.payUrl ?? `/pay?unitId=${m.unitId ?? ''}`}
                          >
                            Pay dues
                          </a>
                          <Button
                            variant="glass"
                            onClick={async () => {
                              if (
                                await run(
                                  () =>
                                    residentsService.myMoveAction(m.id, 'recheck-dues', {
                                      version: m.version,
                                    }),
                                  'Dues checked again',
                                )
                              )
                                load.reload();
                            }}
                          >
                            Check again
                          </Button>
                        </>
                      )}
                      {m.status === 'PENDING_DEPOSIT' && (
                        <a
                          className={buttonClasses('primary', 'md')}
                          href={m.next?.payUrl ?? `/pay?unitId=${m.unitId ?? ''}`}
                        >
                          Pay deposit
                        </a>
                      )}
                      {!['COMPLETED', 'REJECTED', 'CANCELLED', 'IN_PROGRESS'].includes(m.status) &&
                        canCreate && (
                          <Button variant="danger-soft" onClick={() => setCancel(m)}>
                            Cancel request
                          </Button>
                        )}
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )
        }
      </Loading>
      <ConfirmReason
        open={!!cancel}
        title="Cancel this move?"
        confirmLabel="Cancel request"
        onCancel={() => setCancel(null)}
        onConfirm={async reason => {
          if (
            cancel &&
            (await run(
              () => residentsService.myMoveAction(cancel.id, 'cancel', { reason, version: cancel.version }),
              'Move cancelled',
            ))
          ) {
            setCancel(null);
            load.reload();
          }
        }}
      />
      {adding && (
        <MoveForm
          as="owner"
          units={units}
          onClose={() => setAdding(false)}
          onDone={() => {
            setAdding(false);
            load.reload();
          }}
        />
      )}
    </>
  );
}

const STEPS: PermitStatus[] = [
  'PENDING_DEPOSIT',
  'PENDING_APPROVAL',
  'APPROVED',
  'IN_PROGRESS',
  'INSPECTION_PENDING',
  'COMPLETED',
];

function Permits({ units }: { units: Units }) {
  const canCreate = usePermission(RQ.create);
  const run = useRun();
  const [adding, setAdding] = useState(false);
  const [cancel, setCancel] = useState<Permit | null>(null);
  const load = useLoad(() => residentsService.myPermits(), 'p');
  return (
    <>
      {canCreate && units.length > 0 && (
        <Button className="mb-3" onClick={() => setAdding(true)}>
          Apply for a permit
        </Button>
      )}
      {units.length === 0 && (
        <p className="mb-3 text-[14px] text-muted">Only owners can apply for a renovation permit.</p>
      )}
      <Loading load={load} rows={2}>
        {list =>
          list.length === 0 ? (
            <Card>
              <Empty title="No renovation permits" text="Apply before any work starts in your flat." />
            </Card>
          ) : (
            <ul className="grid gap-3">
              {list.map(p => {
                const at = STEPS.indexOf(p.status);
                return (
                  <li key={p.id}>
                    <Card>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="text-[17px] font-bold">
                          {WORK_LABEL[p.workCategory]} · {p.unitLabel}
                        </p>
                        <StatusChip status={p.status} labels={PERMIT_LABEL} tones={PERMIT_TONE} />
                      </div>
                      <p className="mt-1 text-[14px]">
                        {shortDate(p.startDate)} to {shortDate(p.endDate)} · {p.dailyStartTime} to{' '}
                        {p.dailyEndTime}
                      </p>
                      {p.depositPaise > 0 && (
                        <p className="text-[13.5px] text-muted">
                          Deposit {inr(p.depositPaise)}
                          {p.feePaise ? ` · fee ${inr(p.feePaise)}` : ''}
                        </p>
                      )}
                      <ol aria-label="Progress" className="mt-3 flex flex-wrap gap-1.5 text-[12px]">
                        {STEPS.map((s, i) => (
                          <li
                            key={s}
                            aria-current={s === p.status ? 'step' : undefined}
                            className={`rounded-full px-2.5 py-1 font-semibold ${s === p.status ? 'bg-navy text-[#FDF8EE]' : at >= 0 && i < at ? 'bg-[#dcefe5] text-[#14583a]' : 'bg-white/60 text-muted'}`}
                          >
                            {at >= 0 && i < at ? '✓ ' : ''}
                            {PERMIT_LABEL[s]}
                          </li>
                        ))}
                      </ol>
                      {p.status === 'SUSPENDED' && (
                        <p className="mt-2 text-[14px] font-semibold text-bad">
                          Work is stopped. Speak to the committee before you continue.
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {p.status === 'PENDING_DEPOSIT' && (
                          <a
                            className={buttonClasses('primary', 'md')}
                            href={`/pay?paymentOrderId=${p.depositPayment?.paymentOrderId ?? ''}`}
                          >
                            Pay deposit
                          </a>
                        )}
                        {p.status === 'IN_PROGRESS' && canCreate && (
                          <Button
                            onClick={async () => {
                              if (
                                await run(
                                  () =>
                                    residentsService.myPermitAction(p.id, 'work-done', {
                                      version: p.version,
                                    }),
                                  'Inspection requested',
                                )
                              )
                                load.reload();
                            }}
                          >
                            Work done
                          </Button>
                        )}
                        {['PENDING_DEPOSIT', 'PENDING_APPROVAL', 'APPROVED'].includes(p.status) &&
                          canCreate && (
                            <Button variant="danger-soft" onClick={() => setCancel(p)}>
                              Cancel permit
                            </Button>
                          )}
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )
        }
      </Loading>
      <ConfirmReason
        open={!!cancel}
        title="Cancel this permit?"
        description="The deposit is refunded in full."
        confirmLabel="Cancel permit"
        onCancel={() => setCancel(null)}
        onConfirm={async reason => {
          if (
            cancel &&
            (await run(
              () => residentsService.myPermitAction(cancel.id, 'cancel', { reason, version: cancel.version }),
              'Permit cancelled',
            ))
          ) {
            setCancel(null);
            load.reload();
          }
        }}
      />
      {adding && (
        <PermitForm
          as="owner"
          units={units}
          onClose={() => setAdding(false)}
          onDone={() => {
            setAdding(false);
            load.reload();
          }}
        />
      )}
    </>
  );
}

function Transfers({ units }: { units: Units }) {
  const canCreate = usePermission(RQ.create);
  const run = useRun();
  const [adding, setAdding] = useState(false);
  const [cancel, setCancel] = useState<Transfer | null>(null);
  const load = useLoad(() => residentsService.myTransfers(), 't');
  return (
    <>
      {canCreate && units.length > 0 && (
        <Button className="mb-3" onClick={() => setAdding(true)}>
          Start a transfer
        </Button>
      )}
      <Loading load={load} rows={2}>
        {list =>
          list.length === 0 ? (
            <Card>
              <Empty
                title="No ownership transfers"
                text="Start a transfer when you sell or hand over your flat."
              />
            </Card>
          ) : (
            <ul className="grid gap-3">
              {list.map(t => (
                <li key={t.id}>
                  <Card>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-[17px] font-bold">
                        {TRANSFER_TYPE_LABEL[t.transferType]} · {t.unitLabel}
                      </p>
                      <StatusChip status={t.status} labels={TRANSFER_LABEL} tones={TRANSFER_TONE} />
                    </div>
                    <p className="mt-1 text-[14px]">
                      To {t.buyers.map(b => b.name).join(', ')} from {shortDate(t.effectiveDate)}
                    </p>
                    <div className="mt-2 rounded-[14px] bg-white/60 p-3 text-[13.5px]">
                      <p className="font-semibold">Fee preview</p>
                      <p>
                        Transfer premium {inr(t.fees.transferPremiumPaise)} · share transfer{' '}
                        {inr(t.fees.shareTransferFeePaise)} · entrance {inr(t.fees.entranceFeePaise)} ×{' '}
                        {t.fees.newBuyerCount}
                      </p>
                      <p className="font-bold">Total {inr(t.fees.totalFeesPaise)}</p>
                    </div>
                    <p className="mt-2 text-[13.5px] font-semibold">Document checklist</p>
                    {t.missingDocuments.length === 0 ? (
                      <p className="text-[13.5px] text-[#14583a]">All documents received.</p>
                    ) : (
                      <ul className="text-[13.5px]">
                        {t.missingDocuments.map(d => (
                          <li key={d}>
                            <Chip tone="warn">Needed</Chip> {docLabel(d)}
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {t.status === 'DRAFT' && canCreate && (
                        <Button
                          onClick={async () => {
                            if (
                              await run(
                                () =>
                                  residentsService.myTransferAction(t.id, 'submit', { version: t.version }),
                                'Submitted for approval',
                              )
                            )
                              load.reload();
                          }}
                        >
                          Submit
                        </Button>
                      )}
                      {(t.status === 'DRAFT' || t.status === 'PENDING_APPROVAL') && canCreate && (
                        <Button variant="danger-soft" onClick={() => setCancel(t)}>
                          Cancel transfer
                        </Button>
                      )}
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )
        }
      </Loading>
      <ConfirmReason
        open={!!cancel}
        title="Cancel this transfer?"
        confirmLabel="Cancel transfer"
        onCancel={() => setCancel(null)}
        onConfirm={async reason => {
          if (
            cancel &&
            (await run(
              () =>
                residentsService.myTransferAction(cancel.id, 'cancel', { reason, version: cancel.version }),
              'Transfer cancelled',
            ))
          ) {
            setCancel(null);
            load.reload();
          }
        }}
      />
      {adding && (
        <TransferForm
          as="owner"
          units={units}
          onClose={() => setAdding(false)}
          onDone={() => {
            setAdding(false);
            load.reload();
          }}
        />
      )}
    </>
  );
}
