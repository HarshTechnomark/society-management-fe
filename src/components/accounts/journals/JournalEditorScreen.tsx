'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { Gate } from '@/components/setup/Gate';
import { Alert } from '@/components/ui/Alert';
import { Button, buttonClasses } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { inr } from '@/lib/money';
import { accountsJournalService } from '@/services/accountsJournal.service';
import { flattenTree } from '@/services/accountsJournalMappers';
import type { FundOption, JournalDetail, JournalInput, LedgerAccount } from '@/types/accountsJournal';
import { VOUCHER_LABEL, accountsError, plainError, rupeesToPaise, today } from './format';
import { paiseText } from '@/components/billing/format';

const P = PERMISSIONS.finance.accounts;

interface Row {
  key: number;
  code: string;
  debit: string;
  credit: string;
  fund: string;
  note: string;
}
let seq = 0;
const blank = (): Row => ({ key: ++seq, code: '', debit: '', credit: '', fund: '', note: '' });
const amount = (t: string): number => (t.trim() === '' ? 0 : (rupeesToPaise(t) ?? NaN));

/** Totals of the grid in paise; `bad` when an amount is not a number. */
export function totals(rows: Pick<Row, 'debit' | 'credit'>[]) {
  let debit = 0;
  let credit = 0;
  let bad = false;
  for (const r of rows) {
    const d = amount(r.debit);
    const c = amount(r.credit);
    if (Number.isNaN(d) || Number.isNaN(c)) bad = true;
    else {
      debit += d;
      credit += c;
    }
  }
  return { debit, credit, difference: debit - credit, bad };
}

/** New journal and edit draft (spec 8.11, 11.7): a balanced-lines grid with a running difference. */
export function JournalEditorScreen() {
  return (
    <Gate view={P.create} feature="accounting.manual_journals" title="Manual journals">
      <Inner />
    </Gate>
  );
}

function Inner() {
  const draftId = Number(useSearchParams()?.get('draft')) || 0;
  const draft = useLoad(
    () => (draftId ? accountsJournalService.journal(draftId) : Promise.resolve(null)),
    `draft-${draftId}`,
  );
  const chart = useLoad(() => accountsJournalService.chart({ activeOnly: true }), 'chart');
  // The funds list belongs to another screen and may not exist yet: a failure means "type the fund number".
  const funds = useLoad<FundOption[] | null>(
    () => accountsJournalService.fundOptions().catch(() => null),
    'funds',
  );
  const loading = draft.loading || chart.loading;
  const failure = draft.error ?? chart.error;
  return (
    <Page>
      <PageHead
        title={draftId ? 'Edit draft journal' : 'New journal'}
        sub="Debits and credits must be equal before you can send it for approval."
        actions={
          <Link href="/admin/accounts/journals" className={buttonClasses('glass', 'md')}>
            All journals
          </Link>
        }
      />
      {loading && <div className="skeleton h-48 w-full" />}
      {!loading && failure != null && (
        <ErrorState
          error={plainError(failure)}
          action={
            <Button size="sm" onClick={() => (draft.reload(), chart.reload())}>
              Try again
            </Button>
          }
        />
      )}
      {!loading && !failure && draft.data && draft.data.status !== 'DRAFT' && (
        <EmptyState title="This journal is not a draft" text="Only drafts can be edited." />
      )}
      {!loading && !failure && (!draft.data || draft.data.status === 'DRAFT') && !funds.loading && (
        <Editor
          existing={draft.data}
          accounts={flattenTree(chart.data ?? []).filter(a => !a.isGroup && a.isActive)}
          funds={funds.data}
        />
      )}
    </Page>
  );
}

