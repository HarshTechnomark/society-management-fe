'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { ErrorState } from '@/components/common/ErrorState';
import { Gate } from '@/components/setup/Gate';
import { StatusChip } from '@/components/payments/ops/Bits';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { PERMISSIONS } from '@/constants/permissions';
import { useFeature } from '@/hooks/useFeature';
import { useIsPhone } from '@/hooks/useMediaQuery';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { inr, shortDate } from '@/lib/money';
import { accountsStatementsService } from '@/services/accountsStatements.service';
import type { LineMatchStatus, StatementLine } from '@/types/accountsStatements';
import { CandidatePane } from './CandidatePane';
import {
  LINE_STATUS_LABEL,
  LINE_STATUS_TONE,
  STATEMENT_STATUS_LABEL,
  STATEMENT_STATUS_TONE,
  bankError,
  plainError,
} from './format';
import { CreateEntryDialog, IgnoreDialog, lineAmount, lineIsCredit } from './LineActions';
import { UploadStatementDialog } from './UploadStatementDialog';

const P = PERMISSIONS.finance.bank;
const FILTERS: { value: LineMatchStatus | ''; label: string }[] = [
  { value: 'UNMATCHED', label: 'Unmatched' },
  { value: 'MATCHED', label: 'Matched' },
  { value: 'IGNORED', label: 'Ignored' },
  { value: '', label: 'All' },
];

/** Two-pane reconciliation of one statement (spec 11.4): statement lines on the left, book entries on the right. */
export function ReconciliationScreen({ id }: { id: number }) {
  return (
    <Gate view={P.view} feature="payments.bank_statement_import" title="Bank reconciliation">
      <Inner id={id} />
    </Gate>
  );
}

