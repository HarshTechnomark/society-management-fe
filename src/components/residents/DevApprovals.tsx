'use client';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { ConfirmReason } from '@/components/common/ConfirmReason';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card, PageHead } from '@/components/common/PageHead';
import { useLoad } from '@/hooks/useLoad';
import { api } from '@/lib/apiClient';
import { inr } from '@/lib/money';
import { residentsService } from '@/services/residents.service';

interface Pending {
  id: number;
  type: string;
  entityId: number;
  societyId: number;
  status: string;
  source?: string;
  title?: string;
  amountPaise?: number;
  categoryKey?: string;
  /** What the request carries (payments source): flat, amount and mode may sit here or at the top level. */
  payload?: Record<string, unknown> | null;
  unitLabel?: string;
  mode?: string;
}

const ENTITY_LABEL: Record<string, string> = {
  OFFLINE_PAYMENT: 'payment',
  PAYMENT_REFUND: 'refund',
  COLLECTION_PUBLISH: 'collection',
  MANUAL_JOURNAL: 'journal',
  EXPENSE: 'expense',
  FUND_TRANSFER: 'fund',
  DEPOSIT_REFUND: 'deposit',
  PERIOD_UNLOCK: 'period',
};
const MODE_LABEL: Record<string, string> = {
  GATEWAY: 'back to the payer',
  BANK_TRANSFER: 'bank transfer',
  CHEQUE: 'cheque',
  CASH: 'cash',
  UPI: 'UPI',
  NEFT: 'NEFT',
};

/** One line about what is asked: the title, the amount and the mode when the request carries them. */
export function approvalSummary(r: Pending): string {
  const p = r.payload ?? {};
  const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
  const amount = [r.amountPaise, p.amountPaise].find(v => typeof v === 'number' && v > 0) as
    number | undefined;
  const mode = text(r.mode) ?? text(r.categoryKey) ?? text(p.mode) ?? text(p.method);
  const flat = text(r.unitLabel) ?? text(p.unitLabel) ?? text(p.flat);
  const parts: string[] = [];
  if (r.title) parts.push(r.title);
  if (flat) parts.push(`Flat ${flat}`);
  if (amount) parts.push(inr(amount));
  if (mode) parts.push(MODE_LABEL[mode] ?? mode);
  return parts.join(' · ');
}

const TYPE_LABEL: Record<string, string> = {
  RENOVATION_PERMIT: 'Renovation permit',
  OWNERSHIP_TRANSFER: 'Ownership transfer',
  JOIN_REQUEST: 'Join request',
  MOVE_IN: 'Move in',
  MOVE_OUT: 'Move out',
  BILLING_RULE_CHANGE: 'Billing rule change',
  LATE_FEE_POLICY_CHANGE: 'Late fee policy change',
  CREDIT_NOTE: 'Credit note',
  WRITE_OFF: 'Write-off',
  INVOICE_CANCEL: 'Invoice cancellation',
  BILLING_RUN_PUBLISH: 'Billing run publish',
  OFFLINE_PAYMENT: 'Offline payment',
  PAYMENT_REFUND: 'Payment refund',
  COLLECTION_PUBLISH: 'Collection publish',
  MANUAL_JOURNAL: 'Manual journal',
  EXPENSE: 'Expense',
  FUND_TRANSFER: 'Fund transfer',
  DEPOSIT_REFUND: 'Deposit refund',
  PERIOD_UNLOCK: 'Period unlock',
};

const rowKey = (r: { id: number; source?: string }) => `${r.source ?? 'residents'}-${r.id}`;
/** "accounts request 1": the source is part of the name because ids repeat between sources. */
const rowName = (r: { id: number; source?: string }) => `${r.source ? `${r.source} ` : ''}request ${r.id}`;

/**
 * Development stand-in for the module 14 approvals inbox: lists what is waiting in the backend's placeholder and lets you
 * approve or reject it. Outside production only; the real inbox replaces it when module 14 is built.
 */
export function DevApprovals() {
  const { data, loading, error, reload } = useLoad(() => api<Pending[]>('/dev/approvals'));
  const sourceFilter = useSearchParams()?.get('source') || '';
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<Pending | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  async function decide(id: number, approve: boolean, source?: string, reason = '') {
    setBusy(rowKey({ id, source }));
    setFailed(null);
    try {
      if (approve) await residentsService.approvalApprove(id, source);
      else await residentsService.approvalReject(id, reason, source);
      reload();
    } catch (e) {
      setFailed(e instanceof Error ? e.message : 'The decision could not be saved.');
    } finally {
      setBusy(null);
    }
  }

  const rows = (data ?? []).filter(r => !sourceFilter || (r.source ?? 'residents') === sourceFilter);

  return (
    <main>
      <PageHead
        title="Approvals (development)"
        sub="Requests waiting for a decision. The real approvals inbox arrives with module 14."
      />
      {failed && <Alert tone="bad">{failed}</Alert>}
      <Card>
        {loading && <p className="text-[14px] text-muted">Loading requests.</p>}
        {!loading && error != null && <p className="text-[14px]">Approvals are not available here.</p>}
        {!loading && !error && rows.length === 0 && (
          <p className="text-[14px] text-muted">Nothing is waiting for a decision.</p>
        )}
        <ul className="grid gap-3">
          {rows.map(r => (
            <li key={rowKey(r)} className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-[14.5px]">
                <strong>{TYPE_LABEL[r.type] ?? r.type}</strong> · {rowName(r)} ·{' '}
                {ENTITY_LABEL[r.type] ?? 'record'} {r.entityId}
                {approvalSummary(r) && (
                  <span className="block text-[13px] text-muted">{approvalSummary(r)}</span>
                )}
              </span>
              <span className="flex gap-2">
                <Button size="sm" disabled={busy === rowKey(r)} onClick={() => decide(r.id, true, r.source)}>
                  Approve {rowName(r)}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy === rowKey(r)}
                  onClick={() => setRejecting(r)}
                >
                  Reject {rowName(r)}
                </Button>
              </span>
            </li>
          ))}
        </ul>
      </Card>
      {rejecting && (
        <ConfirmReason
          open
          title={`Reject ${rowName(rejecting)}`}
          description="The person who asked sees this reason."
          confirmLabel="Reject"
          onCancel={() => setRejecting(null)}
          onConfirm={async reason => {
            const r = rejecting;
            setRejecting(null);
            await decide(r.id, false, r.source, reason);
          }}
        />
      )}
    </main>
  );
}
