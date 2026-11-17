'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { accountsReportsService } from '@/services/accountsReports.service';
import type { ExportFormat, ReportKey, ReportQuery } from '@/types/accountsReports';
import { periodsError } from '../periods/format';

const FORMATS: { format: ExportFormat; label: string }[] = [
  { format: 'csv', label: 'CSV' },
  { format: 'xlsx', label: 'Excel' },
  { format: 'pdf', label: 'PDF' },
];
type State =
  | { kind: 'idle' }
  | { kind: 'starting' }
  | { kind: 'preparing'; id: string }
  | { kind: 'ready'; url: string }
  | { kind: 'slow' }
  | { kind: 'failed'; message: string };

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Export of the report on screen (spec 8.19, API 66): starts the job, shows "preparing", then a download link. */
export function ExportPanel({
  report,
  params,
  disabled,
  pollMs = 2000,
  maxPolls = 45,
}: {
  report: ReportKey;
  params: ReportQuery;
  disabled?: boolean;
  pollMs?: number;
  maxPolls?: number;
}) {
  const [state, setState] = useState<State>({ kind: 'idle' });
  const preparing = state.kind === 'preparing' ? state.id : null;

  useEffect(() => {
    if (!preparing) return;
    let live = true;
    (async () => {
      for (let i = 0; i < maxPolls && live; i++) {
        await sleep(pollMs);
        if (!live) return;
        try {
          const s = await accountsReportsService.exportStatus(preparing);
          if (!live) return;
          if (s.status === 'READY' && s.downloadUrl) return setState({ kind: 'ready', url: s.downloadUrl });
          if (s.status === 'FAILED')
            return setState({
              kind: 'failed',
              message: s.message ?? 'The file could not be prepared. Try again.',
            });
        } catch {
          /* a failed check is retried on the next round */
        }
      }
      if (live) setState({ kind: 'slow' });
    })();
    return () => {
      live = false;
    };
  }, [preparing, pollMs, maxPolls]);

  const start = async (format: ExportFormat) => {
    setState({ kind: 'starting' });
    try {
      const id = await accountsReportsService.startExport(report, params, format);
      setState(id ? { kind: 'preparing', id } : { kind: 'slow' });
    } catch (e) {
      setState({ kind: 'failed', message: periodsError(e) });
    }
  };
  const busy = state.kind === 'starting' || state.kind === 'preparing';

  return (
    <div className="flex flex-col gap-2" data-testid="export-panel">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Export this report">
        <span className="text-[13px] font-semibold text-muted">Export</span>
        {FORMATS.map(f => (
          <Button
            key={f.format}
            size="xs"
            variant="glass"
            disabled={disabled || busy}
            onClick={() => void start(f.format)}
            aria-label={`Export as ${f.label}`}
          >
            {f.label}
          </Button>
        ))}
      </div>
      {busy && (
        <p role="status" className="flex items-center gap-2 text-[13.5px]">
          <Spinner /> Preparing your file. This can take a minute.
        </p>
      )}
      {state.kind === 'ready' && (
        <p role="status" className="text-[13.5px]">
          Your file is ready.{' '}
          <a className="font-bold underline" href={state.url} download>
            Download your file
          </a>
        </p>
      )}
      {state.kind === 'slow' && (
        <p role="status" className="text-[13.5px] text-muted">
          Your file is taking longer than usual. You will get a notification when it is ready.
        </p>
      )}
      {state.kind === 'failed' && (
        <p role="alert" className="rounded-xl bg-[#f6dcda] px-3 py-2 text-[13.5px] text-[#8a1d17]">
          {state.message}
        </p>
      )}
    </div>
  );
}
