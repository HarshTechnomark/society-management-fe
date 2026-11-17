'use client';
import Link from 'next/link';
import { useState } from 'react';
import { plainAccountsError } from '@/components/accounts/format';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { Gate } from '@/components/setup/Gate';
import { Button, buttonClasses } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { PERMISSIONS } from '@/constants/permissions';
import { useFeature } from '@/hooks/useFeature';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { inr } from '@/lib/money';
import { accountsFundsService } from '@/services/accountsFunds.service';
import type { Fund } from '@/types/accountsFunds';
import { CloseFundDialog, FundFormDialog, SEEDED, TransferDialog } from './FundDialogs';
import { FundStatementDrawer } from './FundStatementDrawer';

const A = PERMISSIONS.finance.accounts;
const KIND: Record<string, string> = {
  SINKING: 'Sinking fund',
  REPAIR: 'Repair fund',
  CORPUS: 'Corpus fund',
  COLLECTION: 'Event fund',
  CUSTOM: 'Custom fund',
};

/** Funds (spec 11.3, 8.13): where the money is earmarked, with statements, edit and transfers. */
export function FundsScreen() {
  return (
    <Gate view={A.view} feature="accounting.collection_and_fund_balances" title="Funds">
      <Inner />
    </Gate>
  );
}

function Lock() {
  return <Chip tone="gold">Premium</Chip>;
}

function Inner() {
  const canCreate = usePermission(A.create);
  const canEdit = usePermission(A.edit);
  const premium = useFeature('accounting.funds');
  const list = useLoad(() => accountsFundsService.list());
  const [dialog, setDialog] = useState<
    | { kind: 'form'; fund: Fund | null }
    | { kind: 'close'; fund: Fund }
    | { kind: 'transfer'; fund: Fund | null }
    | null
  >(null);
  const [stmt, setStmt] = useState<Fund | null>(null);
  const funds = list.data ?? [];
  const total = funds.reduce((s, f) => s + f.balancePaise, 0);
  const spent = funds.reduce((s, f) => s + f.outflowFyPaise, 0);
  const done = () => {
    setDialog(null);
    list.reload();
  };

  return (
    <Page>
      <PageHead
        title="Funds"
        sub="Where the money is earmarked. Anything not in a fund is General."
        actions={
          <>
            <Link href="/admin/accounts/bank" className={buttonClasses('glass', 'md')}>
              Bank accounts
            </Link>
            {canCreate && (
              <>
                <Button
                  variant="glass"
                  disabled={!premium}
                  onClick={() => setDialog({ kind: 'transfer', fund: null })}
                >
                  Transfer between funds {!premium && <Lock />}
                </Button>
                <Button onClick={() => setDialog({ kind: 'form', fund: null })}>New fund</Button>
              </>
            )}
          </>
        }
      />
      {list.error != null ? (
        <ErrorState
          error={plainAccountsError(list.error)}
          action={
            <Button size="sm" onClick={list.reload}>
              Try again
            </Button>
          }
        />
      ) : list.loading ? (
        <div aria-busy="true" aria-label="Loading">
          {[0, 1, 2].map(i => (
            <div key={i} className="skeleton mb-3 h-16 w-full" data-testid="skeleton-row" />
          ))}
        </div>
      ) : funds.length === 0 ? (
        <EmptyState title="No funds yet" text="Funds you create show up here with their balances." />
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-3" data-testid="fund-cards">
            <Card title="In funds">
              <div className="text-[24px] font-bold tabular-nums">{inr(total)}</div>
            </Card>
            <Card title="Active funds">
              <div className="text-[24px] font-bold tabular-nums">{funds.length}</div>
            </Card>
            <Card title="Spent this year">
              <div className="text-[24px] font-bold tabular-nums">{inr(spent)}</div>
            </Card>
          </div>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left text-[14px]">
                <caption className="sr-only">Funds</caption>
                <thead>
                  <tr className="border-b border-[var(--line)] text-[12px] font-semibold uppercase tracking-wide text-muted">
                    {['Fund', 'Balance', 'In this year', 'Out this year', 'Residents see', ''].map((h, i) => (
                      <th key={i} scope="col" className="px-3 py-2.5">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {funds.map(f => (
                    <tr
                      key={f.id}
                      className="border-b border-[var(--line)] last:border-0"
                      data-testid="fund-row"
                    >
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          className="font-semibold underline"
                          onClick={() => setStmt(f)}
                          aria-label={`Open statement of ${f.name}`}
                        >
                          {f.name}
                        </button>
                        <div className="text-[12.5px] text-muted">{KIND[f.fundType] ?? f.fundType}</div>
                      </td>
                      <td className="px-3 py-3 font-semibold tabular-nums">{inr(f.balancePaise)}</td>
                      <td className="px-3 py-3 tabular-nums">{inr(f.inflowFyPaise)}</td>
                      <td className="px-3 py-3 tabular-nums">{inr(f.outflowFyPaise)}</td>
                      <td className="px-3 py-3">{f.showToResidents ? 'Yes' : 'No'}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {canEdit && premium && (
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label={`Edit ${f.name}`}
                              onClick={() => setDialog({ kind: 'form', fund: f })}
                            >
                              Edit
                            </Button>
                          )}
                          {canEdit && premium && !SEEDED.includes(f.fundType) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label={`Close ${f.name}`}
                              onClick={() => setDialog({ kind: 'close', fund: f })}
                            >
                              Close
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!premium && (
              <p className="mt-3 text-[13px] text-muted">
                Editing, closing and moving money between funds are part of the Premium plan. <Lock />
              </p>
            )}
          </Card>
        </>
      )}
      {dialog?.kind === 'form' && (
        <FundFormDialog fund={dialog.fund} onClose={() => setDialog(null)} onSaved={done} />
      )}
      {dialog?.kind === 'close' && (
        <CloseFundDialog fund={dialog.fund} onClose={() => setDialog(null)} onSaved={done} />
      )}
      {dialog?.kind === 'transfer' && (
        <TransferDialog from={dialog.fund} onClose={() => setDialog(null)} onDone={done} />
      )}
      {stmt && <FundStatementDrawer fund={stmt} onClose={() => setStmt(null)} />}
    </Page>
  );
}
