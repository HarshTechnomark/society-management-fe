'use client';
import { useState } from 'react';
import { Card } from '@/components/common/PageHead';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { approvalsRulesService } from '@/services/approvalsRules.service';
import type { SimulationResult } from '@/types/approvalsRules';
import { typeLabel } from '../format';
import { useMembers } from './pickers';
import { MODE_LABEL, rulesError, toPaise } from './rulesFormat';

const VIA: Record<string, string> = { ROLE: 'by role', USER: 'named', FALLBACK: 'fallback' };

/** "Try it" (spec 8.16): which rule would match and who could approve, with no changes saved. */
export function SimulatorPanel({ types }: { types: { type: string; label: string }[] }) {
  const { members } = useMembers();
  const [type, setType] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [requester, setRequester] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SimulationResult | null>(null);

  const run = async () => {
    setResult(null);
    const cat = category.trim().toUpperCase();
    if (!type) return setError('Choose a type.');
    if (amount.trim() !== '' && !/^\d+(\.\d{1,2})?$/.test(amount.trim()))
      return setError('Enter the amount in rupees, for example 12500.');
    if (cat && !/^[A-Z0-9_]{2,40}$/.test(cat))
      return setError('A category is 2 to 40 letters, digits or underscores.');
    setError(null);
    setBusy(true);
    try {
      setResult(
        await approvalsRulesService.simulate({
          type,
          ...(amount.trim() ? { amountPaise: toPaise(amount) } : {}),
          ...(cat ? { categoryKey: cat } : {}),
          ...(requester ? { requesterUserId: Number(requester) } : {}),
        }),
      );
    } catch (e) {
      setError(rulesError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Try it" sub="See which rule would apply and who would be asked. Nothing is saved.">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Select
          label="Type"
          value={type}
          onChange={e => setType(e.target.value)}
          options={[
            { value: '', label: 'Choose a type' },
            ...types.map(t => ({ value: t.type, label: typeLabel(t.type, t.label) })),
          ]}
        />
        <Input
          label="Amount (₹)"
          inputMode="decimal"
          value={amount}
          onChange={e => setAmount(e.target.value)}
        />
        <Input label="Category" value={category} onChange={e => setCategory(e.target.value)} />
        <Select
          label="Raised by"
          value={requester}
          onChange={e => setRequester(e.target.value)}
          options={[
            { value: '', label: 'Me' },
            ...members.map(m => ({ value: String(m.userId), label: m.name })),
          ]}
        />
      </div>
      <div className="mt-3">
        <Button loading={busy} onClick={() => void run()}>
          Check who approves
        </Button>
      </div>
      {error && (
        <Alert tone="bad" className="mt-3">
          {error}
        </Alert>
      )}
      {result && (
        <div className="mt-4" aria-live="polite" data-testid="simulation">
          {result.matchedRuleId == null ? (
            <Alert tone="info">No rule matches, so this would be approved automatically.</Alert>
          ) : (
            <p className="text-[14px]">
              Rule: <strong>{result.ruleName}</strong>
              {result.routing === 'AUTO_APPROVE' && ' (approved automatically)'}
              {result.stepUpRequired && ' · the approver is asked for a fresh code'}
            </p>
          )}
          <ol className="mt-2 grid gap-2">
            {result.steps.map(s => (
              <li key={s.stepNo} className="rounded-xl border border-[rgba(20,35,44,0.12)] p-3 text-[14px]">
                <div className="font-semibold">
                  Step {s.stepNo}: {s.name}{' '}
                  <span className="font-normal text-muted">({MODE_LABEL[s.mode]})</span>
                </div>
                {s.eligibleNow.length > 0 ? (
                  <ul className="mt-1">
                    {s.eligibleNow.map(p => (
                      <li key={`${p.userId}-${p.roleKey}`}>
                        {p.name}{' '}
                        <span className="text-muted">
                          ({p.roleKey}, {VIA[p.via] ?? p.via})
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-bad">Nobody can approve this step today.</p>
                )}
                {s.vacantSlots.length > 0 && (
                  <p className="mt-1 text-[13px] text-muted">
                    {requester !== '' && s.eligibleNow.length === 0
                      ? `No one available for: ${s.vacantSlots.map(v => v.charAt(0).toUpperCase() + v.slice(1)).join(', ')} (the requester cannot approve their own request)`
                      : `Empty seats: ${s.vacantSlots.join(', ')}`}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </Card>
  );
}
