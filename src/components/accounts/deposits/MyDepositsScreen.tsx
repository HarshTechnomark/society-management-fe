'use client';
import { useState } from 'react';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { ListBody, NoRows } from '@/components/payments/ops/Bits';
import { Gate } from '@/components/setup/Gate';
import { Chip } from '@/components/ui/Chip';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { inr, shortDate } from '@/lib/money';
import { accountsDepositsService as svc } from '@/services/accountsDeposits.service';
import { KIND_LABEL, STATUS_LABEL, STATUS_TONE } from './format';

/** Resident: the deposits of my flats and where each one stands (spec 8.17 `GET /me/deposits`). */
export function MyDepositsScreen() {
  return (
    <Gate view={PERMISSIONS.resident.dues.view} title="your deposits">
      <Inner />
    </Gate>
  );
}

function Inner() {
  const [page, setPage] = useState(1);
  const load = useLoad(() => svc.mine({ page, limit: 20 }), `p${page}`);
  return (
    <Page>
      <PageHead title="Deposits" sub="Money you gave the society as a deposit, and what happens to it." />
      <Card>
        <ListBody
          load={load}
          label="My deposits"
          page={page}
          onPage={setPage}
          empty={
            <NoRows
              title="No deposits"
              text="Deposits for your flat, such as renovation or move-in, appear here."
            />
          }
        >
          {items =>
            items.map(d => (
              <li key={d.id} data-testid="my-deposit" className="grid gap-1 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[14.5px] font-bold">{d.title || KIND_LABEL[d.kind]}</span>
                  <Chip tone={STATUS_TONE[d.status] ?? 'neutral'}>{STATUS_LABEL[d.status] ?? d.status}</Chip>
                </div>
                <p className="text-[13.5px] text-muted">
                  {d.unitLabel} · {KIND_LABEL[d.kind] ?? d.kind} · {inr(d.amountPaise)}
                  {d.status === 'HELD' && ` · held ${inr(d.heldPaise)}`}
                  {d.status === 'AWAITING_PAYMENT' && d.dueDate && ` · pay by ${shortDate(d.dueDate)}`}
                  {d.refundedPaise > 0 && ` · refunded ${inr(d.refundedPaise)}`}
                </p>
              </li>
            ))
          }
        </ListBody>
      </Card>
    </Page>
  );
}
