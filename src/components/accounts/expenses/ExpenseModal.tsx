'use client';
import { useState } from 'react';
import { GENERAL_FUND } from '@/components/accounts/pickers/FundPicker';
import { FileField } from '@/components/residents/common';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useFeature } from '@/hooks/useFeature';
import { useLoad } from '@/hooks/useLoad';
import { ApiError } from '@/lib/apiClient';
import { inr } from '@/lib/money';
import { accountsExpensesService as svc } from '@/services/accountsExpenses.service';
import type {
  ExpenseDetail,
  ExpenseInput,
  ExpenseResult,
  ExpenseType,
  LedgerOption,
} from '@/types/accountsExpenses';
import {
  MODES,
  NEEDS_REFERENCE,
  expenseError,
  fieldOfCode,
  formFieldOf,
  paiseText,
  rupeesToPaise,
  today,
} from './format';

type Errors = Partial<Record<string, string>>;
const STATUTORY_CODES = ['2310', '2320', '2330', '2140'];
const MAX_BILLS = 5;
const MAX_PAISE = 100_000_000_000;

/** What the add form says about approval and bills (module 14 rule and the bill setting; these are the seeded defaults). */
export const APPROVAL_ABOVE_PAISE = 500000;
export const BILL_ABOVE_PAISE = 200000;

const moneyField = (text: string): number | null | undefined => {
  if (!text.trim()) return undefined;
  return rupeesToPaise(text);
};

/**
 * Add or edit an expense (spec 8.6, 11.2). "Save expense" sends `submit: true`, "Save as draft" sends false.
 * Pass `expense` to edit a draft, rejected or changes-requested expense.
 */
