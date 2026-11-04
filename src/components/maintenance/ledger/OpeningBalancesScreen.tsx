'use client';
import { useState } from 'react';
import { DataTable, type Column } from '@/components/common/DataTable';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { ConfirmReason } from '@/components/common/ConfirmReason';
import { ConfirmDialog } from '@/components/setup/ConfirmDialog';
import { Gate } from '@/components/setup/Gate';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { fileUploadAvailable, uploadFile } from '@/lib/fileUpload';
import { inr, shortDate } from '@/lib/money';
import { ledgerService } from '@/services/ledger.service';
import type { OpeningBalanceRow, OpeningStatus } from '@/types/ledger';
import { OPENING_LABEL, OPENING_TONE, isoDate, ledgerError, rupeesToPaise } from './format';

const B = PERMISSIONS.finance.billing;
const FILTERS: { key: OpeningStatus | 'ALL'; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'DRAFT', label: 'Draft' },
  { key: 'INVALID', label: 'Invalid' },
  { key: 'POSTED', label: 'Posted' },
  { key: 'REVERSED', label: 'Reversed' },
];

/** Settings > Billing > Opening balances (spec 11.6). */
export function OpeningBalancesScreen() {
  return (
    <Gate view={B.view} feature="billing.opening_balances" title="Opening balances">
      <Inner />
    </Gate>
  );
}

