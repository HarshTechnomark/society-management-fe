'use client';
import { useMemo, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Drawer } from '@/components/ui/Drawer';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { ConfirmReason } from '@/components/common/ConfirmReason';
import { ErrorState } from '@/components/common/ErrorState';
import { useLoad } from '@/hooks/useLoad';
import { shortDate } from '@/lib/money';
import { subscriptionsService } from '@/services/subscriptions.service';
import type { FeatureFlag, FlagOverride } from '@/types/subscriptions';
import { subscriptionErrorText } from '../format';
import { typeText } from './flags';

/** Spec 11.2 overrides drawer: the list, an add form and the evaluator for one society. */
export function FlagOverridesDrawer({
  flag,
  canEdit,
  onClose,
  onChanged,
}: {
  flag: FeatureFlag;
  canEdit: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const detail = useLoad(() => subscriptionsService.flag(flag.id));
  const subs = useLoad(() => subscriptionsService.platformSubscriptions({ limit: 100 }));
  const societies = useMemo(() => {
    const seen = new Map<number, string>();
    for (const s of subs.data?.data ?? []) seen.set(s.society.id, s.society.name);
    return [...seen.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [subs.data]);
  const nameOf = (o: FlagOverride) =>
    o.societyName ?? societies.find(s => s.id === o.societyId)?.name ?? `Society ${o.societyId}`;
  const [removing, setRemoving] = useState<FlagOverride | null>(null);

  const overrides = detail.data?.overrides ?? [];
  const changed = () => {
    detail.reload();
    onChanged();
  };

  return (
    <Drawer
      open
      size={640}
      onClose={onClose}
      title={flag.flagKey}
      description={`${typeText(flag)} · overrides and evaluation`}
    >
      <Evaluator flagId={flag.id} societies={societies} />
      <h3 className="mb-2 mt-4 text-[15px] font-bold">Society overrides ({overrides.length})</h3>
      {detail.error ? (
        <ErrorState error={detail.error} title="Overrides could not be loaded" />
      ) : !detail.data ? (
        <div className="skeleton h-20 w-full" />
      ) : overrides.length === 0 ? (
        <p className="mb-2 text-[14px] text-muted">No overrides. Every society follows the default.</p>
      ) : (
        <ul className="mb-2 flex flex-col divide-y divide-[var(--line)]">
          {overrides.map(o => (
            <li key={o.id} className="flex flex-wrap items-center gap-2 py-2">
              <span className="min-w-0 flex-1">
                <b className="block">{nameOf(o)}</b>
                <span className="block text-[13px] text-muted">
                  {o.reason} · {shortDate(o.createdAt)}
                  {o.expiresAt ? ` · until ${shortDate(o.expiresAt)}` : ''}
                </span>
              </span>
              <Chip tone={o.value ? 'ok' : 'bad'}>{o.value ? 'Forced on' : 'Forced off'}</Chip>
              {canEdit && (
                <Button
                  size="xs"
                  variant="glass"
                  aria-label={`Remove override for ${nameOf(o)}`}
                  onClick={() => setRemoving(o)}
                >
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <AddOverride
          flagId={flag.id}
          societies={societies.filter(s => !overrides.some(o => o.societyId === s.id))}
          onAdded={() => {
            toast.show('Override added.');
            changed();
          }}
        />
      )}
      {removing && (
        <ConfirmReason
          open
          title="Remove override?"
          description={`${nameOf(removing)} goes back to the default for ${flag.flagKey}.`}
          confirmLabel="Remove"
          onCancel={() => setRemoving(null)}
          onConfirm={async reason => {
            try {
              await subscriptionsService.removeFlagOverride(flag.id, removing.id, reason);
              toast.show('Override removed.');
              setRemoving(null);
              changed();
            } catch (e) {
              toast.show(subscriptionErrorText(e), 'error');
            }
          }}
        />
      )}
    </Drawer>
  );
}

function Evaluator({ flagId, societies }: { flagId: number; societies: { id: number; name: string }[] }) {
  const [picked, setPicked] = useState<number | null>(null);
  const societyId = picked ?? societies[0]?.id ?? null;
  const result = useLoad(
    () => (societyId === null ? Promise.resolve(null) : subscriptionsService.evaluateFlag(flagId, societyId)),
    societyId,
  );
  const name = societies.find(s => s.id === societyId)?.name ?? '';
  return (
    <div className="rounded-[18px] border border-[var(--line)] bg-white/50 p-3.5">
      <h3 className="mb-2 text-[13px] font-semibold uppercase text-muted">Evaluate for a society</h3>
      {societies.length === 0 ? (
        <p className="text-[13.5px] text-muted">No societies to evaluate.</p>
      ) : (
        <>
          <Select
            label="Society to evaluate"
            value={String(societyId ?? '')}
            onChange={e => setPicked(Number(e.target.value))}
            options={societies.map(s => ({ value: String(s.id), label: s.name }))}
          />
          <div data-testid="flag-evaluation">
            {result.error ? (
              <Alert tone="bad" className="mb-0">
                {subscriptionErrorText(result.error)}
              </Alert>
            ) : result.data ? (
              <Alert tone={result.data.on ? 'ok' : 'info'} className="mb-0">
                <b>
                  {name}: {result.data.on ? 'ON' : 'OFF'}.
                </b>{' '}
                {result.data.why}
                {result.data.bucket !== undefined && result.data.step !== 'PERCENTAGE'
                  ? ` (bucket ${result.data.bucket})`
                  : ''}
              </Alert>
            ) : (
              <div className="skeleton h-10 w-full" />
            )}
          </div>
        </>
      )}
    </div>
  );
}

function AddOverride({
  flagId,
  societies,
  onAdded,
}: {
  flagId: number;
  societies: { id: number; name: string }[];
  onAdded: () => void;
}) {
  const [societyId, setSocietyId] = useState('');
  const [value, setValue] = useState('on');
  const [reason, setReason] = useState('');
  const [expires, setExpires] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const chosen = societyId || String(societies[0]?.id ?? '');

  const submit = async () => {
    const e: Record<string, string> = {};
    if (!chosen) e.society = 'Pick a society.';
    const r = reason.trim();
    if (r.length < 5 || r.length > 500) e.reason = 'Enter between 5 and 500 characters.';
    let expiresAt: string | undefined;
    if (expires) {
      const t = new Date(`${expires}T23:59:59`).getTime();
      if (Number.isNaN(t) || t <= Date.now() || t > Date.now() + 365 * 86_400_000)
        e.expires = 'Pick a future date within a year.';
      else expiresAt = new Date(t).toISOString();
    }
    setErrors(e);
    setError(null);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await subscriptionsService.addFlagOverride(flagId, {
        societyId: Number(chosen),
        value: value === 'on',
        reason: r,
        ...(expiresAt ? { expiresAt } : {}),
      });
      setReason('');
      setExpires('');
      setSocietyId('');
      onAdded();
    } catch (x) {
      setError(subscriptionErrorText(x));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 rounded-[18px] border border-[var(--line)] bg-white/50 p-3.5">
      <h3 className="mb-2 text-[13px] font-semibold uppercase text-muted">Add override</h3>
      {error && <Alert tone="bad">{error}</Alert>}
      {societies.length === 0 ? (
        <p className="text-[13.5px] text-muted">Every listed society already has an override.</p>
      ) : (
        <>
          <div className="grid gap-x-3 sm:grid-cols-2">
            <Select
              label="Society"
              value={chosen}
              onChange={e => setSocietyId(e.target.value)}
              error={errors.society}
              options={societies.map(s => ({ value: String(s.id), label: s.name }))}
            />
            <Select
              label="Value"
              value={value}
              onChange={e => setValue(e.target.value)}
              options={[
                { value: 'on', label: 'Force on' },
                { value: 'off', label: 'Force off' },
              ]}
            />
          </div>
          <Input
            label="Reason"
            value={reason}
            onChange={e => setReason(e.target.value)}
            error={errors.reason}
            required
          />
          <Input
            label="Expires on (optional)"
            type="date"
            value={expires}
            onChange={e => setExpires(e.target.value)}
            error={errors.expires}
          />
          <div className="flex justify-end">
            <Button size="sm" loading={busy} onClick={submit}>
              Add override
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
