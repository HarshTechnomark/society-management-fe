'use client';
import { useState } from 'react';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { Gate } from '@/components/setup/Gate';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { inr, shortDate } from '@/lib/money';
import { paymentsOpsService } from '@/services/paymentsOps.service';
import { ListBody, NoRows, StatusChip } from '../ops/Bits';
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from '../ops/format';
import { CreateLinkDialog } from './CreateLinkDialog';

const P = PERMISSIONS.finance.payments;
const PAY_ORIGIN = 'https://my.societyapp.in/pay/';

/** Payment links (spec 8.18): create a link and see the links made so far (payment orders of source PAYMENT_LINK). */
export function LinksScreen() {
  return (
    <Gate view={P.view} feature="payments.payment_links" title="Payment links">
      <Inner />
    </Gate>
  );
}

function Inner() {
  const canCreate = usePermission(P.create);
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const load = useLoad(
    () => paymentsOpsService.orders({ sourceType: 'PAYMENT_LINK', page, limit: 20 }),
    page,
  );
  const copyAddress = async (code: string) => {
    try {
      await navigator.clipboard.writeText(`${PAY_ORIGIN}${code}`);
      toast.show(
        'Address copied. The private part of the link was shown only when it was created.',
        'warning',
      );
    } catch {
      toast.show('Could not copy.', 'warning');
    }
  };
  return (
    <Page>
      <PageHead
        title="Payment links"
        sub="Send a flat a link to pay its dues without signing in."
        actions={canCreate && <Button onClick={() => setCreating(true)}>New payment link</Button>}
      />
      <Card>
        <ListBody
          load={load}
          label="Payment links"
          page={page}
          onPage={setPage}
          empty={
            <NoRows
              title="No payment links yet"
              text={canCreate ? 'Create one to collect a due without a login.' : undefined}
            />
          }
        >
          {items =>
            items.map(o => (
              <li
                key={o.id}
                data-testid="link-row"
                className="grid grid-cols-2 items-center gap-x-3 gap-y-1 py-3 min-[900px]:grid-cols-[6rem_6rem_8rem_9rem_1fr_8rem]"
              >
                <span className="text-[14.5px] font-bold">PO-{o.id}</span>
                <span className="text-[14px]">{o.unitLabel}</span>
                <span className="text-[14px] font-semibold tabular-nums">{inr(o.grossAmountPaise)}</span>
                <span>
                  <StatusChip tone={ORDER_STATUS_TONE[o.status] ?? 'neutral'}>
                    {ORDER_STATUS_LABEL[o.status] ?? o.status}
                  </StatusChip>
                </span>
                <span className="text-[13px] text-muted">
                  {o.status === 'PAID' ? `Paid ${shortDate(o.paidAt)}` : `Expires ${shortDate(o.expiresAt)}`}
                </span>
                <span>
                  {o.linkShortCode && (o.status === 'CREATED' || o.status === 'ATTEMPTED') && (
                    <Button size="xs" variant="glass" onClick={() => void copyAddress(o.linkShortCode!)}>
                      Copy link
                    </Button>
                  )}
                </span>
              </li>
            ))
          }
        </ListBody>
      </Card>
      {creating && <CreateLinkDialog onClose={() => setCreating(false)} onCreated={load.reload} />}
    </Page>
  );
}
