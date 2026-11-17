'use client';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { uploadFile } from '@/lib/fileUpload';
import { accountsSettlementsService } from '@/services/accountsSettlements.service';
import type { ImportSettlementResult } from '@/types/accountsSettlements';
import { GATEWAY_PROVIDERS, bankError } from '../statements/format';
import { ImportFilePicker } from '../statements/ImportFilePicker';

export const SETTLEMENT_TEMPLATE_URL = '/templates/settlement-report-template.csv';

/** Import a gateway settlement report: choose a CSV or XLSX file, or paste the rows of the report. */
export function ImportSettlementDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [provider, setProvider] = useState('RAZORPAY');
  const [mode, setMode] = useState<'file' | 'paste'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [fileProblem, setFileProblem] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [result, setResult] = useState<ImportSettlementResult | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setFailed(null);
    let source: File | null = file;
    if (mode === 'paste') {
      if (text.trim().length < 10) return setError('Paste the rows of the report, with its heading row.');
      source = new File([text], 'settlement-report.csv', { type: 'text/csv' });
    } else if (!file) return setError(fileProblem || 'Choose the report file.');
    setError(null);
    setBusy(true);
    try {
      const { fileId } = await uploadFile(source!, 'IMPORT_FILE');
      const r = await accountsSettlementsService.import({ fileId, gatewayProvider: provider });
      setResult(r);
      toast.show(`${r.created} settlements added${r.skipped ? `, ${r.skipped} already there` : ''}.`);
      onDone();
    } catch (e) {
      setFailed(bankError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={busy ? () => {} : onClose}
      title="Import a settlement report"
      description="The report your payment gateway sends with each payout."
      footer={
        result ? (
          <Button onClick={onClose}>Close</Button>
        ) : (
          <>
            <Button variant="ghost" disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            <Button loading={busy} onClick={() => void submit()}>
              Import report
            </Button>
          </>
        )
      }
    >
      {result ? (
        <div className="grid gap-2" data-testid="import-result">
          <Alert tone="ok">
            {result.created} settlements added. {result.skipped} were already there and were skipped.
          </Alert>
          {result.errors.length > 0 && (
            <Alert tone="warn">
              <ul className="list-disc pl-4">
                {result.errors.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </Alert>
          )}
          <p className="text-[13px] text-muted">Matching with your payments runs in the background.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {failed && <Alert tone="bad">{failed}</Alert>}
          <Select
            label="Gateway"
            value={provider}
            onChange={e => setProvider(e.target.value)}
            options={GATEWAY_PROVIDERS}
          />
          <div className="flex gap-2" role="tablist" aria-label="How to add the report">
            {(['file', 'paste'] as const).map(m => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={`rounded-full px-3.5 py-1.5 text-[13.5px] font-semibold ${mode === m ? 'bg-ink text-white' : 'bg-[rgba(20,35,44,0.08)]'}`}
              >
                {m === 'file' ? 'Choose a file' : 'Paste the rows'}
              </button>
            ))}
          </div>
          {mode === 'file' ? (
            <ImportFilePicker
              label="Report file (CSV or XLSX)"
              file={file}
              error={error ?? fileProblem}
              onChange={(f, p) => {
                setFile(f);
                setFileProblem(p ?? '');
                setError(null);
              }}
            />
          ) : (
            <Textarea
              label="Report rows"
              rows={7}
              value={text}
              error={error ?? undefined}
              onChange={e => setText(e.target.value)}
            />
          )}
          <a href={SETTLEMENT_TEMPLATE_URL} download className="text-[13.5px] font-semibold underline">
            Download the CSV template
          </a>
        </div>
      )}
    </Modal>
  );
}
