'use client';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { approvalsRulesService } from '@/services/approvalsRules.service';
import { typeLabel } from '../format';
import { useMembers } from '../rules/pickers';
import { indiaNow, indiaToIso, rulesError, toPaise } from '../rules/rulesFormat';

const DAY = 86_400_000;

/** Hand my approvals to another member for a period (spec 8.18, 11.4). */
export function DelegationDialog({
  types,
  onCancel,
  onCreated,
}: {
  types: { type: string; label: string }[];
  onCancel: () => void;
  onCreated: () => void;
}) {
  const { members, loading } = useMembers();
  const [opened] = useState(() => Date.now());
  const [delegate, setDelegate] = useState('');
  const [from, setFrom] = useState(() => indiaNow());
  const [to, setTo] = useState(() => indiaNow(7 * DAY));
  const [all, setAll] = useState(true);
  const [picked, setPicked] = useState<string[]>([]);
  const [limit, setLimit] = useState('');
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = from ? new Date(`${from}:00+05:30`).getTime() : NaN;
  const end = to ? new Date(`${to}:00+05:30`).getTime() : NaN;
  const r = reason.trim();
  const errors = {
    delegate: delegate ? null : 'Choose who covers for you.',
    from: Number.isNaN(start)
      ? 'Choose a start.'
      : start < opened - 5 * 60_000
        ? 'The start cannot be in the past.'
        : null,
    to: Number.isNaN(end)
      ? 'Choose an end.'
      : end <= start
        ? 'The end must be after the start.'
        : end > start + 90 * DAY
          ? 'A delegation can last at most 90 days.'
          : null,
    types: !all && picked.length === 0 ? 'Choose at least one type.' : null,
    limit:
      limit.trim() !== '' && (!/^\d+(\.\d{1,2})?$/.test(limit.trim()) || toPaise(limit) < 1)
        ? 'Enter an amount in rupees.'
        : null,
    reason: r.length < 5 || r.length > 500 ? 'Enter 5 to 500 characters.' : null,
  };
  const show = (k: keyof typeof errors) => (touched ? errors[k] : null);

  const submit = async () => {
    setTouched(true);
    setError(null);
    if (Object.values(errors).some(Boolean)) return;
    setBusy(true);
    try {
      await approvalsRulesService.createDelegation({
        delegateUserId: Number(delegate),
        startsAt: indiaToIso(from),
        endsAt: indiaToIso(to),
        types: all ? null : picked,
        maxAmountPaise: limit.trim() === '' ? null : toPaise(limit),
        reason: r,
      });
      onCreated();
    } catch (e) {
      setError(rulesError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      wide
      onClose={busy ? () => {} : onCancel}
      title="Away? Delegate your approvals"
      description="The member you choose can approve for you during these dates. You can end it early."
      footer={
        <>
          <Button variant="ghost" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
          <Button loading={busy} onClick={() => void submit()}>
            Create delegation
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        {error && <Alert tone="bad">{error}</Alert>}
        <Select
          label="Delegate"
          value={delegate}
          onChange={e => setDelegate(e.target.value)}
          error={show('delegate')}
          options={[
            { value: '', label: loading ? 'Loading members' : 'Choose a member' },
            ...members.map(m => ({ value: String(m.userId), label: `${m.name} (${m.designation})` })),
          ]}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="From (India time)"
            type="datetime-local"
            value={from}
            onChange={e => setFrom(e.target.value)}
            error={show('from')}
          />
          <Input
            label="To (India time)"
            type="datetime-local"
            value={to}
            onChange={e => setTo(e.target.value)}
            error={show('to')}
          />
        </div>
        <fieldset className="min-w-0">
          <legend className="mb-1 text-[13px] font-semibold">What they can approve</legend>
          <Checkbox
            label="All kinds of approvals"
            checked={all}
            onChange={e => setAll(e.target.checked)}
            className="!mb-1.5"
          />
          {!all && (
            <div className="grid gap-x-4 sm:grid-cols-2">
              {types.map(t => (
                <Checkbox
                  key={t.type}
                  className="!mb-1.5"
                  label={typeLabel(t.type, t.label)}
                  checked={picked.includes(t.type)}
                  onChange={e =>
                    setPicked(e.target.checked ? [...picked, t.type] : picked.filter(x => x !== t.type))
                  }
                />
              ))}
            </div>
          )}
          {show('types') && <p className="text-[12.5px] font-medium text-bad">{errors.types}</p>}
        </fieldset>
        <Input
          label="Up to amount (₹)"
          hint="Leave empty for any amount."
          inputMode="decimal"
          value={limit}
          onChange={e => setLimit(e.target.value)}
          error={show('limit')}
        />
        <Textarea
          label="Reason"
          value={reason}
          onChange={e => setReason(e.target.value)}
          error={show('reason')}
          required
        />
      </div>
    </Modal>
  );
}
