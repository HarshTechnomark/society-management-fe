'use client';
import { useState } from 'react';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { Gate } from '@/components/setup/Gate';
import { Select } from '@/components/ui/Select';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { inr, shortDate } from '@/lib/money';
import { paymentsOpsService } from '@/services/paymentsOps.service';
import { ListBody, NoRows, StatusChip } from '../ops/Bits';
import { ORDER_SOURCE_LABEL, ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from '../ops/format';
import { OrderDrawer } from './OrderDrawer';

const P = PERMISSIONS.finance.payments;
const opt = (all: string, map: Record<string, string>) => [
  { value: '', label: all },
  ...Object.entries(map).map(([value, label]) => ({ value, label })),
];

/** Admin payment orders list (spec 8.16): status and source filters; a row opens the order. */
export function OrdersScreen() {
  return (
    <Gate view={P.view} feature="payments.payment_orders" title="Payment orders">
      <Inner />
    </Gate>
  );
}

function Inner() {
  const [status, setStatus] = useState('');
  const [source, setSource] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<number | null>(null);
  const load = useLoad(
    () =>
      paymentsOpsService.orders({
        status: status || undefined,
        sourceType: source || undefined,
        page,
        limit: 20,
      }),
    `${status}|${source}|${page}`,
  );
  const filtered = !!(status || source);
  return (
    <Page>
      <PageHead title="Payment orders" sub="Every online payment attempt, payment link and AutoPay debit." />
      <Card>
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <Select
            label="Status"
            value={status}
            onChange={e => {
              setStatus(e.target.value);
              setPage(1);
            }}
            options={opt('All statuses', ORDER_STATUS_LABEL)}
          />
          <Select
            label="Started from"
            value={source}
            onChange={e => {
              setSource(e.target.value);
              setPage(1);
            }}
            options={opt('All sources', ORDER_SOURCE_LABEL)}
          />
        </div>
        <ListBody
          load={load}
          label="Payment orders"
          page={page}
          onPage={setPage}
          empty={
            <NoRows
              title={filtered ? 'No orders match' : 'No payment orders yet'}
              text={filtered ? 'Change the filters.' : undefined}
            />
          }
        >
          {items =>
            items.map(o => (
              <li key={o.id} data-testid="order-row">
                <button
                  type="button"
                  onClick={() => setOpen(o.id)}
                  aria-label={`Open order PO-${o.id}`}
                  className="grid w-full grid-cols-2 items-center gap-x-3 gap-y-1 py-3 text-left hover:bg-black/[0.03] min-[900px]:grid-cols-[6rem_6rem_9rem_1fr_9rem_8rem]"
                >
                  <span className="text-[14.5px] font-bold">PO-{o.id}</span>
                  <span className="text-[14px]">{o.unitLabel}</span>
                  <span className="text-[13.5px] text-muted">
                    {ORDER_SOURCE_LABEL[o.sourceType] ?? o.sourceType}
                  </span>
                  <span className="text-[14px] font-semibold tabular-nums">{inr(o.grossAmountPaise)}</span>
                  <span>
                    <StatusChip tone={ORDER_STATUS_TONE[o.status] ?? 'neutral'}>
                      {ORDER_STATUS_LABEL[o.status] ?? o.status}
                    </StatusChip>
                  </span>
                  <span className="text-[13px] text-muted">{shortDate(o.createdAt)}</span>
                </button>
              </li>
            ))
          }
        </ListBody>
      </Card>
      {open !== null && <OrderDrawer orderId={open} onClose={() => setOpen(null)} onChanged={load.reload} />}
    </Page>
  );
}
