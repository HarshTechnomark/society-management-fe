'use client';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { inr } from '@/lib/money';
import type { TdsClaimInput } from '@/types/platformBilling';
import { FileAttach } from './FileAttach';
import { daysAgo, paiseText, rupeesToPaise, today } from './format';

export interface TdsDraft {
  section: '194J' | '194C' | 'OTHER';
  amount: string;
  deductedOn: string;
  notes: string;
  fileId: number | null;
}
export const emptyTds = (): TdsDraft => ({
  section: '194J',
  amount: '',
  deductedOn: today(),
  notes: '',
  fileId: null,
});

interface InvoiceLike {
  subtotalPaise: number;
  amountDuePaise: number;
  issueDate: string | null;
}

/** BR-06-33: TDS is at most 10% of the taxable value and never more than the amount due. */
export const maxTdsPaise = (inv: InvoiceLike) =>
  Math.min(Math.floor(inv.subtotalPaise / 10), inv.amountDuePaise);

export function validateTdsClaim(
  d: TdsDraft,
  inv: InvoiceLike,
): { errors: Record<string, string | null>; input: TdsClaimInput | null } {
  const paise = rupeesToPaise(d.amount);
  const max = maxTdsPaise(inv);
  const earliest = inv.issueDate
    ? new Date(new Date(`${inv.issueDate}T00:00:00Z`).getTime() - 30 * 86_400_000).toISOString().slice(0, 10)
    : daysAgo(400);
  const errors = {
    amount:
      paise === null || paise < 100
        ? 'Enter at least ₹1.'
        : paise > max
          ? `At most ${inr(max)} (10% of the taxable value).`
          : null,
    deductedOn:
      !d.deductedOn || d.deductedOn > today() || d.deductedOn < earliest
        ? 'Pick a date between 30 days before the invoice and today.'
        : null,
  };
  if (Object.values(errors).some(Boolean)) return { errors, input: null };
  return {
    errors,
    input: {
      tdsSection: d.section,
      amountPaise: paise!,
      deductedOn: d.deductedOn,
      certificateFileId: d.fileId ?? undefined,
      notes: d.notes.trim() || undefined,
    },
  };
}

/** The TDS claim fields shared by the society claim modal and the platform Record TDS modal. */
export function TdsClaimFields({
  draft,
  onChange,
  invoice,
  errors,
  certificate = true,
}: {
  draft: TdsDraft;
  onChange: (d: TdsDraft) => void;
  invoice: InvoiceLike;
  errors: Record<string, string | null>;
  certificate?: boolean;
}) {
  const max = maxTdsPaise(invoice);
  return (
    <>
      <Select
        label="TDS section"
        value={draft.section}
        onChange={e => onChange({ ...draft, section: e.target.value as TdsDraft['section'] })}
        options={[
          { value: '194J', label: '194J (professional or technical fees)' },
          { value: '194C', label: '194C (contract)' },
          { value: 'OTHER', label: 'Other' },
        ]}
      />
      <Input
        label="TDS amount (₹)"
        inputMode="decimal"
        hint={`max ${inr(max)} (10% of taxable value)`}
        value={draft.amount}
        placeholder={paiseText(max)}
        onChange={e => onChange({ ...draft, amount: e.target.value })}
        error={errors.amount}
        required
      />
      <Input
        label="Deducted on"
        type="date"
        max={today()}
        value={draft.deductedOn}
        onChange={e => onChange({ ...draft, deductedOn: e.target.value })}
        error={errors.deductedOn}
        required
      />
      {certificate && (
        <FileAttach
          label="TDS certificate"
          purpose="TDS_CERTIFICATE"
          onChange={id => onChange({ ...draft, fileId: id })}
        />
      )}
      <Textarea
        label="Notes"
        value={draft.notes}
        maxLength={500}
        onChange={e => onChange({ ...draft, notes: e.target.value })}
      />
    </>
  );
}
