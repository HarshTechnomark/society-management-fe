'use client';
import { useState } from 'react';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { Gate } from '@/components/setup/Gate';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { shortDate } from '@/lib/money';
import { residentsService } from '@/services/residents.service';
import type { DocType } from '@/types/residents';
import { Empty, FileField, FormDialog, Loading, StatusChip, useRun } from '../common';
import { VERIFY_LABEL, VERIFY_TONE, docLabel } from '../format';

const TYPES: DocType[] = [
  'AADHAAR',
  'PAN',
  'PASSPORT',
  'DRIVING_LICENCE',
  'VOTER_ID',
  'OTHER_ID',
  'ADDRESS_PROOF',
  'OTHER',
];

/** My documents (spec 11.2): upload an ID (only the last 4 characters show), verification chips, download. */
export function MyDocumentsScreen() {
  return (
    <Gate view={PERMISSIONS.resident.home.view} feature="residents.kyc_vault" title="My documents">
      <Inner />
    </Gate>
  );
}

function Inner() {
  const run = useRun();
  const [adding, setAdding] = useState(false);
  const load = useLoad(() => residentsService.myDocuments(), 'd');
  return (
    <Page>
      <PageHead
        title="My documents"
        sub="Your ID and address proof. Only the committee can check them."
        actions={<Button onClick={() => setAdding(true)}>Upload ID</Button>}
      />
      <Loading load={load} rows={3}>
        {list =>
          list.length === 0 ? (
            <Card>
              <Empty title="No documents yet" text="Upload an ID so the committee can verify you." />
            </Card>
          ) : (
            <ul className="grid gap-3">
              {list.map(d => (
                <li key={d.id}>
                  <Card>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-[16px] font-bold">
                          {d.title ?? docLabel(d.docType)}
                          {d.idLast4 ? ` ····${d.idLast4}` : ''}
                        </p>
                        <p className="text-[13px] text-muted">
                          Uploaded {shortDate(d.uploadedAt)}
                          {d.expiresOn ? ` · expires ${shortDate(d.expiresOn)}` : ''}
                        </p>
                      </div>
                      <StatusChip status={d.verificationStatus} labels={VERIFY_LABEL} tones={VERIFY_TONE} />
                    </div>
                    <Button
                      size="sm"
                      variant="glass"
                      className="mt-3"
                      onClick={() =>
                        void run(async () => {
                          const u = await residentsService.myDocumentUrl(d.id);
                          window.open(u.url, '_blank', 'noopener');
                        })
                      }
                    >
                      Download
                    </Button>
                  </Card>
                </li>
              ))}
            </ul>
          )
        }
      </Loading>
      {adding && (
        <UploadDialog
          onClose={() => setAdding(false)}
          onDone={() => {
            setAdding(false);
            load.reload();
          }}
        />
      )}
    </Page>
  );
}

function UploadDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [type, setType] = useState<DocType>('AADHAAR');
  const [last4, setLast4] = useState('');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<number | null>(null);
  // the API accepts the last 4 characters only on an ID document
  const isIdType = type !== 'ADDRESS_PROOF' && type !== 'OTHER';
  return (
    <FormDialog
      title="Upload a document"
      submitLabel="Upload"
      onClose={onClose}
      onDone={onDone}
      onSubmit={async () => {
        if (!file) return { error: 'Choose a photo or PDF first.' };
        if (type === 'OTHER' && title.trim().length < 2) return { error: 'Add a title for this document.' };
        if (last4 && !/^[0-9A-Za-z]{4}$/.test(last4)) return { error: 'Enter exactly 4 letters or digits.' };
        await residentsService.uploadMyDocument({
          fileId: file,
          docType: type,
          ...(last4 && isIdType ? { idLast4: last4.toUpperCase() } : {}),
          ...(type === 'OTHER' ? { title: title.trim() } : {}),
        });
        return { message: 'Document uploaded' };
      }}
    >
      <Select
        label="Document type"
        value={type}
        onChange={e => setType(e.target.value as DocType)}
        options={TYPES.map(t => ({ value: t, label: docLabel(t) }))}
      />
      {type === 'OTHER' && <Input label="Title" value={title} onChange={e => setTitle(e.target.value)} />}
      {isIdType && (
        <Input
          label="Last 4 characters of the ID number (optional)"
          maxLength={4}
          value={last4}
          onChange={e => setLast4(e.target.value)}
          hint="Only these 4 characters are shown on screen, for example ····1234."
        />
      )}
      <FileField label="Photo or PDF" camera purpose="KYC_DOCUMENT" onChange={setFile} />
    </FormDialog>
  );
}
