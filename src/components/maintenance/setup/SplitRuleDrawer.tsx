'use client';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { inr } from '@/lib/money';
import { billingSetupService } from '@/services/billingSetup.service';
import type { AmountSource, SplitBasis, SplitRule, SplitRuleInput } from '@/types/billingSetup';
import { ScopePicker, allUnits, scopeFromApi, scopeToApi, type ScopeState } from './ScopePicker';
import { splitShares } from './splitMath';
import {
  AMOUNT_SOURCE_LABEL,
  BASIS_LABEL,
  UNIT_TYPE_VALUES,
  billingSetupError,
  fieldErrors,
  opts,
  paiseToRupees,
  rupeesToPaise,
} from './format';

/** "501 = 3" lines of a custom weight rule. */
export function parseCustomWeights(text: string): { weights?: Record<string, number>; error?: string } {
  const out: Record<string, number> = {};
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    const m = /^(\d+)\s*[=:,\s]\s*(\d+)$/.exec(t);
    if (!m) return { error: `"${t}" is not a flat id and a weight. Write one per line, like 501 = 3.` };
    const w = Number(m[2]);
    if (w > 1_000_000) return { error: 'A weight can be at most 1,000,000.' };
    out[m[1]] = w;
  }
  if (!Object.values(out).some(w => w > 0)) return { error: 'Give at least one flat a weight above 0.' };
  return { weights: out };
}
const customText = (w: Record<string, number>) =>
  Object.entries(w)
    .map(([k, v]) => `${k} = ${v}`)
    .join('\n');

