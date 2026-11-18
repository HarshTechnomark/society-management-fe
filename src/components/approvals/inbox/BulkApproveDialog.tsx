'use client';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { plural } from '@/lib/plural';
import { approvalsService } from '@/services/approvals.service';
import type { ApprovalRow, BulkResult } from '@/types/approvals';
import { approvalError } from '../format';

const SKIP_TEXT: Record<string, string> = {
  BULK_NOT_ALLOWED: 'Needs a fresh code: approve it on its own.',
  STALE_VERSION: 'Changed meanwhile. Open it and check.',
  APPROVAL_NOT_PENDING: 'Already actioned.',
  MAKER_CHECKER_VIOLATION: 'You created this item.',
  APPROVER_ALREADY_ACTED: 'You already approved it.',
  NOT_ELIGIBLE_APPROVER: 'Not your approval.',
  APPROVAL_NOT_FOUND: 'Not found.',
};

/** Approve the selected items together (spec 8.11): confirm first, then one line per item with what happened. */
export function BulkApproveDialog({
  items,
  onClose,
  onDone,
}: {
  items: ApprovalRow[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BulkResult | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const title = (id: number) => items.find(i => i.id === id)?.title ?? `Request ${id}`;

  const run = async () => {
    setBusy(true);
    setFailed(null);
    try {
      setResult(await approvalsService.bulkApprove(items.map(i => ({ id: i.id, version: i.version }))));
      onDone();
    } catch (e) {
      setFailed(approvalError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={busy ? () => {} : onClose}
      title={result ? 'Bulk approval finished' : `Approve ${plural(items.length, 'item')}`}
      description={
        result ? undefined : 'Each item is checked again. Items that cannot be approved together are skipped.'
      }
      footer={
        result ? (
          <Button onClick={onClose}>Close</Button>
        ) : (
          <>
            <Button variant="ghost" disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            <Button loading={busy} onClick={() => void run()}>
              Approve {items.length}
            </Button>
          </>
        )
      }
    >
      {failed && <Alert tone="bad">{failed}</Alert>}
      {!result && (
        <ul className="grid gap-1 text-[14px]">
          {items.map(i => (
            <li key={i.id}>{i.title}</li>
          ))}
        </ul>
      )}
      {result && (
        <div className="grid gap-2">
          <p className="text-[14.5px] font-semibold">
            {result.approved} approved, {result.skipped} skipped
          </p>
          <ul className="grid gap-1.5" aria-label="Results" data-testid="bulk-results">
            {result.results.map(r => (
              <li key={r.id} className="text-[14px]">
                <span className={r.ok ? 'text-[#14583a]' : 'text-[#8a1d17]'}>
                  {r.ok ? 'Approved' : 'Skipped'}
                </span>
                {': '}
                {title(r.id)}
                {!r.ok && (
                  <span className="block text-[13px] text-muted">
                    {(r.code && SKIP_TEXT[r.code]) || r.message || 'Not approved.'}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}
