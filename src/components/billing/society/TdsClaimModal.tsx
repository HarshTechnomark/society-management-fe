'use client';
import { useState } from 'react';
import { platformBillingService as svc } from '@/services/platform-billing.service';
import type { InvoiceDetail } from '@/types/platformBilling';
import { FormModal } from '../FormModal';
import { TdsClaimFields, emptyTds, validateTdsClaim, type TdsDraft } from '../TdsClaim';

/** Society side claim of TDS (spec 11.3): section, amount with its cap, deducted on, certificate. */
export function TdsClaimModal({
  invoice,
  onClose,
  onDone,
}: {
  invoice: InvoiceDetail;
  onClose: () => void;
  onDone: () => void;
}) {
  const [draft, setDraft] = useState<TdsDraft>(emptyTds());
  const [touched, setTouched] = useState(false);
  const v = validateTdsClaim(draft, invoice);
  return (
    <FormModal
      title="Claim TDS"
      description={`TDS you deducted before paying ${invoice.invoiceNo}. The invoice is settled by this amount; we verify the certificate.`}
      submitLabel="Submit claim"
      onClose={onClose}
      onDone={onDone}
      onSubmit={async () => {
        setTouched(true);
        if (!v.input) return { error: 'Fix the highlighted fields.' };
        await svc.claimTds(invoice.id, v.input);
        return { message: 'TDS claim submitted.' };
      }}
    >
      <TdsClaimFields draft={draft} onChange={setDraft} invoice={invoice} errors={touched ? v.errors : {}} />
    </FormModal>
  );
}
