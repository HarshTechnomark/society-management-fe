'use client';
import { useState } from 'react';
import { KV } from '@/components/residents/common';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { Chip } from '@/components/ui/Chip';
import { inr, shortDate } from '@/lib/money';
import type { Deposit } from '@/types/accountsDeposits';
import { CancelDepositDialog, DeductDialog, RefundPaidDialog, RefundRequestDialog } from './DepositDialogs';
import { KIND_LABEL, MODE_LABEL, STATUS_LABEL, STATUS_TONE } from './format';

type Act = 'deduct' | 'forfeit' | 'refund' | 'paid' | 'cancel';
const ADJ: Record<string, string> = { DEDUCTION: 'Deducted', FORFEIT: 'Forfeited', REFUND: 'Refunded' };

export interface TimelineItem {
  label: string;
  when: string | null;
  amountPaise: number;
  note?: string;
}
/** Oldest first: raised, received, each deduction or forfeit, refund requested, refund paid. */
export function timeline(d: Deposit): TimelineItem[] {
  const items: TimelineItem[] = [{ label: 'Deposit raised', when: d.createdAt, amountPaise: d.amountPaise }];
  if (d.receivedPaise > 0)
    items.push({
      label: d.isOpening ? 'Opening deposit held' : 'Received',
      when: d.receivedAt,
      amountPaise: d.receivedPaise,
    });
  for (const a of d.adjustments)
    items.push({ label: ADJ[a.kind] ?? a.kind, when: a.at, amountPaise: a.amountPaise, note: a.reason });
  if (d.status === 'REFUND_PENDING' || d.status === 'REFUND_APPROVED')
    items.push({
      label: d.status === 'REFUND_PENDING' ? 'Refund requested, waiting for approval' : 'Refund approved',
      when: null,
      amountPaise: d.refundRequestedPaise,
    });
  if (d.status === 'CANCELLED')
    items.push({
      label: 'Cancelled',
      when: null,
      amountPaise: 0,
      ...(d.cancelReason ? { note: d.cancelReason } : {}),
    });
  return items;
}

/** Deposit detail with its timeline and the actions that fit the state. `canAct` needs finance.accounts.create. */
export function DepositDrawer({
  deposit: d,
  canAct,
  onClose,
  onChanged,
}: {
  deposit: Deposit;
  canAct: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [act, setAct] = useState<Act | null>(null);
  const done = () => {
    onChanged();
    onClose();
  };
  const held = d.status === 'HELD' && d.heldPaise > 0;
  return (
    <Drawer open onClose={onClose} title={`${d.code} ${d.title}`} size={520}>
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[26px] font-bold tabular-nums">{inr(d.amountPaise)}</p>
          <Chip tone={STATUS_TONE[d.status] ?? 'neutral'}>{STATUS_LABEL[d.status] ?? d.status}</Chip>
        </div>
        <dl>
          <KV label="Flat">{d.unitLabel || '-'}</KV>
          <KV label="Type">{KIND_LABEL[d.kind] ?? d.kind}</KV>
          <KV label="Received">{inr(d.receivedPaise)}</KV>
          <KV label="Held now">{inr(d.heldPaise)}</KV>
          {d.deductedPaise > 0 && <KV label="Deducted">{inr(d.deductedPaise)}</KV>}
          {d.refundedPaise > 0 && <KV label="Refunded">{inr(d.refundedPaise)}</KV>}
          {d.dueDate && <KV label="Due date">{shortDate(d.dueDate)}</KV>}
          {d.refundMode && (
            <KV label="Refund paid by">
              {MODE_LABEL[d.refundMode as keyof typeof MODE_LABEL] ?? d.refundMode}
              {d.refundReference ? `, ${d.refundReference}` : ''}
            </KV>
          )}
          {d.notes && <KV label="Notes">{d.notes}</KV>}
        </dl>
        <section aria-label="Timeline">
          <h3 className="mb-2 text-[14px] font-bold">Timeline</h3>
          <ol className="grid gap-2">
            {timeline(d).map((t, i) => (
              <li
                key={i}
                data-testid="timeline-item"
                className="rounded-xl bg-white/50 px-3 py-2 text-[13.5px]"
              >
                <div className="flex justify-between gap-2">
                  <span className="font-semibold">{t.label}</span>
                  {t.amountPaise > 0 && <span className="tabular-nums">{inr(t.amountPaise)}</span>}
                </div>
                {(t.when || t.note) && (
                  <p className="text-muted">
                    {t.when ? shortDate(t.when) : ''}
                    {t.when && t.note ? '. ' : ''}
                    {t.note}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </section>
        {canAct && (
          <div className="flex flex-wrap gap-2">
            {held && <Button onClick={() => setAct('refund')}>Request refund</Button>}
            {held && (
              <Button variant="glass" onClick={() => setAct('deduct')}>
                Deduct
              </Button>
            )}
            {held && (
              <Button variant="glass" onClick={() => setAct('forfeit')}>
                Forfeit
              </Button>
            )}
            {d.status === 'REFUND_APPROVED' && (
              <Button onClick={() => setAct('paid')}>Mark refund paid</Button>
            )}
            {d.status === 'AWAITING_PAYMENT' && (
              <Button variant="glass" onClick={() => setAct('cancel')}>
                Cancel deposit
              </Button>
            )}
          </div>
        )}
      </div>
      {(act === 'deduct' || act === 'forfeit') && (
        <DeductDialog deposit={d} mode={act} onClose={() => setAct(null)} onDone={done} />
      )}
      {act === 'refund' && <RefundRequestDialog deposit={d} onClose={() => setAct(null)} onDone={done} />}
      {act === 'paid' && <RefundPaidDialog deposit={d} onClose={() => setAct(null)} onDone={done} />}
      {act === 'cancel' && <CancelDepositDialog deposit={d} onClose={() => setAct(null)} onDone={done} />}
    </Drawer>
  );
}
