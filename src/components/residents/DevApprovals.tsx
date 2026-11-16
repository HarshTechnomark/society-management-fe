'use client';
import { useState } from 'react';
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
}

const ENTITY_LABEL: Record<string, string> = {
  OFFLINE_PAYMENT: 'payment',
  PAYMENT_REFUND: 'refund',
  COLLECTION_PUBLISH: 'collection',
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
  const parts: string[] = [];
  if (r.title) parts.push(r.title);
  if (typeof r.amountPaise === 'number' && r.amountPaise > 0) parts.push(inr(r.amountPaise));
  if (r.categoryKey) parts.push(MODE_LABEL[r.categoryKey] ?? r.categoryKey);
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
};

/**
 * Development stand-in for the module 14 approvals inbox: lists what is waiting in the backend's placeholder and lets you
 * approve or reject it. Outside production only; the real inbox replaces it when module 14 is built.
 */
export function DevApprovals() {
  const { data, loading, error, reload } = useLoad(() => api<Pending[]>('/dev/approvals'));
  const [busy, setBusy] = useState<number | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  async function decide(id: number, approve: boolean, source?: string) {
    setBusy(id);
    setFailed(null);
    try {
      if (approve) await residentsService.approvalApprove(id, source);
      else await residentsService.approvalReject(id, 'Rejected in development', source);
      reload();
    } catch (e) {
      setFailed(e instanceof Error ? e.message : 'The decision could not be saved.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHead
        title="Approvals (development)"
        sub="Requests waiting for a decision. The real approvals inbox arrives with module 14."
      />
      {failed && <Alert tone="bad">{failed}</Alert>}
      <Card>
        {loading && <p className="text-[14px] text-muted">Loading requests.</p>}
        {!loading && error != null && <p className="text-[14px]">Approvals are not available here.</p>}
        {!loading && !error && (data ?? []).length === 0 && (
          <p className="text-[14px] text-muted">Nothing is waiting for a decision.</p>
        )}
        <ul className="grid gap-3">
          {(data ?? []).map(r => (
            <li
              key={`${r.source ?? 'residents'}-${r.id}`}
              className="flex flex-wrap items-center justify-between gap-3"
            >
              <span className="text-[14.5px]">
                <strong>{TYPE_LABEL[r.type] ?? r.type}</strong> · request {r.id} ·{' '}
                {ENTITY_LABEL[r.type] ?? 'record'} {r.entityId}
                {approvalSummary(r) && (
                  <span className="block text-[13px] text-muted">{approvalSummary(r)}</span>
                )}
              </span>
              <span className="flex gap-2">
                <Button size="sm" disabled={busy === r.id} onClick={() => decide(r.id, true, r.source)}>
                  Approve request {r.id}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy === r.id}
                  onClick={() => decide(r.id, false, r.source)}
                >
                  Reject request {r.id}
                </Button>
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
