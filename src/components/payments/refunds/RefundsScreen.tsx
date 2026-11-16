'use client';
import { useState } from 'react';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { Gate } from '@/components/setup/Gate';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { inr, shortDate } from '@/lib/money';
import { paymentsOpsService } from '@/services/paymentsOps.service';
import type { Refund } from '@/types/paymentsOps';
import { ListBody, NoRows, StatusChip } from '../ops/Bits';
import { REFUND_MODE_LABEL, REFUND_STATUS_LABEL, REFUND_STATUS_TONE } from '../ops/format';
import { CompleteRefundDialog } from './CompleteRefundDialog';
import { RequestRefundDialog } from './RequestRefundDialog';

const P = PERMISSIONS.finance.payments;
const FEATURE = 'payments.refunds_and_reversals';
const opt = (all: string, map: Record<string, string>) => [
  { value: '', label: all },
  ...Object.entries(map).map(([value, label]) => ({ value, label })),
];

/** Admin refunds list (spec 8.19, 11.1): status and mode filters, request a refund, record an offline payout. */
export function RefundsScreen() {
  return (
    <Gate view={P.view} feature={FEATURE} title="Refunds">
      <Inner />
    </Gate>
  );
}

function Inner() {
  const canCreate = usePermission(P.create);
  const canEdit = usePermission(P.edit);
  const [status, setStatus] = useState('');
  const [mode, setMode] = useState('');
  const [page, setPage] = useState(1);
  const [asking, setAsking] = useState(false);
  const [paying, setPaying] = useState<Refund | null>(null);
  const load = useLoad(
    () =>
      paymentsOpsService.refunds({ status: status || undefined, mode: mode || undefined, page, limit: 20 }),
    `${status}|${mode}|${page}`,
  );
  const filtered = !!(status || mode);

  return (
    <Page>
      <PageHead
        title="Refunds"
        sub="Money paid back to residents. A different committee member approves each refund."
        actions={canCreate && <Button onClick={() => setAsking(true)}>Request a refund</Button>}
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
            options={opt('All statuses', REFUND_STATUS_LABEL)}
          />
          <Select
            label="Mode"
            value={mode}
            onChange={e => {
              setMode(e.target.value);
              setPage(1);
            }}
            options={opt('All modes', REFUND_MODE_LABEL)}
          />
        </div>
        <ListBody
          load={load}
          label="Refunds"
          page={page}
          onPage={setPage}
          empty={
            <NoRows
              title={filtered ? 'No refunds match' : 'No refunds yet'}
              text={filtered ? 'Change the filters.' : 'Refunds you request appear here.'}
            />
          }
        >
          {items =>
            items.map(r => (
              <li
                key={r.id}
                data-testid="refund-row"
                className="grid gap-x-3 gap-y-1 py-3 min-[900px]:grid-cols-[9rem_6rem_1fr_9rem_8rem_9rem] min-[900px]:items-center"
              >
                <span className="text-[14.5px] font-bold">{r.refundNo ?? `Request ${r.id}`}</span>
                <span className="text-[14px]">{r.unitLabel}</span>
                <span className="text-[13.5px] text-muted">
                  {r.receiptNo ? `For ${r.receiptNo}. ` : ''}
                  {REFUND_MODE_LABEL[r.mode] ?? r.mode}
                  {r.payeeName ? ` to ${r.payeeName}` : ''}
                </span>
                <span className="text-[14px] font-semibold tabular-nums">{inr(r.amountPaise)}</span>
                <span>
                  <StatusChip tone={REFUND_STATUS_TONE[r.status] ?? 'neutral'}>
                    {REFUND_STATUS_LABEL[r.status] ?? r.status}
                  </StatusChip>
                </span>
                <span className="flex items-center justify-between gap-2 text-[13px] text-muted">
                  {shortDate(r.createdAt)}
                  {canEdit && r.status === 'PROCESSING' && r.mode !== 'GATEWAY' && (
                    <Button size="xs" variant="glass" onClick={() => setPaying(r)}>
                      Record payout
                    </Button>
                  )}
                </span>
              </li>
            ))
          }
        </ListBody>
      </Card>
      {asking && <RequestRefundDialog onClose={() => setAsking(false)} onDone={load.reload} />}
      {paying && (
        <CompleteRefundDialog
          refund={paying}
          onClose={() => setPaying(null)}
          onDone={() => {
            setPaying(null);
            load.reload();
          }}
        />
      )}
    </Page>
  );
}
