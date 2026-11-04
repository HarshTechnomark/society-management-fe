'use client';
import { useState } from 'react';
import { ConfirmReason } from '@/components/common/ConfirmReason';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Drawer } from '@/components/ui/Drawer';
import { Input } from '@/components/ui/Input';
import { PERMISSIONS } from '@/constants/permissions';
import { useFeature } from '@/hooks/useFeature';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { StatementDrawer } from '@/components/maintenance/ledger/StatementDrawer';
import { duesView } from '@/components/maintenance/ledger/format';
import { shortDate } from '@/lib/money';
import { residentsService } from '@/services/residents.service';
import type { UnitOwner, UnitPanel } from '@/types/residents';
import { FormDialog, Loading, Section, useRun } from './common';
import {
  FAMILY_LABEL,
  OCCUPANCY_LABEL,
  OCCUPANCY_TONE,
  POLICE_LABEL,
  POLICE_TONE,
  RELATION_LABEL,
  TENANCY_LABEL,
  TENANCY_TONE,
  agreementEndInfo,
} from './format';

const P = PERMISSIONS.residents;
const DUES_CLASS = { due: 'text-[#6f4200]', advance: 'text-[#0a4a63]', clear: 'text-[#14583a]' };
const KIND: Record<string, string> = {
  MOVE_IN: 'Move-in',
  MOVE_OUT: 'Move-out',
  RENOVATION: 'Renovation',
  TRANSFER: 'Ownership transfer',
  JOIN: 'Join request',
};

