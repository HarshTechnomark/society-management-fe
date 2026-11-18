'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ConfirmReason } from '@/components/common/ConfirmReason';
import { ErrorState } from '@/components/common/ErrorState';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { useToast } from '@/components/ui/Toast';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { inr } from '@/lib/money';
import { plural } from '@/lib/plural';
import { helpdeskService } from '@/services/helpdesk.service';
import type { Ticket, TicketAction, TicketComment, TransitionInput } from '@/types/helpdesk';
import { AttachmentStrip } from './AttachmentStrip';
import { EstimateDialog, MergeDialog, TransitionDialog } from './dialogs';
import {
  ACTION_LABEL,
  CHANNEL_LABEL,
  PRIORITY_LABEL,
  ROLE_LABEL,
  STATUS_LABEL,
  dateTime,
  helpdeskError,
  isStale,
  minutesText,
  plainError,
  priorityTone,
  slaChip,
  statusTone,
} from './format';
import { ManageCard } from './ManageCard';
import { Timeline } from './Timeline';

const ACTION_ORDER: TicketAction[] = [
  'START',
  'WAIT_ON_RESIDENT',
  'RESUME',
  'RESOLVE',
  'CLOSE',
  'REOPEN',
  'CANCEL',
];
const CHARGE_LABEL: Record<string, string> = {
  NONE: 'No estimate yet',
  ESTIMATE_SENT: 'Estimate sent: waiting for the resident',
  PENDING: 'Estimate sent: waiting for the resident',
  PENDING_APPROVAL: 'Estimate sent: waiting for the resident',
  APPROVED: 'Resident approved the estimate',
  REJECTED: 'Resident rejected the estimate',
  INVOICED: 'Invoiced',
  WAIVED: 'Waived',
};

type Dialog =
  | { kind: 'TRANSITION'; action: 'WAIT_ON_RESIDENT' | 'RESOLVE' }
  | { kind: 'REASON'; action: 'REOPEN' | 'CANCEL' }
  | { kind: 'UNASSIGN' }
  | { kind: 'MERGE' }
  | { kind: 'ESTIMATE' }
  | { kind: 'REMOVE'; comment: TicketComment }
  | null;

