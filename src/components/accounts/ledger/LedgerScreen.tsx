'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { Gate } from '@/components/setup/Gate';
import { SUBSCRIPTION_PATH } from '@/components/subscription/planLock';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { PERMISSIONS } from '@/constants/permissions';
import { useFeature } from '@/hooks/useFeature';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { inr } from '@/lib/money';
import { accountsJournalService } from '@/services/accountsJournal.service';
import { flattenTree } from '@/services/accountsJournalMappers';
import type { LedgerAccount } from '@/types/accountsJournal';
import { AddAccountDialog, EditAccountDialog } from './AccountDialog';
import { ACCOUNT_TYPE_LABEL, plainError } from '../journals/format';

const P = PERMISSIONS.finance.accounts;
const FEATURE = 'accounting.chart_of_accounts';

/** Chart of accounts (spec 8.10, 11.7): the tree with balances. Adding and editing need the Premium plan. */
export function LedgerScreen() {
  return (
    <Gate view={P.view} title="Chart of accounts">
      <Inner />
    </Gate>
  );
}

/** Keeps the accounts that match `q` and the groups above them. */
export function filterTree(tree: LedgerAccount[], q: string, showOff: boolean): LedgerAccount[] {
  const needle = q.trim().toLowerCase();
  const walk = (list: LedgerAccount[], all: boolean): LedgerAccount[] =>
    list.flatMap(a => {
      if (!showOff && !a.isActive) return [];
      const hit = all || !needle || a.code.includes(needle) || a.name.toLowerCase().includes(needle);
      const kids = walk(a.children, hit);
      return hit || kids.length ? [{ ...a, children: kids }] : [];
    });
  return walk(tree, false);
}

function Inner() {
  const canEdit = usePermission(P.edit);
  const planOk = useFeature(FEATURE);
  const [q, setQ] = useState('');
  const [showOff, setShowOff] = useState(false);
  const [closed, setClosed] = useState<Set<number>>(new Set());
  const [adding, setAdding] = useState<number | null | false>(false);
  const [editing, setEditing] = useState<LedgerAccount | null>(null);
  const load = useLoad(() => accountsJournalService.chart({ activeOnly: false }), 'chart');
  const tree = useMemo(() => filterTree(load.data ?? [], q, showOff), [load.data, q, showOff]);
  const groups = useMemo(
    () => flattenTree(load.data ?? []).filter(a => a.isGroup && a.isActive),
    [load.data],
  );
  const mayEdit = canEdit && planOk;
  const searching = q.trim() !== '';

  const toggle = (id: number) =>
    setClosed(s => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const rows: { a: LedgerAccount; depth: number }[] = [];
  const walk = (list: LedgerAccount[], depth: number) =>
    list.forEach(a => {
      rows.push({ a, depth });
      if (searching || !closed.has(a.id)) walk(a.children, depth + 1);
    });
  walk(tree, 0);

  return (
    <Page>
      <PageHead
        title="Chart of accounts"
        sub="Every account the society keeps its books in, with its balance."
        actions={
          mayEdit && (
            <Button onClick={() => setAdding(null)} disabled={groups.length === 0}>
              Add an account
            </Button>
          )
        }
      />
      {!planOk && (
        <Alert tone="warn">
          Adding and renaming accounts is part of the Premium plan. You can still read the chart.{' '}
          <Link href={SUBSCRIPTION_PATH} className="font-semibold underline">
            See plans
          </Link>
        </Alert>
      )}
      <Card>
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <Input
              label="Search"
              type="search"
              placeholder="Code or name"
              value={q}
              onChange={e => setQ(e.target.value)}
            />
          </div>
          <label className="mb-4 flex items-center gap-2 text-[14px]">
            <input type="checkbox" checked={showOff} onChange={e => setShowOff(e.target.checked)} />
            Show switched-off accounts
          </label>
        </div>
        {load.loading && <div className="skeleton h-40 w-full" data-testid="chart-loading" />}
        {!load.loading && load.error != null && (
          <ErrorState
            error={plainError(load.error)}
            action={
              <Button size="sm" onClick={() => load.reload()}>
                Try again
              </Button>
            }
          />
        )}
        {!load.loading && !load.error && rows.length === 0 && (
          <EmptyState title="No accounts match" text="Clear the search to see the whole chart." />
        )}
        {rows.length > 0 && (
          <ul className="divide-y divide-[var(--line)]" role="tree" aria-label="Chart of accounts">
            {rows.map(({ a, depth }) => (
              <li
                key={a.id}
                role="treeitem"
                aria-selected={false}
                aria-level={depth + 1}
                aria-expanded={a.children.length ? searching || !closed.has(a.id) : undefined}
                data-testid="account-row"
                className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-[14px]"
                style={{ paddingLeft: depth * 18 }}
              >
                {a.children.length > 0 ? (
                  <button
                    type="button"
                    aria-label={`${closed.has(a.id) ? 'Expand' : 'Collapse'} ${a.name}`}
                    className="w-5 text-muted"
                    onClick={() => toggle(a.id)}
                  >
                    {searching || !closed.has(a.id) ? '-' : '+'}
                  </button>
                ) : (
                  <span className="w-5" />
                )}
                <span className="w-14 shrink-0 font-mono text-[13px] text-muted">{a.code}</span>
                <span className={a.isGroup ? 'min-w-0 flex-1 font-bold' : 'min-w-0 flex-1'}>
                  {a.name}
                  {depth === 0 && (
                    <span className="ml-2 text-[12px] font-normal text-muted">
                      {ACCOUNT_TYPE_LABEL[a.accountType] ?? ''}
                    </span>
                  )}
                </span>
                <span className="flex flex-wrap items-center gap-1.5">
                  {a.isSystem && (
                    <span title="System account" aria-label="System account, locked">
                      <Chip>Locked</Chip>
                    </span>
                  )}
                  {!a.isActive && <Chip tone="warn">Switched off</Chip>}
                  {a.isCashBookCategory && <Chip tone="info">Cash book</Chip>}
                </span>
                {a.balancePaise !== null && (
                  <span className="w-28 text-right tabular-nums" data-testid="balance">
                    {inr(a.balancePaise)}
                  </span>
                )}
                {mayEdit && (
                  <span className="flex gap-1">
                    {a.isGroup && a.isActive && (
                      <Button
                        size="xs"
                        variant="ghost"
                        aria-label={`Add under ${a.name}`}
                        onClick={() => setAdding(a.id)}
                      >
                        Add under
                      </Button>
                    )}
                    <Button
                      size="xs"
                      variant="glass"
                      aria-label={`Edit ${a.name}`}
                      onClick={() => setEditing(a)}
                    >
                      Edit
                    </Button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[12.5px] text-muted">
          Balances show debit minus credit. Debits are positive, credits negative.
        </p>
      </Card>
      {adding !== false && (
        <AddAccountDialog
          groups={groups}
          initialParentId={adding ?? undefined}
          onClose={() => setAdding(false)}
          onDone={load.reload}
        />
      )}
      {editing && (
        <EditAccountDialog account={editing} onClose={() => setEditing(null)} onDone={load.reload} />
      )}
    </Page>
  );
}
