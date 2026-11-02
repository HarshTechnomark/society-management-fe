'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { useToast } from '@/components/ui/Toast';
import { ErrorState } from '@/components/common/ErrorState';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { platformBillingService as svc } from '@/services/platform-billing.service';
import type { InvoiceListItem } from '@/types/platformBilling';
import { InvoiceBody } from '../InvoiceBody';
import { billingError, isOpen } from '../format';
import {
  ApproveDialog,
  CreditNoteModal,
  ExtendGraceModal,
  ReasonDialog,
  RecordPaymentModal,
  RecordTdsModal,
  RemindModal,
} from './dialogs';

type Dlg =
  'pay' | 'remind' | 'grace' | 'cn' | 'tds' | 'writeoff' | 'approve' | 'reject' | 'woApprove' | 'woReject';

/** Spec 11.1 invoice drawer: the invoice, its payments, credit notes and dunning timeline, with the actions. */
export function InvoiceDrawer({
  summary,
  onClose,
  onChanged,
}: {
  summary: InvoiceListItem;
  onClose: () => void;
  onChanged: () => void;
}) {
  const canEdit = usePermission(PERMISSIONS.platform.billing.edit);
  const canApprove = usePermission(PERMISSIONS.platform.billing.approve);
  const toast = useToast();
  const load = useLoad(() => svc.platformInvoice(summary.id), summary.id);
  const [dlg, setDlg] = useState<Dlg | null>(null);
  const inv = load.data;
  const done = () => {
    setDlg(null);
    load.reload();
    onChanged();
  };
  const close = () => setDlg(null);
  const open = !!inv && inv.documentType === 'INVOICE' && isOpen(inv.status);
  const draft = inv?.status === 'DRAFT';
  const writeOffPending = !!inv?.writeOff?.reason;
  const canCredit =
    !!inv &&
    inv.documentType === 'INVOICE' &&
    !['DRAFT', 'REJECTED', 'VOID', 'WRITTEN_OFF'].includes(inv.status);

  const download = async () => {
    try {
      const r = await svc.platformPdfUrl(summary.id);
      window.open(r.url, '_blank', 'noopener');
    } catch (e) {
      toast.show(billingError(e), 'error');
    }
  };

  return (
    <>
      <Drawer
        open
        onClose={onClose}
        size={640}
        title={summary.invoiceNo ?? 'Draft invoice'}
        description={summary.societyName}
        footer={
          inv && (
            <div className="flex flex-wrap gap-2">
              {!draft && (
                <Button size="sm" variant="glass" onClick={download} disabled={inv.pdfStatus !== 'READY'}>
                  Download
                </Button>
              )}
              {canEdit && open && (
                <>
                  <Button size="sm" variant="glass" onClick={() => setDlg('remind')}>
                    Send reminder
                  </Button>
                  <Button size="sm" onClick={() => setDlg('pay')}>
                    Record payment
                  </Button>
                  <Button size="sm" variant="glass" onClick={() => setDlg('grace')}>
                    Extend grace
                  </Button>
                  <Button size="sm" variant="glass" onClick={() => setDlg('tds')}>
                    Record TDS
                  </Button>
                </>
              )}
              {canEdit && canCredit && (
                <Button size="sm" variant="glass" onClick={() => setDlg('cn')}>
                  Issue credit note
                </Button>
              )}
              {canEdit && open && !writeOffPending && (
                <Button size="sm" variant="danger-soft" onClick={() => setDlg('writeoff')}>
                  Write off
                </Button>
              )}
              {canApprove && writeOffPending && (
                <>
                  <Button size="sm" onClick={() => setDlg('woApprove')}>
                    Approve write-off
                  </Button>
                  <Button size="sm" variant="danger-soft" onClick={() => setDlg('woReject')}>
                    Reject write-off
                  </Button>
                </>
              )}
              {canApprove && draft && (
                <>
                  <Button size="sm" onClick={() => setDlg('approve')}>
                    Approve
                  </Button>
                  <Button size="sm" variant="danger-soft" onClick={() => setDlg('reject')}>
                    Reject
                  </Button>
                </>
              )}
            </div>
          )
        }
      >
        {load.error ? (
          <ErrorState
            error={load.error}
            action={
              <Button size="sm" onClick={load.reload}>
                Try again
              </Button>
            }
          />
        ) : !inv ? (
          <div className="flex flex-col gap-3" data-testid="invoice-loading">
            <div className="skeleton h-6 w-1/2" />
            <div className="skeleton h-32" />
            <div className="skeleton h-24" />
          </div>
        ) : (
          <InvoiceBody inv={inv} platform />
        )}
      </Drawer>
      {inv && dlg === 'pay' && (
        <RecordPaymentModal
          invoice={{ ...summary, ...inv, societyId: summary.societyId }}
          onClose={close}
          onDone={done}
        />
      )}
      {inv && dlg === 'remind' && (
        <RemindModal invoice={{ ...summary, invoiceNo: inv.invoiceNo }} onClose={close} onDone={done} />
      )}
      {inv && dlg === 'grace' && <ExtendGraceModal invoice={inv} onClose={close} onDone={done} />}
      {inv && dlg === 'cn' && <CreditNoteModal invoice={inv} onClose={close} onDone={done} />}
      {inv && dlg === 'tds' && <RecordTdsModal invoice={inv} onClose={close} onDone={done} />}
      {inv && dlg === 'writeoff' && (
        <ReasonDialog
          title="Request write-off"
          description={`Writes off the amount due on ${inv.invoiceNo}. Another person has to approve it.`}
          confirmLabel="Request write-off"
          run={reason => svc.requestWriteOff(inv.id, { reason, version: inv.version })}
          success="Write-off sent for approval."
          onClose={close}
          onDone={done}
        />
      )}
      {inv && dlg === 'woApprove' && (
        <ApproveDialog
          title="Approve write-off"
          description={`The amount due on ${inv.invoiceNo} will be written off.`}
          run={() => svc.approveWriteOff(inv.id, inv.version)}
          success="Write-off approved."
          onClose={close}
          onDone={done}
        />
      )}
      {inv && dlg === 'woReject' && (
        <ReasonDialog
          title="Reject write-off"
          confirmLabel="Reject"
          run={reason => svc.rejectWriteOff(inv.id, inv.version, reason)}
          success="Write-off rejected."
          onClose={close}
          onDone={done}
        />
      )}
      {inv && dlg === 'approve' && (
        <ApproveDialog
          title={inv.documentType === 'CREDIT_NOTE' ? 'Approve credit note' : 'Approve invoice'}
          description="It is numbered and issued to the society."
          run={() => svc.approveInvoice(inv.id, inv.version)}
          success="Issued."
          onClose={close}
          onDone={done}
        />
      )}
      {inv && dlg === 'reject' && (
        <ReasonDialog
          title="Reject draft"
          confirmLabel="Reject"
          run={reason => svc.rejectInvoice(inv.id, inv.version, reason)}
          success="Draft rejected."
          onClose={close}
          onDone={done}
        />
      )}
    </>
  );
}
