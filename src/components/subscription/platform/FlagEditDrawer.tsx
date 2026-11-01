'use client';
import { useId, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Drawer } from '@/components/ui/Drawer';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { subscriptionsService } from '@/services/subscriptions.service';
import type { FeatureFlag } from '@/types/subscriptions';
import { PLAN_CODES } from '../format';
import { planName } from '../planLock';
import { EVALUATION_ORDER, FLAG_TYPE_LABEL, ROLLOUT_HINT } from './flags';
import { ReviewDialog, type Diff } from './ReviewDialog';

/** Spec 11.2 edit drawer: description, rollout slider, minimum plan, visibility, owner, expiry; then diff and reason. */
export function FlagEditDrawer({
  flag,
  onClose,
  onSaved,
}: {
  flag: FeatureFlag;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const sliderId = useId();
  const [description, setDescription] = useState(flag.description);
  const [rollout, setRollout] = useState(flag.rolloutPercent ?? 0);
  const [minPlan, setMinPlan] = useState(flag.minPlanCode ?? 'STANDARD');
  const [clientVisible, setClientVisible] = useState(flag.isClientVisible);
  const [owner, setOwner] = useState(flag.ownerTeam ?? '');
  const [expires, setExpires] = useState(flag.expiresOn ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [review, setReview] = useState<{ diffs: Diff[]; body: Record<string, unknown> } | null>(null);

  const next = () => {
    const body: Record<string, unknown> = {};
    const diffs: Diff[] = [];
    const add = (
      field: string,
      label: string,
      before: unknown,
      after: unknown,
      show = (v: unknown) => String(v ?? ''),
    ) => {
      if (before === after) return;
      body[field] = after;
      diffs.push({ label, before: show(before), after: show(after) });
    };
    add('description', 'Description', flag.description, description.trim());
    if (flag.type === 'PERCENTAGE')
      add('rolloutPercent', 'Rollout', flag.rolloutPercent ?? 0, rollout, v => `${v}%`);
    if (flag.type === 'PLAN')
      add('minPlanCode', 'Minimum plan', flag.minPlanCode, minPlan, v => (v ? planName(String(v)) : '-'));
    if (flag.type !== 'KILL_SWITCH')
      add('isClientVisible', 'Visible to apps', flag.isClientVisible, clientVisible, v => (v ? 'Yes' : 'No'));
    add('ownerTeam', 'Owner team', flag.ownerTeam ?? null, owner.trim() || null, v => String(v ?? '-'));
    add('expiresOn', 'Remove by', flag.expiresOn ?? null, expires || null, v => String(v ?? '-'));
    return { body, diffs };
  };

  const reviewNow = () => {
    const e: Record<string, string> = {};
    const d = description.trim();
    if (d.length < 5 || d.length > 300) e.description = 'Enter between 5 and 300 characters.';
    if (owner.trim().length > 60) e.owner = 'Up to 60 characters.';
    setErrors(e);
    if (Object.keys(e).length) return;
    const n = next();
    if (n.diffs.length === 0) {
      toast.show('No changes to save.', 'warning');
      return;
    }
    setReview(n);
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={flag.flagKey}
      description={FLAG_TYPE_LABEL[flag.type]}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={reviewNow}>Save</Button>
        </>
      }
    >
      <Input
        label="Description"
        value={description}
        onChange={e => setDescription(e.target.value)}
        error={errors.description}
        required
      />
      {flag.type === 'PERCENTAGE' && (
        <div className="mb-4">
          <label htmlFor={sliderId} className="mb-1.5 block text-[13px] font-semibold">
            Rollout percentage: <b>{rollout}%</b>
          </label>
          <input
            id={sliderId}
            type="range"
            min={0}
            max={100}
            step={5}
            value={rollout}
            onChange={e => setRollout(Number(e.target.value))}
            className="w-full accent-[#143041]"
          />
          <p className="mt-1.5 text-[12.5px] text-muted">{ROLLOUT_HINT}</p>
        </div>
      )}
      {flag.type === 'PLAN' && (
        <Select
          label="Minimum plan"
          value={minPlan}
          onChange={e => setMinPlan(e.target.value)}
          options={PLAN_CODES.map(p => ({ value: p, label: planName(p) }))}
        />
      )}
      {flag.type !== 'KILL_SWITCH' && (
        <Checkbox
          label="Show this flag to the web and mobile apps"
          checked={clientVisible}
          onChange={e => setClientVisible(e.target.checked)}
        />
      )}
      <Input label="Owner team" value={owner} onChange={e => setOwner(e.target.value)} error={errors.owner} />
      <Input
        label="Remove by"
        type="date"
        value={expires}
        onChange={e => setExpires(e.target.value)}
        hint="Flags are temporary. Pick when it should be cleaned up."
      />
      <Alert tone="info">{EVALUATION_ORDER}</Alert>
      {review && (
        <ReviewDialog
          title={`Save changes to ${flag.flagKey}`}
          text="Every society evaluates the new settings at once."
          confirmLabel="Save"
          diffs={review.diffs}
          onCancel={() => setReview(null)}
          onConfirm={reason =>
            subscriptionsService.updateFlag(flag.id, { ...review.body, reason, version: flag.version })
          }
          onDone={() => {
            setReview(null);
            toast.show('Flag updated.');
            onSaved();
          }}
        />
      )}
    </Drawer>
  );
}
