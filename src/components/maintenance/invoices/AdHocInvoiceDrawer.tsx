'use client';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { useLoad } from '@/hooks/useLoad';
import { billingInvoicesService } from '@/services/billingInvoices.service';
import type { InvoiceDetail, UnitOption } from '@/types/billingInvoices';
import { UnitPicker } from './InvoiceBits';
import { LinesEditor, newLine, parseLines, type LineDraft } from './LinesEditor';
import { addDaysIso, billingInvoiceError, todayIso } from './format';

/** New one-off invoice for a flat (spec 8.14): flat, 1 to 20 charges, due date and a narration. GST comes from the heads. */
export function AdHocInvoiceDrawer({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (invoice: InvoiceDetail) => void;
}) {
  const today = todayIso();
  const [unit, setUnit] = useState<UnitOption | null>(null);
  const [drafts, setDrafts] = useState<LineDraft[]>(() => [newLine()]);
  const [dueDate, setDueDate] = useState(addDaysIso(today, 15));
  const [description, setDescription] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const heads = useLoad(() => billingInvoicesService.heads());

  const submit = async () => {
    const parsed = parseLines(drafts, 20);
    const narration = description.trim();
    const fail = !unit
      ? 'Choose the flat to bill.'
      : parsed.problem
        ? parsed.problem
        : !dueDate || dueDate < today || dueDate > addDaysIso(today, 365)
          ? 'The due date must be from today to one year ahead.'
          : narration.length < 2 || narration.length > 300
            ? 'Write the purpose of the bill in 2 to 300 characters.'
            : null;
    if (fail || !unit) return setProblem(fail);
    setBusy(true);
    setProblem(null);
    try {
      onCreated(
        await billingInvoicesService.createAdHoc({
          unitId: unit.id,
          lines: parsed.lines,
          dueDate,
          description: narration,
        }),
      );
    } catch (e) {
      setProblem(billingInvoiceError(e));
      setBusy(false);
    }
  };

  return (
    <Drawer
      open
      onClose={busy ? () => {} : onClose}
      title="New invoice"
      size={640}
      description="A one-off bill for a single flat, for example a hall booking or a repair charge."
      footer={
        <>
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={() => void submit()}>
            Create invoice
          </Button>
        </>
      }
    >
      {problem && (
        <Alert tone="bad" className="mb-3">
          {problem}
        </Alert>
      )}
      <UnitPicker label="Flat" value={unit} onChange={setUnit} required />
      {heads.error != null ? (
        <Alert tone="bad" className="my-3">
          {billingInvoiceError(heads.error)}
        </Alert>
      ) : heads.loading ? (
        <div className="skeleton my-3 h-24 w-full" />
      ) : (
        <LinesEditor drafts={drafts} heads={heads.data ?? []} max={20} onChange={setDrafts} />
      )}
      <Input
        label="Due date"
        type="date"
        value={dueDate}
        min={today}
        max={addDaysIso(today, 365)}
        onChange={e => setDueDate(e.target.value)}
        required
      />
      <Textarea
        label="Narration"
        hint="Printed on the bill as its purpose."
        value={description}
        maxLength={300}
        onChange={e => setDescription(e.target.value)}
        required
      />
      <p className="text-[13px] text-muted">
        GST is added by the rules of each charge head. The bill goes to the owner or payer of the flat, and
        the resident is notified.
      </p>
    </Drawer>
  );
}
