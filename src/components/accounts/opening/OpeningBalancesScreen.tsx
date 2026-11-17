'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ErrorState } from '@/components/common/ErrorState';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { Gate } from '@/components/setup/Gate';
import { Alert } from '@/components/ui/Alert';
import { Button, buttonClasses } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { PERMISSIONS } from '@/constants/permissions';
import { useFeature } from '@/hooks/useFeature';
import { useLoad } from '@/hooks/useLoad';
import { inr, shortDate } from '@/lib/money';
import { accountsJournalService } from '@/services/accountsJournal.service';
import { flattenTree } from '@/services/accountsJournalMappers';
import type { LedgerAccount, OpeningBalanceResult } from '@/types/accountsJournal';
import { accountsError, plainError, rupeesToPaise, today } from '../journals/format';

const P = PERMISSIONS.finance.accounts;
const SIMPLE = ['BANK', 'CASH', 'PETTY_CASH', 'FUND'];
const OFFSET = '3900';

interface Row {
  key: number;
  code: string;
  side: 'DR' | 'CR';
  amount: string;
}
let seq = 0;

/** The side an account naturally opens on: assets are debits, everything else credits. */
const sideOf = (a: LedgerAccount): 'DR' | 'CR' =>
  a.accountType === 'ASSET' || a.accountType === 'EXPENSE' ? 'DR' : 'CR';

/** Debits, credits and the auto-balance line, in paise. `bad` when an amount is not valid. */
export function openingTotals(rows: Pick<Row, 'side' | 'amount'>[], autoBalance: boolean) {
  let debit = 0;
  let credit = 0;
  let bad = false;
  for (const r of rows) {
    if (r.amount.trim() === '') continue;
    const p = rupeesToPaise(r.amount);
    if (p === null) bad = true;
    else if (r.side === 'DR') debit += p;
    else credit += p;
  }
  const diff = debit - credit;
  return {
    debit,
    credit,
    bad,
    difference: diff,
    autoPaise: autoBalance ? Math.abs(diff) : 0,
    autoSide: diff > 0 ? ('CR' as const) : ('DR' as const),
  };
}

/** Opening balances (spec 8.12, 11.7): one voucher that sets bank, cash and fund balances at the start. */
export function OpeningBalancesScreen() {
  return (
    <Gate view={P.create} title="Opening balances">
      <Inner />
    </Gate>
  );
}

function Inner() {
  const chart = useLoad(() => accountsJournalService.chart({ activeOnly: true }), 'chart');
  // The existing opening voucher: the journals list may be off the plan (402) or hidden, then the form simply shows.
  const existing = useLoad(
    () =>
      accountsJournalService
        .journals({ voucherType: 'OPENING_BALANCE', status: 'POSTED', limit: 1 })
        .then(r => r.items[0] ?? null)
        .catch(() => null),
    'opening',
  );
  const [done, setDone] = useState<OpeningBalanceResult | null>(null);
  const posted =
    done ??
    (existing.data
      ? {
          voucherNo: existing.data.voucherNo,
          asOfDate: existing.data.entryDate,
          totalPaise: existing.data.totalPaise,
        }
      : null);

  return (
    <Page>
      <PageHead
        title="Opening balances"
        sub="Tell the books what the society already has: bank, cash and fund balances at the start. You do this once."
      />
      {(chart.loading || existing.loading) && <div className="skeleton h-48 w-full" />}
      {!chart.loading && chart.error != null && (
        <ErrorState error={plainError(chart.error)} onRetry={chart.reload} />
      )}
      {!chart.loading && !existing.loading && !chart.error && posted && (
        <Card title="Opening balances are posted">
          <p className="text-[14.5px]" data-testid="posted">
            {posted.voucherNo ? `Voucher ${posted.voucherNo}` : 'The voucher'} was posted as of{' '}
            {shortDate(posted.asOfDate)} for {inr(posted.totalPaise)}. To change it, reverse it from the
            journals list and enter the balances again.
          </p>
          <Link href="/admin/accounts/journals" className={`${buttonClasses('glass', 'md')} mt-3`}>
            See journals
          </Link>
        </Card>
      )}
      {!chart.loading && !existing.loading && !chart.error && !posted && (
        <Form accounts={flattenTree(chart.data ?? [])} onPosted={setDone} />
      )}
    </Page>
  );
}