/** "Merged into ISS-12": the number from the response, else from the merge entry, else looked up by id. */
function MergedChip({ ticket }: { ticket: Ticket }) {
  const fromTimeline = ticket.comments.find(
    c => c.kind === 'MERGE' && typeof c.metadata.mergedTicketNo === 'string',
  )?.metadata.mergedTicketNo as string | undefined;
  const known = ticket.mergedIntoTicketNo || fromTimeline || null;
  const looked = useLoad<string | null>(
    () =>
      known || ticket.mergedIntoTicketId == null
        ? Promise.resolve(known)
        : helpdeskService.get(ticket.mergedIntoTicketId).then(
            r => r.ticketNo,
            () => null,
          ),
    `merged-${ticket.mergedIntoTicketId}-${known ?? ''}`,
  );
  const no = known ?? looked.data;
  return <Chip>{no ? `Merged into ${no}` : 'Merged into another issue'}</Chip>;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2 py-1.5 text-[14px] max-[420px]:grid-cols-1 max-[420px]:gap-0">
      <dt className="font-semibold text-muted">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

/** The ticket detail (spec 11.2), shared by the drawer and `/admin/issues/[id]`. */
export function TicketDetailView({
  id,
  onChanged,
  onLoaded,
}: {
  id: number;
  onChanged?: () => void;
  onLoaded?: (t: Ticket) => void;
}) {
  const canEdit = usePermission(PERMISSIONS.helpdesk.tickets.edit);
  const toast = useToast();
  const load = useLoad(() => helpdeskService.get(id), id);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const t = load.data;
  useEffect(() => {
    if (t) onLoaded?.(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t?.id, t?.version]);

  if (load.error != null)
    return (
      <ErrorState
        error={plainError(load.error)}
        action={
          <Button size="sm" onClick={load.reload}>
            Try again
          </Button>
        }
        notFoundAction={
          <Link href="/admin/issues" className="font-semibold underline">
            Back to issues
          </Link>
        }
      />
    );
  if (!t)
    return (
      <div aria-busy="true" aria-label="Loading">
        {[0, 1, 2].map(i => (
          <div key={i} className="skeleton mb-3 h-14 w-full" data-testid="skeleton-row" />
        ))}
      </div>
    );

  const changed = () => {
    load.reload();
    onChanged?.();
  };
  /** Runs a write: success message and reload, or the readable error (a stale version reloads too). */
  const run = async (fn: () => Promise<unknown>, ok: string): Promise<boolean> => {
    setBusy(true);
    setNotice(null);
    try {
      await fn();
      toast.show(ok);
      setDialog(null);
      changed();
      return true;
    } catch (e) {
      setNotice(helpdeskError(e));
      if (isStale(e)) changed();
      return false;
    } finally {
      setBusy(false);
    }
  };
  const transition = (input: Omit<TransitionInput, 'version'>, ok: string) =>
    run(() => helpdeskService.transition(t.id, { ...input, version: t.version }), ok);

  const act = (a: TicketAction) => {
    setNotice(null);
    if (a === 'START') {
      if (!t.assignment) return setNotice('Assign someone before starting work.');
      void transition({ action: a }, 'Work started');
    } else if (a === 'RESUME') void transition({ action: a }, 'Resumed');
    else if (a === 'CLOSE') void transition({ action: a }, 'Closed');
    else if (a === 'WAIT_ON_RESIDENT' || a === 'RESOLVE') setDialog({ kind: 'TRANSITION', action: a });
    else setDialog({ kind: 'REASON', action: a });
  };

  const sla = slaChip(t.sla.slaState, t.sla.resolutionDueAt, t.status);
  const terminal = t.status === 'CLOSED' || t.status === 'CANCELLED';
  const actions = ACTION_ORDER.filter(a => t.allowedActions.includes(a));
  const canMerge = canEdit && t.kind === 'BUILDING' && !terminal && t.mergedIntoTicketId == null;
  const canEstimate =
    canEdit &&
    t.kind === 'PERSONAL' &&
    t.isChargeable &&
    t.status === 'IN_PROGRESS' &&
    (!t.charge || t.charge.status === 'NONE' || t.charge.status === 'REJECTED');
  const scope =
    t.kind === 'PERSONAL'
      ? t.unit?.label
      : t.affectedLevel === 'SOCIETY'
        ? 'Whole society'
        : t.affectedLevel === 'FLOOR'
          ? `${t.affectedBuildingName ?? 'Building'} · Floor`
          : t.affectedBuildingName;

  return (
    <div className="grid gap-4 pb-4">
      <div>
        <h2 className="text-[18px] font-bold">{t.title}</h2>
        <p className="text-[13px] text-muted">
          {t.ticketNo}
          {t.category ? ` · ${t.category.name}${t.subCategory ? ` › ${t.subCategory.name}` : ''}` : ''}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Chip tone={statusTone(t.status)}>{STATUS_LABEL[t.status]}</Chip>
          <Chip tone={priorityTone(t.priority)}>{PRIORITY_LABEL[t.priority]}</Chip>
          {sla && <Chip tone={sla.tone}>{sla.text}</Chip>}
          {scope && <Chip tone="info">{scope}</Chip>}
          {t.isRecurring && <Chip tone="warn">Keeps coming back</Chip>}
          {t.mergedIntoTicketId != null && <MergedChip ticket={t} />}
        </div>
      </div>
      {notice && <Alert tone="bad">{notice}</Alert>}

      <dl className="rounded-2xl bg-white/50 px-4 py-2">
        <Row label="About">
          <span className="whitespace-pre-wrap">{t.description || '-'}</span>
        </Row>
        <Row label={t.kind === 'PERSONAL' ? 'Flat' : 'Where'}>
          {t.kind === 'PERSONAL' ? (t.unit?.label ?? '-') : (t.locationLabel ?? '-')}
        </Row>
        <Row label="Raised by">
          {[
            t.requesterName,
            t.reporterRole ? (ROLE_LABEL[t.reporterRole] ?? t.reporterRole) : null,
            dateTime(t.createdAt),
            CHANNEL_LABEL[t.channel] ?? t.channel,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Row>
        <Row label="Assigned to">
          {t.assignment ? (
            <>
              {t.assignment.assigneeLabel}
              {t.assignment.externalMobile ? ` · ${t.assignment.externalMobile}` : ''}
              <span className="text-muted"> · since {dateTime(t.assignment.assignedAt)}</span>
            </>
          ) : (
            <strong>Unassigned</strong>
          )}
        </Row>
        {t.kind === 'BUILDING' && (
          <Row label="Affected">
            {plural(t.affectedUnitCount, 'flat')}
            {t.upvoteCount > 0 ? ` · ${t.upvoteCount} said me too` : ''}
          </Row>
        )}
        <Row label="SLA">
          {t.sla.resolutionDueAt ? (
            <>
              Reply by {dateTime(t.sla.responseDueAt)}
              {t.sla.responseBreached ? ' (missed)' : ''}; fix by {dateTime(t.sla.resolutionDueAt)}
              {t.sla.resolutionBreached ? ' (missed)' : ''}
              {t.sla.pausedMinutes > 0 ? ` · paused ${minutesText(t.sla.pausedMinutes)}` : ''}
              {t.sla.escalationLevel > 0 ? ` · escalated to level ${t.sla.escalationLevel}` : ''}
            </>
          ) : (
            'No SLA'
          )}
        </Row>
        {t.preferredSlot && (
          <Row label="Visit slot">
            {dateTime(t.preferredSlot.from)} to {dateTime(t.preferredSlot.to)}
          </Row>
        )}
        {(t.charge || t.isChargeable) && (
          <Row label="Charge">
            {t.charge ? (
              <>
                {CHARGE_LABEL[t.charge.status] ?? t.charge.status}
                {t.charge.estimatePaise > 0 ? ` · estimate ${inr(t.charge.estimatePaise)}` : ''}
                {t.charge.finalPaise > 0 ? ` · final ${inr(t.charge.finalPaise)}` : ''}
                {t.charge.invoiceId != null && (
                  <>
                    {' · '}
                    <Link className="underline" href={`/admin/billing/invoices/${t.charge.invoiceId}`}>
                      invoice
                    </Link>
                  </>
                )}
              </>
            ) : (
              'Chargeable: no estimate yet'
            )}
          </Row>
        )}
        {t.invoiceId != null && (
          <Row label="Invoice">
            <Link className="underline" href={`/admin/billing/invoices/${t.invoiceId}`}>
              Open invoice #{t.invoiceId}
            </Link>
          </Row>
        )}
      </dl>

      <AttachmentStrip ticketId={t.id} fileIds={t.fileIds} />

      {canEdit && (
        <ManageCard
          key={t.id}
          ticket={t}
          onSaved={changed}
          onUnassign={() => setDialog({ kind: 'UNASSIGN' })}
        />
      )}

      <section aria-label="Updates">
        <h3 className="mb-2 text-[15px] font-bold">Timeline</h3>
        <Timeline
          entries={t.comments}
          ticketId={t.id}
          onRemove={c => setDialog({ kind: 'REMOVE', comment: c })}
        />
      </section>

      {canEdit && (actions.length > 0 || canMerge || canEstimate) && (
        <div
          aria-label="Actions"
          className="sticky bottom-0 z-10 -mx-5 -mb-5 flex flex-wrap gap-2 border-t border-[var(--line)] bg-[#FBF7F0] px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-6px_12px_-8px_rgba(0,0,0,0.15)]"
        >
          {actions.map(a => (
            <Button
              key={a}
              size="sm"
              variant={
                a === 'RESOLVE'
                  ? 'gold'
                  : a === 'CANCEL'
                    ? 'danger-soft'
                    : a === 'START'
                      ? 'primary'
                      : 'glass'
              }
              disabled={busy || (a === 'START' && !t.assignment)}
              onClick={() => act(a)}
            >
              {ACTION_LABEL[a]}
            </Button>
          ))}
          {actions.includes('START') && !t.assignment && (
            <p className="basis-full text-[12.5px] text-muted">Assign someone before starting work.</p>
          )}
          {canMerge && (
            <Button size="sm" variant="glass" onClick={() => setDialog({ kind: 'MERGE' })}>
              Merge into...
            </Button>
          )}
          {canEstimate && (
            <Button size="sm" variant="glass" onClick={() => setDialog({ kind: 'ESTIMATE' })}>
              Send estimate
            </Button>
          )}
        </div>
      )}

      {dialog?.kind === 'TRANSITION' && (
        <TransitionDialog
          ticket={t}
          action={dialog.action}
          onCancel={() => setDialog(null)}
          onConfirm={async input => {
            await helpdeskService.transition(t.id, { ...input, version: t.version });
            toast.show(dialog.action === 'RESOLVE' ? 'Marked resolved' : 'Waiting on the resident');
            setDialog(null);
            changed();
          }}
        />
      )}
      {dialog?.kind === 'REASON' && (
        <ConfirmReason
          open
          title={dialog.action === 'REOPEN' ? 'Reopen this ticket' : 'Cancel this ticket'}
          description={dialog.action === 'CANCEL' ? 'The resident is told it was cancelled.' : undefined}
          confirmLabel={dialog.action === 'REOPEN' ? 'Reopen' : 'Cancel ticket'}
          variant={dialog.action === 'REOPEN' ? 'primary' : 'danger'}
          onCancel={() => setDialog(null)}
          onConfirm={async reason => {
            await transition(
              { action: dialog.action, reason },
              dialog.action === 'REOPEN' ? 'Reopened' : 'Cancelled',
            );
          }}
        />
      )}
      {dialog?.kind === 'UNASSIGN' && (
        <ConfirmReason
          open
          title="Take the assignee off"
          description="The ticket goes back to Open."
          confirmLabel="Unassign"
          onCancel={() => setDialog(null)}
          onConfirm={async reason => {
            await run(() => helpdeskService.unassign(t.id, { reason, version: t.version }), 'Unassigned');
          }}
        />
      )}
      {dialog?.kind === 'REMOVE' && (
        <ConfirmReason
          open
          title="Remove this update"
          confirmLabel="Remove"
          onCancel={() => setDialog(null)}
          onConfirm={async reason => {
            await run(() => helpdeskService.removeComment(t.id, dialog.comment.id, reason), 'Update removed');
          }}
        />
      )}
      {dialog?.kind === 'MERGE' && (
        <MergeDialog
          similar={t.similarOpen}
          onCancel={() => setDialog(null)}
          onConfirm={async input => {
            await helpdeskService.merge(t.id, { ...input, version: t.version });
            toast.show('Merged');
            setDialog(null);
            changed();
          }}
        />
      )}
      {dialog?.kind === 'ESTIMATE' && (
        <EstimateDialog
          onCancel={() => setDialog(null)}
          onConfirm={async input => {
            await helpdeskService.estimate(t.id, { ...input, version: t.version });
            toast.show('Estimate sent to the resident');
            setDialog(null);
            changed();
          }}
        />
      )}
    </div>
  );
}
