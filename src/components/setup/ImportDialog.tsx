'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button, buttonClasses } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Chip } from '@/components/ui/Chip';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { fileUploadAvailable, uploadFile } from '@/lib/fileUpload';
import { societySetupService } from '@/services/society-setup.service';
import type { CommitPolicy, ImportMode, ImportReport } from '@/types/societySetup';
import { setupError } from './format';

/** Polling fallback of the realtime event `setup.import.updated` (spec 11.7: every 3 s). Tests shorten it. */
export const importPoll = { ms: 3000 };

const MODES = [
  { value: 'CREATE_ONLY', label: 'Create only' },
  { value: 'UPSERT', label: 'Create and update' },
];

const ROW_CODE: Record<string, string> = {
  REQUIRED: 'A required cell is empty',
  INVALID_NUMBER: 'Not a number',
  OUT_OF_RANGE: 'Outside the allowed range',
  INVALID_ENUM: 'Not an allowed value',
  INVALID_DATE: 'Not a valid date',
  UNKNOWN_BUILDING: 'Building not found',
  BUILDING_ARCHIVED: 'Building is archived',
  DUPLICATE_IN_FILE: 'Repeated in the file',
  UNIT_EXISTS: 'Flat already exists',
  FLOOR_OUT_OF_RANGE: 'Floor outside the building',
  AREA_ORDER_INVALID: 'Area order is wrong',
  SHARE_TOTAL_EXCEEDS_100: 'Shares add up to over 100%',
  LIMIT_EXCEEDED: 'Beyond your plan limit',
};

const FAIL: Record<string, string> = {
  IMPORT_STALE: 'The data changed after the check and new errors appeared. Upload the file again.',
  IMPORT_TOO_MANY_ROWS: 'The file has more than 5,000 rows.',
  IMPORT_FILE_INVALID: 'The file could not be read or a column heading is missing.',
};

/**
 * Import units flow (spec 11.7): template, mode, upload, validation progress, report, commit and result.
 * Uses a plain file input; the file goes through the module 01 uploader (purpose IMPORT_FILE).
 */
