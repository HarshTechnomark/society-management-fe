'use client';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useLoad } from '@/hooks/useLoad';
import { ApiError } from '@/lib/apiClient';
import { inr } from '@/lib/money';
import { collectionsService } from '@/services/collections.service';
import type { CollectionDetail, OfflineContributionInput } from '@/types/collections';
import { collectionError, paiseToRupees, rupeesToPaise, todayIso } from './format';

const METHODS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'NEFT', label: 'NEFT' },
  { value: 'IMPS', label: 'IMPS' },
  { value: 'RTGS', label: 'RTGS' },
  { value: 'UPI_TO_BANK', label: 'UPI to society QR' },
];

/**
 * Record a contribution made offline (spec 11.1, POST /payments/offline with `payingFor` COLLECTION). The payment goes
 * for approval unless the society auto-approves. A flat that already paid in full is not listed.
 */
export function RecordContributionDialog({
  collection,
  requestId,
  onCancel,
  onDone,
}: {
  collection: CollectionDetail;
  requestId?: number;
  onCancel: () => void;
  onDone: (message: string) => void;
}) {
  const today = todayIso();
  const open = useLoad(async () => {
    const [a, b] = await Promise.all([
      collectionsService.requests(collection.id, { status: 'OPEN', limit: 100 }),
      collectionsService.requests(collection.id, { status: 'PART_PAID', limit: 100 }),
    ]);
    return [...a.items, ...b.items].sort((x, y) =>
      x.unitLabel.localeCompare(y.unitLabel, 'en', { numeric: true }),
    );
  });
  const [chosen, setChosen] = useState(requestId ? String(requestId) : '');
  // null until the person types: then the amount still due of the chosen flat is shown
  const [typed, setTyped] = useState<string | null>(null);
  const [method, setMethod] = useState<OfflineContributionInput['method']>('CASH');
  const [date, setDate] = useState(today);
  const [reference, setReference] = useState('');
  const [bank, setBank] = useState('');
  const [chequeNo, setChequeNo] = useState('');
  const [chequeDate, setChequeDate] = useState(today);
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState(false);
  const [busy, setBusy] = useState(false);

  const req = (open.data ?? []).find(r => String(r.id) === chosen);
  const due = req ? req.amountPaise - req.paidPaise : 0;
  const amount = typed ?? (due > 0 ? paiseToRupees(due) : '');
  const pick = (id: string) => {
    setChosen(id);
    setTyped(null);
  };

  const submit = async (confirmDuplicate = false) => {
    const e: Record<string, string> = {};
    const paise = rupeesToPaise(amount);
    if (!req) e.request = 'Choose the flat.';
    if (paise === null || paise < 100) e.amount = 'Enter an amount of at least ₹1.';
    else if (collection.amountMode === 'MIN_PER_UNIT' && paise < collection.minAmountPaise)
      e.amount = `The minimum is ${inr(collection.minAmountPaise)}.`;
    if (!date || date > today) e.date = 'The payment date cannot be in the future.';
    if (method !== 'CASH' && method !== 'CHEQUE' && reference.trim().length < 4)
      e.reference = 'Enter the reference number of the payment.';
    if (method === 'CHEQUE') {
      if (bank.trim().length < 2 || bank.trim().length > 80)
        e.bank = 'Enter the bank name (2 to 80 characters).';
      if (!/^\d{6}$/.test(chequeNo)) e.chequeNo = 'The cheque number has 6 digits.';
      if (!chequeDate) e.chequeDate = 'Enter the cheque date.';
    }
    setErrors(e);
    if (Object.keys(e).length || !req || paise === null) return;
    setBusy(true);
    setProblem(null);
    try {
      const r = (await collectionsService.recordContribution({
        unitId: req.unitId,
        collectionRequestId: req.id,
        method,
        amountPaise: paise,
        paymentDate: date,
        ...(reference.trim() ? { referenceNo: reference.trim() } : {}),
        ...(method === 'CHEQUE' ? { cheque: { bankName: bank.trim(), chequeNo, chequeDate } } : {}),
        ...(note.trim() ? { notes: note.trim() } : {}),
        ...(confirmDuplicate ? { confirmDuplicate: true } : {}),
      })) as { status?: string } | null;
      onDone(
        r?.status === 'PENDING_APPROVAL'
          ? 'Sent for approval'
          : `Recorded ${inr(paise)} from ${req.unitLabel}`,
      );
    } catch (err) {
      if (err instanceof ApiError && err.code === 'DUPLICATE_PAYMENT_SUSPECTED') setDuplicate(true);
      else if (err instanceof ApiError && err.code === 'VALIDATION_FAILED' && err.errors?.length) {
        const f: Record<string, string> = {};
        const KEY: Record<string, string> = {
          amountPaise: 'amount',
          referenceNo: 'reference',
          paymentDate: 'date',
          collectionRequestId: 'request',
          unitId: 'request',
          'cheque.bankName': 'bank',
          'cheque.chequeNo': 'chequeNo',
          'cheque.chequeDate': 'chequeDate',
        };
        for (const x of err.errors) f[KEY[x.field] ?? x.field] = x.message;
        setErrors(f);
      } else setProblem(collectionError(err));
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={busy ? () => {} : onCancel}
      title="Record contribution"
      description={collection.title}
      footer={
        <>
          <Button variant="ghost" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
          {duplicate ? (
            <Button variant="gold" loading={busy} onClick={() => void submit(true)}>
              Record anyway
            </Button>
          ) : (
            <Button loading={busy} onClick={() => void submit()}>
              Record and send for approval
            </Button>
          )}
        </>
      }
    >
      {problem && (
        <Alert tone="bad" className="mb-3">
          {problem}
        </Alert>
      )}
      {duplicate && (
        <Alert tone="warn" className="mb-3">
          A payment of this amount was just recorded for this flat. Record it anyway only if it is a different
          payment.
        </Alert>
      )}
      <Select
        label="Flat"
        value={chosen}
        error={errors.request}
        onChange={e => pick(e.target.value)}
        options={[
          { value: '', label: open.loading ? 'Loading flats' : 'Choose a flat' },
          ...(open.data ?? []).map(r => ({
            value: String(r.id),
            label: `${r.unitLabel}${r.amountPaise ? ` · asked ${inr(r.amountPaise)}` : ''}`,
          })),
        ]}
        required
      />
      <Input
        label="Amount (₹)"
        inputMode="decimal"
        value={amount}
        error={errors.amount}
        onChange={e => setTyped(e.target.value)}
        required
      />
      <Select
        label="Method"
        value={method}
        onChange={e => setMethod(e.target.value as typeof method)}
        options={METHODS}
      />
      <Input
        label="Payment date"
        type="date"
        value={date}
        max={today}
        error={errors.date}
        onChange={e => setDate(e.target.value)}
        required
      />
      {method !== 'CASH' && method !== 'CHEQUE' && (
        <Input
          label="Reference number"
          value={reference}
          error={errors.reference}
          onChange={e => setReference(e.target.value)}
          required
        />
      )}
      {method === 'CHEQUE' && (
        <>
          <Input
            label="Bank"
            value={bank}
            error={errors.bank}
            onChange={e => setBank(e.target.value)}
            required
          />
          <Input
            label="Cheque number"
            inputMode="numeric"
            maxLength={6}
            value={chequeNo}
            error={errors.chequeNo}
            onChange={e => setChequeNo(e.target.value)}
            required
          />
          <Input
            label="Cheque date"
            type="date"
            value={chequeDate}
            error={errors.chequeDate}
            onChange={e => setChequeDate(e.target.value)}
            required
          />
          <p className="mb-4 text-[12.5px] text-muted">
            Cheques are counted in the bank balance only after they clear.
          </p>
        </>
      )}
      <Textarea label="Note" value={note} maxLength={500} rows={2} onChange={e => setNote(e.target.value)} />
    </Modal>
  );
}
