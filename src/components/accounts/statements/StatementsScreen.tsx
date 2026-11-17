'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { Gate } from '@/components/setup/Gate';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { ListBody, NoRows, StatusChip } from '@/components/payments/ops/Bits';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { inr, shortDate } from '@/lib/money';
import { accountsStatementsService } from '@/services/accountsStatements.service';
import type { StatementStatus } from '@/types/accountsStatements';
import { STATEMENT_STATUS_LABEL, STATEMENT_STATUS_TONE, isPlan402, plainError } from './format';
import { UploadStatementDialog } from './UploadStatementDialog';
import { PlanLocked } from '@/components/subscription/FeatureGate';

const P = PERMISSIONS.finance.bank;
const FEATURE = 'payments.bank_statement_import';

/** Bank statement imports (spec 8.16, 11.4): the list, upload, and the parsing status of each file. */
export function StatementsScreen() {
  return (
    <Gate view={P.view} feature={FEATURE} title="Bank statements">
      <Inner />
    </Gate>
  );
}

function Inner() {
  const canImport = usePermission(P.import);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [uploading, setUploading] = useState(false);
  const load = useLoad(
    () =>
      accountsStatementsService.list({
        status: (status || undefined) as StatementStatus | undefined,
        page,
        limit: 20,
      }),
    `${status}|${page}`,
  );
  const reading = load.data?.items.some(i => i.status === 'UPLOADED') ?? false;
  useEffect(() => {
    if (!reading) return;
    const t = setInterval(load.reload, 5000);
    return () => clearInterval(t);
  }, [reading, load.reload]);

  return (
    <Page>
      <PageHead
        title="Bank statements"
        sub="Upload the statement from your bank, match each line with the books and sign it off."
        actions={canImport && <Button onClick={() => setUploading(true)}>Upload a statement</Button>}
      />
      <Card>
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <Select
            label="Status"
            value={status}
            onChange={e => {
              setStatus(e.target.value);
              setPage(1);
            }}
            options={[
              { value: '', label: 'All statuses' },
              ...Object.entries(STATEMENT_STATUS_LABEL).map(([value, label]) => ({ value, label })),
            ]}
          />
        </div>
        <ListBody
          load={{ ...load, error: load.error ? plainError(load.error) : load.error }}
          label="Bank statements"
          page={page}
          onPage={setPage}
          locked={isPlan402(load.error) ? <PlanLocked title="Bank statements" /> : undefined}
          empty={
            <NoRows
              title={status ? 'No statements match' : 'No statements yet'}
              text={status ? 'Change the filter.' : 'Upload your first bank statement to start matching.'}
            />
          }
        >
          {items =>
            items.map(s => (
              <li
                key={s.id}
                data-testid="statement-row"
                className="grid gap-x-3 gap-y-1 py-3 min-[900px]:grid-cols-[1fr_12rem_9rem_9rem_8rem] min-[900px]:items-center"
              >
                <Link
                  href={`/admin/accounts/bank/statements/${s.id}`}
                  className="text-[14.5px] font-bold underline-offset-2 hover:underline"
                >
                  {s.bankAccountLabel || `Account ${s.bankAccountId}`}
                  {s.fileName ? (
                    <span className="ml-2 text-[13px] font-normal text-muted">{s.fileName}</span>
                  ) : null}
                </Link>
                <span className="text-[13.5px] text-muted">
                  {s.periodFrom
                    ? `${shortDate(s.periodFrom)} to ${shortDate(s.periodTo)}`
                    : 'Period not known yet'}
                </span>
                <span className="text-[13.5px] tabular-nums">
                  {s.status === 'UPLOADED' ? 'Reading...' : `${s.matchedCount} of ${s.lineCount} matched`}
                </span>
                <span className="text-[13.5px] tabular-nums">{inr(s.closingBalancePaise)}</span>
                <span>
                  <StatusChip tone={STATEMENT_STATUS_TONE[s.status] ?? 'neutral'}>
                    {STATEMENT_STATUS_LABEL[s.status] ?? s.status}
                  </StatusChip>
                </span>
                {s.status === 'FAILED' && s.errorMessage && (
                  <p className="text-[13px] text-bad min-[900px]:col-span-5">{s.errorMessage}</p>
                )}
              </li>
            ))
          }
        </ListBody>
      </Card>
      {uploading && (
        <UploadStatementDialog
          onClose={() => setUploading(false)}
          onDone={() => {
            setUploading(false);
            load.reload();
          }}
        />
      )}
    </Page>
  );
}
