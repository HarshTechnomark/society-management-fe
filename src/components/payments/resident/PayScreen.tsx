'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { Gate } from '@/components/setup/Gate';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { inr, shortDate } from '@/lib/money';
import { billingResidentService } from '@/services/billingResident.service';
import { paymentsResidentService as svc } from '@/services/paymentsResident.service';
import type { Payable, Payables } from '@/types/paymentsResident';
import { CheckoutSheet, type Selection } from './CheckoutSheet';
import { OfflineSheet } from './OfflineSheet';
import { PayTabs } from './PayTabs';
import { paiseToText, plainPayError, rupeesToPaise } from './format';

const key = (p: Payable) => `${p.type}-${p.id}`;

/** Pay tab (spec 11.3): tick what to pay, edit amounts, one "Pay ₹…" button. */
export function PayScreen() {
  return (
    <Gate view={PERMISSIONS.resident.payments.view} title="payments">
      <Inner />
    </Gate>
  );
}

function Inner() {
  const params = useSearchParams();
  const wantUnit = Number(params.get('unitId')) || 0;
  const invoiceId = Number(params.get('invoiceId')) || 0;
  const requestId = Number(params.get('requestId')) || 0;
  const dues = useLoad(() => billingResidentService.dues(), 'dues');
  const [picked, setPicked] = useState<number | null>(null);
  const units = dues.data ?? [];
  const unitId = picked ?? (units.some(u => u.unitId === wantUnit) ? wantUnit : (units[0]?.unitId ?? 0));
  const pay = useLoad(() => (unitId ? svc.payables(unitId) : Promise.resolve(null)), `payables-${unitId}`);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <Page>
      <PageHead title="Pay" sub="Choose what to pay for your flat." />
      <PayTabs />
      {dues.error != null ? (
        <Card>
          <ErrorState
            error={plainPayError(dues.error)}
            action={
              <Button size="sm" onClick={dues.reload}>
                Try again
              </Button>
            }
          />
        </Card>
      ) : dues.loading ? (
        <div aria-busy="true" aria-label="Loading">
          <div className="skeleton h-40 w-full" data-testid="skeleton-row" />
        </div>
      ) : units.length === 0 ? (
        <Card>
          <EmptyState
            title="No flat yet"
            text="Once you are a member of a flat, you can pay its dues here."
          />
        </Card>
      ) : (
        <>
          {units.length > 1 && (
            <div className="mb-3 max-w-xs">
              <Select
                label="Flat"
                value={String(unitId)}
                onChange={e => {
                  setPicked(Number(e.target.value));
                  setNotice(null);
                }}
                options={units.map(u => ({ value: String(u.unitId), label: u.unitLabel }))}
              />
            </div>
          )}
          {notice && (
            <Alert tone="warn" className="mb-3">
              {notice}
            </Alert>
          )}
          {pay.error != null ? (
            <Card>
              <ErrorState
                error={plainPayError(pay.error)}
                action={
                  <Button size="sm" onClick={pay.reload}>
                    Try again
                  </Button>
                }
              />
            </Card>
          ) : pay.loading || !pay.data ? (
            <div aria-busy="true" aria-label="Loading your dues">
              <div className="skeleton h-40 w-full" data-testid="skeleton-row" />
            </div>
          ) : (
            <PayList
              key={`${pay.data.unit.id}-${pay.data.payListVersion}`}
              payables={pay.data}
              invoiceId={invoiceId}
              requestId={requestId}
              onChanged={() => {
                setNotice(
                  'Your dues changed while you were choosing. The list is updated; check it and pay again.',
                );
                pay.reload();
              }}
            />
          )}
        </>
      )}
    </Page>
  );
}