/** The flat drawer of the Residents page (spec 11.1): dues, people, open requests, timeline and actions. */
export function UnitDrawer({
  unitId,
  onClose,
  onChanged,
  onOpenResident,
  onAddResident,
  onOpenTenancy,
}: {
  unitId: number;
  onClose: () => void;
  onChanged: () => void;
  onOpenResident: (id: number) => void;
  onAddResident: (unitId: number, label: string) => void;
  onOpenTenancy: (id: number) => void;
}) {
  const canEdit = usePermission(P.people.edit);
  const canCreate = usePermission(P.people.create);
  const canReveal = usePermission(P.contacts.view);
  const sharesOn = useFeature('residents.joint_ownership');
  const timelineOn = useFeature('residents.resident_timeline');
  const billingView = usePermission(PERMISSIONS.finance.billing.view);
  const statementOn = useFeature('billing.statement_of_account');
  const canStatement = billingView && statementOn;
  const [statement, setStatement] = useState(false);
  const run = useRun();
  const [reveal, setReveal] = useState(false);
  const [vacate, setVacate] = useState(false);
  const [shares, setShares] = useState<UnitPanel | null>(null);
  const [showTimeline, setShowTimeline] = useState(false);
  const load = useLoad(() => residentsService.unit(unitId, reveal), `${unitId}|${reveal}`);
  const timeline = useLoad(
    () => (showTimeline ? residentsService.timeline(unitId) : Promise.resolve([])),
    `${unitId}|${showTimeline}`,
  );

  return (
    <Drawer open onClose={onClose} title={load.data?.unit.label ?? 'Flat'} size={640}>
      <Loading load={load} rows={4}>
        {u => (
          <>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[12.5px] font-semibold uppercase text-muted">Dues</p>
                <p className={`text-[30px] font-bold ${DUES_CLASS[duesView(u.duesPaise).tone]}`}>
                  {duesView(u.duesPaise).label}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Chip tone={OCCUPANCY_TONE[u.occupancy]}>{OCCUPANCY_LABEL[u.occupancy]}</Chip>
                {u.billTo && <Chip tone="gold">Bill to {u.billTo.name}</Chip>}
              </div>
            </div>

            <Section
              title="People"
              action={
                <div className="flex gap-1.5">
                  {canReveal && !reveal && (
                    <Button size="xs" variant="glass" onClick={() => setReveal(true)}>
                      Reveal contacts
                    </Button>
                  )}
                  {canCreate && (
                    <Button size="xs" variant="glass" onClick={() => onAddResident(unitId, u.unit.label)}>
                      Add resident
                    </Button>
                  )}
                </div>
              }
            >
              {u.owners.length === 0 && <p className="text-[14px] text-muted">No owner linked yet.</p>}
              <ul>
                {u.owners.map(o => (
                  <li
                    key={o.linkId}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] py-2 text-[14px]"
                  >
                    <button
                      type="button"
                      className="text-left font-semibold underline-offset-2 hover:underline"
                      onClick={() => onOpenResident(o.resident.id)}
                    >
                      {o.resident.name}
                    </button>
                    <span className="flex flex-wrap items-center gap-1.5">
                      <Chip>{u.owners.length > 1 ? 'Co-owner' : 'Owner'}</Chip>
                      {o.sharePercent && <Chip>{o.sharePercent}% share</Chip>}
                      {o.isPrimary && <Chip tone="gold">Primary</Chip>}
                      {o.resident.mobile && <span className="text-muted">{o.resident.mobile}</span>}
                    </span>
                  </li>
                ))}
              </ul>
              {sharesOn && canEdit && u.owners.length > 1 && (
                <Button size="xs" variant="glass" className="mt-2" onClick={() => setShares(u)}>
                  Edit shares
                </Button>
              )}
              {u.tenancy && (
                <div className="mt-3 rounded-[14px] bg-white/60 p-3 text-[14px]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      className="font-semibold underline-offset-2 hover:underline"
                      onClick={() => onOpenTenancy(u.tenancy!.id)}
                    >
                      Tenant {u.tenancy.tenant?.name ?? ''}
                    </button>
                    <Chip tone={TENANCY_TONE[u.tenancy.status]}>{TENANCY_LABEL[u.tenancy.status]}</Chip>
                  </div>
                  <p className="mt-1 text-muted">
                    Agreement ends {agreementEndInfo(u.tenancy.agreementEnd, u.tenancy.status).text}
                  </p>
                  <div className="mt-1">
                    <Chip tone={POLICE_TONE[u.tenancy.policeVerificationStatus]}>
                      {POLICE_LABEL[u.tenancy.policeVerificationStatus]}
                    </Chip>
                  </div>
                </div>
              )}
              {u.household.length > 0 && (
                <ul className="mt-3">
                  {u.household.map(h => (
                    <li key={h.linkId} className="flex flex-wrap justify-between gap-2 py-1.5 text-[14px]">
                      <button
                        type="button"
                        className="text-left underline-offset-2 hover:underline"
                        onClick={() => onOpenResident(h.resident.id)}
                      >
                        {h.resident.name}
                      </button>
                      <span className="text-muted">
                        {h.relation === 'FAMILY' && h.familyRelation
                          ? FAMILY_LABEL[h.familyRelation]
                          : RELATION_LABEL[h.relation]}{' '}
                        of {h.householdOf === 'OWNER' ? 'owner' : 'tenant'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Open requests">
              {u.openRequests.length === 0 ? (
                <p className="text-[14px] text-muted">No open requests.</p>
              ) : (
                <ul>
                  {u.openRequests.map(r => (
                    <li key={`${r.kind}-${r.id}`} className="flex justify-between py-1.5 text-[14px]">
                      <span>{KIND[r.kind] ?? r.kind}</span>
                      <Chip tone="warn">{r.status.replace(/_/g, ' ').toLowerCase()}</Chip>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {timelineOn && (
              <Section
                title="Timeline"
                action={
                  !showTimeline && (
                    <Button size="xs" variant="ghost" onClick={() => setShowTimeline(true)}>
                      Show timeline
                    </Button>
                  )
                }
              >
                {showTimeline && (
                  <Loading load={timeline}>
                    {events =>
                      events.length === 0 ? (
                        <p className="text-[14px] text-muted">Nothing recorded yet.</p>
                      ) : (
                        <ol>
                          {events.map((ev, i) => (
                            <li key={i} className="py-1.5 text-[14px]">
                              <span className="text-muted">{shortDate(ev.at)}</span> {ev.label}
                            </li>
                          ))}
                        </ol>
                      )
                    }
                  </Loading>
                )}
              </Section>
            )}

            <div className="flex flex-wrap gap-2 border-t border-[var(--line)] pt-4">
              {canStatement && (
                <Button variant="glass" onClick={() => setStatement(true)}>
                  Statement
                </Button>
              )}
              {canEdit && u.occupancy !== 'VACANT' && (
                <>
                  {u.owners[0] && (
                    <Button
                      variant="glass"
                      onClick={() =>
                        onOpenResident(
                          u.owners.find(o => o.isPrimary)?.resident.id ?? u.owners[0].resident.id,
                        )
                      }
                    >
                      Edit contact
                    </Button>
                  )}
                  <Button variant="danger-soft" onClick={() => setVacate(true)}>
                    Mark vacant
                  </Button>
                </>
              )}
              {canCreate && u.occupancy === 'VACANT' && (
                <Button onClick={() => onAddResident(unitId, u.unit.label)}>Add resident</Button>
              )}
            </div>

            <ConfirmReason
              open={vacate}
              title={`Mark ${u.unit.label} as vacant?`}
              description="The residents lose app access. Unpaid dues stay on the flat."
              confirmLabel="Mark vacant"
              onCancel={() => setVacate(false)}
              onConfirm={async reason => {
                if (
                  await run(() => residentsService.vacate(unitId, reason), `${u.unit.label} is now vacant`)
                ) {
                  setVacate(false);
                  load.reload();
                  onChanged();
                }
              }}
            />
          </>
        )}
      </Loading>
      {statement && (
        <StatementDrawer
          unitId={unitId}
          unitLabel={load.data?.unit.label ?? 'Flat'}
          onClose={() => setStatement(false)}
        />
      )}
      {shares && (
        <SharesDialog
          panel={shares}
          onClose={() => setShares(null)}
          onDone={() => {
            setShares(null);
            load.reload();
            onChanged();
          }}
        />
      )}
    </Drawer>
  );
}

/** Set every owner share at once (spec 8.9); the total must be 100. */
function SharesDialog({
  panel,
  onClose,
  onDone,
}: {
  panel: UnitPanel;
  onClose: () => void;
  onDone: () => void;
}) {
  const [values, setValues] = useState<Record<number, string>>(
    Object.fromEntries(panel.owners.map(o => [o.linkId, o.sharePercent ?? ''])),
  );
  const [primary, setPrimary] = useState(
    panel.owners.find(o => o.isPrimary)?.linkId ?? panel.owners[0].linkId,
  );
  const total = panel.owners.reduce((n, o) => n + (Number(values[o.linkId]) || 0), 0);
  const submit = async () => {
    if (Math.abs(total - 100) > 0.001) return { error: 'Shares must add up to exactly 100%.' };
    await residentsService.setShares(panel.unit.id, {
      shares: panel.owners.map((o: UnitOwner) => ({
        linkId: o.linkId,
        sharePercent: Number(values[o.linkId]).toFixed(2),
      })),
      primaryLinkId: primary,
      version: panel.owners.map(o => ({ linkId: o.linkId, version: o.version ?? 1 })),
    });
    return { message: 'Shares saved' };
  };
  return (
    <FormDialog
      title="Edit ownership shares"
      description="Every owner share, and who is the primary contact."
      submitLabel="Save shares"
      onClose={onClose}
      onSubmit={submit}
      onDone={onDone}
    >
      {panel.owners.map(o => (
        <div key={o.linkId} className="flex items-end gap-3">
          <div className="min-w-0 flex-1">
            <Input
              label={`Share % of ${o.resident.name}`}
              inputMode="decimal"
              value={values[o.linkId]}
              onChange={e => setValues(v => ({ ...v, [o.linkId]: e.target.value }))}
            />
          </div>
          <label className="mb-4 flex h-12 items-center gap-1.5 text-[13px] font-semibold">
            <input
              type="radio"
              name="primary"
              checked={primary === o.linkId}
              onChange={() => setPrimary(o.linkId)}
            />
            Primary
          </label>
        </div>
      ))}
      <p className="text-[13px] text-muted">Total: {total.toFixed(2)}%</p>
    </FormDialog>
  );
}
