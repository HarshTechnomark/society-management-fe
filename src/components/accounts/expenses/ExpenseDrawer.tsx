'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ConfirmReason } from '@/components/common/ConfirmReason';
import { ErrorState } from '@/components/common/ErrorState';
import { KV, Section } from '@/components/residents/common';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Drawer } from '@/components/ui/Drawer';
import { useToast } from '@/components/ui/Toast';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { inr, shortDate } from '@/lib/money';
import { accountsExpensesService as svc } from '@/services/accountsExpenses.service';
import { ExpenseModal } from './ExpenseModal';
import { expenseError, modeLabel, plainError, statusInfo } from './format';

const E = PERMISSIONS.finance.expenses;
type Dialog = 'edit' | 'withdraw' | 'cancel' | 'reverse';

const ACTION_WORDS: Record<string, string> = {
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CHANGES_REQUESTED: 'Asked for changes',
  CANCELLED: 'Withdrawn',
  SUBMITTED: 'Sent for approval',
  RESUBMITTED: 'Sent again',
  CREATED: 'Created',
};
const actionWord = (a: string) => ACTION_WORDS[a] ?? a.toLowerCase().replace(/_/g, ' ');

/** Expense drawer (spec 11.2): amount, status, every field, bills, approval timeline and the actions the state allows. */
export function ExpenseDrawer({
  id,
  onClose,
  onChanged,
}: {
  id: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const load = useLoad(() => svc.get(id), id);
  const toast = useToast();
  const canCreate = usePermission(E.create);
  const canEdit = usePermission(E.edit);
  const canDelete = usePermission(E.delete);
  const canApprove = usePermission(E.approve);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [busy, setBusy] = useState(false);
  const x = load.data;

  const done = (message: string) => {
    setDialog(null);
    toast.show(message);
    onChanged();
    load.reload();
  };
  const run = async (fn: () => Promise<unknown>, message: string) => {
    try {
      await fn();
      done(message);
    } catch (e) {
      toast.show(expenseError(e), 'error');
    }
  };
  const submit = async () => {
    if (!x) return;
    setBusy(true);
    await run(async () => {
      const r = await svc.submit(x.id, x.version);
      return r;
    }, 'Sent for approval.');
    setBusy(false);
  };

  const mayEdit = canCreate || canEdit;
  const editable = !!x && ['DRAFT', 'REJECTED', 'CHANGES_REQUESTED'].includes(x.status) && mayEdit;
  const actions = x && (
    <>
      {editable && (
        <Button size="sm" variant="glass" onClick={() => setDialog('edit')}>
          {x.status === 'DRAFT' ? 'Edit' : 'Edit and resubmit'}
        </Button>
      )}
      {canCreate && ['DRAFT', 'CHANGES_REQUESTED'].includes(x.status) && (
        <Button size="sm" loading={busy} onClick={() => void submit()}>
          Submit for approval
        </Button>
      )}
      {canCreate && ['PENDING_APPROVAL', 'CHANGES_REQUESTED'].includes(x.status) && (
        <Button size="sm" variant="glass" onClick={() => setDialog('withdraw')}>
          Withdraw
        </Button>
      )}
      {(canDelete || canCreate) && x.status === 'DRAFT' && (
        <Button size="sm" variant="danger-soft" onClick={() => setDialog('cancel')}>
          Cancel draft
        </Button>
      )}
      {canApprove && x.status === 'POSTED' && (
        <Button size="sm" variant="danger-soft" onClick={() => setDialog('reverse')}>
          Reverse
        </Button>
      )}
    </>
  );

  const st = x ? statusInfo(x.status) : null;
  return (
    <>
      <Drawer
        open
        onClose={onClose}
        size={640}
        title={x ? `Expense ${x.displayId}` : 'Expense'}
        footer={actions || undefined}
      >
        {load.error != null ? (
          <ErrorState
            error={plainError(load.error)}
            notFoundAction={
              <Button size="sm" onClick={onClose}>
                Close
              </Button>
            }
            action={
              <Button size="sm" onClick={load.reload}>
                Try again
              </Button>
            }
          />
        ) : load.loading || !x ? (
          <div aria-busy="true" aria-label="Loading">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="skeleton mb-3 h-10 w-full" data-testid="skeleton-row" />
            ))}
          </div>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <div className="text-[28px] font-bold tabular-nums">{inr(x.grossAmountPaise)}</div>
              {st && <Chip tone={st.tone}>{st.label}</Chip>}
            </div>
            {x.status === 'PENDING_APPROVAL' && (
              <Alert tone="info">
                Waiting for approval. The money leaves the account when it is approved.
                {x.approvalRequestId != null && (
                  <>
                    {' '}
                    <Link href="/admin/dev-approvals" className="font-semibold underline">
                      Open the approval
                    </Link>
                  </>
                )}
              </Alert>
            )}
            {(x.status === 'REJECTED' || x.status === 'CHANGES_REQUESTED') && (
              <Alert tone="warn">
                {x.status === 'REJECTED' ? 'Rejected' : 'Changes requested'}
                {x.rejectionReason ? `: ${x.rejectionReason}` : '.'}
              </Alert>
            )}
            <dl className="mb-5">
              <KV label="Paid to">{x.payee}</KV>
              <KV label="Category">{x.ledgerAccount?.name ?? '-'}</KV>
              <KV label="Paid from">{x.paidFrom?.name ?? '-'}</KV>
              <KV label="Payment mode">
                {modeLabel(x.paymentMode)}
                {x.paymentReference ? ` (${x.paymentReference})` : ''}
              </KV>
              <KV label="Date">{shortDate(x.expenseDate)}</KV>
              <KV label="Entered by">{x.createdByName ?? '-'}</KV>
              {x.approvedByName && <KV label="Approved by">{x.approvedByName}</KV>}
              <KV label="Belongs to">
                {x.collectionTitle ?? x.fundName ?? (x.fundId ? `Fund ${x.fundId}` : 'General')}
              </KV>
              {x.gstPaise > 0 && <KV label="GST">{inr(x.gstPaise)}</KV>}
              {x.tdsPaise > 0 && (
                <KV label="TDS">
                  {inr(x.tdsPaise)}
                  {x.tdsSection ? ` (section ${x.tdsSection})` : ''}
                </KV>
              )}
              {x.tdsPaise > 0 && <KV label="Paid out">{inr(x.netPaidPaise)}</KV>}
              {x.challanNo && <KV label="Challan">{x.challanNo}</KV>}
              {x.description && <KV label="Note">{x.description}</KV>}
              {x.voucherNo && <KV label="Voucher number">{x.voucherNo}</KV>}
              {x.reversalVoucherNo && <KV label="Reversal voucher">{x.reversalVoucherNo}</KV>}
              {x.reversalReason && <KV label="Reversed because">{x.reversalReason}</KV>}
            </dl>
            <Section title="Bill">
              {x.files.length === 0 ? (
                <p className="text-[14px] text-muted">No bill attached.</p>
              ) : (
                <ul className="grid gap-2" data-testid="bill-list">
                  {x.files.map(f => (
                    <li key={f.id} className="text-[14px]">
                      {f.url && f.mimeType.startsWith('image/') && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={f.url}
                          alt={f.name}
                          className="mb-1 max-h-56 rounded-lg border border-[var(--line)]"
                        />
                      )}
                      {f.url ? (
                        <a
                          href={f.url}
                          target="_blank"
                          rel="noopener"
                          download
                          className="font-semibold underline"
                        >
                          {f.name}
                        </a>
                      ) : (
                        <span className="font-semibold">{f.name}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Section>
            {x.approval && (
              <Section title="Approval">
                <p className="mb-2 text-[14px]">
                  Status: {x.approval.status.toLowerCase().replace(/_/g, ' ') || 'not started'}
                  {x.approval.levels
                    ? ` (${x.approval.levels} step${x.approval.levels === 1 ? '' : 's'})`
                    : ''}
                </p>
                <ol className="grid gap-1.5 text-[13.5px]" data-testid="timeline">
                  {x.approval.actions.map((a, i) => (
                    <li key={i}>
                      <span className="text-muted">{shortDate(a.at)}</span> {actionWord(a.action)}
                      {a.by ? ` by ${a.by}` : ''}
                      {a.note ? `: ${a.note}` : ''}
                    </li>
                  ))}
                </ol>
                {x.approvalRequestId != null && x.status !== 'PENDING_APPROVAL' && (
                  <Link
                    href="/admin/dev-approvals"
                    className="mt-2 inline-block text-[13.5px] font-semibold underline"
                  >
                    Open the approval
                  </Link>
                )}
              </Section>
            )}
            {x.journalLines.length > 0 && (
              <Section title="Accounts affected">
                <ul className="grid gap-1 text-[13.5px]">
                  {x.journalLines.map((l, i) => (
                    <li key={i} className="flex justify-between gap-3">
                      <span>{l.account}</span>
                      <span className="tabular-nums">
                        {l.debitPaise > 0 ? `Dr ${inr(l.debitPaise)}` : `Cr ${inr(l.creditPaise)}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}
          </>
        )}
      </Drawer>
      {x && dialog === 'edit' && (
        <ExpenseModal
          expense={x}
          onClose={() => setDialog(null)}
          onSaved={(_r, submitted) => done(submitted ? 'Sent for approval.' : 'Draft saved.')}
        />
      )}
      {x && dialog === 'withdraw' && (
        <ConfirmReason
          open
          title="Withdraw this expense"
          description="It will be cancelled and nothing is paid."
          confirmLabel="Withdraw"
          onCancel={() => setDialog(null)}
          onConfirm={reason =>
            run(() => svc.withdraw(x.id, { version: x.version, reason }), 'Expense withdrawn.')
          }
        />
      )}
      {x && dialog === 'cancel' && (
        <ConfirmReason
          open
          title="Cancel this draft"
          confirmLabel="Cancel draft"
          onCancel={() => setDialog(null)}
          onConfirm={reason =>
            run(() => svc.cancelDraft(x.id, { version: x.version, reason }), 'Draft cancelled.')
          }
        />
      )}
      {x && dialog === 'reverse' && (
        <ConfirmReason
          open
          title="Reverse this expense"
          description="The money goes back to the account it was paid from. You will be asked to confirm it is you."
          confirmLabel="Reverse expense"
          onCancel={() => setDialog(null)}
          onConfirm={reason =>
            run(() => svc.reverse(x.id, { version: x.version, reason }), 'Expense reversed.')
          }
        />
      )}
    </>
  );
}
