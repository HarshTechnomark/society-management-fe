'use client';
import { useState } from 'react';
import { UnitPicker } from '@/components/maintenance/invoices/InvoiceBits';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { useFeature } from '@/hooks/useFeature';
import { inr, shortDate } from '@/lib/money';
import { paymentsOpsService } from '@/services/paymentsOps.service';
import type { CreatedLink, LinkChannel } from '@/types/paymentsOps';
import type { UnitOption } from '@/types/billingInvoices';
import { opsError, rupeesToPaise } from '../ops/format';

const CHANNELS: { value: LinkChannel; label: string }[] = [
  { value: 'SMS', label: 'SMS' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
];

/** Create a payment link (spec 8.18). The full link is shown once, with a copy button. WhatsApp needs the Standard plan. */
export function CreateLinkDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const toast = useToast();
  const whatsappOn = useFeature('payments.whatsapp_payment_link');
  const [unit, setUnit] = useState<UnitOption | null>(null);
  const [mode, setMode] = useState<'OUTSTANDING' | 'FIXED'>('OUTSTANDING');
  const [amount, setAmount] = useState('');
  const [days, setDays] = useState('');
  const [channels, setChannels] = useState<LinkChannel[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<CreatedLink | null>(null);

  const toggle = (c: LinkChannel) =>
    setChannels(cur => (cur.includes(c) ? cur.filter(x => x !== c) : [...cur, c]));

  const submit = async () => {
    const e: Record<string, string> = {};
    if (!unit) e.unit = 'Choose the flat.';
    const paise = mode === 'FIXED' ? rupeesToPaise(amount) : null;
    if (mode === 'FIXED' && (paise === null || paise < 100 || paise > 100_000_000))
      e.amount = 'Enter an amount from ₹1 to ₹10,00,000.';
    const d = days.trim() === '' ? undefined : Number(days);
    if (d !== undefined && (!Number.isInteger(d) || d < 1 || d > 30)) e.days = 'Enter 1 to 30 days.';
    setErrors(e);
    setFailed(null);
    if (Object.keys(e).length || !unit) return;
    setBusy(true);
    try {
      const link = await paymentsOpsService.createLink({
        unitId: unit.id,
        amountMode: mode,
        ...(mode === 'FIXED' ? { amountPaise: paise! } : {}),
        ...(d !== undefined ? { expiresInDays: d } : {}),
        ...(channels.length ? { channels } : {}),
      });
      setCreated(link);
      onCreated();
    } catch (err) {
      setFailed(opsError(err));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(created!.url);
      toast.show('Link copied.');
    } catch {
      toast.show('Could not copy. Select the link and copy it by hand.', 'warning');
    }
  };

  if (created)
    return (
      <Modal
        open
        sticky
        onClose={onClose}
        title="Payment link ready"
        description="This is the only time the full link is shown. Copy it now."
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>
              Done
            </Button>
            <Button onClick={() => void copy()}>Copy link</Button>
          </>
        }
      >
        <p className="text-[14px]">
          {inr(created.amountPaise)} for {unit?.label}
          {created.expiresAt ? `, valid until ${shortDate(created.expiresAt)}` : ''}.
        </p>
        <input
          readOnly
          aria-label="Payment link"
          value={created.url}
          onFocus={e => e.currentTarget.select()}
          className="mt-3 h-11 w-full rounded-xl border border-[rgba(20,35,44,0.16)] bg-white/70 px-3 text-[13.5px]"
        />
      </Modal>
    );

  return (
    <Modal
      open
      onClose={busy ? () => {} : onClose}
      title="New payment link"
      description="A link the payer opens to pay without signing in."
      footer={
        <>
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={() => void submit()}>
            Create link
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        {failed && (
          <p role="alert" className="rounded-xl bg-[#f6dcda] px-3 py-2 text-[13.5px] text-[#8a1d17]">
            {failed}
          </p>
        )}
        <UnitPicker label="Flat" value={unit} onChange={setUnit} required error={errors.unit} />
        <Select
          label="Amount"
          value={mode}
          onChange={e => setMode(e.target.value as 'OUTSTANDING' | 'FIXED')}
          options={[
            { value: 'OUTSTANDING', label: 'All dues of the flat, oldest first' },
            { value: 'FIXED', label: 'A fixed amount' },
          ]}
        />
        {mode === 'FIXED' && (
          <Input
            label="Amount (₹)"
            inputMode="decimal"
            value={amount}
            error={errors.amount}
            onChange={e => setAmount(e.target.value)}
            required
          />
        )}
        <Input
          label="Valid for (days)"
          inputMode="numeric"
          value={days}
          error={errors.days}
          hint="1 to 30. Leave empty for the society default."
          onChange={e => setDays(e.target.value)}
        />
        <fieldset>
          <legend className="mb-1 text-[13px] font-semibold">Send the link by</legend>
          {CHANNELS.map(c => {
            const locked = c.value === 'WHATSAPP' && !whatsappOn;
            return (
              <Checkbox
                key={c.value}
                label={locked ? 'WhatsApp (Standard plan)' : c.label}
                disabled={locked}
                checked={channels.includes(c.value)}
                onChange={() => toggle(c.value)}
                className="mb-1"
              />
            );
          })}
        </fieldset>
      </div>
    </Modal>
  );
}
