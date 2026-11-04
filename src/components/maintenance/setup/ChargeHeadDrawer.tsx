'use client';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Drawer } from '@/components/ui/Drawer';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { billingSetupService } from '@/services/billingSetup.service';
import type { ChargeHead, ChargeHeadInput, GstTreatment, HeadType, PayerRouting } from '@/types/billingSetup';
import {
  CREATABLE_HEAD_TYPES,
  GST_LABEL,
  HEAD_TYPE_LABEL,
  OWNER_ONLY_TYPES,
  ROUTING_LABEL,
  billingSetupError,
  fieldErrors,
  opts,
} from './format';

const KEY_RE = /^[A-Z][A-Z0-9_]{1,39}$/;
const LEDGER_RE = /^(\d{4}(-\d{3})?|[A-Z][A-Z_]{2,39})$/;

interface Form {
  key: string;
  name: string;
  description: string;
  headType: HeadType;
  payerRouting: PayerRouting;
  gstTreatment: GstTreatment;
  sacCode: string;
  prorate: boolean;
  interestBearing: boolean;
  ledgerAccountCode: string;
  sortOrder: string;
}

const blank: Form = {
  key: '',
  name: '',
  description: '',
  headType: 'OTHER',
  payerRouting: 'BILL_TO',
  gstTreatment: 'NONE',
  sacCode: '',
  prorate: true,
  interestBearing: true,
  ledgerAccountCode: '',
  sortOrder: '100',
};

const fromHead = (h: ChargeHead): Form => ({
  key: h.key,
  name: h.name,
  description: h.description ?? '',
  headType: h.headType,
  payerRouting: h.payerRouting,
  gstTreatment: h.gstTreatment,
  sacCode: h.sacCode ?? '',
  prorate: h.prorate,
  interestBearing: h.interestBearing,
  ledgerAccountCode: h.ledgerAccountCode,
  sortOrder: String(h.sortOrder),
});

