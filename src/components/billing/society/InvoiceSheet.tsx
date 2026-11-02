'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { useToast } from '@/components/ui/Toast';
import { ErrorState } from '@/components/common/ErrorState';
import { useLoad } from '@/hooks/useLoad';
import { platformBillingService as svc } from '@/services/platform-billing.service';
import { InvoiceBody } from '../InvoiceBody';
import { billingError, isOpen } from '../format';
import { CertificateModal } from './CertificateModal';
import { PayDialog } from './PayDialog';
import { TdsClaimModal } from './TdsClaimModal';

/** Spec 11.3 invoice detail sheet: lines, GST, settlement, PDF, Pay, Claim TDS and Upload certificate. */
export function InvoiceSheet({
  id,
  title,
  canEdit,
  onClose,
  onChanged,
}: {
  id: number;
  title: string;
  canEdit: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const load = useLoad(() => svc.invoice(id), id);
  const [dlg, setDlg] = useState<'pay' | 'tds' | 'cert' | null>(null);
  const inv = load.data;
  const open = !!inv && inv.documentType === 'INVOICE' && isOpen(inv.status);
  const claim = inv?.payments.find(p => p.kind === 'TDS' && p.status === 'CLAIMED' && !p.hasCertificate);
  const hasTds = !!inv?.payments.some(p => p.kind === 'TDS' && !['REJECTED', 'FAILED'].includes(p.status));
  const done = () => {
    setDlg(null);
    load.reload();
    onChanged();
  };

  const download = async () => {
    try {
      const r = await svc.pdfUrl(id);
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
        title={title}
        size={640}
        footer={
          inv && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="glass" onClick={download} disabled={inv.pdfStatus !== 'READY'}>
                Download PDF
              </Button>
              {canEdit && open && (
                <Button size="sm" onClick={() => setDlg('pay')}>
                  Pay
                </Button>
              )}
              {canEdit && open && !hasTds && (
                <Button size="sm" variant="glass" onClick={() => setDlg('tds')}>
                  Claim TDS
                </Button>
              )}
              {canEdit && claim && (
                <Button size="sm" variant="glass" onClick={() => setDlg('cert')}>
                  Upload certificate
                </Button>
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
          </div>
        ) : (
          <InvoiceBody inv={inv} />
        )}
      </Drawer>
      {inv && dlg === 'pay' && <PayDialog invoice={inv} onClose={() => setDlg(null)} onDone={done} />}
      {inv && dlg === 'tds' && <TdsClaimModal invoice={inv} onClose={() => setDlg(null)} onDone={done} />}
      {claim && dlg === 'cert' && (
        <CertificateModal
          claim={{ id: claim.id, version: claim.version ?? 1 }}
          onClose={() => setDlg(null)}
          onDone={done}
        />
      )}
    </>
  );
}
