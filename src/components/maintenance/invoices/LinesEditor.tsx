'use client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import type { HeadOption, NoteLineInput } from '@/types/billingInvoices';
import { rupeesToPaise } from './format';

export interface LineDraft {
  key: number;
  headId: string;
  description: string;
  amount: string;
}
let counter = 0;
export const newLine = (): LineDraft => ({ key: ++counter, headId: '', description: '', amount: '' });

/** Checks the drafts (heads, 2 to 200 character descriptions, ₹0.01 to ₹10,00,000) and returns API lines or the first problem. */
export function parseLines(
  drafts: LineDraft[],
  max: number,
): { lines: NoteLineInput[]; problem: string | null } {
  const lines: NoteLineInput[] = [];
  if (drafts.length === 0 || drafts.length > max)
    return { lines, problem: `Add between 1 and ${max} lines.` };
  for (const [i, d] of drafts.entries()) {
    const n = i + 1;
    const paise = rupeesToPaise(d.amount);
    if (!d.headId) return { lines, problem: `Line ${n}: choose a charge head.` };
    const desc = d.description.trim();
    if (desc.length < 2 || desc.length > 200)
      return { lines, problem: `Line ${n}: describe the charge in 2 to 200 characters.` };
    if (paise === null || paise < 1 || paise > 100_000_000)
      return { lines, problem: `Line ${n}: enter an amount from ₹0.01 to ₹10,00,000.` };
    lines.push({ chargeHeadId: Number(d.headId), description: desc, amountPaise: paise });
  }
  return { lines, problem: null };
}

/** Rows of charge head, description and amount, shared by the ad-hoc invoice and the debit note. */
export function LinesEditor({
  drafts,
  heads,
  max,
  onChange,
}: {
  drafts: LineDraft[];
  heads: HeadOption[];
  max: number;
  onChange: (next: LineDraft[]) => void;
}) {
  const set = (key: number, patch: Partial<LineDraft>) =>
    onChange(drafts.map(d => (d.key === key ? { ...d, ...patch } : d)));
  return (
    <fieldset className="mb-3">
      <legend className="mb-1 text-[13px] font-semibold">Charges</legend>
      <ul className="flex flex-col gap-3">
        {drafts.map((d, i) => {
          const head = heads.find(h => String(h.id) === d.headId);
          return (
            <li key={d.key} className="rounded-2xl border border-[var(--line)] p-3" data-testid="line-draft">
              <div className="grid grid-cols-1 gap-x-3 min-[560px]:grid-cols-2">
                <Select
                  label={`Charge head, line ${i + 1}`}
                  value={d.headId}
                  onChange={e => set(d.key, { headId: e.target.value })}
                  options={[
                    { value: '', label: 'Choose a head' },
                    ...heads.map(h => ({ value: String(h.id), label: h.name })),
                  ]}
                  hint={
                    head
                      ? head.gstTreatment === 'NONE'
                        ? 'No GST on this head.'
                        : 'GST is added on top as per the head setting.'
                      : undefined
                  }
                />
                <Input
                  label={`Amount in rupees, line ${i + 1}`}
                  inputMode="decimal"
                  value={d.amount}
                  onChange={e => set(d.key, { amount: e.target.value })}
                />
              </div>
              <Input
                label={`Description, line ${i + 1}`}
                value={d.description}
                maxLength={200}
                onChange={e => set(d.key, { description: e.target.value })}
              />
              {drafts.length > 1 && (
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => onChange(drafts.filter(x => x.key !== d.key))}
                >
                  {`Remove line ${i + 1}`}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {drafts.length < max && (
        <Button size="sm" variant="glass" className="mt-2" onClick={() => onChange([...drafts, newLine()])}>
          Add a line
        </Button>
      )}
    </fieldset>
  );
}
