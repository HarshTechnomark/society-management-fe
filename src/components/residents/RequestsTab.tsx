'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Pager, useServerList } from '@/components/billing/useServerList';
import { ConfirmReason } from '@/components/common/ConfirmReason';
import { DataTable, type Column } from '@/components/common/DataTable';
import { Card } from '@/components/common/PageHead';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Chip } from '@/components/ui/Chip';
import { Drawer } from '@/components/ui/Drawer';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { PERMISSIONS } from '@/constants/permissions';
import { useFeature } from '@/hooks/useFeature';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { inr, shortDate } from '@/lib/money';
import { residentsService } from '@/services/residents.service';
import type { MoveRequest, Permit, Transfer, ViolationCategory } from '@/types/residents';
import {
  FormDialog,
  KV,
  Loading,
  Section,
  Segments,
  StatusChip,
  isoDate,
  rupeesToPaise,
  useRun,
} from './common';
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
} from './format';
import { MoveForm, PermitForm, TransferForm } from './RequestForms';

const R = PERMISSIONS.residents.requests;
type Sub = 'moves' | 'renovation' | 'transfers';

/** The Requests tab (spec 11.1): Moves (list and week calendar), Renovation and Transfers. */
export function RequestsTab({ refreshKey, onChanged }: { refreshKey: number; onChanged: () => void }) {
  const [sub, setSub] = useState<Sub>('moves');
  const moveIn = useFeature('residents.move_in_workflow');
  const moveOut = useFeature('residents.move_out_workflow');
  const moveOn = moveIn || moveOut;
  const permitOn = useFeature('residents.renovation_permits');
  const transferOn = useFeature('residents.ownership_transfer');
  const options = [
    ...(moveOn ? [{ key: 'moves' as const, label: 'Moves' }] : []),
    ...(permitOn ? [{ key: 'renovation' as const, label: 'Renovation' }] : []),
    ...(transferOn ? [{ key: 'transfers' as const, label: 'Transfers' }] : []),
  ];
  if (options.length === 0)
    return (
      <Card>
        <p className="text-[14px] text-muted">
          Move, renovation and transfer requests are not part of your plan.
        </p>
      </Card>
    );
  const current = options.some(o => o.key === sub) ? sub : options[0].key;
  return (
    <div>
      <Segments label="Request kind" options={options} value={current} onChange={setSub} />
      {current === 'moves' && <MovesPanel refreshKey={refreshKey} onChanged={onChanged} />}
      {current === 'renovation' && <PermitsPanel refreshKey={refreshKey} onChanged={onChanged} />}
      {current === 'transfers' && <TransfersPanel refreshKey={refreshKey} onChanged={onChanged} />}
    </div>
  );
}