function PayList({
  payables,
  invoiceId,
  requestId,
  onChanged,
}: {
  payables: Payables;
  invoiceId: number;
  requestId: number;
  onChanged: () => void;
}) {
  const canPay = usePermission(PERMISSIONS.resident.payments.create);
  const items = useMemo(
    () =>
      [...payables.items].sort((a, b) => {
        if (a.type !== b.type) return a.type === 'INVOICE' ? -1 : 1;
        if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
        return (a.dueDate ?? '').localeCompare(b.dueDate ?? '');
      }),
    [payables.items],
  );
  const initial = (p: Payable) =>
    p.type === 'INVOICE'
      ? invoiceId
        ? p.id === invoiceId
        : requestId
          ? false
          : !p.isDisputed // a disputed bill cannot be paid online (maxPaise 0)
      : p.id === requestId;
  const [ticked, setTicked] = useState<Set<string>>(() => new Set(items.filter(initial).map(key)));
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      items.map(p => [
        key(p),
        (p.type === 'INVOICE' ? (p.outstandingPaise ?? 0) : (p.suggestedPaise ?? 0)) > 0
          ? paiseToText(p.type === 'INVOICE' ? (p.outstandingPaise ?? 0) : (p.suggestedPaise ?? 0))
          : '',
      ]),
    ),
  );
  const [advance, setAdvance] = useState('');
  const [sheet, setSheet] = useState<'pay' | 'offline' | null>(null);

  const rows = items.map(p => {
    const k = key(p);
    const on = ticked.has(k);
    const paise = rupeesToPaise(amounts[k] ?? '');
    const locked = p.type === 'INVOICE' && !payables.allowPartial;
    let error: string | null = null;
    if (on) {
      if (paise === null || paise <= 0) error = 'Enter an amount.';
      else if (paise < p.minPaise && !(p.type === 'INVOICE' && paise === p.maxPaise))
        error = `At least ${inr(p.minPaise)}.`;
      else if (paise > p.maxPaise) error = `At most ${inr(p.maxPaise)}.`;
    }
    return { p, k, on, paise, locked, error };
  });
  const advancePaise = advance.trim() === '' ? 0 : rupeesToPaise(advance);
  const advanceError = advancePaise === null ? 'Enter an amount.' : null;
  const total = rows.filter(r => r.on).reduce((s, r) => s + (r.paise ?? 0), 0) + (advancePaise ?? 0);
  const hasError = rows.some(r => r.error) || advanceError !== null;
  const selection: Selection = {
    items: rows
      .filter(r => r.on && r.paise)
      .map(r => ({ type: r.p.type, id: r.p.id, amountPaise: r.paise! })),
    advancePaise: advancePaise ?? 0,
    totalPaise: total,
  };
  const toggle = (k: string) =>
    setTicked(s => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  return (
    <>
      {payables.liveOrder && (
        <Alert tone="info" className="mb-3">
          A payment for this flat is in progress.{' '}
          <Link className="font-bold underline" href={`/resident/pay/status/${payables.liveOrder.orderId}`}>
            See its status
          </Link>
        </Alert>
      )}
      {!payables.gatewayReady && (
        <Alert tone="warn" className="mb-3">
          Online payment is not set up for your society yet. Use “Pay offline” below.
        </Alert>
      )}
      <Card title={payables.unit.label} sub={`Total dues ${inr(payables.totalDuesPaise)}`}>
        {rows.length === 0 ? (
          <EmptyState
            title="Nothing to pay"
            text="You are paid up. You can still add money to your advance."
          />
        ) : (
          <ul aria-label="Pay list" className="divide-y divide-[var(--line)]">
            {rows.map(r => (
              <li
                key={r.k}
                className="grid gap-2 py-3 sm:grid-cols-[1fr_180px] sm:items-start"
                data-testid="pay-row"
              >
                <label className="flex cursor-pointer items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={r.on}
                    onChange={() => toggle(r.k)}
                    aria-label={`Pay ${r.p.label}`}
                    className="mt-1 h-[18px] w-[18px] shrink-0 accent-[#143041]"
                  />
                  <span className="min-w-0 text-[14.5px]">
                    <span className="block font-semibold">{r.p.label}</span>
                    <span className="block text-[13px] text-muted">
                      {r.p.type === 'INVOICE'
                        ? `${inr(r.p.outstandingPaise)} due${r.p.dueDate ? ` by ${shortDate(r.p.dueDate)}` : ''}`
                        : `${r.p.suggestedPaise ? `Suggested ${inr(r.p.suggestedPaise)}` : 'Any amount'}${r.p.dueDate ? ` · by ${shortDate(r.p.dueDate)}` : ''}`}
                    </span>
                    <span className="mt-0.5 flex flex-wrap gap-1">
                      {r.p.isOverdue && <Chip tone="bad">Overdue</Chip>}
                      {r.p.isDisputed && <Chip tone="warn">Under dispute</Chip>}
                      {r.p.type === 'COLLECTION_REQUEST' && <Chip tone="gold">Optional</Chip>}
                    </span>
                  </span>
                </label>
                {r.on && (
                  <Input
                    label={`Amount for ${r.p.label} (₹)`}
                    inputMode="decimal"
                    value={amounts[r.k] ?? ''}
                    readOnly={r.locked}
                    hint={
                      r.locked
                        ? 'Pay the full amount.'
                        : `Between ${inr(r.p.minPaise)} and ${inr(r.p.maxPaise)}`
                    }
                    error={r.error}
                    onChange={e => setAmounts(a => ({ ...a, [r.k]: e.target.value }))}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
        {payables.allowAdvance && (
          <div className="mt-3 max-w-xs">
            <Input
              label="Add to advance balance (₹, optional)"
              inputMode="decimal"
              value={advance}
              error={advanceError}
              onChange={e => setAdvance(e.target.value)}
            />
          </div>
        )}
        <p className="mt-2 text-[14px]" data-testid="advance-line">
          Advance balance: <strong>{inr(payables.advanceBalancePaise)}</strong>
        </p>
        <div className="mt-3 flex items-center justify-between border-t border-[var(--line)] pt-3">
          <span className="text-[15px] font-bold">Total</span>
          <span className="text-[20px] font-bold tabular-nums" data-testid="pay-total">
            {inr(total)}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {canPay && (
            <Button
              disabled={total <= 0 || hasError || !payables.gatewayReady}
              onClick={() => setSheet('pay')}
            >
              Pay {inr(total)}
            </Button>
          )}
          <Button variant="glass" onClick={() => setSheet('offline')}>
            Pay offline
          </Button>
        </div>
      </Card>
      {sheet === 'pay' && (
        <CheckoutSheet
          payables={payables}
          selection={selection}
          onClose={() => setSheet(null)}
          onChanged={() => {
            setSheet(null);
            onChanged();
          }}
        />
      )}
      {sheet === 'offline' && (
        <OfflineSheet
          unitId={payables.unit.id}
          unitLabel={payables.unit.label}
          instructions={payables.offlineInstructions}
          initialAmountPaise={total}
          onClose={() => setSheet(null)}
        />
      )}
    </>
  );
}
