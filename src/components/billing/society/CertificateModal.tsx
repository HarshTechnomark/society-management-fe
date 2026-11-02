'use client';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { fileUploadAvailable } from '@/lib/fileUpload';
import { platformBillingService as svc } from '@/services/platform-billing.service';
import { FileAttach } from '../FileAttach';
import { FormModal } from '../FormModal';

/** Attach the TDS certificate to a claim that is still waiting (8.10). */
export function CertificateModal({
  claim,
  onClose,
  onDone,
}: {
  claim: { id: number; version: number };
  onClose: () => void;
  onDone: () => void;
}) {
  const [file, setFile] = useState<number | null>(null);
  return (
    <FormModal
      title="Upload TDS certificate"
      submitLabel="Attach certificate"
      onClose={onClose}
      onDone={onDone}
      onSubmit={async () => {
        if (!file) return { error: 'Choose the certificate file first.' };
        await svc.attachCertificate(claim.id, { certificateFileId: file, version: claim.version });
        return { message: 'Certificate attached.' };
      }}
    >
      {!fileUploadAvailable() && (
        <Alert tone="info">File upload is not switched on yet. Try again later.</Alert>
      )}
      <FileAttach label="Certificate (PDF or image)" purpose="TDS_CERTIFICATE" onChange={setFile} />
    </FormModal>
  );
}
