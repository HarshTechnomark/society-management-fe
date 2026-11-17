'use client';
import { useEffect, useRef, useState } from 'react';
import { accountsError } from '@/components/accounts/format';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { useToast } from '@/components/ui/Toast';
import { inr, shortDate } from '@/lib/money';
import { accountsBankService } from '@/services/accountsBank.service';
import type { BankAccount } from '@/types/accountsBank';

/** How long a revealed number stays on screen. */
export const REVEAL_MS = 15_000;

interface Props {
  account: BankAccount;
  canEdit: boolean;
  canApprove: boolean;
  onEdit: () => void;
  onClose: () => void;
  onChanged: () => void;
}

export function BankCard({ account: a, canEdit, canApprove, onEdit, onClose, onChanged }: Props) {
  const toast = useToast();
  const [shown, setShown] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setShown(null);
  };
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const reveal = async () => {
    setBusy('reveal');
    try {
      const n = await accountsBankService.reveal(a.id);
      setShown(n);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(hide, REVEAL_MS);
    } catch (e) {
      toast.show(accountsError(e), 'warning');
    } finally {
      setBusy(null);
    }
  };

  const act = async (key: string, fn: () => Promise<unknown>, done: string) => {
    setBusy(key);
    try {
      await fn();
      toast.show(done);
      onChanged();
    } catch (e) {
      toast.show(accountsError(e), 'warning');
    } finally {
      setBusy(null);
    }
  };

  const closed = a.status === 'CLOSED';
  const verified = a.verificationStatus === 'VERIFIED';
  return (
    <article className="glass p-4 sm:p-5" data-testid="bank-card" aria-label={a.displayName}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-[17px] font-bold">{a.displayName}</h2>
          <p className="text-[13px] text-muted">
            {a.bankName}
            {a.branchName ? `, ${a.branchName}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {a.isCollectionAccount && !closed && <Chip tone="info">Collection account</Chip>}
          {closed ? (
            <Chip>Closed</Chip>
          ) : verified ? (
            <Chip tone="ok">Verified</Chip>
          ) : (
            <Chip tone="warn">Not verified</Chip>
          )}
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-[14px] sm:grid-cols-2">
        <div>
          <dt className="text-[12px] uppercase tracking-wide text-muted">Account</dt>
          <dd className="flex items-center gap-2 font-semibold tabular-nums">
            <span data-testid="account-number">{shown ?? a.maskedNumber}</span>
            {canEdit && !closed && (
              <Button
                size="sm"
                variant="ghost"
                loading={busy === 'reveal'}
                aria-label={shown ? 'Hide number' : 'Reveal number'}
                onClick={() => (shown ? hide() : void reveal())}
              >
                {shown ? 'Hide' : 'Reveal number'}
              </Button>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-[12px] uppercase tracking-wide text-muted">IFSC</dt>
          <dd>{a.ifsc}</dd>
        </div>
        <div>
          <dt className="text-[12px] uppercase tracking-wide text-muted">Holder</dt>
          <dd>{a.accountHolderName}</dd>
        </div>
        <div>
          <dt className="text-[12px] uppercase tracking-wide text-muted">Type</dt>
          <dd>{a.accountKind === 'SAVINGS' ? 'Savings' : 'Current'}</dd>
        </div>
      </dl>
      <p className="mt-3 text-[13px] text-muted">
        {verified
          ? `Verified${a.verifiedByName ? ` by ${a.verifiedByName}` : ''}${a.verifiedAt ? ` on ${shortDate(a.verifiedAt)}` : ''}.`
          : 'Waiting for a second committee member to verify this account.'}{' '}
        {a.lastReconciledDate
          ? `Last reconciled ${shortDate(a.lastReconciledDate)}${a.lastReconciledBalancePaise != null ? `, statement balance ${inr(a.lastReconciledBalancePaise)}` : ''}.`
          : 'Not reconciled yet.'}
      </p>
      {!closed && (canEdit || canApprove) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {canEdit && (
            <Button size="sm" variant="glass" onClick={onEdit}>
              Change bank account
            </Button>
          )}
          {canApprove && !verified && (
            <Button
              size="sm"
              loading={busy === 'verify'}
              onClick={() =>
                void act('verify', () => accountsBankService.verify(a.id, a.version), 'Bank account verified')
              }
            >
              Verify
            </Button>
          )}
          {canApprove && !a.isCollectionAccount && (
            <Button
              size="sm"
              variant="glass"
              loading={busy === 'collection'}
              onClick={() =>
                void act(
                  'collection',
                  () => accountsBankService.setCollection(a.id, a.version),
                  'Collection account changed',
                )
              }
            >
              Set as collection account
            </Button>
          )}
          {canApprove && (
            <Button size="sm" variant="ghost" onClick={onClose}>
              Close account
            </Button>
          )}
        </div>
      )}
    </article>
  );
}
