'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { useLoad } from '@/hooks/useLoad';
import { uploadFile } from '@/lib/fileUpload';
import { accountsStatementsService } from '@/services/accountsStatements.service';
import { bankError, isNotFound } from './format';
import { ImportFilePicker } from './ImportFilePicker';

export const STATEMENT_TEMPLATE_URL = '/templates/bank-statement-template.csv';

/** Upload a bank statement (CSV, 20 MB, 5,000 rows). The bank account comes from a list, or is typed when the list is not available. */
export function UploadStatementDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const router = useRouter();
  const accounts = useLoad(
    () => accountsStatementsService.bankAccounts().catch(e => (isNotFound(e) ? null : Promise.reject(e))),
    'banks',
  );
  const [account, setAccount] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const typed = accounts.data === null && !accounts.loading;

  const submit = async () => {
    const e: Record<string, string> = {};
    const id = Number(account);
    if (!Number.isInteger(id) || id <= 0) e.account = 'Choose the bank account of this statement.';
    if (!file) e.file = 'Choose the statement file.';
    else if (errors.file) e.file = errors.file;
    setErrors(e);
    setFailed(null);
    if (Object.keys(e).length || !file) return;
    setBusy(true);
    try {
      const { fileId } = await uploadFile(file, 'IMPORT_FILE');
      const imp = await accountsStatementsService.import({ bankAccountId: id, fileId });
      toast.show('Statement uploaded. We are reading it now.');
      onDone();
      if (imp.id > 0) router.push(`/admin/accounts/bank/statements/${imp.id}`);
    } catch (err) {
      setFailed(bankError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={busy ? () => {} : onClose}
      title="Upload a bank statement"
      description="A CSV file from your bank, up to 20 MB and 5,000 rows."
      footer={
        <>
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={() => void submit()}>
            Upload statement
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        {failed && <Alert tone="bad">{failed}</Alert>}
        {typed ? (
          <Input
            label="Bank account number (ID)"
            inputMode="numeric"
            value={account}
            error={errors.account}
            onChange={e => setAccount(e.target.value)}
            required
          />
        ) : (
          <Select
            label="Bank account"
            value={account}
            error={errors.account}
            onChange={e => setAccount(e.target.value)}
            options={[
              { value: '', label: accounts.loading ? 'Loading...' : 'Choose an account' },
              ...(accounts.data ?? []).map(a => ({ value: String(a.id), label: a.label })),
            ]}
            required
          />
        )}
        <ImportFilePicker
          label="Statement file"
          file={file}
          error={errors.file}
          onChange={(f, problem) => {
            setFile(f);
            setErrors(x => ({ ...x, file: problem ?? '' }));
          }}
        />
        <a href={STATEMENT_TEMPLATE_URL} download className="text-[13.5px] font-semibold underline">
          Download the CSV template
        </a>
      </div>
    </Modal>
  );
}
