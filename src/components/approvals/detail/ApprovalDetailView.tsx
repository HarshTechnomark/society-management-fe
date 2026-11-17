'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ConfirmReason } from '@/components/common/ConfirmReason';
import { ErrorState } from '@/components/common/ErrorState';
import { KV } from '@/components/residents/common';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { inr } from '@/lib/money';
import { approvalsService } from '@/services/approvals.service';
import type { ApprovalDetail } from '@/types/approvals';
import {
  ACTION_LABEL,
  STATUS_LABEL,
  STATUS_TONE,
  approvalError,
  dateTime,
  isStale,
  plainError,
  reasonText,
  typeLabel,
} from '../format';
import { ApproveDialog } from './ApproveDialog';
import { ReassignDialog } from './ReassignDialog';

type Dialog = 'approve' | 'reject' | 'changes' | 'cancel' | 'reassign' | null;

/**
 * One request in full (spec 11.1): what is asked, who must approve, what happened so far and the buttons the API
 * says I may use. Used by the drawer in the inbox and by the page `/admin/approvals/[id]`.
 */
export function ApprovalDetailView({ id, onChanged }: { id: number; onChanged?: () => void }) {
  const toast = useToast();
  const load = useLoad(() => approvalsService.get(id), id);
  const canEditRules = usePermission(PERMISSIONS.settings.approvalRules.edit);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [actingFor, setActingFor] = useState('');

  if (load.error != null)
    return (
      <ErrorState
        error={plainError(load.error)}
        action={
          <Button size="sm" onClick={load.reload}>
            Try again
          </Button>
        }
        notFoundAction={<span />}
      />
    );
  if (load.loading || !load.data)
    return (
      <div aria-busy="true" aria-label="Loading">
        <div className="skeleton mb-2 h-10 w-2/3" />
        <div className="skeleton h-40 w-full" />
      </div>
    );
  const d = load.data;
  const my = d.myAction;
  const pending = d.status === 'PENDING';
  const onBehalf = actingFor ? { onBehalfOfUserId: Number(actingFor) } : {};
  const current = d.steps.find(s => s.state === 'CURRENT');

  /** Runs one decision: success closes the dialog and reloads; a changed item reloads quietly; other errors stay in a toast. */
  async function run(done: string, fn: () => Promise<unknown>) {
    try {
      await fn();
      toast.show(done);
      setDialog(null);
      load.reload();
      onChanged?.();
    } catch (e) {
      toast.show(approvalError(e), isStale(e) ? 'warning' : 'error');
      if (isStale(e)) {
        setDialog(null);
        load.reload();
        onChanged?.();
      }
    }
  }
  const v = d.version;

  return (
    <div className="grid gap-4" data-testid="approval-detail">
      <div>
        <p className="text-[13px] font-semibold uppercase tracking-wide text-muted">
          {typeLabel(d.type, d.typeLabel)}
        </p>
        <h2 className="text-[19px] font-bold">{d.title}</h2>
        {d.amountPaise ? <p className="text-[28px] font-bold tabular-nums">{inr(d.amountPaise)}</p> : null}
        <div className="mt-1 flex flex-wrap gap-1.5">
          <Chip tone={STATUS_TONE[d.status] ?? 'neutral'}>{STATUS_LABEL[d.status] ?? d.status}</Chip>
          {d.round > 1 && <Chip>Round {d.round}</Chip>}
          {d.stepUpRequired && pending && <Chip tone="gold">Needs a fresh code</Chip>}
        </div>
      </div>

      {d.summary && <p className="text-[14px] text-muted">{d.summary}</p>}

      {d.facts.length > 0 && (
        <dl>
          {d.facts.map((f, i) => (
            <KV key={`${f.label}-${i}`} label={f.label}>
              {f.value || '-'}
            </KV>
          ))}
        </dl>
      )}
      {d.link && (
        <Link href={d.link} className="text-[14px] font-semibold underline underline-offset-2">
          Open the item
        </Link>
      )}

      {pending && !my.canApprove && !my.canReject && my.reason && (
        <Alert tone="info">{reasonText(my.reason, current?.name)}</Alert>
      )}

      <section aria-label="Steps">
        <h3 className="mb-1 text-[15px] font-bold">Who must approve</h3>
        {d.ruleName && <p className="mb-2 text-[13px] text-muted">Rule: {d.ruleName}</p>}
        <ol className="grid gap-2">
          {d.steps.map(s => (
            <li
              key={s.stepNo}
              data-testid="approval-step"
              className="rounded-xl border border-[var(--line)] px-3 py-2 text-[14px]"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong>
                  Step {s.stepNo}: {s.name}
                </strong>
                <Chip tone={s.state === 'DONE' ? 'ok' : s.state === 'CURRENT' ? 'info' : 'neutral'}>
                  {s.state === 'DONE' ? 'Done' : s.state === 'CURRENT' ? 'Now' : 'Later'}
                </Chip>
              </div>
              <p className="text-[13px] text-muted">
                {s.slots.map(x => x.label).join(', ')}
                {s.requiredCount > 1 ? ` · ${s.approvalsGiven} of ${s.requiredCount} approved` : ''}
                {s.approvedBy.length > 0 ? ` · approved by ${s.approvedBy.join(', ')}` : ''}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-label="History">
        <h3 className="mb-1 text-[15px] font-bold">What happened</h3>
        <ol className="grid gap-2" data-testid="approval-timeline">
          {d.actions.map((a, i) => (
            <li key={i} className="border-l-2 border-[var(--line)] pl-3 text-[14px]">
              <p>
                <strong>{ACTION_LABEL[a.action] ?? a.action}</strong>
                {a.actorName ? ` by ${a.actorName}` : ''}
                {a.onBehalfOfName ? `, on behalf of ${a.onBehalfOfName}` : ''}
              </p>
              {a.comment && <p className="text-[13.5px]">{a.comment}</p>}
              <p className="text-[12.5px] text-muted">{dateTime(a.at)}</p>
            </li>
          ))}
          {d.actions.length === 0 && <li className="text-[13.5px] text-muted">Nothing yet.</li>}
        </ol>
      </section>

      {pending && my.onBehalfOptions.length > 0 && (
        <Select
          label="Acting for"
          value={actingFor}
          onChange={e => setActingFor(e.target.value)}
          options={[
            { value: '', label: 'Myself' },
            ...my.onBehalfOptions.map(o => ({ value: String(o.userId), label: o.name })),
          ]}
        />
      )}

      <div className="flex flex-wrap gap-2">
        {my.canApprove && <Button onClick={() => setDialog('approve')}>Approve</Button>}
        {my.canRequestChanges && (
          <Button variant="glass" onClick={() => setDialog('changes')}>
            Request changes
          </Button>
        )}
        {my.canReject && (
          <Button variant="danger-soft" onClick={() => setDialog('reject')}>
            Reject
          </Button>
        )}
        {my.canCancel && (
          <Button variant="ghost" onClick={() => setDialog('cancel')}>
            Cancel request
          </Button>
        )}
        {pending && canEditRules && (
          <Button variant="glass" onClick={() => setDialog('reassign')}>
            Reassign
          </Button>
        )}
      </div>

      {dialog === 'approve' && (
        <ApproveDialog
          title={d.title}
          stepUp={d.stepUpRequired}
          onCancel={() => setDialog(null)}
          onConfirm={comment =>
            run('Approved.', () =>
              approvalsService.approve(d.id, { version: v, ...(comment ? { comment } : {}), ...onBehalf }),
            )
          }
        />
      )}
      <ConfirmReason
        open={dialog === 'reject'}
        title="Reject this request"
        description="The requester is told why. A reason is required."
        confirmLabel="Reject"
        onCancel={() => setDialog(null)}
        onConfirm={reason =>
          run('Rejected.', () => approvalsService.reject(d.id, { version: v, reason, ...onBehalf }))
        }
      />
      <ConfirmReason
        open={dialog === 'changes'}
        title="Ask for changes"
        description="The requester is told what to fix. A reason is required."
        confirmLabel="Send back"
        variant="primary"
        onCancel={() => setDialog(null)}
        onConfirm={reason =>
          run('Sent back for changes.', () =>
            approvalsService.requestChanges(d.id, { version: v, reason, ...onBehalf }),
          )
        }
      />
      <ConfirmReason
        open={dialog === 'cancel'}
        title="Cancel this request"
        description="Nobody needs to approve it any more. A reason is required."
        confirmLabel="Cancel request"
        onCancel={() => setDialog(null)}
        onConfirm={reason =>
          run('Request cancelled.', () => approvalsService.cancel(d.id, { version: v, reason }))
        }
      />
      {dialog === 'reassign' && (
        <ReassignDialog
          step={current}
          onCancel={() => setDialog(null)}
          onConfirm={input =>
            run('Handed to the new approver.', () =>
              approvalsService.reassign(d.id, { version: v, ...input }),
            )
          }
        />
      )}
    </div>
  );
}

export type { ApprovalDetail };
