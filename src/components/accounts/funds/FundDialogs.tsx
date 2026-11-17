'use client';
import { useState } from 'react';
import { FundPicker } from '@/components/accounts/pickers/FundPicker';
import { accountsError, fieldErrors } from '@/components/accounts/format';
import { rupeesToPaise, todayIso } from '@/components/payments/ops/format';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { useFeature } from '@/hooks/useFeature';
import { accountsFundsService } from '@/services/accountsFunds.service';
import type { Fund } from '@/types/accountsFunds';

export const SEEDED = ['SINKING', 'REPAIR', 'CORPUS'];

/** Create a fund, or edit one (name, purpose and flags; the kind cannot change). */
export function FundFormDialog({
  fund,
  onClose,
  onSaved,
}: {
  fund: Fund | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const custom = useFeature('accounting.funds');
  const [kind, setKind] = useState<'COLLECTION' | 'CUSTOM'>(
    fund?.fundType === 'CUSTOM' ? 'CUSTOM' : 'COLLECTION',
  );
  const [name, setName] = useState(fund?.name ?? '');
  const [purpose, setPurpose] = useState(fund?.purpose ?? '');
  const [resolution, setResolution] = useState(fund?.usageRequiresResolution ?? false);
  const [show, setShow] = useState(fund?.showToResidents ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const e: Record<string, string> = {};
    const n = name.trim();
    if (n.length < 2 || n.length > 80) e.name = 'Enter a name of 2 to 80 characters.';
    if (purpose.length > 300) e.purpose = 'Keep the purpose within 300 characters.';
    setErrors(e);
    setFailed(null);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      if (fund)
        await accountsFundsService.update(fund.id, {
          name: n,
          purpose: purpose.trim() || null,
          usageRequiresResolution: resolution,
          showToResidents: show,
          version: fund.version,
        });
      else
        await accountsFundsService.create({
          fundType: kind,
          name: n,
          ...(purpose.trim() ? { purpose: purpose.trim() } : {}),
          usageRequiresResolution: resolution,
          showToResidents: show,
        });
      toast.show(fund ? 'Fund saved' : 'Fund created');
      onSaved();
    } catch (err) {
      setErrors(fieldErrors(err));
      setFailed(accountsError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={busy ? () => {} : onClose}
      title={fund ? 'Edit fund' : 'New fund'}
      description="A fund earmarks money for one purpose. New funds start at zero; move money in with a transfer."
      footer={
        <>
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={() => void submit()}>
            {fund ? 'Save' : 'Create fund'}
          </Button>
        </>
      }
    >
      <div className="grid gap-1">
        {failed && <Alert tone="bad">{failed}</Alert>}
        {!fund && (
          <Select
            label="Kind of fund"
            value={kind}
            onChange={e => setKind(e.target.value as 'COLLECTION' | 'CUSTOM')}
            hint={custom ? undefined : 'Custom funds are part of the Premium plan.'}
            options={[
              { value: 'COLLECTION', label: 'Event fund' },
              { value: 'CUSTOM', label: custom ? 'Custom fund' : 'Custom fund (Premium)' },
            ]}
          />
        )}
        {!fund && kind === 'CUSTOM' && !custom && (
          <Alert tone="warn">Custom funds need the Premium plan.</Alert>
        )}
        <Input
          label="Name"
          value={name}
          error={errors.name}
          onChange={e => setName(e.target.value)}
          required
        />
        <Textarea
          label="Purpose"
          value={purpose}
          error={errors.purpose}
          onChange={e => setPurpose(e.target.value)}
        />
        <Checkbox
          label="Spending from this fund needs a general body resolution"
          checked={resolution}
          onChange={e => setResolution(e.target.checked)}
        />
        <Checkbox
          label="Residents can see this fund in Society finances"
          checked={show}
          onChange={e => setShow(e.target.checked)}
        />
      </div>
    </Modal>
  );
}

/** Close a fund that has no money in it. */
export function CloseFundDialog({
  fund,
  onClose,
  onSaved,
}: {
  fund: Fund;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const run = async () => {
    setBusy(true);
    setFailed(null);
    try {
      await accountsFundsService.update(fund.id, { status: 'CLOSED', version: fund.version });
      toast.show('Fund closed');
      onSaved();
    } catch (e) {
      setFailed(accountsError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={busy ? () => {} : onClose}
      title={`Close ${fund.name}?`}
      description="A closed fund no longer takes money or spending. A fund can be closed only when its balance is zero."
      footer={
        <>
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            Keep it
          </Button>
          <Button variant="danger" loading={busy} onClick={() => void run()}>
            Close fund
          </Button>
        </>
      }
    >
      {failed && <Alert tone="bad">{failed}</Alert>}
    </Modal>
  );
}

/** Move money between funds (or from/to General). It waits for an approver, then posts. */
export function TransferDialog({
  from,
  onClose,
  onDone,
}: {
  from?: Fund | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [src, setSrc] = useState(from ? String(from.id) : '');
  const [dst, setDst] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayIso());
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const id = (v: string) => (v === 'general' ? null : Number(v));

  const submit = async () => {
    const e: Record<string, string> = {};
    if (!src) e.fromFundId = 'Choose where the money comes from.';
    if (!dst) e.toFundId = 'Choose where the money goes.';
    else if (src && src === dst) e.toFundId = 'Choose two different funds.';
    const paise = rupeesToPaise(amount);
    if (paise === null || paise < 100) e.amountPaise = 'Enter an amount of at least ₹1.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > todayIso()) e.date = 'Choose a date up to today.';
    if (reason.trim().length < 5 || reason.trim().length > 500)
      e.reason = 'Give a reason of 5 to 500 characters.';
    setErrors(e);
    setFailed(null);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const r = await accountsFundsService.transfer({
        fromFundId: id(src),
        toFundId: id(dst),
        amountPaise: paise!,
        date,
        reason: reason.trim(),
      });
      toast.show(r.done ? 'Money moved' : 'Sent for approval. The money moves once it is approved.');
      onDone();
    } catch (err) {
      setErrors(fieldErrors(err));
      setFailed(accountsError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={busy ? () => {} : onClose}
      title="Transfer between funds"
      description="Another committee member approves the transfer before the money moves."
      footer={
        <>
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={() => void submit()}>
            Request transfer
          </Button>
        </>
      }
    >
      <div className="grid gap-1">
        {failed && <Alert tone="bad">{failed}</Alert>}
        <FundPicker
          label="From"
          hint=""
          includeGeneral
          value={src}
          onChange={setSrc}
          error={errors.fromFundId}
          required
        />
        <FundPicker
          label="To"
          hint=""
          includeGeneral
          excludeId={src && src !== 'general' ? Number(src) : null}
          value={dst}
          onChange={setDst}
          error={errors.toFundId}
          required
        />
        <Input
          label="Amount (₹)"
          inputMode="decimal"
          value={amount}
          error={errors.amountPaise}
          onChange={e => setAmount(e.target.value)}
          required
        />
        <Input
          label="Date"
          type="date"
          value={date}
          max={todayIso()}
          error={errors.date}
          onChange={e => setDate(e.target.value)}
          required
        />
        <Textarea
          label="Reason"
          value={reason}
          error={errors.reason}
          onChange={e => setReason(e.target.value)}
          required
        />
      </div>
    </Modal>
  );
}
