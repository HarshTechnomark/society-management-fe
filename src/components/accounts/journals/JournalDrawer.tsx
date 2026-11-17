'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ErrorState } from '@/components/common/ErrorState';
import { KV, Section } from '@/components/residents/common';
import { Alert } from '@/components/ui/Alert';
import { Button, buttonClasses } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Drawer } from '@/components/ui/Drawer';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { PERMISSIONS } from '@/constants/permissions';
import { useMe } from '@/lib/auth';
import { useFeature } from '@/hooks/useFeature';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { inr, shortDate } from '@/lib/money';
import { accountsJournalService } from '@/services/accountsJournal.service';
import { approvalHref } from '@/components/approvals/links';
import type { JournalDetail } from '@/types/accountsJournal';
import {
  STATUS_LABEL,
  STATUS_TONE,
  VOUCHER_LABEL,
  accountsError,
  plainError,
  refLabel,
  sourceHref,
  today,
} from './format';

const P = PERMISSIONS.finance.accounts;

/** The voucher: header facts, lines, source and reversal links, audit trail, and the actions the state allows. */
export function JournalDrawer({
  id,
  onClose,
  onChanged,
}: {
  id: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [openId, setOpenId] = useState(id);
  const load = useLoad(() => accountsJournalService.journal(openId), openId);
  const toast = useToast();
  const canCreate = usePermission(P.create);
  const canApprove = usePermission(P.approve);
  const { me } = useMe();
  const manualOn = useFeature('accounting.manual_journals');
  const [reversing, setReversing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const j = load.data;

  const run = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setFailed(null);
    try {
      await fn();
      toast.show(done);
      onChanged();
      load.reload();
    } catch (e) {
      setFailed(accountsError(e));
    } finally {
      setBusy(false);
    }
  };

  const manual = j?.source === 'MANUAL';
  const balanced = j?.differencePaise === 0;
  const canReverse =
    !!j &&
    canApprove &&
    manualOn &&
    manual &&
    j.status === 'POSTED' &&
    !j.reversedBy &&
    !j.reversalOf &&
    !['OPENING_BALANCE', 'CLOSING'].includes(j.voucherType);
  const isMaker = j?.createdBy == null || me?.user.id === j.createdBy;
  const draftActions = !!j && canCreate && manualOn && manual && j.status === 'DRAFT' && isMaker;

  return (
    <>
      <Drawer open onClose={onClose} title={j?.voucherNo ?? (j ? `Draft ${j.id}` : 'Journal')} size={640}>
        {load.loading && <div className="skeleton h-40 w-full" />}
        {!load.loading && load.error != null && (
          <ErrorState
            error={plainError(load.error)}
            action={
              <Button size="sm" onClick={() => load.reload()}>
                Try again
              </Button>
            }
          />
        )}
        {failed && <Alert tone="bad">{failed}</Alert>}
        {j && (
          <>
            <div className="mb-3 flex flex-wrap gap-1.5">
              <Chip tone={STATUS_TONE[j.status] ?? 'neutral'}>{STATUS_LABEL[j.status] ?? j.status}</Chip>
              <Chip tone={manual ? 'gold' : 'info'}>{manual ? 'Manual' : 'System'}</Chip>
              {j.reversedBy && <Chip tone="warn">Reversed</Chip>}
            </div>
            <dl>
              <KV label="Date">{shortDate(j.entryDate)}</KV>
              <KV label="Type">{VOUCHER_LABEL[j.voucherType] ?? j.voucherType}</KV>
              <KV label="Narration">{j.narration}</KV>
              <KV label="Total debits / credits">{inr(j.totalPaise)}</KV>
              {j.instrumentRef && <KV label="Reference">{j.instrumentRef}</KV>}
              {j.postedAt && <KV label="Posted">{shortDate(j.postedAt)}</KV>}
              {j.sourceLink && (
                <KV label="Comes from">
                  {sourceHref(j.sourceLink.refType, j.sourceLink.refId) ? (
                    <Link className="underline" href={sourceHref(j.sourceLink.refType, j.sourceLink.refId)!}>
                      {j.sourceLink.label || refLabel(j.sourceLink.refType)}
                    </Link>
                  ) : (
                    j.sourceLink.label || refLabel(j.sourceLink.refType)
                  )}
                </KV>
              )}
              {j.reversalOf && (
                <KV label="Reverses">
                  <button type="button" className="underline" onClick={() => setOpenId(j.reversalOf!.id)}>
                    {j.reversalOf.voucherNo ?? `Entry ${j.reversalOf.id}`}
                  </button>
                </KV>
              )}
              {j.reversedBy && (
                <KV label="Reversed by">
                  <button type="button" className="underline" onClick={() => setOpenId(j.reversedBy!.id)}>
                    {j.reversedBy.voucherNo ?? `Entry ${j.reversedBy.id}`}
                  </button>
                </KV>
              )}
              {j.reversalReason && <KV label="Reversal reason">{j.reversalReason}</KV>}
              {j.rejectionReason && <KV label="Rejected because">{j.rejectionReason}</KV>}
            </dl>
            <Section title="Lines">
              <table className="w-full text-[13.5px]">
                <caption className="sr-only">Journal lines</caption>
                <thead>
                  <tr className="text-left text-muted">
                    <th className="py-1 font-semibold">Account</th>
                    <th className="py-1 text-right font-semibold">Debit</th>
                    <th className="py-1 text-right font-semibold">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {j.lines.map(l => (
                    <tr
                      key={l.lineNo}
                      data-testid="journal-line"
                      className="border-t border-[var(--line)] align-top"
                    >
                      <td className="py-1.5 pr-2">
                        {l.ledgerAccountCode} {l.ledgerAccountName}
                        {l.fundName && (
                          <span className="block text-[12px] text-muted">Fund: {l.fundName}</span>
                        )}
                        {l.lineNarration && (
                          <span className="block text-[12px] text-muted">{l.lineNarration}</span>
                        )}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">
                        {l.debitPaise ? inr(l.debitPaise) : ''}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">
                        {l.creditPaise ? inr(l.creditPaise) : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {j.status === 'DRAFT' && !balanced && (
                <p className="mt-2 text-[13px] text-bad">
                  Difference {inr(Math.abs(j.differencePaise))}. It must be zero to submit.
                </p>
              )}
            </Section>
            {j.audit.length > 0 && (
              <Section title="History">
                <ul className="grid gap-1 text-[13px]">
                  {j.audit.map((a, i) => (
                    <li key={i}>
                      {shortDate(a.at)} · {a.action}
                      {a.by ? ` · ${a.by}` : ''}
                      {a.note ? ` · ${a.note}` : ''}
                    </li>
                  ))}
                </ul>
              </Section>
            )}
            {j.status === 'PENDING_APPROVAL' && (
              <p className="mb-3 text-[13.5px] text-muted">
                Waiting for a different committee member to approve it.{' '}
                <Link
                  className="font-semibold underline"
                  href={approvalHref(j.approvalRequestId, 'MANUAL_JOURNAL')}
                >
                  Open the approval
                </Link>
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {draftActions && (
                <>
                  <Link
                    href={`/admin/accounts/journals/new?draft=${j.id}`}
                    className={buttonClasses('glass', 'md')}
                  >
                    Edit draft
                  </Link>
                  <Button
                    loading={busy}
                    disabled={!balanced}
                    onClick={() =>
                      run(() => accountsJournalService.submitJournal(j.id, j.version), 'Sent for approval.')
                    }
                  >
                    Submit for approval
                  </Button>
                  <Button
                    variant="danger-soft"
                    disabled={busy}
                    onClick={() => run(() => accountsJournalService.cancelJournal(j.id), 'Draft cancelled.')}
                  >
                    Cancel draft
                  </Button>
                </>
              )}
              {canReverse && (
                <Button variant="danger-soft" onClick={() => setReversing(true)}>
                  Reverse
                </Button>
              )}
            </div>
            {!manual && j.status === 'POSTED' && (
              <p className="mt-3 text-[12.5px] text-muted">
                A system entry is reversed from the place it came from, not here.
              </p>
            )}
          </>
        )}
      </Drawer>
      {reversing && j && (
        <ReverseJournalDialog
          journal={j}
          onClose={() => setReversing(false)}
          onDone={() => {
            onChanged();
            load.reload();
          }}
        />
      )}
    </>
  );
}

/** Reverse needs a step-up: the API client opens the "Confirm it is you" dialog when the API asks and retries. */
function ReverseJournalDialog({
  journal,
  onClose,
  onDone,
}: {
  journal: JournalDetail;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [date, setDate] = useState(today());
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const r = reason.trim();
    setFailed(null);
    if (r.length < 5 || r.length > 500) return setError('Enter a reason of 5 to 500 characters.');
    setError(null);
    setBusy(true);
    try {
      await accountsJournalService.reverseJournal(journal.id, {
        reason: r,
        version: journal.version,
        ...(date ? { reversalDate: date } : {}),
      });
      toast.show('Journal reversed.');
      onDone();
      onClose();
    } catch (e) {
      setFailed(accountsError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Reverse ${journal.voucherNo ?? 'journal'}`}
      description="A new entry with debits and credits swapped is posted. You will be asked to confirm it is you."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" onClick={submit} loading={busy}>
            Reverse journal
          </Button>
        </>
      }
    >
      {failed && (
        <p role="alert" className="mb-3 text-[14px] text-bad">
          {failed}
        </p>
      )}
      <Input
        label="Reversal date"
        type="date"
        value={date}
        max={today()}
        onChange={e => setDate(e.target.value)}
      />
      <Textarea
        label="Reason"
        value={reason}
        error={error ?? undefined}
        onChange={e => setReason(e.target.value)}
      />
    </Modal>
  );
}
