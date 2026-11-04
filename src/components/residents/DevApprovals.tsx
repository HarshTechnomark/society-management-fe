'use client';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card, PageHead } from '@/components/common/PageHead';
import { useLoad } from '@/hooks/useLoad';
import { api } from '@/lib/apiClient';
import { residentsService } from '@/services/residents.service';

interface Pending {
  id: number;
  type: string;
  entityId: number;
  societyId: number;
  status: string;
}

const TYPE_LABEL: Record<string, string> = {
  RENOVATION_PERMIT: 'Renovation permit',
  OWNERSHIP_TRANSFER: 'Ownership transfer',
  JOIN_REQUEST: 'Join request',
  MOVE_IN: 'Move in',
  MOVE_OUT: 'Move out',
  BILLING_RUN_PUBLISH: 'Billing run publish',
};

/**
 * Development stand-in for the module 14 approvals inbox: lists what is waiting in the backend's placeholder and lets you
 * approve or reject it. Outside production only; the real inbox replaces it when module 14 is built.
 */
export function DevApprovals() {
  const { data, loading, error, reload } = useLoad(() => api<Pending[]>('/dev/approvals'));
  const [busy, setBusy] = useState<number | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  async function decide(id: number, approve: boolean) {
    setBusy(id);
    setFailed(null);
    try {
      if (approve) await residentsService.approvalApprove(id);
      else await residentsService.approvalReject(id, 'Rejected in development');
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
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-[14.5px]">
                <strong>{TYPE_LABEL[r.type] ?? r.type}</strong> · request {r.id} · record {r.entityId}
              </span>
              <span className="flex gap-2">
                <Button size="sm" disabled={busy === r.id} onClick={() => decide(r.id, true)}>
                  Approve request {r.id}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy === r.id}
                  onClick={() => decide(r.id, false)}
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
