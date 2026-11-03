'use client';
import { useMemo, useState } from 'react';
import { Pager, useServerList } from '@/components/billing/useServerList';
import { DataTable, type Column } from '@/components/common/DataTable';
import { ConfirmReason } from '@/components/common/ConfirmReason';
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
import type { PoliceStatus, Tenancy, TenancyStatus } from '@/types/residents';
import {
  FileField,
  FormDialog,
  KV,
  Loading,
  Section,
  StatusChip,
  isoDate,
  rupeesToPaise,
  useRun,
} from './common';
import {
  POLICE_LABEL,
  POLICE_TONE,
  TENANCY_LABEL,
  TENANCY_TONE,
  agreementEndInfo,
  opts,
  today,
} from './format';
import { TenancyForm } from './TenancyForm';

const P = PERMISSIONS.residents.people;

/** The Tenancies tab (spec 11.1): list with agreement end and police verification, drawer with actions. */
export function TenanciesTab({ refreshKey, onChanged }: { refreshKey: number; onChanged: () => void }) {
  const canCreate = usePermission(P.create);
  const [status, setStatus] = useState('');
  const [expiring, setExpiring] = useState('');
  const [tracker, setTracker] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const list = useServerList<Tenancy>(
    page =>
      residentsService.tenancies({
        status: (tracker ? 'ACTIVE' : status || undefined) as TenancyStatus | undefined,
        policeVerificationStatus: tracker ? 'NOT_SUBMITTED' : undefined,
        expiringWithinDays: expiring ? Number(expiring) : undefined,
        page,
        limit: 20,
      }),
    [status, expiring, tracker, refreshKey].join('|'),
    20,
  );
  const columns: Column<Tenancy>[] = useMemo(
    () => [
      { key: 'flat', label: 'Flat', render: t => <strong>{t.unit.label}</strong> },
      { key: 'tenant', label: 'Tenant', render: t => t.tenant.name },
      {
        key: 'status',
        label: 'Status',
        render: t => <StatusChip status={t.status} labels={TENANCY_LABEL} tones={TENANCY_TONE} />,
      },
      {
        key: 'end',
        label: 'Agreement end',
        render: t => {
          const i = agreementEndInfo(t.agreementEnd, t.status);
          return i.tone === 'neutral' ? i.text : <Chip tone={i.tone}>{i.text}</Chip>;
        },
      },
      {
        key: 'police',
        label: 'Police verification',
        render: t => (
          <StatusChip status={t.policeVerificationStatus} labels={POLICE_LABEL} tones={POLICE_TONE} />
        ),
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
      <div className="mb-2 grid items-end gap-x-3 sm:grid-cols-3">
        <Select
          label="Status"
          value={status}
          disabled={tracker}
          onChange={e => setStatus(e.target.value)}
          options={[{ value: '', label: 'All statuses' }, ...opts(TENANCY_LABEL)]}
        />
        <Select
          label="Agreement ends within"
          value={expiring}
          onChange={e => setExpiring(e.target.value)}
          options={[
            { value: '', label: 'Any time' },
            { value: '30', label: '30 days' },
            { value: '60', label: '60 days' },
            { value: '90', label: '90 days' },
          ]}
        />
        <Checkbox
          label="Verification tracker: active tenants without police verification"
          checked={tracker}
          onChange={e => setTracker(e.target.checked)}
        />
      </div>
      {canCreate && (
        <div className="mb-3">
          <Button size="sm" onClick={() => setAdding(true)}>
            Add tenant
          </Button>
        </div>
      )}
      <DataTable
        caption="Tenancies"
        columns={columns}
        rows={list.rows}
        rowKey={t => t.id}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        onRowClick={t => setOpen(t.id)}
        rowLabel={t => `${t.unit.label} ${t.tenant.name}`}
        pageSize={100}
        empty={{ title: 'No tenancies', text: 'Tenants appear here once an owner or admin adds them.' }}
      />
      <Pager pagination={list.pagination} page={list.page} onPage={list.setPage} />
      {open !== null && <TenancyDrawer id={open} onClose={() => setOpen(null)} onChanged={changed} />}
      {adding && (
        <TenancyForm
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

type Act = 'reject' | 'cancel' | 'approve' | 'activate' | 'renew' | 'end' | 'police';

export function TenancyDrawer({
  id,
  onClose,
  onChanged,
}: {
  id: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const canEdit = usePermission(P.edit);
  const canApprove = usePermission(P.approve);
  const policeOn = useFeature('residents.police_verification_tracking');
  const run = useRun();
  const [act, setAct] = useState<Act | null>(null);
  const load = useLoad(() => residentsService.tenancy(id), id);
  const done = () => {
    setAct(null);
    load.reload();
    onChanged();
  };
  const go = (t: Tenancy, action: 'submit', msg: string) =>
    run(() => residentsService.tenancyAction(id, action, { version: t.version }), msg).then(
      ok => ok && done(),
    );
  return (
    <Drawer
      open
      onClose={onClose}
      title={load.data ? `Tenancy of ${load.data.unit.label}` : 'Tenancy'}
      size={640}
    >
      <Loading load={load} rows={4}>
        {t => {
          const end = agreementEndInfo(t.agreementEnd, t.status);
          const live = t.status === 'ACTIVE' || t.status === 'EXPIRED_OVERSTAY';
          return (
            <>
              <div className="mb-4 flex flex-wrap gap-1.5">
                <StatusChip status={t.status} labels={TENANCY_LABEL} tones={TENANCY_TONE} />
                <StatusChip status={t.policeVerificationStatus} labels={POLICE_LABEL} tones={POLICE_TONE} />
              </div>
              <dl className="mb-5">
                <KV label="Tenant">
                  {t.tenant.name}
                  {t.tenant.mobile ? ` · ${t.tenant.mobile}` : ''}
                </KV>
                <KV label="Owner">{t.landlord?.name ?? '-'}</KV>
                <KV label="Agreement">
                  {shortDate(t.agreementStart)} to {shortDate(t.agreementEnd)}
                </KV>
                <KV label="Agreement end">
                  {end.tone === 'neutral' ? end.text : <Chip tone={end.tone}>{end.text}</Chip>}
                </KV>
                <KV label="Monthly rent">{inr(t.monthlyRentPaise)}</KV>
                <KV label="Maintenance paid by">{t.maintenancePayer === 'TENANT' ? 'Tenant' : 'Owner'}</KV>
                {t.rejectReason && <KV label="Rejected because">{t.rejectReason}</KV>}
              </dl>
              {canEdit && (
                <Section title="Actions">
                  <div className="flex flex-wrap gap-2">
                    {t.status === 'DRAFT' && (
                      <Button onClick={() => void go(t, 'submit', 'Tenancy submitted')}>Submit</Button>
                    )}
                    {t.status === 'PENDING_APPROVAL' && canApprove && (
                      <>
                        <Button onClick={() => setAct('approve')}>Approve</Button>
                        <Button variant="danger-soft" onClick={() => setAct('reject')}>
                          Reject
                        </Button>
                      </>
                    )}
                    {t.status === 'APPROVED' && (
                      <Button onClick={() => setAct('activate')}>Mark moved in</Button>
                    )}
                    {live && <Button onClick={() => setAct('renew')}>Renew</Button>}
                    {(t.status === 'APPROVED' || live) && (
                      <Button variant="danger-soft" onClick={() => setAct('end')}>
                        End tenancy
                      </Button>
                    )}
                    {(t.status === 'DRAFT' || t.status === 'PENDING_APPROVAL') && (
                      <Button variant="ghost" onClick={() => setAct('cancel')}>
                        Cancel tenancy
                      </Button>
                    )}
                    {policeOn &&
                      t.status !== 'REJECTED' &&
                      t.status !== 'CANCELLED' &&
                      t.status !== 'ENDED' && (
                        <Button variant="glass" onClick={() => setAct('police')}>
                          Update police verification
                        </Button>
                      )}
                  </div>
                </Section>
              )}
              <ConfirmReason
                open={act === 'reject'}
                title="Reject this tenancy?"
                description="The owner is told why."
                confirmLabel="Reject"
                onCancel={() => setAct(null)}
                onConfirm={async reason => {
                  if (
                    await run(
                      () => residentsService.tenancyAction(id, 'reject', { reason, version: t.version }),
                      'Tenancy rejected',
                    )
                  )
                    done();
                }}
              />
              <ConfirmReason
                open={act === 'cancel'}
                title="Cancel this tenancy?"
                confirmLabel="Cancel tenancy"
                minLength={5}
                onCancel={() => setAct(null)}
                onConfirm={async reason => {
                  if (
                    await run(
                      () => residentsService.tenancyAction(id, 'cancel', { reason, version: t.version }),
                      'Tenancy cancelled',
                    )
                  )
                    done();
                }}
              />
              {act === 'approve' && <ApproveDialog t={t} onClose={() => setAct(null)} onDone={done} />}
              {act === 'activate' && <ActivateDialog t={t} onClose={() => setAct(null)} onDone={done} />}
              {act === 'renew' && <RenewDialog t={t} onClose={() => setAct(null)} onDone={done} />}
              {act === 'end' && <EndDialog t={t} onClose={() => setAct(null)} onDone={done} />}
              {act === 'police' && <PoliceDialog t={t} onClose={() => setAct(null)} onDone={done} />}
            </>
          );
        }}
      </Loading>
    </Drawer>
  );
}

function ApproveDialog({ t, onClose, onDone }: { t: Tenancy; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState('');
  return (
    <FormDialog
      title="Approve this tenancy"
      description="The tenant and family get app access from the agreement start."
      submitLabel="Approve"
      onClose={onClose}
      onDone={onDone}
      onSubmit={async () => {
        await residentsService.tenancyAction(t.id, 'approve', {
          version: t.version,
          ...(note ? { note } : {}),
        });
        return { message: 'Tenancy approved' };
      }}
    >
      <Input label="Note (optional)" value={note} onChange={e => setNote(e.target.value)} />
    </FormDialog>
  );
}

function ActivateDialog({ t, onClose, onDone }: { t: Tenancy; onClose: () => void; onDone: () => void }) {
  const [date, setDate] = useState(today());
  return (
    <FormDialog
      title="Mark moved in"
      description="Use this when no move-in request is needed."
      submitLabel="Mark moved in"
      onClose={onClose}
      onDone={onDone}
      onSubmit={async () => {
        if (!isoDate(date)) return { error: 'Choose the move-in date.' };
        await residentsService.tenancyAction(t.id, 'activate', { moveInDate: date, version: t.version });
        return { message: 'Tenancy is active' };
      }}
    >
      <Input label="Moved in on" type="date" value={date} onChange={e => setDate(e.target.value)} />
    </FormDialog>
  );
}

function RenewDialog({ t, onClose, onDone }: { t: Tenancy; onClose: () => void; onDone: () => void }) {
  const [end, setEnd] = useState('');
  const [rent, setRent] = useState('');
  const [file, setFile] = useState<number | null>(null);
  return (
    <FormDialog
      title="Renew tenancy"
      description="Add the new agreement and its end date."
      submitLabel="Renew"
      onClose={onClose}
      onDone={onDone}
      onSubmit={async () => {
        if (!isoDate(end) || end <= t.agreementEnd)
          return { error: 'The new end date must be after the current end date.' };
        if (!file) return { error: 'Attach the renewed rent agreement.' };
        await residentsService.tenancyAction(t.id, 'renew', {
          agreementEnd: end,
          fileId: file,
          ...(rent ? { monthlyRentPaise: rupeesToPaise(rent) } : {}),
          version: t.version,
        });
        return { message: 'Tenancy renewed' };
      }}
    >
      <Input label="New agreement end" type="date" value={end} onChange={e => setEnd(e.target.value)} />
      <Input
        label="New monthly rent (₹, optional)"
        inputMode="decimal"
        value={rent}
        onChange={e => setRent(e.target.value)}
      />
      <FileField label="Renewed rent agreement" onChange={setFile} />
    </FormDialog>
  );
}

function EndDialog({ t, onClose, onDone }: { t: Tenancy; onClose: () => void; onDone: () => void }) {
  const [date, setDate] = useState(today());
  const [reason, setReason] = useState('MOVED_OUT');
  const [note, setNote] = useState('');
  return (
    <FormDialog
      title="End tenancy"
      description="The tenant and family lose app access for this flat."
      submitLabel="End tenancy"
      variant="danger"
      onClose={onClose}
      onDone={onDone}
      onSubmit={async () => {
        if (!isoDate(date)) return { error: 'Choose the end date.' };
        await residentsService.tenancyAction(t.id, 'end', {
          endedOn: date,
          endReason: reason,
          ...(note ? { endNote: note } : {}),
          version: t.version,
        });
        return { message: 'Tenancy ended' };
      }}
    >
      <Input label="Ended on" type="date" value={date} onChange={e => setDate(e.target.value)} />
      <Select
        label="Reason"
        value={reason}
        onChange={e => setReason(e.target.value)}
        options={[
          { value: 'MOVED_OUT', label: 'Tenant moved out' },
          { value: 'AGREEMENT_ENDED', label: 'Agreement ended' },
          { value: 'TERMINATED', label: 'Terminated' },
          { value: 'OTHER', label: 'Other' },
        ]}
      />
      <Input label="Note (optional)" value={note} onChange={e => setNote(e.target.value)} />
    </FormDialog>
  );
}

export function PoliceDialog({
  t,
  onClose,
  onDone,
  mine,
}: {
  t: Tenancy;
  onClose: () => void;
  onDone: () => void;
  mine?: boolean;
}) {
  const [status, setStatus] = useState<PoliceStatus>(
    t.policeVerificationStatus === 'NOT_SUBMITTED' ? 'SUBMITTED' : t.policeVerificationStatus,
  );
  const [on, setOn] = useState(today());
  const [ref, setRef] = useState('');
  const [file, setFile] = useState<number | null>(null);
  const statuses: PoliceStatus[] = mine
    ? ['SUBMITTED']
    : ['NOT_REQUIRED', 'NOT_SUBMITTED', 'SUBMITTED', 'VERIFIED', 'REJECTED'];
  return (
    <FormDialog
      title="Police verification"
      submitLabel="Save"
      onClose={onClose}
      onDone={onDone}
      onSubmit={async () => {
        if (status === 'VERIFIED' && (!isoDate(on) || ref.trim().length < 2))
          return { error: 'Add the verification date and reference.' };
        const body = {
          status,
          ...(status === 'VERIFIED' ? { verifiedOn: on, reference: ref.trim() } : {}),
          ...(file ? { fileId: file } : {}),
          version: t.version,
        };
        if (mine) {
          if (!file) return { error: 'Attach the police verification document.' };
          await residentsService.addTenancyDocument(t.id, { fileId: file, docType: 'POLICE_VERIFICATION' });
        } else await residentsService.policeVerification(t.id, body);
        return { message: 'Police verification saved' };
      }}
    >
      {!mine && (
        <Select
          label="Status"
          value={status}
          onChange={e => setStatus(e.target.value as PoliceStatus)}
          options={statuses.map(s => ({ value: s, label: POLICE_LABEL[s] }))}
        />
      )}
      {status === 'VERIFIED' && (
        <>
          <Input label="Verified on" type="date" value={on} onChange={e => setOn(e.target.value)} />
          <Input label="Reference" value={ref} onChange={e => setRef(e.target.value)} />
        </>
      )}
      <FileField label="Document" onChange={setFile} />
    </FormDialog>
  );
}