function Inner({ id }: { id: number }) {
  const toast = useToast();
  const canImport = usePermission(P.import);
  const canApprove = usePermission(P.approve);
  const premium = useFeature('accounting.bank_reconciliation');
  const phone = useIsPhone();
  const [filter, setFilter] = useState<LineMatchStatus | ''>('UNMATCHED');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<number | null>(null);
  const [dialog, setDialog] = useState<'create' | 'ignore' | 'reupload' | null>(null);
  const [busy, setBusy] = useState<'auto' | 'sign' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const imp = useLoad(() => accountsStatementsService.get(id), `imp-${id}`);
  const status = imp.data?.status;
  const reload = imp.reload;
  const parsed = status === 'PARSED' || status === 'RECONCILED';
  const lines = useLoad(
    () =>
      parsed
        ? accountsStatementsService.lines(id, { matchStatus: filter, page, limit: 50 })
        : Promise.resolve(null),
    `${id}|${parsed}|${filter}|${page}`,
  );
  // While the file is being read, ask again every few seconds (without bumping the idle timer).
  useEffect(() => {
    if (status !== 'UPLOADED') return;
    const t = setInterval(() => {
      accountsStatementsService.get(id, true).then(
        r => {
          if (r.status !== 'UPLOADED') reload();
        },
        () => {},
      );
    }, 4000);
    return () => clearInterval(t);
  }, [status, id, reload]);

  const reloadAll = () => {
    imp.reload();
    lines.reload();
  };

  if (imp.error != null)
    return (
      <Page>
        <ErrorState
          error={plainError(imp.error)}
          action={
            <Button size="sm" onClick={imp.reload}>
              Try again
            </Button>
          }
          notFoundAction={
            <Link href="/admin/accounts/bank/statements" className="font-semibold underline">
              Back to statements
            </Link>
          }
        />
      </Page>
    );
  if (!imp.data)
    return (
      <Page>
        <div className="skeleton h-40 w-full" aria-busy="true" data-testid="skeleton-row" />
      </Page>
    );
  const s = imp.data;
  const reconciled = s.status === 'RECONCILED';
  const items = lines.data?.items ?? [];
  const current = items.find(l => l.id === selected) ?? null;
  const pct = s.lineCount > 0 ? Math.round((s.matchedCount / s.lineCount) * 100) : 0;
  const total = lines.data?.pagination.totalPages ?? 1;

  const autoMatch = async () => {
    setBusy('auto');
    setError(null);
    try {
      const r = await accountsStatementsService.autoMatch(id);
      toast.show(r.matched > 0 ? `${r.matched} lines matched.` : 'No new matches found.');
      reloadAll();
    } catch (e) {
      setError(bankError(e));
    } finally {
      setBusy(null);
    }
  };
  const sign = async () => {
    setBusy('sign');
    setError(null);
    try {
      await accountsStatementsService.markReconciled(id, s.version);
      toast.show('Statement marked as reconciled.');
      reloadAll();
    } catch (e) {
      setError(bankError(e));
    } finally {
      setBusy(null);
    }
  };

  const pane = current && (
    <CandidatePane
      key={`${current.id}-${current.version}`}
      line={current}
      canWrite={canImport}
      locked={reconciled}
      onChanged={() => {
        setSelected(null);
        reloadAll();
      }}
      onCreate={() => setDialog('create')}
      onIgnore={() => setDialog('ignore')}
    />
  );

  return (
    <Page>
      <PageHead
        title={s.bankAccountLabel ? `Reconcile ${s.bankAccountLabel}` : 'Bank reconciliation'}
        sub={
          s.periodFrom
            ? `Statement from ${shortDate(s.periodFrom)} to ${shortDate(s.periodTo)}`
            : 'Bank statement'
        }
        actions={
          <>
            <Link href="/admin/accounts/bank/statements" className="text-[14px] font-semibold underline">
              All statements
            </Link>
            {parsed && s.bankAccountId > 0 && (
              <Link
                href={`/admin/accounts/bank/${s.bankAccountId}/brs`}
                className="text-[14px] font-semibold underline"
              >
                Reconciliation statement
              </Link>
            )}
            {canImport && status === 'PARSED' && (
              <Button variant="glass" loading={busy === 'auto'} onClick={() => void autoMatch()}>
                Auto-match
              </Button>
            )}
            {canApprove && status === 'PARSED' && premium && (
              <Button loading={busy === 'sign'} onClick={() => void sign()}>
                Mark reconciled
              </Button>
            )}
          </>
        }
      />
      {error && (
        <Alert tone="bad" className="mb-3">
          {error}
        </Alert>
      )}

      {status === 'UPLOADED' && (
        <Card>
          <div className="flex items-center gap-3" role="status">
            <Spinner />
            <p className="text-[14.5px]">
              Reading your statement{s.lineCount > 0 ? `: ${s.lineCount} lines so far` : ''}. This page
              updates by itself.
            </p>
          </div>
        </Card>
      )}
      {status === 'FAILED' && (
        <Card>
          <Alert tone="bad">{s.errorMessage ?? 'The file could not be read.'}</Alert>
          {canImport && (
            <Button className="mt-3" onClick={() => setDialog('reupload')}>
              Upload again
            </Button>
          )}
        </Card>
      )}

      {parsed && (
        <>
          <Card className="mb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[15px] font-bold" data-testid="progress">
                  {s.matchedCount} of {s.lineCount} lines matched
                </p>
                <div
                  className="mt-2 h-2 w-64 max-w-full overflow-hidden rounded-full bg-[rgba(20,35,44,0.1)]"
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Reconciliation progress"
                >
                  <div className="h-full bg-[#14583a]" style={{ width: `${pct}%` }} />
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-[13.5px] sm:grid-cols-4">
                <Fig label="Opening" v={inr(s.openingBalancePaise)} />
                <Fig label="Closing" v={inr(s.closingBalancePaise)} />
                <Fig label="Money in" v={inr(s.creditTotalPaise)} />
                <Fig label="Money out" v={inr(s.debitTotalPaise)} />
              </dl>
              <StatusChip tone={STATEMENT_STATUS_TONE[s.status]}>
                {STATEMENT_STATUS_LABEL[s.status]}
              </StatusChip>
            </div>
            {s.duplicateCount > 0 && (
              <p className="mt-2 text-[12.5px] text-muted">
                {s.duplicateCount} lines were skipped because they were imported before.
              </p>
            )}
          </Card>

          <div className="mb-3 flex flex-wrap gap-2" role="tablist" aria-label="Lines">
            {FILTERS.map(f => (
              <button
                key={f.label}
                type="button"
                role="tab"
                aria-selected={filter === f.value}
                onClick={() => {
                  setFilter(f.value);
                  setPage(1);
                  setSelected(null);
                }}
                className={`rounded-full px-3.5 py-1.5 text-[13.5px] font-semibold ${filter === f.value ? 'bg-ink text-white' : 'bg-[rgba(20,35,44,0.08)]'}`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="grid gap-4 min-[901px]:grid-cols-[1.2fr_1fr]">
            <Card title="Statement lines">
              {lines.loading ? (
                <div className="skeleton h-20 w-full" data-testid="skeleton-row" />
              ) : lines.error ? (
                <ErrorState
                  error={plainError(lines.error)}
                  action={
                    <Button size="sm" onClick={lines.reload}>
                      Try again
                    </Button>
                  }
                />
              ) : items.length === 0 ? (
                <p className="py-6 text-center text-[14px] text-muted">
                  {s.lineCount === 0 ? 'This statement has no lines.' : 'No lines here.'}
                </p>
              ) : (
                <ul aria-label="Statement lines" className="divide-y divide-[var(--line)]">
                  {items.map((l: StatementLine) => (
                    <li key={l.id} data-testid="line-row">
                      <button
                        type="button"
                        onClick={() => setSelected(l.id)}
                        aria-pressed={selected === l.id}
                        className={`flex w-full items-center justify-between gap-3 px-1 py-2.5 text-left ${selected === l.id ? 'bg-[rgba(20,35,44,0.06)]' : ''}`}
                      >
                        <span className="min-w-0 text-[13.5px]">
                          <span className="block truncate font-semibold">{l.description}</span>
                          <span className="text-muted">
                            {shortDate(l.txnDate)}
                            {l.reference ? ` . ${l.reference}` : ''}
                          </span>
                        </span>
                        <span className="shrink-0 text-right text-[13.5px]">
                          <span
                            className={`block font-semibold tabular-nums ${lineIsCredit(l) ? 'text-[#14583a]' : ''}`}
                          >
                            {lineIsCredit(l) ? '+' : '-'}
                            {inr(lineAmount(l))}
                          </span>
                          <StatusChip tone={LINE_STATUS_TONE[l.matchStatus]}>
                            {LINE_STATUS_LABEL[l.matchStatus]}
                          </StatusChip>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {total > 1 && (
                <nav
                  aria-label="Pages of lines"
                  className="mt-3 flex items-center justify-between text-[13.5px]"
                >
                  <Button size="sm" variant="glass" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                    Previous
                  </Button>
                  <span>
                    Page {page} of {total}
                  </span>
                  <Button
                    size="sm"
                    variant="glass"
                    disabled={page >= total}
                    onClick={() => setPage(page + 1)}
                  >
                    Next
                  </Button>
                </nav>
              )}
            </Card>
            {!phone && (
              <Card title="Entries in your books">
                {pane ?? (
                  <p className="py-6 text-center text-[14px] text-muted">
                    Choose a line to see entries that could match it.
                  </p>
                )}
              </Card>
            )}
          </div>
          {phone && current && (
            <Drawer open onClose={() => setSelected(null)} title="Match this line">
              {pane}
            </Drawer>
          )}
        </>
      )}

      {dialog === 'create' && current && (
        <CreateEntryDialog
          line={current}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            setSelected(null);
            reloadAll();
          }}
        />
      )}
      {dialog === 'ignore' && current && (
        <IgnoreDialog
          line={current}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            setSelected(null);
            reloadAll();
          }}
        />
      )}
      {dialog === 'reupload' && (
        <UploadStatementDialog onClose={() => setDialog(null)} onDone={() => setDialog(null)} />
      )}
    </Page>
  );
}

const Fig = ({ label, v }: { label: string; v: string }) => (
  <div>
    <dt className="text-muted">{label}</dt>
    <dd className="font-semibold tabular-nums">{v}</dd>
  </div>
);