function Inner() {
  const canImport = usePermission(B.import);
  const toast = useToast();
  const [filter, setFilter] = useState<OpeningStatus | 'ALL'>('ALL');
  const [file, setFile] = useState<File | null>(null);
  const [asOf, setAsOf] = useState(isoDate(new Date()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [reverse, setReverse] = useState<OpeningBalanceRow | null>(null);
  const [remove, setRemove] = useState<OpeningBalanceRow | null>(null);
  const load = useLoad(
    () => ledgerService.openingBalances({ status: filter === 'ALL' ? undefined : filter, limit: 1000 }),
    filter,
  );
  const totals = load.data?.totals;
  const draftNet = totals ? totals.draftArrearsPaise - totals.draftAdvancePaise : 0;
  const hasDraft = !!totals && (totals.draftArrearsPaise > 0 || totals.draftAdvancePaise > 0);

  const check = async () => {
    if (!file) return;
    if (asOf > isoDate(new Date())) return setError('The as-of date cannot be in the future.');
    setBusy(true);
    setError(null);
    setSummary(null);
    try {
      const { fileId } = await uploadFile(file, 'IMPORT_FILE');
      const r = await ledgerService.importOpening(fileId, asOf);
      setSummary(`${r.draftCount} valid rows and ${r.invalidCount} rows with errors. Nothing is posted yet.`);
      setFile(null);
      setFilter('ALL');
      load.reload();
    } catch (e) {
      setError(ledgerError(e));
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<OpeningBalanceRow>[] = [
    { key: 'row', label: 'Row', render: r => r.rowNo, sortValue: r => r.rowNo },
    { key: 'flat', label: 'Flat', render: r => <strong>{r.unitLabel}</strong>, sortValue: r => r.unitLabel },
    {
      key: 'principal',
      label: 'Arrears principal',
      className: 'text-right',
      render: r => inr(r.arrearsPrincipalPaise),
    },
    {
      key: 'interest',
      label: 'Arrears interest',
      className: 'text-right',
      render: r => inr(r.arrearsInterestPaise),
    },
    { key: 'advance', label: 'Advance', className: 'text-right', render: r => inr(r.advancePaise) },
    {
      key: 'status',
      label: 'Status',
      render: r => <Chip tone={OPENING_TONE[r.status]}>{OPENING_LABEL[r.status]}</Chip>,
    },
    {
      key: 'error',
      label: 'Error',
      render: r => (r.validationError ? <span className="text-[#8a1d17]">{r.validationError}</span> : null),
    },
    {
      key: 'actions',
      label: 'Actions',
      hideLabel: true,
      render: r => {
        if (!canImport) return null;
        if (r.status === 'DRAFT' || r.status === 'INVALID')
          return (
            <Button
              size="xs"
              variant="ghost"
              aria-label={`Delete row ${r.rowNo}`}
              onClick={() => setRemove(r)}
            >
              Delete
            </Button>
          );
        if (r.status === 'POSTED')
          return r.advancePaise > 0 ? (
            <span className="text-[12px] text-muted">Advance, cannot be reversed</span>
          ) : (
            <Button
              size="xs"
              variant="danger-soft"
              aria-label={`Reverse ${r.unitLabel}`}
              onClick={() => setReverse(r)}
            >
              Reverse
            </Button>
          );
        return null;
      },
    },
  ];

  return (
    <Page>
      <PageHead
        title="Opening balances"
        sub="Load each flat's old dues or advance once, when you go live. Check the file first; nothing is posted until you confirm."
        actions={
          canImport && (
            <Button disabled={!hasDraft || (totals?.invalidCount ?? 0) > 0} onClick={() => setPosting(true)}>
              Post opening balances
            </Button>
          )
        }
      />

      {canImport && (
        <Card
          title="Upload"
          sub="CSV or Excel with the columns unit, arrears_principal, arrears_interest, advance."
        >
          <p className="mb-3 text-[14px]">
            <a
              className="font-semibold text-navy underline"
              href="/templates/opening-balances-template.csv"
              download
            >
              Download template (CSV)
            </a>
            . Amounts are in rupees. A flat has arrears or an advance, not both.
          </p>
          <div className="grid items-end gap-x-3 min-[640px]:grid-cols-2">
            <div>
              <label htmlFor="ob-file" className="mb-1.5 block text-[13px] font-semibold">
                File
              </label>
              <input
                id="ob-file"
                type="file"
                accept=".csv,.xlsx,text/csv"
                onChange={e => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <Input
              label="Balances as of"
              type="date"
              max={isoDate(new Date())}
              value={asOf}
              onChange={e => setAsOf(e.target.value)}
              hint="Once billing has started this must be the day before the billing start."
            />
          </div>
          {!fileUploadAvailable() && (
            <p className="mb-2 text-[12.5px] text-muted">
              File upload is not available yet, so a check cannot start.
            </p>
          )}
          {error && <Alert tone="bad">{error}</Alert>}
          {summary && <Alert tone="ok">{summary}</Alert>}
          <div className="mt-3 flex justify-end">
            <Button loading={busy} disabled={!file || !fileUploadAvailable()} onClick={check}>
              Check file
            </Button>
          </div>
        </Card>
      )}

      <Card className="mt-4" title="What posting does">
        <ul className="list-disc space-y-1 pl-5 text-[14px]">
          <li>
            Each flat with arrears gets one arrears invoice numbered <strong>OB/&lt;flat&gt;</strong> and one
            ledger entry, so it shows on the flat&apos;s statement and in dues.
          </li>
          <li>
            Each flat with an advance is credited with that advance, which is adjusted against its next bills.
          </li>
          <li>
            A posted arrears row can be reversed while nothing is paid on it. A posted advance cannot be
            reversed.
          </li>
        </ul>
      </Card>

      {totals && (
        <div className="mt-4 flex flex-wrap gap-2" aria-label="Totals">
          <Chip tone="info">Draft arrears {inr(totals.draftArrearsPaise)}</Chip>
          <Chip tone="info">Draft advances {inr(totals.draftAdvancePaise)}</Chip>
          <Chip tone={totals.invalidCount ? 'bad' : 'neutral'}>Rows with errors {totals.invalidCount}</Chip>
          <Chip tone={totals.postedCount ? 'ok' : 'neutral'}>Posted {totals.postedCount}</Chip>
        </div>
      )}
      {totals && totals.invalidCount > 0 && (
        <Alert tone="warn" className="mt-3">
          {totals.invalidCount} rows have errors. Posting is blocked until you delete them or upload a
          corrected file.
        </Alert>
      )}

      <Card className="mt-4">
        <div role="group" aria-label="Filter by status" className="mb-3 flex flex-wrap gap-1.5">
          {FILTERS.map(f => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${
                filter === f.key ? 'bg-navy text-[#FDF8EE]' : 'bg-white/60 text-ink-2 hover:bg-white/90'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <DataTable
          caption="Opening balances"
          columns={columns}
          rows={load.data?.items ?? []}
          rowKey={r => r.id}
          loading={load.loading}
          error={load.error}
          onRetry={load.reload}
          pageSize={25}
          empty={{ title: 'No opening balances yet', text: 'Upload a file to start.' }}
        />
      </Card>

      {posting && totals && (
        <PostDialog
          arrears={totals.draftArrearsPaise}
          advance={totals.draftAdvancePaise}
          net={draftNet}
          asOf={load.data?.items.find(r => r.status === 'DRAFT')?.asOfDate}
          onClose={() => setPosting(false)}
          onDone={n => {
            setPosting(false);
            toast.show(`${n} opening balances posted`);
            load.reload();
          }}
        />
      )}

      <ConfirmReason
        open={!!reverse}
        title={`Reverse the opening balance of ${reverse?.unitLabel ?? ''}?`}
        description="The arrears invoice is closed with a credit note and the ledger is corrected."
        confirmLabel="Reverse"
        minLength={10}
        onCancel={() => setReverse(null)}
        onConfirm={async reason => {
          try {
            await ledgerService.reverseOpening(reverse!.id, reason, reverse!.version);
            toast.show('Opening balance reversed');
            setReverse(null);
            load.reload();
          } catch (e) {
            toast.show(ledgerError(e), 'error');
          }
        }}
      />
      <ConfirmDialog
        open={!!remove}
        title={`Delete row ${remove?.rowNo ?? ''}?`}
        description="The row is removed from the draft. Upload a corrected file to replace all draft rows."
        confirmLabel="Delete"
        onCancel={() => setRemove(null)}
        onConfirm={async () => {
          try {
            await ledgerService.deleteOpening(remove!.id, remove!.version);
            toast.show('Row deleted');
            setRemove(null);
            load.reload();
          } catch (e) {
            toast.show(ledgerError(e), 'error');
          }
        }}
      />
    </Page>
  );
}

/** Asks the person to type the net total (arrears minus advances) before posting. */
function PostDialog({
  arrears,
  advance,
  net,
  asOf,
  onClose,
  onDone,
}: {
  arrears: number;
  advance: number;
  net: number;
  asOf?: string;
  onClose: () => void;
  onDone: (posted: number) => void;
}) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const match = rupeesToPaise(typed) === net;
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await ledgerService.postOpening(net);
      onDone(r.posted);
    } catch (e) {
      setError(ledgerError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="Post opening balances"
      description={`This creates arrears invoices and advances for every draft row${asOf ? ` as of ${shortDate(asOf)}` : ''}. It needs you to confirm it is you.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} disabled={!match} onClick={submit}>
            Post
          </Button>
        </>
      }
    >
      <p className="mb-3 text-[14px]">
        Arrears {inr(arrears)} minus advances {inr(advance)} is <strong>{inr(net)}</strong>. Type this total
        in rupees to confirm.
      </p>
      {error && <Alert tone="bad">{error}</Alert>}
      <Input
        label="Total in rupees"
        inputMode="decimal"
        value={typed}
        onChange={e => setTyped(e.target.value)}
        error={typed && !match ? 'This does not match the total above.' : null}
      />
    </Modal>
  );
}