export function ExpenseModal({
  expense,
  onClose,
  onSaved,
}: {
  expense?: ExpenseDetail;
  onClose: () => void;
  onSaved: (r: ExpenseResult, submitted: boolean) => void;
}) {
  const premiumExpenses = useFeature('accounting.expenses');
  const tdsOn = useFeature('accounting.tds');
  const pettyOn = useFeature('accounting.petty_cash');
  const ledgers = useLoad(() => svc.ledgerOptions(false), 'all');
  const funds = useLoad(() => svc.funds(), 'funds');
  const ledgerMissing = ledgers.error != null;
  const fundsMissing = funds.error != null;

  const [type, setType] = useState<ExpenseType>(expense?.expenseType ?? 'DIRECT');
  const [amount, setAmount] = useState(expense ? paiseText(expense.grossAmountPaise) : '');
  const [date, setDate] = useState(expense?.expenseDate || today());
  const [payee, setPayee] = useState(expense?.payee ?? '');
  const [head, setHead] = useState(expense?.ledgerAccount ? String(expense.ledgerAccount.id) : '');
  const [paidFrom, setPaidFrom] = useState(expense?.paidFrom ? String(expense.paidFrom.id) : '');
  const [mode, setMode] = useState(expense?.paymentMode ?? '');
  const [reference, setReference] = useState(expense?.paymentReference ?? '');
  const [fund, setFund] = useState(expense?.fundId ? String(expense.fundId) : GENERAL_FUND);
  const [note, setNote] = useState(expense?.description ?? '');
  const [gst, setGst] = useState(expense && expense.gstPaise ? paiseText(expense.gstPaise) : '');
  const [tds, setTds] = useState(expense && expense.tdsPaise ? paiseText(expense.tdsPaise) : '');
  const [tdsSection, setTdsSection] = useState(expense?.tdsSection ?? '');
  const [challan, setChallan] = useState(expense?.challanNo ?? '');
  const [more, setMore] = useState(
    !!expense && (expense.expenseType !== 'DIRECT' || expense.gstPaise > 0 || expense.tdsPaise > 0),
  );
  const [bills, setBills] = useState<{ id: number; name: string }[]>(
    (expense?.files ?? []).map(f => ({ id: f.id, name: f.name })),
  );
  const [uploader, setUploader] = useState(0);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'save' | 'draft' | null>(null);

  const all = ledgers.data ?? [];
  const sources = all.filter(
    a => ['BANK', 'CASH'].includes(a.subtype) || (a.subtype === 'PETTY_CASH' && pettyOn),
  );
  const heads = all.filter(a =>
    type === 'STATUTORY_DUE'
      ? STATUTORY_CODES.includes(a.code)
      : a.accountType === 'EXPENSE' && (premiumExpenses || a.isCashBookCategory),
  );
  const source: LedgerOption | undefined = sources.find(a => String(a.id) === paidFrom);
  const headRow = heads.find(a => String(a.id) === head);
  const isTdsDeposit = type === 'STATUTORY_DUE' && headRow?.code === '2140';
  const cashSource = source ? ['CASH', 'PETTY_CASH'].includes(source.subtype) : null;
  const modes = MODES.filter(
    m => cashSource === null || (cashSource ? m.value === 'CASH' : m.value !== 'CASH'),
  );
  const amountPaise = rupeesToPaise(amount);

  const build = (submit: boolean): ExpenseInput | null => {
    const e: Errors = {};
    if (amountPaise === null || amountPaise < 100 || amountPaise > MAX_PAISE)
      e.amount = 'Enter an amount of at least ₹1.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today())
      e.date = 'Choose a date that is not in the future.';
    if (payee.trim().length < 2 || payee.trim().length > 150)
      e.payee = 'Enter who was paid (2 to 150 letters).';
    if (!head) e.head = 'Choose a category.';
    if (!paidFrom || !/^\d+$/.test(paidFrom)) e.paidFrom = 'Choose where the money comes from.';
    if (!mode) e.mode = 'Choose how it was paid.';
    const ref = reference.trim();
    if (NEEDS_REFERENCE.includes(mode) && !/^[A-Za-z0-9/-]{6,30}$/.test(ref))
      e.reference = 'Enter the cheque number or UTR (6 to 30 letters and digits).';
    const gstP = moneyField(gst);
    const tdsP = moneyField(tds);
    if (gstP === null) e.gst = 'Enter the GST amount in rupees.';
    else if (gstP !== undefined && amountPaise !== null && gstP >= amountPaise)
      e.gst = 'GST must be less than the amount.';
    if (tdsP === null) e.tds = 'Enter the TDS amount in rupees.';
    else if (tdsP !== undefined && amountPaise !== null && tdsP >= amountPaise)
      e.tds = 'TDS must be less than the amount.';
    const needSection = (tdsP ?? 0) > 0 || isTdsDeposit;
    if (needSection && !/^[0-9]{3}[A-Z]{0,3}$/.test(tdsSection.trim().toUpperCase()))
      e.tdsSection = 'Enter the TDS section, for example 194C.';
    if (challan.trim() && !/^[A-Za-z0-9/-]{6,30}$/.test(challan.trim()))
      e.challan = 'The challan number has 6 to 30 letters and digits.';
    if (fund && fund !== GENERAL_FUND && !/^\d+$/.test(fund)) e.fund = 'Enter the fund number.';
    if (note.length > 500) e.note = 'Keep the note under 500 characters.';
    setErrors(e);
    if (Object.keys(e).length > 0 || amountPaise === null) return null;
    return {
      expenseType: type,
      expenseDate: date,
      payee: payee.trim(),
      ledgerAccountId: Number(head),
      grossAmountPaise: amountPaise,
      paidFromLedgerAccountId: Number(paidFrom),
      paymentMode: mode,
      ...(NEEDS_REFERENCE.includes(mode) ? { paymentReference: ref } : {}),
      ...(note.trim() ? { description: note.trim() } : {}),
      ...(gstP ? { gstPaise: gstP } : {}),
      ...(tdsP ? { tdsPaise: tdsP } : {}),
      ...(needSection ? { tdsSection: tdsSection.trim().toUpperCase() } : {}),
      ...(isTdsDeposit && challan.trim() ? { challanNo: challan.trim() } : {}),
      ...(fund && fund !== GENERAL_FUND ? { fundId: Number(fund) } : {}),
      fileIds: bills.map(b => b.id),
      ...(expense ? {} : { submit }),
    };
  };

  const save = async (submit: boolean) => {
    setFormError(null);
    const body = build(submit);
    if (!body) return;
    setBusy(submit ? 'save' : 'draft');
    try {
      let r: ExpenseResult;
      if (expense) {
        r = await svc.update(expense.id, { ...body, version: expense.version });
        if (submit) r = await svc.submit(expense.id, r.version);
      } else {
        r = await svc.create(body);
      }
      onSaved(r, submit);
    } catch (err) {
      const next: Errors = {};
      if (err instanceof ApiError) {
        for (const f of err.errors ?? []) {
          const k = formFieldOf(f.field);
          if (k && f.message) next[k] = f.message;
        }
        const code = fieldOfCode(err.code);
        if (code) next[code] = expenseError(err);
      }
      setErrors(next);
      if (Object.keys(next).length === 0) setFormError(expenseError(err));
      setTimeout(() => {
        document
          .querySelector('[role="dialog"] [aria-invalid="true"]')
          ?.scrollIntoView?.({ block: 'center' });
      }, 0);
    } finally {
      setBusy(null);
    }
  };

  const label = (a: LedgerOption) => (a.balancePaise != null ? `${a.name} (${inr(a.balancePaise)})` : a.name);
  const loadingLedgers = ledgers.loading && !ledgerMissing;

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={expense ? `Edit ${expense.displayId}` : 'Add an expense'}
      description={`Above ${inr(APPROVAL_ABOVE_PAISE)} needs approval. Above ${inr(BILL_ABOVE_PAISE)} needs a bill.`}
      footer={
        <>
          {formError && (
            <div className="w-full">
              <Alert tone="bad">{formError}</Alert>
            </div>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="glass"
            loading={busy === 'draft'}
            disabled={busy !== null}
            onClick={() => void save(false)}
          >
            Save as draft
          </Button>
          <Button loading={busy === 'save'} disabled={busy !== null} onClick={() => void save(true)}>
            Save expense
          </Button>
        </>
      }
    >
      {expense?.rejectionReason && <Alert tone="warn">Sent back: {expense.rejectionReason}</Alert>}
      <Input
        label="Amount (₹)"
        required
        inputMode="decimal"
        value={amount}
        error={errors.amount}
        onChange={e => setAmount(e.target.value)}
      />
      <Input
        label="Date of expense"
        type="date"
        required
        value={date}
        max={today()}
        error={errors.date}
        onChange={e => setDate(e.target.value)}
      />
      <Input
        label="Payee"
        required
        value={payee}
        maxLength={150}
        error={errors.payee}
        onChange={e => setPayee(e.target.value)}
      />
      {ledgerMissing ? (
        <>
          <Input
            label="Category (ledger account number)"
            required
            inputMode="numeric"
            value={head}
            error={errors.head}
            hint="The list of categories could not be loaded, so type the account number."
            onChange={e => setHead(e.target.value.replace(/\D/g, ''))}
          />
          <Input
            label="Paid from (ledger account number)"
            required
            inputMode="numeric"
            value={paidFrom}
            error={errors.paidFrom}
            hint="The list of accounts could not be loaded, so type the account number."
            onChange={e => setPaidFrom(e.target.value.replace(/\D/g, ''))}
          />
        </>
      ) : (
        <>
          <Select
            label="Category"
            required
            value={head}
            error={errors.head}
            onChange={e => setHead(e.target.value)}
            options={[
              { value: '', label: loadingLedgers ? 'Loading categories...' : 'Choose a category' },
              ...heads.map(h => ({ value: String(h.id), label: h.name })),
            ]}
          />
          <Select
            label="Paid from"
            required
            value={paidFrom}
            error={errors.paidFrom}
            onChange={e => {
              setPaidFrom(e.target.value);
              const s = sources.find(a => String(a.id) === e.target.value);
              if (s) {
                const cash = ['CASH', 'PETTY_CASH'].includes(s.subtype);
                if (cash) setMode('CASH');
                else if (mode === 'CASH' || !mode) setMode('NEFT');
              }
            }}
            options={[
              { value: '', label: loadingLedgers ? 'Loading accounts...' : 'Choose an account' },
              ...sources.map(s => ({ value: String(s.id), label: label(s) })),
            ]}
          />
        </>
      )}
      <Select
        label="Payment mode"
        required
        value={mode}
        error={errors.mode}
        onChange={e => setMode(e.target.value)}
        options={[{ value: '', label: 'Choose a mode' }, ...modes]}
      />
      {NEEDS_REFERENCE.includes(mode) && (
        <Input
          label={mode === 'CHEQUE' ? 'Cheque number' : 'Reference (UTR)'}
          value={reference}
          error={errors.reference}
          onChange={e => setReference(e.target.value)}
        />
      )}
      {fundsMissing ? (
        <Input
          label="Fund number (optional)"
          inputMode="numeric"
          value={fund === GENERAL_FUND ? '' : fund}
          error={errors.fund}
          hint="Leave empty for general money of the society."
          onChange={e => setFund(e.target.value.replace(/\D/g, '') || GENERAL_FUND)}
        />
      ) : (
        <Select
          label="Belongs to"
          value={fund}
          error={errors.fund}
          onChange={e => setFund(e.target.value)}
          options={[
            { value: GENERAL_FUND, label: 'General' },
            ...(funds.data ?? []).map(f => ({
              value: String(f.id),
              label: f.balancePaise != null ? `${f.name} (${inr(f.balancePaise)})` : f.name,
            })),
          ]}
        />
      )}
      <div className="mb-4">
        <div className="mb-1.5 text-[13px] font-semibold">Bill photo (up to {MAX_BILLS})</div>
        {bills.length > 0 && (
          <ul className="mb-2 flex flex-wrap gap-2" aria-label="Attached bills">
            {bills.map(b => (
              <li
                key={b.id}
                className="flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-[13px]"
                data-testid="bill-chip"
              >
                {b.name}
                <button
                  type="button"
                  className="font-semibold text-bad"
                  aria-label={`Remove ${b.name}`}
                  onClick={() => setBills(l => l.filter(x => x.id !== b.id))}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        {bills.length < MAX_BILLS && (
          <FileField
            key={uploader}
            label="Add a bill"
            purpose="EXPENSE_BILL"
            camera
            onChange={id => {
              if (id === null) return;
              setBills(l => [...l, { id, name: `Bill ${l.length + 1}` }]);
              setUploader(n => n + 1);
            }}
          />
        )}
        {errors.bill && <p className="text-[13px] text-bad">{errors.bill}</p>}
      </div>
      <Textarea
        label="Note"
        value={note}
        maxLength={500}
        error={errors.note}
        onChange={e => setNote(e.target.value)}
      />
      <Alert tone="info">Posting reduces the live society balance at once.</Alert>
      {(premiumExpenses || tdsOn) && (
        <div className="mt-3">
          <Button size="sm" variant="ghost" aria-expanded={more} onClick={() => setMore(m => !m)}>
            {more ? 'Hide more details' : 'More details'}
          </Button>
          {more && (
            <div className="mt-2">
              {premiumExpenses && (
                <Select
                  label="Expense type"
                  value={type}
                  onChange={e => {
                    setType(e.target.value as ExpenseType);
                    setHead('');
                  }}
                  options={[
                    { value: 'DIRECT', label: 'Direct expense' },
                    { value: 'STATUTORY_DUE', label: 'Statutory payment (TDS, GST, PF)' },
                  ]}
                />
              )}
              {premiumExpenses && type === 'DIRECT' && (
                <Input
                  label="GST amount (₹)"
                  inputMode="decimal"
                  value={gst}
                  error={errors.gst}
                  hint="The GST included in the amount."
                  onChange={e => setGst(e.target.value)}
                />
              )}
              {(tdsOn && type === 'DIRECT') || isTdsDeposit ? (
                <>
                  {type === 'DIRECT' && (
                    <Input
                      label="TDS deducted (₹)"
                      inputMode="decimal"
                      value={tds}
                      error={errors.tds}
                      onChange={e => setTds(e.target.value)}
                    />
                  )}
                  <Input
                    label="TDS section"
                    value={tdsSection}
                    error={errors.tdsSection}
                    placeholder="194C"
                    onChange={e => setTdsSection(e.target.value.toUpperCase())}
                  />
                </>
              ) : null}
              {isTdsDeposit && (
                <Input
                  label="Challan number (optional)"
                  value={challan}
                  error={errors.challan}
                  onChange={e => setChallan(e.target.value)}
                />
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
