'use client';
import { useMemo, useState } from 'react';
import { FileField } from '@/components/residents/common';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useLoad } from '@/hooks/useLoad';
import { ApiError } from '@/lib/apiClient';
import { inr } from '@/lib/money';
import { paymentsService } from '@/services/payments.service';
import { residentsService } from '@/services/residents.service';
import type {
  CollectionRequestRef,
  FlatOption,
  OfflineMethod,
  OfflinePaymentInput,
  OfflinePaymentResult,
} from '@/types/payments';
import { isoDay, paiseText, paymentError, rupeesToPaise, today } from './format';

const METHODS: { value: OfflineMethod; label: string }[] = [
  { value: 'CASH', label: 'Cash' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'NEFT', label: 'NEFT / IMPS / RTGS' },
  { value: 'UPI_TO_BANK', label: 'UPI to society QR' },
];
/** The three bank-transfer rails share one choice in the prototype; the reference tells them apart. */
const TRANSFER_RAILS: OfflineMethod[] = ['NEFT', 'IMPS', 'RTGS'];

type Errors = Partial<Record<string, string>>;

/** Record a payment (spec 8.11, 11.1): the payment waits for a second person's approval. */
export function RecordPaymentModal({
  initialUnit,
  onClose,
  onRecorded,
}: {
  /** A flat chosen already (opened from a flat's page). */
  initialUnit?: { unitId: number; unitLabel: string };
  onClose: () => void;
  onRecorded: (r: OfflinePaymentResult) => void;
}) {
  const [search, setSearch] = useState('');
  const flats = useLoad(
    async (): Promise<FlatOption[]> => {
      const r = await residentsService.flats({
        q: search.trim().length >= 2 ? search.trim() : undefined,
        limit: 50,
      });
      return r.items
        .map(f => ({
          unitId: f.unitId,
          unitLabel: f.unitLabel,
          duesPaise: f.duesPaise ?? 0,
          payerName: f.primaryOwner?.name ?? '',
        }))
        .sort((a, b) => b.duesPaise - a.duesPaise || a.unitLabel.localeCompare(b.unitLabel));
    },
    search.trim().length >= 2 ? search.trim() : '',
  );
  const collections = useLoad(() => paymentsService.liveCollections(), 'collections');

  const [unitId, setUnitId] = useState<number | null>(initialUnit?.unitId ?? null);
  const [payingFor, setPayingFor] = useState('DUES');
  const [typed, setTyped] = useState<string | null>(null);
  const [method, setMethod] = useState<OfflineMethod>('CASH');
  const [reference, setReference] = useState('');
  const [bank, setBank] = useState('');
  const [chequeNo, setChequeNo] = useState('');
  const [chequeDate, setChequeDate] = useState(today());
  const [date, setDate] = useState(today());
  const [notes, setNotes] = useState('');
  const [fileIds, setFileIds] = useState<(number | null)[]>([null]);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<OfflinePaymentResult | null>(null);

  const flat = useMemo(() => flats.data?.find(f => f.unitId === unitId) ?? null, [flats.data, unitId]);
  const unitLabel = flat?.unitLabel ?? initialUnit?.unitLabel ?? '';
  const duesPaise = flat?.duesPaise ?? 0;

  // the open request of the chosen flat in the chosen collection
  const found = useLoad(async (): Promise<CollectionRequestRef | null> => {
    if (payingFor === 'DUES' || !unitLabel || unitId === null) return null;
    try {
      const list = await paymentsService.collectionRequestFor(Number(payingFor), unitLabel);
      return list.find(r => r.unitId === unitId && r.status !== 'PAID' && r.status !== 'WAIVED') ?? null;
    } catch {
      return null;
    }
  }, `${payingFor}|${unitId}|${unitLabel}`);
  const request = payingFor === 'DUES' ? null : found.data;
  const requestMissing = payingFor !== 'DUES' && unitId !== null && !found.loading && !found.data;

  // amount prefilled with the dues of the flat, or the open part of the collection request, until it is typed
  const suggested =
    payingFor === 'DUES'
      ? duesPaise > 0
        ? paiseText(duesPaise)
        : ''
      : request
        ? paiseText(Math.max(0, request.amountPaise - request.paidPaise))
        : '';
  const amount = typed ?? suggested;

  const needsReference = method !== 'CASH' && method !== 'CHEQUE';

  const build = (confirmDuplicate: boolean): OfflinePaymentInput | null => {
    const e: Errors = {};
    if (unitId === null) e.unitId = 'Choose a flat.';
    const paise = rupeesToPaise(amount);
    if (paise === null || paise < 100) e.amount = 'Enter an amount of at least ₹1.';
    if (payingFor !== 'DUES' && !request) e.payingFor = 'This flat has no open request in that collection.';
    if (!isoDay(date)) e.date = 'Enter the payment date.';
    if (needsReference) {
      const ref = reference.trim();
      if (method === 'UPI_TO_BANK') {
        if (!/^\d{12}$/.test(ref)) e.reference = 'Use the 12-digit UPI reference.';
      } else if (!/^[A-Za-z0-9]{12,22}$/.test(ref)) e.reference = 'Use the UTR: 12 to 22 letters and digits.';
    }
    if (method === 'CHEQUE') {
      if (bank.trim().length < 2) e.bank = 'Enter the cheque bank.';
      if (!/^\d{6}$/.test(chequeNo)) e.chequeNo = 'The cheque number has 6 digits.';
      if (!isoDay(chequeDate)) e.chequeDate = 'Enter the cheque date.';
    }
    setErrors(e);
    if (Object.keys(e).length > 0 || unitId === null || paise === null) return null;
    const ids = fileIds.filter((x): x is number => x !== null);
    return {
      unitId,
      payingFor: payingFor === 'DUES' ? 'DUES' : 'COLLECTION',
      ...(payingFor !== 'DUES' && request ? { collectionRequestId: request.id } : {}),
      method,
      amountPaise: paise,
      paymentDate: date,
      ...(needsReference ? { referenceNo: reference.trim() } : {}),
      ...(method === 'CHEQUE' ? { cheque: { bankName: bank.trim(), chequeNo, chequeDate } } : {}),
      ...(flat?.payerName ? { payerName: flat.payerName } : {}),
      ...(ids.length ? { fileIds: ids } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      ...(confirmDuplicate ? { confirmDuplicate: true } : {}),
    };
  };

  const submit = async (confirmDuplicate = false) => {
    setFormError(null);
    const body = build(confirmDuplicate);
    if (!body) return;
    setBusy(true);
    try {
      const r = await paymentsService.recordOffline(body);
      setResult(r);
      onRecorded(r);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'DUPLICATE_PAYMENT_SUSPECTED') setDuplicate(true);
      else {
        setDuplicate(false);
        setFormError(paymentError(err));
      }
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    const pending = result.status === 'PENDING_APPROVAL';
    return (
      <Modal
        open
        onClose={onClose}
        title={pending ? 'Sent for approval' : 'Payment recorded'}
        footer={<Button onClick={onClose}>Done</Button>}
      >
        <Alert tone="ok">
          {pending
            ? `${inr(result.amountPaise)} from ${unitLabel} is waiting for a second committee member. The receipt is issued once it is approved.`
            : `${inr(result.amountPaise)} from ${unitLabel} is recorded. Receipt ${result.receiptNo ?? ''}.`}
        </Alert>
      </Modal>
    );
  }

  const flatOptions = [
    { value: '', label: flats.loading ? 'Loading flats...' : 'Choose a flat' },
    ...(initialUnit && !flat ? [{ value: String(initialUnit.unitId), label: initialUnit.unitLabel }] : []),
    ...(flats.data ?? []).map(f => ({
      value: String(f.unitId),
      label: f.duesPaise > 0 ? `${f.unitLabel} (owes ${inr(f.duesPaise)})` : f.unitLabel,
    })),
  ];

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title="Record a payment"
      description="Cash, cheque or bank transfer received outside the app."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={() => void submit(false)}>
            Record and send for approval
          </Button>
        </>
      }
    >
      {formError && <Alert tone="bad">{formError}</Alert>}
      {duplicate && (
        <Alert tone="warn">
          <p className="font-semibold">Possible duplicate</p>
          <p>A payment from this flat with the same method, amount and date is already recorded.</p>
          <Button size="sm" variant="glass" className="mt-2" loading={busy} onClick={() => void submit(true)}>
            Record anyway
          </Button>
        </Alert>
      )}
      {!initialUnit && (
        <Input
          label="Search flat"
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="A-1203"
        />
      )}
      <Select
        label="Flat"
        required
        value={unitId ? String(unitId) : ''}
        error={errors.unitId}
        onChange={e => {
          setUnitId(Number(e.target.value) || null);
          setTyped(null);
        }}
        options={flatOptions}
      />
      <Select
        label="Paying for"
        value={payingFor}
        error={
          errors.payingFor ?? (requestMissing ? 'This flat has no open request in that collection.' : null)
        }
        onChange={e => {
          setPayingFor(e.target.value);
          setTyped(null);
        }}
        options={[
          { value: 'DUES', label: 'Maintenance dues (oldest first)' },
          ...(collections.data ?? []).map(c => ({ value: String(c.id), label: c.title })),
        ]}
      />
      <Input
        label="Amount (₹)"
        required
        inputMode="decimal"
        value={amount}
        error={errors.amount}
        onChange={e => {
          setTyped(e.target.value);
        }}
      />
      <Select
        label="Method"
        value={TRANSFER_RAILS.includes(method) ? 'NEFT' : method}
        onChange={e => setMethod(e.target.value as OfflineMethod)}
        options={METHODS}
        hint="Cash goes to Cash in hand. Cheques are counted in the bank balance only after they clear."
      />
      {needsReference && (
        <Input
          label="Reference (UTR or UPI reference)"
          value={reference}
          error={errors.reference}
          onChange={e => setReference(e.target.value)}
        />
      )}
      {method === 'CHEQUE' && (
        <>
          <Input
            label="Cheque bank"
            value={bank}
            error={errors.bank}
            onChange={e => setBank(e.target.value)}
          />
          <Input
            label="Cheque number"
            inputMode="numeric"
            maxLength={6}
            value={chequeNo}
            error={errors.chequeNo}
            onChange={e => setChequeNo(e.target.value.replace(/\D/g, ''))}
          />
          <Input
            label="Cheque date"
            type="date"
            value={chequeDate}
            error={errors.chequeDate}
            onChange={e => setChequeDate(e.target.value)}
          />
        </>
      )}
      <Input
        label="Received on"
        type="date"
        value={date}
        max={today()}
        error={errors.date}
        onChange={e => setDate(e.target.value)}
      />
      <Textarea label="Note" value={notes} maxLength={500} onChange={e => setNotes(e.target.value)} />
      {fileIds.map((_, i) => (
        <FileField
          key={i}
          label={i === 0 ? 'Proof (photo of the cheque or the transfer)' : `Proof ${i + 1}`}
          purpose="PAYMENT_PROOF"
          onChange={id => setFileIds(list => list.map((x, j) => (j === i ? id : x)))}
        />
      ))}
      {fileIds.length < 3 && fileIds[fileIds.length - 1] !== null && (
        <Button size="sm" variant="ghost" onClick={() => setFileIds(l => [...l, null])}>
          Add another proof
        </Button>
      )}
    </Modal>
  );
}