function Editor({
  existing,
  accounts,
  funds,
}: {
  existing: JournalDetail | null;
  accounts: LedgerAccount[];
  funds: FundOption[] | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [date, setDate] = useState(existing?.entryDate.slice(0, 10) ?? today());
  const [vt, setVt] = useState(existing?.voucherType ?? 'JOURNAL');
  const [narration, setNarration] = useState(existing?.narration ?? '');
  const [ref, setRef] = useState(existing?.instrumentRef ?? '');
  const [rows, setRows] = useState<Row[]>(() =>
    existing && existing.lines.length
      ? existing.lines.map(l => ({
          key: ++seq,
          code: l.ledgerAccountCode,
          debit: l.debitPaise ? paiseText(l.debitPaise) : '',
          credit: l.creditPaise ? paiseText(l.creditPaise) : '',
          fund: l.fundId ? String(l.fundId) : '',
          note: l.lineNarration ?? '',
        }))
      : [blank(), blank()],
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const t = totals(rows);
  const patch = (key: number, p: Partial<Row>) =>
    setRows(rs => rs.map(r => (r.key === key ? { ...r, ...p } : r)));
  const balanced = !t.bad && t.difference === 0 && t.debit > 0;

  const build = (): JournalInput | null => {
    const e: Record<string, string> = {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today())
      e.date = 'Enter a date that is not in the future.';
    const n = narration.trim();
    if (n.length < 3 || n.length > 500) e.narration = 'Enter a narration of 3 to 500 characters.';
    if (ref.length > 60) e.ref = 'Keep the reference within 60 characters.';
    const used = rows.filter(r => r.code || r.debit.trim() || r.credit.trim() || r.fund || r.note);
    if (used.length < 2) e.lines = 'Add at least two lines.';
    const lines = used.map((r, i) => {
      const d = amount(r.debit);
      const c = amount(r.credit);
      if (!r.code) e[`row${r.key}`] = `Line ${i + 1}: pick an account.`;
      else if (Number.isNaN(d) || Number.isNaN(c))
        e[`row${r.key}`] = `Line ${i + 1}: enter an amount with at most two decimals.`;
      else if (d > 0 === c > 0)
        e[`row${r.key}`] = `Line ${i + 1}: enter a debit or a credit, not both and not neither.`;
      else if (r.fund && !/^\d+$/.test(r.fund))
        e[`row${r.key}`] = `Line ${i + 1}: the fund number must be digits.`;
      return {
        ledgerAccountCode: r.code,
        debitPaise: d || 0,
        creditPaise: c || 0,
        ...(r.fund ? { fundId: Number(r.fund) } : {}),
        ...(r.note.trim() ? { lineNarration: r.note.trim().slice(0, 200) } : {}),
      };
    });
    setErrors(e);
    if (Object.keys(e).length) return null;
    return {
      date,
      voucherType: vt as JournalInput['voucherType'],
      narration: n,
      ...(ref.trim() ? { instrumentRef: ref.trim() } : {}),
      lines,
    };
  };

  const save = async (submit: boolean) => {
    setFailed(null);
    const body = build();
    if (!body) return;
    if (submit && !balanced) {
      setFailed('Total debits and total credits must be equal before you can send it for approval.');
      return;
    }
    setBusy(true);
    try {
      const saved = existing
        ? await accountsJournalService.updateJournal(existing.id, { ...body, version: existing.version })
        : await accountsJournalService.createJournal(body);
      if (submit) {
        await accountsJournalService.submitJournal(saved.id, saved.version);
        toast.show('Journal sent for approval.');
      } else toast.show('Draft saved.');
      router.push('/admin/accounts/journals');
    } catch (err) {
      setFailed(accountsError(err));
    } finally {
      setBusy(false);
    }
  };

  const options = [
    { value: '', label: 'Choose an account' },
    ...accounts.map(a => ({ value: a.code, label: `${a.code} ${a.name}` })),
  ];

  return (
    <Card>
      {failed && <Alert tone="bad">{failed}</Alert>}
      <div className="grid gap-x-4 sm:grid-cols-4">
        <Input
          label="Date"
          type="date"
          value={date}
          max={today()}
          error={errors.date}
          onChange={e => setDate(e.target.value)}
        />
        <Select
          label="Type"
          value={vt}
          onChange={e => setVt(e.target.value)}
          options={['JOURNAL', 'CONTRA', 'PAYMENT', 'RECEIPT'].map(v => ({
            value: v,
            label: VOUCHER_LABEL[v],
          }))}
        />
        <div className="sm:col-span-2">
          <Input
            label="Reference (optional)"
            value={ref}
            error={errors.ref}
            onChange={e => setRef(e.target.value)}
          />
        </div>
      </div>
      <Input
        label="Narration"
        value={narration}
        error={errors.narration}
        onChange={e => setNarration(e.target.value)}
      />
      <h2 className="mb-2 text-[15px] font-bold">Lines</h2>
      {errors.lines && <p className="mb-2 text-[13px] text-bad">{errors.lines}</p>}
      <div className="grid gap-3">
        {rows.map((r, i) => (
          <div
            key={r.key}
            data-testid="line-row"
            className="grid gap-x-3 rounded-xl border border-[var(--line)] p-3 sm:grid-cols-[2fr_1fr_1fr_1fr_auto]"
          >
            <Select
              label={`Account, line ${i + 1}`}
              value={r.code}
              onChange={e => patch(r.key, { code: e.target.value })}
              options={options}
            />
            <Input
              label={`Debit, line ${i + 1}`}
              inputMode="decimal"
              value={r.debit}
              onChange={e =>
                patch(r.key, { debit: e.target.value, ...(e.target.value ? { credit: '' } : {}) })
              }
            />
            <Input
              label={`Credit, line ${i + 1}`}
              inputMode="decimal"
              value={r.credit}
              onChange={e =>
                patch(r.key, { credit: e.target.value, ...(e.target.value ? { debit: '' } : {}) })
              }
            />
            {funds && funds.length > 0 ? (
              <Select
                label={`Fund, line ${i + 1}`}
                value={r.fund}
                onChange={e => patch(r.key, { fund: e.target.value })}
                options={[
                  { value: '', label: 'No fund' },
                  ...funds.map(f => ({ value: String(f.id), label: f.name })),
                ]}
              />
            ) : (
              <Input
                label={`Fund number, line ${i + 1}`}
                inputMode="numeric"
                value={r.fund}
                onChange={e => patch(r.key, { fund: e.target.value.replace(/\D/g, '') })}
              />
            )}
            <div className="flex items-end pb-4">
              <Button
                size="xs"
                variant="ghost"
                disabled={rows.length <= 2}
                aria-label={`Remove line ${i + 1}`}
                onClick={() => setRows(rs => rs.filter(x => x.key !== r.key))}
              >
                Remove
              </Button>
            </div>
            <div className="sm:col-span-5">
              <Input
                label={`Line note, line ${i + 1} (optional)`}
                value={r.note}
                onChange={e => patch(r.key, { note: e.target.value })}
              />
              {errors[`row${r.key}`] && (
                <p className="-mt-2 mb-1 text-[13px] text-bad">{errors[`row${r.key}`]}</p>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="glass"
          size="sm"
          disabled={rows.length >= 200}
          onClick={() => setRows(rs => [...rs, blank()])}
        >
          Add a line
        </Button>
        <div className="text-[14px]" aria-live="polite" data-testid="totals">
          <span className="mr-4">Debits {inr(t.debit)}</span>
          <span className="mr-4">Credits {inr(t.credit)}</span>
          <strong className={balanced ? 'text-ok' : 'text-bad'} data-testid="difference">
            {t.bad ? 'Check the amounts' : `Difference ₹${(Math.abs(t.difference) / 100).toFixed(2)}`}
          </strong>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button variant="glass" loading={busy} onClick={() => save(false)}>
          Save draft
        </Button>
        <Button loading={busy} disabled={!balanced} onClick={() => save(true)}>
          Submit for approval
        </Button>
      </div>
    </Card>
  );
}