function Form({
  accounts,
  onPosted,
}: {
  accounts: LedgerAccount[];
  onPosted: (r: OpeningBalanceResult) => void;
}) {
  const toast = useToast();
  const advanced = useFeature('accounting.opening_balance_import');
  const leaves = useMemo(
    () => accounts.filter(a => !a.isGroup && a.isActive && a.code !== OFFSET),
    [accounts],
  );
  const [asOf, setAsOf] = useState(today());
  const [narration, setNarration] = useState('');
  const [auto, setAuto] = useState(true);
  const [rows, setRows] = useState<Row[]>(() =>
    leaves
      .filter(a => ['BANK', 'CASH', 'PETTY_CASH', 'FUND'].includes(a.subtype))
      .map(a => ({ key: ++seq, code: a.code, side: sideOf(a), amount: '' })),
  );
  const [adding, setAdding] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [failed, setFailed] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const byCode = (c: string) => leaves.find(a => a.code === c);
  const t = openingTotals(rows, auto);
  const simple = rows.every(r => r.amount.trim() === '' || SIMPLE.includes(byCode(r.code)?.subtype ?? ''));
  const mustBalance = !simple; // other accounts need the import entitlement and a balanced entry by hand
  const useAuto = auto && !mustBalance;
  const tot = openingTotals(rows, useAuto);
  const pickable = leaves.filter(
    a => !rows.some(r => r.code === a.code) && (advanced || SIMPLE.includes(a.subtype)),
  );
  const offsetName = accounts.find(a => a.code === OFFSET)?.name ?? 'Opening balance equity';

  const check = (): boolean => {
    const e: string[] = [];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf) || asOf > today())
      e.push('Enter an "as of" date that is not in the future.');
    if (narration.length > 500) e.push('Keep the note within 500 characters.');
    if (t.bad) e.push('Every amount needs digits with at most two decimals.');
    if (rows.every(r => r.amount.trim() === '')) e.push('Enter at least one balance.');
    if (!useAuto && !t.bad && t.difference !== 0)
      e.push(
        `Debits and credits differ by ${inr(Math.abs(t.difference))}. Turn on the automatic balance or fix the amounts.`,
      );
    setErrors(e);
    return e.length === 0;
  };

  const post = async () => {
    setBusy(true);
    setFailed(null);
    try {
      const lines = rows
        .filter(r => r.amount.trim() !== '')
        .map(r => {
          const p = rupeesToPaise(r.amount)!;
          return {
            ledgerAccountCode: r.code,
            debitPaise: r.side === 'DR' ? p : 0,
            creditPaise: r.side === 'CR' ? p : 0,
          };
        });
      const res = await accountsJournalService.postOpeningBalances({
        asOfDate: asOf,
        ...(narration.trim() ? { narration: narration.trim() } : {}),
        autoBalance: useAuto,
        lines,
      });
      toast.show('Opening balances posted.');
      onPosted({
        ...res,
        asOfDate: res.asOfDate ?? asOf,
        totalPaise: res.totalPaise || Math.max(tot.debit, tot.credit) + 0,
      });
    } catch (e) {
      setConfirming(false);
      setFailed(accountsError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      {failed && <Alert tone="bad">{failed}</Alert>}
      {errors.length > 0 && (
        <Alert tone="bad">
          <ul>
            {errors.map(e => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </Alert>
      )}
      <div className="grid gap-x-4 sm:grid-cols-3">
        <Input
          label="As of"
          type="date"
          value={asOf}
          max={today()}
          onChange={e => setAsOf(e.target.value)}
          hint="The day these balances are true."
        />
        <div className="sm:col-span-2">
          <Input
            label="Note (optional)"
            value={narration}
            placeholder={`Opening balances as of ${shortDate(asOf)}`}
            onChange={e => setNarration(e.target.value)}
          />
        </div>
      </div>
      {rows.length === 0 && (
        <p className="mb-3 text-[14px] text-muted">
          There are no bank, cash or fund accounts yet. Add them first.
        </p>
      )}
      <div className="grid gap-2">
        {rows.map(r => {
          const a = byCode(r.code);
          return (
            <div
              key={r.key}
              data-testid="opening-row"
              className="grid items-end gap-x-3 sm:grid-cols-[2fr_8rem_1fr_auto]"
            >
              <p className="mb-4 text-[14.5px] font-semibold">
                {r.code} {a?.name ?? ''}
              </p>
              {advanced ? (
                <Select
                  label={`Side of ${r.code}`}
                  value={r.side}
                  onChange={e =>
                    setRows(rs =>
                      rs.map(x => (x.key === r.key ? { ...x, side: e.target.value as 'DR' | 'CR' } : x)),
                    )
                  }
                  options={[
                    { value: 'DR', label: 'Debit' },
                    { value: 'CR', label: 'Credit' },
                  ]}
                />
              ) : (
                <p className="mb-4 text-[13px] text-muted">{r.side === 'DR' ? 'Money held' : 'Set aside'}</p>
              )}
              <Input
                label={`Amount for ${r.code}`}
                inputMode="decimal"
                value={r.amount}
                onChange={e =>
                  setRows(rs => rs.map(x => (x.key === r.key ? { ...x, amount: e.target.value } : x)))
                }
              />
              <Button
                size="xs"
                variant="ghost"
                className="mb-4"
                aria-label={`Remove ${r.code}`}
                onClick={() => setRows(rs => rs.filter(x => x.key !== r.key))}
              >
                Remove
              </Button>
            </div>
          );
        })}
      </div>
      {pickable.length > 0 && (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <div className="min-w-[220px] flex-1">
            <Select
              label={advanced ? 'Add another account' : 'Add a bank, cash or fund account'}
              value={adding}
              onChange={e => {
                const c = e.target.value;
                if (!c) return;
                const a = byCode(c)!;
                setRows(rs => [...rs, { key: ++seq, code: c, side: sideOf(a), amount: '' }]);
                setAdding('');
              }}
              options={[
                { value: '', label: 'Choose an account' },
                ...pickable.map(a => ({ value: a.code, label: `${a.code} ${a.name}` })),
              ]}
            />
          </div>
        </div>
      )}
      {!advanced && (
        <p className="mb-3 text-[12.5px] text-muted">
          Other accounts, such as dues owed to you, are part of the Premium plan.
        </p>
      )}
      <Checkbox
        label={`Put any difference on ${OFFSET} ${offsetName} automatically`}
        checked={useAuto}
        disabled={mustBalance}
        onChange={e => setAuto(e.target.checked)}
      />
      <dl className="mb-4 grid gap-1 rounded-xl bg-white/50 p-3 text-[14px]" data-testid="opening-totals">
        <div className="flex justify-between">
          <dt>Debits</dt>
          <dd className="tabular-nums">{inr(tot.debit)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Credits</dt>
          <dd className="tabular-nums">{inr(tot.credit)}</dd>
        </div>
        {useAuto && tot.autoPaise > 0 && (
          <div className="flex justify-between font-semibold" data-testid="auto-line">
            <dt>
              {OFFSET} {offsetName} ({tot.autoSide === 'CR' ? 'credit' : 'debit'}, automatic)
            </dt>
            <dd className="tabular-nums">{inr(tot.autoPaise)}</dd>
          </div>
        )}
        {!useAuto && (
          <div className="flex justify-between font-semibold">
            <dt>Difference</dt>
            <dd className="tabular-nums">{inr(Math.abs(tot.difference))}</dd>
          </div>
        )}
      </dl>
      <div className="flex justify-end">
        <Button onClick={() => check() && setConfirming(true)}>Review and post</Button>
      </div>
      {confirming && (
        <Modal
          open
          onClose={() => setConfirming(false)}
          title="Post opening balances?"
          description={`This posts one voucher as of ${shortDate(asOf)}. It can only be undone by reversing it.`}
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirming(false)}>
                Go back
              </Button>
              <Button onClick={post} loading={busy}>
                Post opening balances
              </Button>
            </>
          }
        >
          <ul className="grid gap-1 text-[14px]">
            {rows
              .filter(r => r.amount.trim() !== '')
              .map(r => (
                <li key={r.key} className="flex justify-between">
                  <span>
                    {r.code} {byCode(r.code)?.name}
                  </span>
                  <span className="tabular-nums">
                    {inr(rupeesToPaise(r.amount) ?? 0)} {r.side === 'DR' ? 'Dr' : 'Cr'}
                  </span>
                </li>
              ))}
            {useAuto && tot.autoPaise > 0 && (
              <li className="flex justify-between font-semibold">
                <span>
                  {OFFSET} {offsetName}
                </span>
                <span className="tabular-nums">
                  {inr(tot.autoPaise)} {tot.autoSide === 'CR' ? 'Cr' : 'Dr'}
                </span>
              </li>
            )}
          </ul>
        </Modal>
      )}
    </Card>
  );
}
