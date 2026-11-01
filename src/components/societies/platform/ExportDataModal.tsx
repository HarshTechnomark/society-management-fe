'use client';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Switch } from '@/components/ui/Switch';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { societiesService } from '@/services/societies.service';
import { societyErrorText } from '../format';

interface Props {
  open: boolean;
  society: { id: number; name: string };
  onClose: () => void;
  onDone: () => void;
}

/** P-08 Export data dialog (prototype `Actions['soc-data-export']`, wording updated per spec 11.4). */
export function ExportDataModal({ open, society, onClose, onDone }: Props) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [docs, setDocs] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [alert, setAlert] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const close = () => {
    setReason('');
    setDocs(true);
    setError(null);
    setAlert(null);
    onClose();
  };

  const submit = async () => {
    const r = reason.trim();
    if (r.length < 10 || r.length > 300) return setError('Enter 10 to 300 characters.');
    setError(null);
    setBusy(true);
    try {
      await societiesService.startPlatformExport(society.id, { reason: r, includeDocuments: docs });
      toast.show('Export started. Society members with export permission are notified when it is ready.');
      close();
      onDone();
    } catch (e) {
      setAlert(societyErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Export all data?"
      description={`A zip of CSVs and documents for ${society.name} will be prepared. Society members with export permission get a download link; platform staff cannot download it.`}
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button loading={busy} onClick={submit}>
            Start export
          </Button>
        </>
      }
    >
      <div aria-live="assertive">{alert && <Alert tone="bad">{alert}</Alert>}</div>
      <Textarea
        label="Reason"
        value={reason}
        onChange={e => setReason(e.target.value)}
        error={error}
        hint="At least 10 characters. Recorded in the audit trail."
        maxLength={300}
        required
      />
      <div className="flex items-center justify-between gap-3">
        <p className="text-[14px] font-semibold">Include documents</p>
        <Switch label="Include documents" checked={docs} onChange={setDocs} />
      </div>
    </Modal>
  );
}