function mondayOf(d: Date) {
  const x = new Date(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x.toISOString().slice(0, 10);
}
const addDays = (iso: string, n: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

function MovesPanel({ refreshKey, onChanged }: { refreshKey: number; onChanged: () => void }) {
  const canCreate = usePermission(R.create);
  const [view, setView] = useState<'list' | 'week'>('list');
  const [status, setStatus] = useState('');
  const [week, setWeek] = useState(mondayOf(new Date()));
  const [open, setOpen] = useState<MoveRequest | null>(null);
  const [adding, setAdding] = useState(false);
  const list = useServerList<MoveRequest>(
    page =>
      residentsService.moves({
        status: (status || undefined) as MoveRequest['status'] | undefined,
        ...(view === 'week' ? { dateFrom: week, dateTo: addDays(week, 6) } : {}),
        page,
        limit: view === 'week' ? 100 : 20,
      }),
    [status, view, week, refreshKey].join('|'),
    20,
  );
  const columns: Column<MoveRequest>[] = useMemo(
    () => [
      { key: 'flat', label: 'Flat', render: m => <strong>{m.unitLabel}</strong> },
      { key: 'type', label: 'Type', render: m => (m.type === 'MOVE_IN' ? 'Move in' : 'Move out') },
      {
        key: 'date',
        label: 'Date and slot',
        render: m => `${shortDate(m.moveDate)} · ${m.slotStart} to ${m.slotEnd}`,
      },
      { key: 'lift', label: 'Lift', render: m => m.liftLabel ?? '-' },
      {
        key: 'status',
        label: 'Status',
        render: m => <StatusChip status={m.status} labels={MOVE_LABEL} tones={MOVE_TONE} />,
      },
    ],
    [],
  );
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const lifts = [...new Set(list.rows.map(m => m.liftLabel ?? 'No lift'))];
  const changed = () => {
    list.reload();
    onChanged();
  };
  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <Segments
          label="View"
          value={view}
          onChange={setView}
          options={[
            { key: 'list', label: 'List' },
            { key: 'week', label: 'Week calendar' },
          ]}
        />
        {view === 'list' && (
          <div className="min-w-[200px]">
            <Select
              label="Status"
              value={status}
              onChange={e => setStatus(e.target.value)}
              options={[
                { value: '', label: 'All statuses' },
                ...Object.entries(MOVE_LABEL).map(([value, label]) => ({ value, label })),
              ]}
            />
          </div>
        )}
        {canCreate && (
          <Button size="sm" className="mb-3" onClick={() => setAdding(true)}>
            New move
          </Button>
        )}
      </div>
      {view === 'week' && (
        <div className="mb-3 flex items-center gap-2 text-[14px]">
          <Button size="xs" variant="glass" onClick={() => setWeek(addDays(week, -7))}>
            Previous week
          </Button>
          <span>Week of {shortDate(week)}</span>
          <Button size="xs" variant="glass" onClick={() => setWeek(addDays(week, 7))}>
            Next week
          </Button>
        </div>
      )}
      {view === 'week' && !list.loading && !list.error ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-[13px]">
            <caption className="sr-only">Moves this week by lift</caption>
            <thead>
              <tr>
                <th scope="col" className="p-2 text-left">
                  Lift
                </th>
                {days.map(d => (
                  <th key={d} scope="col" className="p-2 text-left">
                    {shortDate(d)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lifts.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-4 text-center text-muted">
                    No moves this week.
                  </td>
                </tr>
              )}
              {lifts.map(l => (
                <tr key={l} className="border-t border-[var(--line)] align-top">
                  <th scope="row" className="p-2 text-left font-semibold">
                    {l}
                  </th>
                  {days.map(d => (
                    <td key={d} className="p-2">
                      {list.rows
                        .filter(m => (m.liftLabel ?? 'No lift') === l && m.moveDate === d)
                        .map(m => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setOpen(m)}
                            className="mb-1 block w-full rounded-[10px] bg-white/70 px-2 py-1 text-left"
                          >
                            {m.unitLabel} {m.slotStart}-{m.slotEnd}
                            <span className="block text-[11.5px] text-muted">{MOVE_LABEL[m.status]}</span>
                          </button>
                        ))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <DataTable
            caption="Moves"
            columns={columns}
            rows={list.rows}
            rowKey={m => m.id}
            loading={list.loading}
            error={list.error}
            onRetry={list.reload}
            onRowClick={m => setOpen(m)}
            rowLabel={m => `${m.unitLabel} ${m.moveDate}`}
            pageSize={100}
            empty={{ title: 'No move requests', text: 'Move-in and move-out requests appear here.' }}
          />
          <Pager pagination={list.pagination} page={list.page} onPage={list.setPage} />
        </>
      )}
      {open && (
        <MoveDrawer
          move={open}
          onClose={() => setOpen(null)}
          onChanged={() => {
            setOpen(null);
            changed();
          }}
        />
      )}
      {adding && (
        <MoveForm
          as="admin"
          onClose={() => setAdding(false)}
          onDone={() => {
            setAdding(false);
            changed();
          }}
        />
      )}
    </Card>
  );
}

function MoveDrawer({
  move: m,
  onClose,
  onChanged,
}: {
  move: MoveRequest;
  onClose: () => void;
  onChanged: () => void;
}) {
  const canEdit = usePermission(R.edit);
  const canCreate = usePermission(R.create);
  const canApprove = usePermission(R.approve);
  const run = useRun();
  const [act, setAct] = useState<'override' | 'cancel' | 'inspect' | null>(null);
  const body = { version: m.version };
  const go = async (action: 'recheck-dues' | 'start' | 'complete', msg: string) => {
    if (await run(() => residentsService.moveAction(m.id, action, body), msg)) onChanged();
  };
  const open = !['COMPLETED', 'REJECTED', 'CANCELLED', 'IN_PROGRESS'].includes(m.status);
  return (
    <Drawer
      open
      onClose={onClose}
      title={`${m.type === 'MOVE_IN' ? 'Move in' : 'Move out'} · ${m.unitLabel}`}
      size={640}
    >
      <div className="mb-4">
        <StatusChip status={m.status} labels={MOVE_LABEL} tones={MOVE_TONE} />
      </div>
      <dl className="mb-5">
        <KV label="Date">{shortDate(m.moveDate)}</KV>
        <KV label="Slot">
          {m.slotStart} to {m.slotEnd}
        </KV>
        {m.liftLabel && <KV label="Lift">{m.liftLabel}</KV>}
        {m.vehicleNumber && <KV label="Vehicle">{m.vehicleNumber}</KV>}
        {m.moverCompany && (
          <KV label="Movers">
            {m.moverCompany}
            {m.helperCount ? ` · ${m.helperCount} helpers` : ''}
          </KV>
        )}
        <KV label="Dues on the flat">{m.duesBalancePaise > 0 ? inr(m.duesBalancePaise) : 'Paid up'}</KV>
        <KV label="Deposit">{inr(m.depositPaise)}</KV>
        {m.gatePassCode && (
          <KV label="Gate pass code">
            <code>{m.gatePassCode}</code>
          </KV>
        )}
        {m.inspectionStatus && m.inspectionStatus !== 'NOT_REQUIRED' && (
          <KV label="Inspection">
            {m.inspectionStatus === 'PENDING'
              ? 'Waiting'
              : m.inspectionStatus === 'PASSED'
                ? 'Passed'
                : 'Damage found'}
          </KV>
        )}
      </dl>
      <Section title="Actions">
        <div className="flex flex-wrap gap-2">
          {m.status === 'BLOCKED_DUES' && canCreate && (
            <Button onClick={() => void go('recheck-dues', 'Dues checked again')}>Check dues again</Button>
          )}
          {m.status === 'BLOCKED_DUES' && canApprove && (
            <Button variant="glass" onClick={() => setAct('override')}>
              Override dues
            </Button>
          )}
          {m.status === 'APPROVED' && canEdit && (
            <Button onClick={() => void go('start', 'Move started')}>Mark started</Button>
          )}
          {m.status === 'IN_PROGRESS' && canEdit && (
            <Button onClick={() => void go('complete', 'Move completed')}>Mark completed</Button>
          )}
          {m.status === 'COMPLETED' && m.inspectionStatus === 'PENDING' && canEdit && (
            <Button onClick={() => setAct('inspect')}>Record inspection</Button>
          )}
          {open && canEdit && (
            <Button variant="danger-soft" onClick={() => setAct('cancel')}>
              Cancel move
            </Button>
          )}
          {m.status === 'PENDING_APPROVAL' && (
            <Link className="self-center text-[14px] font-semibold underline" href="/admin/approvals">
              Open in approvals
            </Link>
          )}
        </div>
      </Section>
      <ConfirmReason
        open={act === 'override'}
        title="Override the dues block?"
        description="The move goes on although dues are unpaid. This is recorded. Another person than the requester must do it."
        confirmLabel="Override"
        variant="primary"
        onCancel={() => setAct(null)}
        onConfirm={async reason => {
          if (
            await run(
              () => residentsService.moveAction(m.id, 'override-dues', { reason, version: m.version }),
              'Dues overridden',
            )
          )
            onChanged();
        }}
      />
      <ConfirmReason
        open={act === 'cancel'}
        title="Cancel this move?"
        confirmLabel="Cancel move"
        onCancel={() => setAct(null)}
        onConfirm={async reason => {
          if (
            await run(
              () => residentsService.moveAction(m.id, 'cancel', { reason, version: m.version }),
              'Move cancelled',
            )
          )
            onChanged();
        }}
      />
      {act === 'inspect' && <InspectionDialog m={m} onClose={() => setAct(null)} onDone={onChanged} />}
    </Drawer>
  );
}

function InspectionDialog({
  m,
  onClose,
  onDone,
}: {
  m: MoveRequest;
  onClose: () => void;
  onDone: () => void;
}) {
  const [result, setResult] = useState('PASSED');
  const [deduction, setDeduction] = useState('0');
  const [note, setNote] = useState('');
  return (
    <FormDialog
      title="Record inspection"
      description="The deposit refund is requested after this."
      submitLabel="Save inspection"
      onClose={onClose}
      onDone={onDone}
      onSubmit={async () => {
        if (note.trim().length < 5) return { error: 'Add a note of at least 5 characters.' };
        const paise = result === 'DAMAGE_FOUND' ? rupeesToPaise(deduction || '0') : 0;
        if (paise > m.depositPaise) return { error: 'The deduction is more than the deposit.' };
        await residentsService.moveAction(m.id, 'inspection', {
          result,
          damageDeductionPaise: paise,
          note: note.trim(),
          version: m.version,
        });
        return { message: 'Inspection recorded' };
      }}
    >
      <Select
        label="Result"
        value={result}
        onChange={e => setResult(e.target.value)}
        options={[
          { value: 'PASSED', label: 'Passed' },
          { value: 'DAMAGE_FOUND', label: 'Damage found' },
        ]}
      />
      {result === 'DAMAGE_FOUND' && (
        <Input
          label="Deduction (₹)"
          inputMode="decimal"
          value={deduction}
          onChange={e => setDeduction(e.target.value)}
        />
      )}
      <Input label="Note" value={note} onChange={e => setNote(e.target.value)} />
    </FormDialog>
  );
}

function PermitsPanel({ refreshKey, onChanged }: { refreshKey: number; onChanged: () => void }) {
  const canCreate = usePermission(R.create);
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState<Permit | null>(null);
  const [adding, setAdding] = useState(false);
  const list = useServerList<Permit>(
    page => residentsService.permits({ status: status || undefined, page, limit: 20 }),
    [status, refreshKey].join('|'),
    20,
  );
  const columns: Column<Permit>[] = useMemo(
    () => [
      { key: 'flat', label: 'Flat', render: p => <strong>{p.unitLabel}</strong> },
      { key: 'work', label: 'Work', render: p => WORK_LABEL[p.workCategory] },
      { key: 'dates', label: 'Dates', render: p => `${shortDate(p.startDate)} to ${shortDate(p.endDate)}` },
      { key: 'hours', label: 'Hours', render: p => `${p.dailyStartTime} to ${p.dailyEndTime}` },
      {
        key: 'status',
        label: 'Status',
        render: p => <StatusChip status={p.status} labels={PERMIT_LABEL} tones={PERMIT_TONE} />,
      },
    ],
    [],
  );
  const changed = () => {
    list.reload();
    onChanged();
  };
  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div className="min-w-[200px]">
          <Select
            label="Status"
            value={status}
            onChange={e => setStatus(e.target.value)}
            options={[
              { value: '', label: 'All statuses' },
              ...Object.entries(PERMIT_LABEL).map(([value, label]) => ({ value, label })),
            ]}
          />
        </div>
        {canCreate && (
          <Button size="sm" className="mb-3" onClick={() => setAdding(true)}>
            New permit
          </Button>
        )}
      </div>
      <DataTable
        caption="Renovation permits"
        columns={columns}
        rows={list.rows}
        rowKey={p => p.id}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        onRowClick={p => setOpen(p)}
        rowLabel={p => `${p.unitLabel} ${WORK_LABEL[p.workCategory]}`}
        pageSize={100}
        empty={{ title: 'No renovation permits', text: 'Permits appear here when owners apply.' }}
      />
      <Pager pagination={list.pagination} page={list.page} onPage={list.setPage} />
      {open && (
        <PermitDrawer
          permit={open}
          onClose={() => setOpen(null)}
          onChanged={() => {
            setOpen(null);
            changed();
          }}
        />
      )}
      {adding && (
        <PermitForm
          as="admin"
          onClose={() => setAdding(false)}
          onDone={() => {
            setAdding(false);
            changed();
          }}
        />
      )}
    </Card>
  );
}

const VIOLATIONS: [ViolationCategory, string][] = [
  ['OUTSIDE_HOURS', 'Work outside hours'],
  ['NOISE', 'Noise'],
  ['DEBRIS', 'Debris left'],
  ['COMMON_AREA_DAMAGE', 'Common area damaged'],
  ['UNAUTHORISED_WORK', 'Unauthorised work'],
  ['SAFETY', 'Safety'],
  ['OTHER', 'Other'],
];

function PermitDrawer({
  permit: p,
  onClose,
  onChanged,
}: {
  permit: Permit;
  onClose: () => void;
  onChanged: () => void;
}) {
  const canEdit = usePermission(R.edit);
  const run = useRun();
  const [act, setAct] = useState<'suspend' | 'cancel' | 'extend' | 'violation' | 'inspect' | null>(null);
  const go = async (action: 'start' | 'resume' | 'work-done', msg: string) => {
    if (await run(() => residentsService.permitAction(p.id, action, { version: p.version }), msg))
      onChanged();
  };
  const cancellable = ['PENDING_DEPOSIT', 'PENDING_APPROVAL', 'APPROVED'].includes(p.status);
  return (
    <Drawer open onClose={onClose} title={`${WORK_LABEL[p.workCategory]} · ${p.unitLabel}`} size={640}>
      <div className="mb-4">
        <StatusChip status={p.status} labels={PERMIT_LABEL} tones={PERMIT_TONE} />
      </div>
      <dl className="mb-5">
        {p.contractorName && (
          <KV label="Contractor">
            {p.contractorName}
            {p.contractorMobile ? ` · ${p.contractorMobile}` : ''}
          </KV>
        )}
        {p.workerCount !== undefined && <KV label="Workers">{p.workerCount}</KV>}
        <KV label="Dates">
          {shortDate(p.startDate)} to {shortDate(p.endDate)}
        </KV>
        <KV label="Hours">
          {p.dailyStartTime} to {p.dailyEndTime}
        </KV>
        <KV label="Deposit">{inr(p.depositPaise)}</KV>
        <KV label="Fee">{inr(p.feePaise)}</KV>
        {p.extensionCount ? <KV label="Extensions">{p.extensionCount} of 3</KV> : null}
      </dl>
      {canEdit && (
        <Section title="Actions">
          <div className="flex flex-wrap gap-2">
            {p.status === 'APPROVED' && (
              <Button onClick={() => void go('start', 'Work started')}>Start work</Button>
            )}
            {p.status === 'IN_PROGRESS' && (
              <Button variant="glass" onClick={() => setAct('violation')}>
                Record violation
              </Button>
            )}
            {p.status === 'IN_PROGRESS' && (
              <Button variant="danger-soft" onClick={() => setAct('suspend')}>
                Stop work
              </Button>
            )}
            {p.status === 'SUSPENDED' && (
              <Button onClick={() => void go('resume', 'Work resumed')}>Resume work</Button>
            )}
            {(p.status === 'IN_PROGRESS' || p.status === 'SUSPENDED' || p.status === 'APPROVED') && (
              <Button variant="glass" onClick={() => setAct('extend')}>
                Extend end date
              </Button>
            )}
            {p.status === 'IN_PROGRESS' && (
              <Button variant="glass" onClick={() => void go('work-done', 'Inspection requested')}>
                Ask for inspection
              </Button>
            )}
            {p.status === 'INSPECTION_PENDING' && (
              <Button onClick={() => setAct('inspect')}>Record inspection</Button>
            )}
            {cancellable && (
              <Button variant="danger-soft" onClick={() => setAct('cancel')}>
                Cancel permit
              </Button>
            )}
            {p.status === 'PENDING_APPROVAL' && (
              <Link className="self-center text-[14px] font-semibold underline" href="/admin/approvals">
                Open in approvals
              </Link>
            )}
          </div>
        </Section>
      )}
      <ConfirmReason
        open={act === 'suspend'}
        title="Stop work on this permit?"
        description="Guards will deny the contractor entry until work resumes."
        confirmLabel="Stop work"
        onCancel={() => setAct(null)}
        onConfirm={async reason => {
          if (
            await run(
              () => residentsService.permitAction(p.id, 'suspend', { reason, version: p.version }),
              'Work stopped',
            )
          )
            onChanged();
        }}
      />
      <ConfirmReason
        open={act === 'cancel'}
        title="Cancel this permit?"
        description="The deposit is refunded in full."
        confirmLabel="Cancel permit"
        onCancel={() => setAct(null)}
        onConfirm={async reason => {
          if (
            await run(
              () => residentsService.permitAction(p.id, 'cancel', { reason, version: p.version }),
              'Permit cancelled',
            )
          )
            onChanged();
        }}
      />
      {act === 'extend' && <ExtendDialog p={p} onClose={() => setAct(null)} onDone={onChanged} />}
      {act === 'violation' && <ViolationDialog p={p} onClose={() => setAct(null)} onDone={onChanged} />}
      {act === 'inspect' && <PermitInspectDialog p={p} onClose={() => setAct(null)} onDone={onChanged} />}
    </Drawer>
  );
}

function ExtendDialog({ p, onClose, onDone }: { p: Permit; onClose: () => void; onDone: () => void }) {
  const [end, setEnd] = useState('');
  const [reason, setReason] = useState('');
  return (
    <FormDialog
      title="Extend the permit"
      description="A permit can be extended up to 3 times."
      submitLabel="Extend"
      onClose={onClose}
      onDone={onDone}
      onSubmit={async () => {
        if (!isoDate(end) || end <= p.endDate)
          return { error: 'The new end date must be after the current end date.' };
        if (reason.trim().length < 5) return { error: 'Add a reason of at least 5 characters.' };
        await residentsService.permitAction(p.id, 'extend', {
          endDate: end,
          reason: reason.trim(),
          version: p.version,
        });
        return { message: 'Permit extended' };
      }}
    >
      <Input label="New end date" type="date" value={end} onChange={e => setEnd(e.target.value)} />
      <Input label="Reason" value={reason} onChange={e => setReason(e.target.value)} />
    </FormDialog>
  );
}

function ViolationDialog({ p, onClose, onDone }: { p: Permit; onClose: () => void; onDone: () => void }) {
  const [category, setCategory] = useState<ViolationCategory>('OUTSIDE_HOURS');
  const [note, setNote] = useState('');
  const [stop, setStop] = useState(false);
  const [fine, setFine] = useState('');
  return (
    <FormDialog
      title="Record a violation"
      submitLabel="Record"
      onClose={onClose}
      onDone={onDone}
      onSubmit={async () => {
        if (note.trim().length < 5) return { error: 'Describe what happened in at least 5 characters.' };
        await residentsService.permitAction(p.id, 'violations', {
          category,
          note: note.trim(),
          stopWork: stop,
          finePaise: fine ? rupeesToPaise(fine) : 0,
          version: p.version,
        });
        return { message: stop ? 'Violation recorded and work stopped' : 'Violation recorded' };
      }}
    >
      <Select
        label="What happened"
        value={category}
        onChange={e => setCategory(e.target.value as ViolationCategory)}
        options={VIOLATIONS.map(([value, label]) => ({ value, label }))}
      />
      <Input label="Note" value={note} onChange={e => setNote(e.target.value)} />
      <Input
        label="Fine (₹, optional)"
        inputMode="decimal"
        value={fine}
        onChange={e => setFine(e.target.value)}
      />
      <Checkbox label="Stop work now" checked={stop} onChange={e => setStop(e.target.checked)} />
    </FormDialog>
  );
}

function PermitInspectDialog({ p, onClose, onDone }: { p: Permit; onClose: () => void; onDone: () => void }) {
  const [result, setResult] = useState('PASSED');
  const [note, setNote] = useState('');
  const [deduction, setDeduction] = useState('0');
  return (
    <FormDialog
      title="Inspection result"
      submitLabel="Save result"
      onClose={onClose}
      onDone={onDone}
      onSubmit={async () => {
        if (note.trim().length < 5) return { error: 'Add a note of at least 5 characters.' };
        const paise = rupeesToPaise(deduction || '0');
        if (paise > p.depositPaise) return { error: 'The deduction is more than the deposit.' };
        await residentsService.permitAction(p.id, 'inspect', {
          result,
          note: note.trim(),
          damageDeductionPaise: paise,
          version: p.version,
        });
        return { message: result === 'PASSED' ? 'Permit completed' : 'Inspection failed. Work continues.' };
      }}
    >
      <Select
        label="Result"
        value={result}
        onChange={e => setResult(e.target.value)}
        options={[
          { value: 'PASSED', label: 'Passed' },
          { value: 'FAILED', label: 'Failed' },
        ]}
      />
      <Input
        label="Deduction from deposit (₹)"
        inputMode="decimal"
        value={deduction}
        onChange={e => setDeduction(e.target.value)}
      />
      <Input label="Note" value={note} onChange={e => setNote(e.target.value)} />
    </FormDialog>
  );
}

function TransfersPanel({ refreshKey, onChanged }: { refreshKey: number; onChanged: () => void }) {
  const canCreate = usePermission(R.create);
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const list = useServerList<Transfer>(
    page => residentsService.transfers({ status: status || undefined, page, limit: 20 }),
    [status, refreshKey].join('|'),
    20,
  );
  const columns: Column<Transfer>[] = useMemo(
    () => [
      { key: 'flat', label: 'Flat', render: t => <strong>{t.unitLabel}</strong> },
      { key: 'type', label: 'Kind', render: t => TRANSFER_TYPE_LABEL[t.transferType] },
      { key: 'buyers', label: 'Buyers', render: t => t.buyers.map(b => b.name).join(', ') },
      { key: 'date', label: 'Effective', render: t => shortDate(t.effectiveDate) },
      {
        key: 'status',
        label: 'Status',
        render: t => <StatusChip status={t.status} labels={TRANSFER_LABEL} tones={TRANSFER_TONE} />,
      },
    ],
    [],
  );
  const changed = () => {
    list.reload();
    onChanged();
  };
  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div className="min-w-[200px]">
          <Select
            label="Status"
            value={status}
            onChange={e => setStatus(e.target.value)}
            options={[
              { value: '', label: 'All statuses' },
              ...Object.entries(TRANSFER_LABEL).map(([value, label]) => ({ value, label })),
            ]}
          />
        </div>
        {canCreate && (
          <Button size="sm" className="mb-3" onClick={() => setAdding(true)}>
            New transfer
          </Button>
        )}
      </div>
      <DataTable
        caption="Ownership transfers"
        columns={columns}
        rows={list.rows}
        rowKey={t => t.id}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        onRowClick={t => setOpen(t.id)}
        rowLabel={t => `${t.unitLabel} ${TRANSFER_TYPE_LABEL[t.transferType]}`}
        pageSize={100}
        empty={{
          title: 'No ownership transfers',
          text: 'Start a transfer after a flat is sold or inherited.',
        }}
      />
      <Pager pagination={list.pagination} page={list.page} onPage={list.setPage} />
      {open !== null && <TransferDrawer id={open} onClose={() => setOpen(null)} onChanged={changed} />}
      {adding && (
        <TransferForm
          as="admin"
          onClose={() => setAdding(false)}
          onDone={() => {
            setAdding(false);
            changed();
          }}
        />
      )}
    </Card>
  );
}

function TransferDrawer({
  id,
  onClose,
  onChanged,
}: {
  id: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const canEdit = usePermission(R.edit);
  const canApprove = usePermission(R.approve);
  const run = useRun();
  const [cancel, setCancel] = useState(false);
  const load = useLoad(() => residentsService.transfer(id), id);
  const done = () => {
    load.reload();
    onChanged();
  };
  return (
    <Drawer
      open
      onClose={onClose}
      title={load.data ? `Transfer of ${load.data.unitLabel}` : 'Transfer'}
      size={640}
    >
      <Loading load={load} rows={4}>
        {t => (
          <>
            <div className="mb-4 flex flex-wrap gap-1.5">
              <StatusChip status={t.status} labels={TRANSFER_LABEL} tones={TRANSFER_TONE} />
              <Chip>{TRANSFER_TYPE_LABEL[t.transferType]}</Chip>
            </div>
            <dl className="mb-5">
              <KV label="Effective date">{shortDate(t.effectiveDate)}</KV>
              <KV label="Sellers">{t.sellers?.map(s => s.name).join(', ') || '-'}</KV>
              <KV label="Buyers">{t.buyers.map(b => `${b.name} (${b.sharePercent}%)`).join(', ')}</KV>
              <KV label="Transfer premium">{inr(t.fees.transferPremiumPaise)}</KV>
              <KV label="Share transfer fee">{inr(t.fees.shareTransferFeePaise)}</KV>
              <KV label={`Entrance fee × ${t.fees.newBuyerCount}`}>
                {inr(t.fees.entranceFeePaise * t.fees.newBuyerCount)}
              </KV>
              <KV label="Total fees">{inr(t.fees.totalFeesPaise)}</KV>
              {t.balancePaise !== undefined && (
                <KV label="Dues on the flat">{t.balancePaise > 0 ? inr(t.balancePaise) : 'Paid up'}</KV>
              )}
              <KV label="Dues rule">
                {t.duesPolicy === 'MUST_CLEAR' ? 'Seller must clear dues' : 'Dues stay with the flat'}
              </KV>
            </dl>
            <Section title="Documents still needed">
              {t.missingDocuments.length === 0 ? (
                <p className="text-[14px] text-[#14583a]">All documents received.</p>
              ) : (
                <ul>
                  {t.missingDocuments.map(d => (
                    <li key={d} className="py-0.5 text-[14px]">
                      {docLabel(d)}
                    </li>
                  ))}
                </ul>
              )}
            </Section>
            <Section title="Actions">
              <div className="flex flex-wrap gap-2">
                {t.status === 'DRAFT' && canEdit && (
                  <Button
                    onClick={async () => {
                      if (
                        await run(
                          () => residentsService.transferAction(id, 'submit', { version: t.version }),
                          'Submitted for approval',
                        )
                      )
                        done();
                    }}
                  >
                    Submit for approval
                  </Button>
                )}
                {t.status === 'APPROVED' && canApprove && (
                  <Button
                    onClick={async () => {
                      if (
                        await run(
                          () => residentsService.transferAction(id, 'complete', { version: t.version }),
                          'Transfer completed',
                        )
                      )
                        done();
                    }}
                  >
                    Complete transfer
                  </Button>
                )}
                {(t.status === 'DRAFT' || t.status === 'PENDING_APPROVAL'
                  ? canEdit
                  : t.status === 'APPROVED' && canApprove) && (
                  <Button variant="danger-soft" onClick={() => setCancel(true)}>
                    Cancel transfer
                  </Button>
                )}
                {t.status === 'PENDING_APPROVAL' && (
                  <Link className="self-center text-[14px] font-semibold underline" href="/admin/approvals">
                    Open in approvals
                  </Link>
                )}
              </div>
            </Section>
            <ConfirmReason
              open={cancel}
              title="Cancel this transfer?"
              description="Fees already raised are cancelled."
              confirmLabel="Cancel transfer"
              onCancel={() => setCancel(false)}
              onConfirm={async reason => {
                if (
                  await run(
                    () => residentsService.transferAction(id, 'cancel', { reason, version: t.version }),
                    'Transfer cancelled',
                  )
                ) {
                  setCancel(false);
                  done();
                }
              }}
            />
          </>
        )}
      </Loading>
    </Drawer>
  );
}
