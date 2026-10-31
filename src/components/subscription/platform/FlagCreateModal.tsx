'use client';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { ApiError } from '@/lib/apiClient';
import { subscriptionsService } from '@/services/subscriptions.service';
import type { FlagCreateInput, FlagType } from '@/types/subscriptions';
import { PLAN_CODES, subscriptionErrorText } from '../format';
import { planName } from '../planLock';
import { FLAG_KEY_RE, FLAG_TYPES } from './flags';

const TYPE_OPTIONS: Record<FlagType, string> = {
  GLOBAL: 'Global',
  PLAN: 'Plan based',
  TENANT: 'Per society',
  PERCENTAGE: 'Percentage rollout',
  KILL_SWITCH: 'Kill switch',
};

const todayIso = () => new Date().toISOString().slice(0, 10);
const plusDaysIso = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

/** Spec 11.2 create modal (with the client-visible switch, owner team and expiry date of the prototype update). */
export function FlagCreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const toast = useToast();
  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<FlagType>('GLOBAL');
  const [startsOn, setStartsOn] = useState(false);
  const [minPlan, setMinPlan] = useState('STANDARD');
  const [rollout, setRollout] = useState('10');
  const [clientVisible, setClientVisible] = useState(false);
  const [owner, setOwner] = useState('');
  const [expires, setExpires] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const e: Record<string, string> = {};
    const k = key.trim();
    if (!FLAG_KEY_RE.test(k) || k.length > 80) e.key = 'Use the form module.feature_name in lowercase.';
    const d = description.trim();
    if (d.length < 5 || d.length > 300) e.description = 'Describe the flag in 5 to 300 characters.';
    if (type === 'PERCENTAGE' && (!/^\d+$/.test(rollout) || Number(rollout) > 100))
      e.rollout = 'Between 0 and 100.';
    if (owner.trim().length > 60) e.owner = 'Up to 60 characters.';
    if (expires && (expires < todayIso() || expires > plusDaysIso(730)))
      e.expires = 'Pick a date from today to two years ahead.';
    const r = reason.trim();
    if (r.length < 5 || r.length > 500) e.reason = 'Enter between 5 and 500 characters.';
    setErrors(e);
    setError(null);
    if (Object.keys(e).length) return;
    const body: FlagCreateInput = { flagKey: k, description: d, type, isEnabled: startsOn, reason: r };
    if (type === 'PLAN') body.minPlanCode = minPlan;
    if (type === 'PERCENTAGE') body.rolloutPercent = Number(rollout);
    if (type !== 'KILL_SWITCH') body.isClientVisible = clientVisible;
    if (owner.trim()) body.ownerTeam = owner.trim();
    if (expires) body.expiresOn = expires;
    setBusy(true);
    try {
      await subscriptionsService.createFlag(body);
      toast.show('Flag created.');
      onCreated();
    } catch (x) {
      if (x instanceof ApiError && x.code === 'FLAG_KEY_TAKEN') setErrors({ key: subscriptionErrorText(x) });
      else setError(subscriptionErrorText(x));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Create feature flag"
      description="Keys are permanent. Use module.feature_name."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={submit}>
            Create flag
          </Button>
        </>
      }
    >
      {error && <Alert tone="bad">{error}</Alert>}
      <Input
        label="Key"
        value={key}
        placeholder="billing.new_invoice_layout"
        hint="module.feature_name"
        onChange={e => setKey(e.target.value)}
        error={errors.key}
        autoCapitalize="none"
        spellCheck={false}
        required
      />
      <Input
        label="Description"
        value={description}
        placeholder="What does it control?"
        onChange={e => setDescription(e.target.value)}
        error={errors.description}
        required
      />
      <div className="grid gap-x-3 sm:grid-cols-2">
        <Select
          label="Type"
          value={type}
          onChange={e => setType(e.target.value as FlagType)}
          options={FLAG_TYPES.map(t => ({ value: t, label: TYPE_OPTIONS[t] }))}
        />
        <Select
          label="Starts as"
          value={startsOn ? 'on' : 'off'}
          onChange={e => setStartsOn(e.target.value === 'on')}
          options={[
            { value: 'off', label: 'Off' },
            { value: 'on', label: 'On' },
          ]}
        />
      </div>
      {type === 'PLAN' && (
        <Select
          label="Minimum plan"
          value={minPlan}
          onChange={e => setMinPlan(e.target.value)}
          options={PLAN_CODES.map(p => ({ value: p, label: planName(p) }))}
        />
      )}
      {type === 'PERCENTAGE' && (
        <Input
          label="Initial rollout (%)"
          inputMode="numeric"
          value={rollout}
          onChange={e => setRollout(e.target.value)}
          error={errors.rollout}
        />
      )}
      {type !== 'KILL_SWITCH' && (
        <Checkbox
          label="Show this flag to the web and mobile apps"
          checked={clientVisible}
          onChange={e => setClientVisible(e.target.checked)}
        />
      )}
      <div className="grid gap-x-3 sm:grid-cols-2">
        <Input
          label="Owner team"
          value={owner}
          onChange={e => setOwner(e.target.value)}
          error={errors.owner}
        />
        <Input
          label="Remove by"
          type="date"
          value={expires}
          onChange={e => setExpires(e.target.value)}
          error={errors.expires}
        />
      </div>
      <Input
        label="Reason"
        value={reason}
        placeholder="Why is this flag needed?"
        onChange={e => setReason(e.target.value)}
        error={errors.reason}
        required
      />
    </Modal>
  );
}
