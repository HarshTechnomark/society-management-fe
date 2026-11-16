'use client';
import { useState } from 'react';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { Gate } from '@/components/setup/Gate';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { inr, shortDate } from '@/lib/money';
import { paymentsOpsService } from '@/services/paymentsOps.service';
import type { Mandate } from '@/types/paymentsOps';
import { ListBody, NoRows, ReasonModal, StatusChip } from '../ops/Bits';
import { MANDATE_STATUS_LABEL, MANDATE_STATUS_TONE, MANDATE_TYPE_LABEL } from '../ops/format';

const P = PERMISSIONS.finance.payments;
const opt = (all: string, map: Record<string, string>) => [
  { value: '', label: all },
  ...Object.entries(map).map(([value, label]) => ({ value, label })),
];
const DEBIT: Record<string, string> = { SUCCESS: 'Debited', FAILED: 'Debit failed', SKIPPED: 'Skipped' };
const live = (s: Mandate['status']) => s === 'PENDING_AUTH' || s === 'ACTIVE' || s === 'PAUSED';

/**
 * Admin AutoPay mandates (spec 8.20). The API answers 402 when the plan or the AutoPay flag is off; the screen then
 * says AutoPay is not available instead of an error.
 */
export function AutopayScreen() {
  return (
    <Gate view={P.view} title="AutoPay">
      <Inner />
    </Gate>
  );
}

function Inner() {
  const canEdit = usePermission(P.edit);
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const [cancelling, setCancelling] = useState<Mandate | null>(null);
  const load = useLoad(
    () =>
      paymentsOpsService.mandates({
        status: status || undefined,
        mandateType: type || undefined,
        page,
        limit: 20,
      }),
    `${status}|${type}|${page}`,
  );
  const filtered = !!(status || type);
  return (
    <Page>
      <PageHead
        title="AutoPay"
        sub="Standing instructions residents set up to pay their bills on the due date."
      />
      <Card>
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <Select
            label="Status"
            value={status}
            onChange={e => {
              setStatus(e.target.value);
              setPage(1);
            }}
            options={opt('All statuses', MANDATE_STATUS_LABEL)}
          />
          <Select
            label="Type"
            value={type}
            onChange={e => {
              setType(e.target.value);
              setPage(1);
            }}
            options={opt('All types', MANDATE_TYPE_LABEL)}
          />
        </div>
        <ListBody
          load={load}
          label="AutoPay mandates"
          page={page}
          onPage={setPage}
          locked={
            <NoRows
              title="AutoPay is not available"
              text="AutoPay is not part of your plan or is switched off for your society."
            />
          }
          empty={
            <NoRows
              title={filtered ? 'No mandates match' : 'No AutoPay mandates yet'}
              text={
                filtered
                  ? 'Change the filters.'
                  : 'Residents start AutoPay from the Pay tab of the resident app.'
              }
            />
          }
        >
          {items =>
            items.map(m => (
              <li
                key={m.id}
                data-testid="mandate-row"
                className="grid grid-cols-2 items-center gap-x-3 gap-y-1 py-3 min-[900px]:grid-cols-[6rem_1fr_8rem_8rem_9rem_8rem]"
              >
                <span className="text-[14.5px] font-bold">{m.unitLabel}</span>
                <span className="text-[14px]">
                  {m.payerName}
                  {m.payerInstrumentMasked && (
                    <span className="text-muted"> ({m.payerInstrumentMasked})</span>
                  )}
                </span>
                <span className="text-[13.5px] text-muted">
                  {MANDATE_TYPE_LABEL[m.mandateType] ?? m.mandateType}
                </span>
                <span className="text-[14px] tabular-nums">Up to {inr(m.maxAmountPaise)}</span>
                <span>
                  <StatusChip tone={MANDATE_STATUS_TONE[m.status] ?? 'neutral'}>
                    {MANDATE_STATUS_LABEL[m.status] ?? m.status}
                  </StatusChip>
                </span>
                <span className="flex items-center justify-between gap-2 text-[13px] text-muted">
                  {m.lastDebitAt
                    ? `${DEBIT[m.lastDebitStatus ?? ''] ?? 'Debit'} ${shortDate(m.lastDebitAt)}`
                    : 'No debit yet'}
                  {canEdit && live(m.status) && (
                    <Button size="xs" variant="danger-soft" onClick={() => setCancelling(m)}>
                      Cancel
                    </Button>
                  )}
                </span>
              </li>
            ))
          }
        </ListBody>
      </Card>
      {cancelling && (
        <ReasonModal
          title={`Cancel AutoPay of ${cancelling.unitLabel}`}
          description={`${cancelling.payerName} will be told and no further debits are made.`}
          confirmLabel="Cancel AutoPay"
          onCancel={() => setCancelling(null)}
          onSubmit={async reason => {
            await paymentsOpsService.cancelMandate(cancelling.id, { reason, version: cancelling.version });
            toast.show('AutoPay was cancelled.');
            setCancelling(null);
            load.reload();
          }}
        />
      )}
    </Page>
  );
}