/** Add or edit a bill split rule (spec 8.3): basis, amount source, scope, weights, with an exact-paise example. */
export function SplitRuleDrawer({
  rule,
  onClose,
  onSaved,
}: {
  rule: SplitRule | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(rule?.name ?? '');
  const [description, setDescription] = useState(rule?.description ?? '');
  const [basis, setBasis] = useState<SplitBasis>(rule?.basis ?? 'EQUAL');
  const [source, setSource] = useState<AmountSource>(rule?.amountSource ?? 'FIXED');
  const [fixed, setFixed] = useState(paiseToRupees(rule?.fixedAmountPaise));
  const [scope, setScope] = useState<ScopeState>(
    rule ? scopeFromApi(rule.scopeType, rule.scopeValues) : allUnits,
  );
  const [typeW, setTypeW] = useState<Record<string, string>>(
    rule?.basis === 'UNIT_TYPE_WEIGHT'
      ? Object.fromEntries(Object.entries(rule.weights).map(([k, v]) => [k, String(v)]))
      : {},
  );
  const [customW, setCustomW] = useState(rule?.basis === 'CUSTOM_WEIGHT' ? customText(rule.weights) : '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const typeWeights = (): { weights?: Record<string, number>; error?: string } => {
    const w: Record<string, number> = {};
    for (const [k, t] of Object.entries(typeW)) {
      if (t.trim() === '') continue;
      const n = Number(t);
      if (!Number.isInteger(n) || n < 0 || n > 1_000_000)
        return { error: `The weight of ${k} must be a whole number from 0 to 1,000,000.` };
      w[k] = n;
    }
    return Object.values(w).some(x => x > 0)
      ? { weights: w }
      : { error: 'Give at least one flat type a weight above 0.' };
  };

  const total = source === 'FIXED' ? rupeesToPaise(fixed) : 1_000_000;
  const sample: number[] | null =
    basis === 'EQUAL'
      ? [1, 1, 1]
      : basis === 'AREA'
        ? [650, 800, 1000]
        : basis === 'UNIT_TYPE_WEIGHT'
          ? typeWeights().weights
            ? Object.values(typeWeights().weights!).filter(x => x > 0)
            : null
          : parseCustomWeights(customW).weights
            ? Object.values(parseCustomWeights(customW).weights!)
                .filter(x => x > 0)
                .slice(0, 6)
            : null;
  const shares = sample && total ? splitShares(total, sample) : null;

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setFormError(null);
    const e: Record<string, string> = {};
    if (name.trim().length < 2 || name.trim().length > 100) e.name = 'Enter 2 to 100 characters.';
    if (description.length > 300) e.description = 'At most 300 characters.';
    let fixedAmountPaise: number | null = null;
    if (source === 'FIXED') {
      fixedAmountPaise = rupeesToPaise(fixed);
      if (fixedAmountPaise === null || fixedAmountPaise < 1 || fixedAmountPaise > 1_000_000_000)
        e.fixed = 'Enter an amount from ₹0.01 to ₹1,00,00,000 per month.';
    }
    const sc = scopeToApi(scope);
    if (sc.error) e.scope = sc.error;
    let weights: Record<string, number> | undefined;
    if (basis === 'UNIT_TYPE_WEIGHT') {
      const t = typeWeights();
      if (t.error) e.weights = t.error;
      weights = t.weights;
    } else if (basis === 'CUSTOM_WEIGHT') {
      const c = parseCustomWeights(customW);
      if (c.error) e.weights = c.error;
      weights = c.weights;
    }
    setErrors(e);
    if (Object.keys(e).length) return;
    const body: SplitRuleInput = {
      name: name.trim(),
      description: description.trim() || undefined,
      basis,
      amountSource: source,
      fixedAmountPaise: source === 'FIXED' ? fixedAmountPaise : null,
      scopeType: scope.type,
      ...(sc.values ? { scopeValues: sc.values } : {}),
      ...(weights ? { weights } : {}),
    };
    setBusy(true);
    try {
      if (rule) await billingSetupService.updateSplitRule(rule.id, { ...body, version: rule.version });
      else await billingSetupService.createSplitRule(body);
      toast.show('Split rule saved.');
      onSaved();
    } catch (x) {
      setErrors(fieldErrors(x));
      setFormError(billingSetupError(x));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      open
      onClose={onClose}
      size={640}
      title={rule ? `Edit ${rule.name}` : 'Add a split rule'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="split-form" loading={busy}>
            Save split rule
          </Button>
        </>
      }
    >
      {formError && <Alert tone="bad">{formError}</Alert>}
      <form id="split-form" onSubmit={submit} noValidate>
        <Input
          label="Name"
          value={name}
          onChange={e => setName(e.target.value)}
          error={errors.name}
          hint="For example: Lift AMC - Wing D."
          required
        />
        <Input
          label="Description"
          value={description}
          onChange={e => setDescription(e.target.value)}
          error={errors.description}
        />
        <Select
          label="Split by"
          value={basis}
          onChange={e => setBasis(e.target.value as SplitBasis)}
          options={opts(BASIS_LABEL)}
        />
        <Select
          label="Total amount"
          value={source}
          onChange={e => setSource(e.target.value as AmountSource)}
          options={opts(AMOUNT_SOURCE_LABEL)}
        />
        {source === 'FIXED' && (
          <Input
            label="Total per month (₹)"
            inputMode="decimal"
            value={fixed}
            onChange={e => setFixed(e.target.value)}
            error={errors.fixed}
            required
          />
        )}
        <ScopePicker
          value={scope}
          onChange={setScope}
          error={errors.scope}
          label="Flats that share the total"
        />
        {basis === 'UNIT_TYPE_WEIGHT' && (
          <fieldset className="mb-4">
            <legend className="mb-1.5 text-[13px] font-semibold">Weight of each flat type</legend>
            <div className="grid grid-cols-2 gap-x-3">
              {UNIT_TYPE_VALUES.map(t => (
                <Input
                  key={t}
                  label={t}
                  inputMode="numeric"
                  value={typeW[t] ?? ''}
                  onChange={e => setTypeW({ ...typeW, [t]: e.target.value })}
                />
              ))}
            </div>
            {errors.weights && <p className="text-[12.5px] font-medium text-bad">{errors.weights}</p>}
          </fieldset>
        )}
        {basis === 'CUSTOM_WEIGHT' && (
          <Textarea
            label="Weight of each flat"
            rows={5}
            value={customW}
            onChange={e => setCustomW(e.target.value)}
            error={errors.weights}
            hint="One flat per line: the flat id, then the weight, like 501 = 3. A flat without a line pays nothing."
          />
        )}
        {shares && sample && (
          <div className="mb-4 rounded-[14px] bg-white/60 p-3 text-[13.5px]" aria-label="Example split">
            <p className="font-semibold">
              Example: {inr(total!)} shared by {sample.length}{' '}
              {basis === 'AREA' ? 'flats of 650, 800 and 1,000 sq ft' : 'flats'}
            </p>
            <p>
              {shares.map(s => inr(s)).join(' + ')} = {inr(shares.reduce((a, b) => a + b, 0))}
            </p>
            <p className="text-[12.5px] text-muted">
              Shares add up exactly. Leftover paise go to the largest remainders first.
            </p>
          </div>
        )}
      </form>
    </Drawer>
  );
}
