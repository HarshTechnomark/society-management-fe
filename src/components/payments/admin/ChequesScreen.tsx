'use client';
import Link from 'next/link';
import { useState } from 'react';
import { BankAccountPicker } from '@/components/accounts/pickers/BankAccountPicker';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { Segments } from '@/components/residents/common';
import { Gate } from '@/components/setup/Gate';
import { Alert } from '@/components/ui/Alert';
import { Button, buttonClasses } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { inr, shortDate } from '@/lib/money';
import { paymentsService } from '@/services/payments.service';
import { PaymentDrawer } from './PaymentDrawer';
import { isoDay, paymentError, plainError, statusInfo, today } from './format';

const P = PERMISSIONS.finance.payments;
const STATES = [
  { key: 'RECEIVED', label: 'Received' },
  { key: 'DEPOSITED', label: 'Deposited' },
  { key: 'CLEARED', label: 'Cleared' },
  { key: 'BOUNCED', label: 'Bounced' },
  { key: 'RETURNED', label: 'Returned' },
] as const;
type State = (typeof STATES)[number]['key'];

/** Cheques (spec 8.12, 11.1): the list by state and the deposit batch for received cheques. */
export function ChequesScreen() {
  return (
    <Gate view={P.view} feature="payments.cheque_lifecycle" title="Cheques">
      <Inner />
    </Gate>
  );
}

function Inner() {
  const canEdit = usePermission(P.edit);
  const toast = useToast();
  const [state, setState] = useState<State>('RECEIVED');
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [bankId, setBankId] = useState('');
  const [on, setOn] = useState(today());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const list = useLoad(() => paymentsService.list({ method: 'CHEQUE', status: state, limit: 100 }), state);
  const items = list.data?.items ?? [];
  const batch = canEdit && state === 'RECEIVED';
  const total = items.filter(i => picked.has(i.id)).reduce((s, i) => s + i.amountPaise, 0);

  const toggle = (id: number) =>
    setPicked(s => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const deposit = async () => {
    setError(null);
    if (picked.size === 0) return setError('Select at least one cheque.');
    if (!bankId) return setError('Choose the bank account.');
    if (!isoDay(on)) return setError('Enter the deposit date.');
    setBusy(true);
    try {
      const r = await paymentsService.depositCheques({
        paymentIds: [...picked],
        depositedOn: on,
        bankAccountId: Number(bankId),
      });
      toast.show(`${r.deposited} ${r.deposited === 1 ? 'cheque' : 'cheques'} marked as deposited`);
      setPicked(new Set());
      list.reload();
    } catch (e) {
      setError(paymentError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page>
      <PageHead
        title="Cheques"
        sub="Deposit received cheques in one batch, then mark each one cleared or bounced."
        actions={
          <Link href="/admin/payments" className={buttonClasses('glass', 'md')}>
            All payments
          </Link>
        }
      />
      <Card>
        <Segments
          label="Cheque state"
          options={[...STATES]}
          value={state}
          onChange={s => {
            setState(s);
            setPicked(new Set());
            setError(null);
          }}
        />
        {batch && (
          <div className="mb-4 grid gap-x-4 sm:grid-cols-3" data-testid="deposit-form">
            <BankAccountPicker value={bankId} onChange={setBankId} />
            <Input
              label="Deposit date"
              type="date"
              value={on}
              max={today()}
              onChange={e => setOn(e.target.value)}
            />
            <div className="flex items-end pb-4">
              <Button loading={busy} disabled={picked.size === 0} onClick={() => void deposit()}>
                {picked.size === 0
                  ? 'Deposit selected cheques'
                  : `Deposit ${picked.size} ${picked.size === 1 ? 'cheque' : 'cheques'} (${inr(total)})`}
              </Button>
            </div>
          </div>
        )}
        {error && <Alert tone="bad">{error}</Alert>}
        {list.error != null ? (
          <ErrorState
            error={plainError(list.error)}
            action={
              <Button size="sm" onClick={list.reload}>
                Try again
              </Button>
            }
          />
        ) : list.loading ? (
          <div aria-busy="true" aria-label="Loading">
            {[0, 1, 2].map(i => (
              <div key={i} className="skeleton mb-3 h-12 w-full" data-testid="skeleton-row" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState title="No cheques here" text="Cheques in this state show up in this list." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-[14px]">
              <caption className="sr-only">Cheques</caption>
              <thead>
                <tr className="border-b border-[var(--line)] text-[12px] font-semibold uppercase tracking-wide text-muted">
                  {batch && (
                    <th scope="col" className="w-10 px-3 py-2.5">
                      <input
                        type="checkbox"
                        aria-label="Select all cheques"
                        checked={picked.size === items.length}
                        onChange={e =>
                          setPicked(e.target.checked ? new Set(items.map(i => i.id)) : new Set())
                        }
                      />
                    </th>
                  )}
                  {['Receipt', 'Flat', 'Cheque', 'Amount', 'Date', 'Status'].map(h => (
                    <th key={h} scope="col" className="px-3 py-2.5">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map(p => {
                  const st = statusInfo(p.status);
                  return (
                    <tr
                      key={p.id}
                      className="border-b border-[var(--line)] last:border-0"
                      data-testid="cheque-row"
                    >
                      {batch && (
                        <td className="px-3 py-3">
                          <input
                            type="checkbox"
                            aria-label={`Select cheque of ${p.unitLabel}`}
                            checked={picked.has(p.id)}
                            onChange={() => toggle(p.id)}
                          />
                        </td>
                      )}
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          className="font-semibold underline"
                          onClick={() => setOpenId(p.id)}
                          aria-label={`Open ${p.receiptNo ?? `payment ${p.id}`}`}
                        >
                          {p.receiptNo ?? 'Not issued'}
                        </button>
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-semibold">{p.unitLabel}</div>
                        <div className="text-[12.5px] text-muted">{p.payerName}</div>
                      </td>
                      <td className="px-3 py-3">{p.referenceNo ?? '-'}</td>
                      <td className="px-3 py-3 font-semibold tabular-nums">{inr(p.amountPaise)}</td>
                      <td className="px-3 py-3">{shortDate(p.paymentDate)}</td>
                      <td className="px-3 py-3">
                        <Chip tone={st.tone}>{st.label}</Chip>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {openId !== null && (
        <PaymentDrawer id={openId} onClose={() => setOpenId(null)} onChanged={() => list.reload()} />
      )}
    </Page>
  );
}