/** Add or edit a charge head (spec 11.5, fields of 7.1). `key` and `headType` are fixed once created (BR-11-8). */
export function ChargeHeadDrawer({
  head,
  onClose,
  onSaved,
}: {
  /** The head to edit, or null to add one. */
  head: ChargeHead | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const editing = head !== null;
  const system = head?.isSystem ?? false;
  const [f, setF] = useState<Form>(head ? fromHead(head) : blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF(s => ({ ...s, [k]: v }));
  const ownerOnly = OWNER_ONLY_TYPES.includes(f.headType);

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!editing && !KEY_RE.test(f.key))
      e.key = 'Use capital letters, digits and _ (2 to 40 characters), starting with a letter.';
    const name = f.name.trim();
    if (name.length < 2 || name.length > 80) e.name = 'Enter 2 to 80 characters.';
    if (f.description.length > 300) e.description = 'At most 300 characters.';
    if (f.gstTreatment !== 'NONE' && !/^\d{4,8}$/.test(f.sacCode.trim()))
      e.sacCode = 'Enter the SAC code (4 to 8 digits) when GST applies.';
    if (!system && !LEDGER_RE.test(f.ledgerAccountCode.trim()))
      e.ledgerAccountCode = 'Use an account code such as 4100 or 4100-001.';
    const so = Number(f.sortOrder);
    if (!Number.isInteger(so) || so < 0 || so > 999) e.sortOrder = 'Enter a whole number from 0 to 999.';
    if (ownerOnly && f.payerRouting !== 'OWNER')
      e.payerRouting = 'This type of head is always billed to the owner.';
    return e;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    setFormError(null);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const body: ChargeHeadInput = {
        name: f.name.trim(),
        description: f.description.trim() || (editing ? null : undefined),
        payerRouting: f.payerRouting,
        gstTreatment: f.gstTreatment,
        sacCode: f.gstTreatment === 'NONE' ? null : f.sacCode.trim(),
        prorate: f.prorate,
        interestBearing: f.interestBearing,
        ledgerAccountCode: f.ledgerAccountCode.trim(),
        sortOrder: Number(f.sortOrder),
      };
      if (head) {
        // A system head accepts only name, description, sort order and SAC code (BR-11-11).
        const patch = system
          ? {
              name: body.name,
              description: body.description,
              sortOrder: body.sortOrder,
              sacCode: body.sacCode,
            }
          : body;
        await billingSetupService.updateChargeHead(head.id, { ...patch, version: head.version });
        toast.show('Charge head saved.');
      } else {
        await billingSetupService.createChargeHead({ ...body, key: f.key, headType: f.headType });
        toast.show('Charge head added.');
      }
      onSaved();
    } catch (x) {
      setErrors(fieldErrors(x));
      setFormError(billingSetupError(x));
      setStale((x as { code?: string }).code === 'STALE_VERSION');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={editing ? `Edit ${head.name}` : 'Add a charge head'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="charge-head-form" loading={busy}>
            {editing ? 'Save changes' : 'Add charge head'}
          </Button>
        </>
      }
    >
      {formError && (
        <Alert tone="bad">
          {formError}{' '}
          {stale && (
            <button className="font-semibold underline" type="button" onClick={onSaved}>
              Reload
            </button>
          )}
        </Alert>
      )}
      {system && (
        <Alert tone="info">
          This is a system head. You can change its name, description, order and SAC code only.
        </Alert>
      )}
      <form id="charge-head-form" onSubmit={submit} noValidate>
        <Input
          label="Key"
          value={f.key}
          onChange={e => set('key', e.target.value.toUpperCase())}
          error={errors.key}
          hint={editing ? 'The key never changes.' : 'Short code such as LIFT_FUND. It never changes.'}
          disabled={editing}
          required
        />
        <Input
          label="Name"
          value={f.name}
          onChange={e => set('name', e.target.value)}
          error={errors.name}
          hint="Printed on bills."
          required
        />
        <Input
          label="Description"
          value={f.description}
          onChange={e => set('description', e.target.value)}
          error={errors.description}
        />
        <Select
          label="Type"
          value={f.headType}
          onChange={e => {
            const t = e.target.value as HeadType;
            setF(s => ({
              ...s,
              headType: t,
              payerRouting: OWNER_ONLY_TYPES.includes(t) ? 'OWNER' : s.payerRouting,
            }));
          }}
          disabled={editing}
          hint={editing ? 'The type never changes.' : undefined}
          options={opts(
            Object.fromEntries(
              (editing ? [f.headType] : CREATABLE_HEAD_TYPES).map(t => [t, HEAD_TYPE_LABEL[t]]),
            ) as Record<HeadType, string>,
          )}
        />
        <Select
          label="Billed to"
          value={f.payerRouting}
          onChange={e => set('payerRouting', e.target.value as PayerRouting)}
          disabled={system}
          error={errors.payerRouting}
          hint={
            ownerOnly
              ? 'Sinking fund, repair fund and non-occupancy are always billed to the owner.'
              : 'Bill-to means the owner, or the tenant when the tenancy says the tenant pays.'
          }
          options={opts(ROUTING_LABEL)}
        />
        <Select
          label="GST"
          value={f.gstTreatment}
          onChange={e => set('gstTreatment', e.target.value as GstTreatment)}
          disabled={system}
          options={opts<GstTreatment>(
            system
              ? GST_LABEL
              : { NONE: GST_LABEL.NONE, THRESHOLD: GST_LABEL.THRESHOLD, ALWAYS: GST_LABEL.ALWAYS },
          )}
        />
        {f.gstTreatment !== 'NONE' && (
          <Input
            label="SAC code"
            value={f.sacCode}
            onChange={e => set('sacCode', e.target.value)}
            error={errors.sacCode}
            inputMode="numeric"
            hint="The code your CA advises. Needed before the first GST bill."
            required
          />
        )}
        <Input
          label="Ledger account code"
          value={f.ledgerAccountCode}
          onChange={e => set('ledgerAccountCode', e.target.value.toUpperCase())}
          error={errors.ledgerAccountCode}
          disabled={system}
          hint="The income or liability account this head posts to, for example 4100."
          required
        />
        <Input
          label="Order on bills"
          type="number"
          min={0}
          max={999}
          value={f.sortOrder}
          onChange={e => set('sortOrder', e.target.value)}
          error={errors.sortOrder}
        />
        <Checkbox
          label="Charge only for the days the flat is liable (prorate)"
          checked={f.prorate}
          disabled={system}
          onChange={e => set('prorate', e.target.checked)}
        />
        <Checkbox
          label="Interest is charged on unpaid amounts of this head"
          checked={f.interestBearing}
          disabled={system}
          onChange={e => set('interestBearing', e.target.checked)}
        />
      </form>
    </Drawer>
  );
}