function ImportDialogInner({
  open,
  onClose,
  onDone,
  defaultMode = 'CREATE_ONLY',
}: {
  open: boolean;
  onClose: () => void;
  onDone?: () => void;
  defaultMode?: ImportMode;
}) {
  const toast = useToast();
  const [mode, setMode] = useState<ImportMode>(defaultMode);
  const [createMissing, setCreateMissing] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [importId, setImportId] = useState<number | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'start' | CommitPolicy | null>(null);
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  });

  const status = report?.status;
  const waiting = importId !== null && (!report || status === 'VALIDATING' || status === 'COMMITTING');
  useEffect(() => {
    if (!open || importId === null || (status && status !== 'VALIDATING' && status !== 'COMMITTING')) return;
    let live = true;
    const poll = async () => {
      try {
        const r = await societySetupService.importStatus(importId, { activity: false });
        if (!live) return;
        setReport(r);
        if (r.status === 'COMMITTED' || r.status === 'COMMITTED_PARTIAL') doneRef.current?.();
      } catch (e) {
        if (live) setError(setupError(e));
      }
    };
    const first = setTimeout(poll, 0);
    const timer = setInterval(poll, importPoll.ms);
    return () => {
      live = false;
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [open, importId, status]);

  const start = async () => {
    if (!file) return;
    setBusy('start');
    setError(null);
    try {
      const { fileId } = await uploadFile(file, 'IMPORT_FILE');
      const r = await societySetupService.startImport(fileId, mode, createMissing);
      setReport(null);
      setImportId(r.importId);
    } catch (e) {
      setError(setupError(e));
    } finally {
      setBusy(null);
    }
  };

  const commit = async (policy: CommitPolicy) => {
    if (importId === null) return;
    setBusy(policy);
    setError(null);
    try {
      await societySetupService.commitImport(importId, policy);
      setReport(r => (r ? { ...r, status: 'COMMITTING' } : r));
    } catch (e) {
      setError(setupError(e));
    } finally {
      setBusy(null);
    }
  };

  const downloadReport = async () => {
    if (!report?.reportFileId) return;
    try {
      const { url } = await societySetupService.fileDownloadUrl(report.reportFileId);
      window.location.assign(url);
    } catch (e) {
      toast.show(setupError(e), 'error');
    }
  };

  const again = () => {
    setImportId(null);
    setReport(null);
    setFile(null);
    setError(null);
  };

  const finished = status === 'COMMITTED' || status === 'COMMITTED_PARTIAL' || status === 'FAILED';
  const counts = report?.counts;
  const writable = counts ? counts.create + counts.update : 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="Import flats"
      description="Upload a CSV or Excel sheet. We check every row first and write nothing until you confirm."
    >
      {error && <Alert tone="bad">{error}</Alert>}

      {importId === null && (
        <div>
          <p className="mb-3 text-[14px]">
            <a className="font-semibold text-navy underline" href="/templates/units-template.csv" download>
              Download template (CSV)
            </a>
            . Keep the heading row. Excel files are accepted too.
          </p>
          <Select
            label="What should the import do?"
            value={mode}
            onChange={e => setMode(e.target.value as ImportMode)}
            options={MODES}
            hint={
              mode === 'CREATE_ONLY'
                ? 'Flats that already exist are reported as errors.'
                : 'Existing flats are updated with the columns in your file; empty cells keep their value.'
            }
          />
          <Checkbox
            label="Create missing towers"
            checked={createMissing}
            onChange={e => setCreateMissing(e.target.checked)}
          />
          <label htmlFor="import-file" className="mb-1.5 block text-[13px] font-semibold">
            File
          </label>
          <input
            id="import-file"
            type="file"
            accept=".csv,.xlsx,text/csv"
            onChange={e => setFile(e.target.files?.[0] ?? null)}
          />
          {!fileUploadAvailable() && (
            <p className="mt-2 text-[12.5px] text-muted">
              File upload is not available yet, so an import cannot start.
            </p>
          )}
          <div className="mt-4 flex justify-end">
            <Button loading={busy === 'start'} disabled={!file || !fileUploadAvailable()} onClick={start}>
              Check file
            </Button>
          </div>
        </div>
      )}

      {waiting && (
        <div role="status" aria-live="polite" className="py-6 text-center">
          <div className="skeleton mx-auto mb-3 h-3 w-48" />
          <p className="text-[14px] font-semibold">
            {status === 'COMMITTING' ? 'Writing flats...' : 'Checking your file...'}
          </p>
          <p className="text-[13px] text-muted">This usually takes a few seconds.</p>
        </div>
      )}

      {report && status === 'VALIDATED' && counts && (
        <section aria-label="Import report">
          <p className="mb-2 text-[13px] text-muted">
            {report.fileName} · {report.totalRows} rows
          </p>
          <div className="mb-3 flex flex-wrap gap-2">
            <Chip tone="ok">Create {counts.create}</Chip>
            <Chip tone="info">Update {counts.update}</Chip>
            <Chip>Unchanged {counts.unchanged}</Chip>
            <Chip tone={counts.error ? 'bad' : 'neutral'}>Errors {counts.error}</Chip>
          </div>
          {report.errorsPreview.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-left text-[13px]">
                  <caption className="sr-only">First errors</caption>
                  <thead className="text-[12px] uppercase text-muted">
                    <tr>
                      <th className="p-1.5">Row</th>
                      <th className="p-1.5">Column</th>
                      <th className="p-1.5">Value</th>
                      <th className="p-1.5">Problem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.errorsPreview.slice(0, 50).map((x, i) => (
                      <tr key={i} className="border-t border-[var(--line)]">
                        <td className="p-1.5 font-semibold">{x.row}</td>
                        <td className="p-1.5">{x.column}</td>
                        <td className="p-1.5">{x.value}</td>
                        <td className="p-1.5">{x.message || ROW_CODE[x.code] || x.code}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {counts.error > report.errorsPreview.length && (
                <p className="mt-1 text-[12.5px] text-muted">
                  Showing the first {report.errorsPreview.length} of {counts.error} errors. Download the error
                  file for all of them.
                </p>
              )}
            </>
          )}
          {report.reportFileId && (
            <div className="mt-3">
              <Button size="sm" variant="glass" onClick={downloadReport}>
                Download error file
              </Button>
            </div>
          )}
          {writable === 0 && (
            <Alert tone="warn" className="mt-3">
              There is nothing to write: no new or changed rows.
            </Alert>
          )}
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={again}>
              Choose another file
            </Button>
            <Button
              variant="glass"
              loading={busy === 'VALID_ROWS_ONLY'}
              disabled={writable === 0}
              onClick={() => commit('VALID_ROWS_ONLY')}
            >
              Import valid rows only
            </Button>
            <Button
              loading={busy === 'ALL_OR_NOTHING'}
              disabled={writable === 0 || counts.error > 0}
              onClick={() => commit('ALL_OR_NOTHING')}
            >
              Import all (needs zero errors)
            </Button>
          </div>
        </section>
      )}

      {report && finished && (
        <div>
          {status === 'FAILED' ? (
            <Alert tone="bad">
              The import failed. {FAIL[report.result?.failureCode ?? ''] ?? 'Nothing was written.'}
            </Alert>
          ) : (
            <Alert tone="ok">
              {report.result?.written ?? 0} flats written, {report.result?.skipped ?? 0} skipped.
            </Alert>
          )}
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={again}>
              Import another file
            </Button>
            <Link href="/admin/units" className={buttonClasses('primary', 'md')} onClick={onClose}>
              Go to flats
            </Link>
          </div>
        </div>
      )}
    </Modal>
  );
}

/** The dialog mounts only while open, so every opening starts clean. */
export function ImportDialog(props: {
  open: boolean;
  onClose: () => void;
  onDone?: () => void;
  defaultMode?: ImportMode;
}) {
  return props.open ? <ImportDialogInner {...props} /> : null;
}
