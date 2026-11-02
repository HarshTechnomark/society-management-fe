'use client';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { useToast } from '@/components/ui/Toast';
import { FormModal } from '@/components/billing/FormModal';
import { PERMISSIONS } from '@/constants/permissions';
import { usePermission } from '@/hooks/usePermission';
import { platformOpsService as svc } from '@/services/platform-ops.service';
import type { Provider, ProviderChannel, TestSendResult } from '@/types/platformOps';
import { CHANNEL_LABEL, HealthChip, opsError, timeAgo } from '../format';
import { configFields, credentialFields, vendorsFor, type FieldDef } from './vendors';

const CHANNELS = Object.keys(CHANNEL_LABEL) as ProviderChannel[];

function FieldInputs({
  fields,
  values,
  onChange,
  secret,
  disabled,
}: {
  fields: FieldDef[];
  values: Record<string, string>;
  onChange: (key: string, v: string) => void;
  secret?: boolean;
  disabled?: boolean;
}) {
  return (
    <>
      {fields.map(f =>
        f.options ? (
          <Select
            key={f.key}
            label={f.label}
            disabled={disabled}
            value={values[f.key] ?? f.options[0]}
            onChange={e => onChange(f.key, e.target.value)}
            options={f.options.map(o => ({ value: o, label: o }))}
          />
        ) : secret ? (
          <PasswordInput
            key={f.key}
            label={f.label}
            autoComplete="off"
            value={values[f.key] ?? ''}
            onChange={e => onChange(f.key, e.target.value)}
          />
        ) : (
          <Input
            key={f.key}
            label={f.label}
            hint={f.hint}
            disabled={disabled}
            value={values[f.key] ?? ''}
            onChange={e => onChange(f.key, e.target.value)}
          />
        ),
      )}
    </>
  );
}

const asStrings = (o: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k, String(v ?? '')]));
/** Drops empty optional values; keeps the rest as typed. */
const clean = (v: Record<string, string>, fields: FieldDef[]) =>
  Object.fromEntries(
    fields
      .map(f => [f.key, (v[f.key] ?? f.options?.[0] ?? '').trim()] as const)
      .filter(([k, x]) => x !== '' || !fields.find(f => f.key === k)?.optional),
  );

/** Spec 11.3 provider configuration drawer; with `provider` null it adds a provider. */
export function ProviderDrawer({
  provider,
  onClose,
  onChanged,
}: {
  provider: Provider | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const canEdit = usePermission(PERMISSIONS.platform.settings.edit);
  const canTest = usePermission(PERMISSIONS.platform.health.edit);
  const [p, setP] = useState<Provider | null>(provider);
  const creating = provider === null;

  const [channel, setChannel] = useState<ProviderChannel>(provider?.channel ?? 'SMS');
  const [vendor, setVendor] = useState(provider?.vendor ?? vendorsFor('SMS')[0].vendor);
  const [key, setKey] = useState('');
  const [name, setName] = useState(provider?.displayName ?? '');
  const [desc, setDesc] = useState(provider?.description ?? '');
  const [priority, setPriority] = useState(String(provider?.priority ?? 1));
  const [latency, setLatency] = useState(String(provider?.health.degradedLatencyMs ?? 3000));
  const [config, setConfig] = useState<Record<string, string>>(asStrings(provider?.config ?? {}));
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [newCreds, setNewCreds] = useState<Record<string, string>>({});
  const [to, setTo] = useState('');
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestSendResult | null>(null);
  const [deleting, setDeleting] = useState(false);

  const cfg = configFields(vendor, channel);
  const credFields = credentialFields(vendor, channel);
  const disabled = !canEdit;

  const finish = (next: Provider, message: string) => {
    setP(next);
    toast.show(message);
    onChanged();
  };

  const create = async () => {
    setProblem(null);
    if (key.length < 3 || !/^[a-z][a-z0-9_]{2,39}$/.test(key))
      return setProblem('Provider key: lowercase letters, digits and underscores, 3 to 40 characters.');
    if (name.trim().length < 3) return setProblem('Enter a display name of at least 3 characters.');
    setBusy(true);
    try {
      const body = {
        providerKey: key,
        channel,
        vendor,
        displayName: name.trim(),
        ...(desc.trim() ? { description: desc.trim() } : {}),
        priority: Number(priority),
        config: clean(config, cfg),
        ...(credFields.length ? { credentials: clean(creds, credFields) } : {}),
        degradedLatencyMs: Number(latency),
      };
      const created = await svc.createProvider(body);
      toast.show('Provider added. Send a test, then enable it.');
      onChanged();
      setP(created);
    } catch (e) {
      setProblem(opsError(e));
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!p) return;
    setProblem(null);
    setBusy(true);
    try {
      const next = await svc.updateProvider(p.id, {
        version: p.version,
        displayName: name.trim(),
        description: desc.trim() || null,
        priority: Number(priority),
        degradedLatencyMs: Number(latency),
        config: clean(config, cfg),
      });
      finish(next, 'Provider saved.');
    } catch (e) {
      setProblem(opsError(e));
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (on: boolean) => {
    if (!p) return;
    setProblem(null);
    try {
      finish(
        await svc.updateProvider(p.id, { version: p.version, isEnabled: on }),
        on ? 'Provider enabled.' : 'Provider disabled.',
      );
    } catch (e) {
      setProblem(opsError(e));
    }
  };

  const test = async () => {
    if (!p) return;
    setProblem(null);
    setTesting(true);
    setResult(null);
    try {
      const body =
        p.channel === 'PUSH'
          ? { pushSubscriptionOfMe: true }
          : ['SMS', 'WHATSAPP', 'EMAIL'].includes(p.channel)
            ? { to: to.trim() }
            : {};
      setResult(await svc.testSend(p.id, body));
      onChanged();
    } catch (e) {
      setProblem(opsError(e));
    } finally {
      setTesting(false);
    }
  };

  const needsTarget = p && ['SMS', 'WHATSAPP', 'EMAIL'].includes(p.channel);
  return (
    <Drawer
      open
      onClose={onClose}
      size={640}
      title={creating && !p ? 'Add provider' : (p?.displayName ?? 'Provider')}
      footer={
        canEdit ? (
          <>
            {p && (
              <Button variant="danger-soft" disabled={p.isEnabled} onClick={() => setDeleting(true)}>
                Delete
              </Button>
            )}
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            <Button loading={busy} onClick={p ? save : create}>
              {p ? 'Save' : 'Add provider'}
            </Button>
          </>
        ) : undefined
      }
    >
      {problem && <Alert tone="bad">{problem}</Alert>}
      {p && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-[13px]">
          <HealthChip status={p.health.status} />
          <span className="text-muted">
            {CHANNEL_LABEL[p.channel]} · {p.vendor} · key {p.providerKey}
          </span>
        </div>
      )}
      {!p && (
        <>
          <Select
            label="Channel"
            value={channel}
            onChange={e => {
              const c = e.target.value as ProviderChannel;
              setChannel(c);
              setVendor(vendorsFor(c)[0].vendor);
              setConfig({});
              setCreds({});
            }}
            options={CHANNELS.map(c => ({ value: c, label: CHANNEL_LABEL[c] }))}
          />
          <Select
            label="Vendor"
            value={vendor}
            onChange={e => {
              setVendor(e.target.value);
              setConfig({});
              setCreds({});
            }}
            options={vendorsFor(channel).map(v => ({ value: v.vendor, label: v.label }))}
          />
          <Input
            label="Provider key"
            hint="Cannot be changed later"
            value={key}
            onChange={e => setKey(e.target.value)}
          />
        </>
      )}
      <Input label="Display name" disabled={disabled} value={name} onChange={e => setName(e.target.value)} />
      <Input label="Description" disabled={disabled} value={desc} onChange={e => setDesc(e.target.value)} />
      <div className="grid gap-3 min-[600px]:grid-cols-2">
        <Select
          label="Priority"
          hint="1 is the primary; higher numbers are fallbacks"
          disabled={disabled}
          value={priority}
          onChange={e => setPriority(e.target.value)}
          options={Array.from({ length: 9 }, (_, i) => ({
            value: String(i + 1),
            label: i === 0 ? 'Primary' : `Fallback ${i + 1}`,
          }))}
        />
        <Input
          label="Degraded latency (ms)"
          type="number"
          inputMode="numeric"
          disabled={disabled}
          value={latency}
          onChange={e => setLatency(e.target.value)}
        />
      </div>
      {cfg.length > 0 && (
        <fieldset className="mt-1">
          <legend className="mb-2 text-[13px] font-bold">Vendor settings</legend>
          <FieldInputs
            fields={cfg}
            values={config}
            disabled={disabled}
            onChange={(k, v) => setConfig(c => ({ ...c, [k]: v }))}
          />
        </fieldset>
      )}
      {!p && credFields.length > 0 && (
        <fieldset className="mt-1">
          <legend className="mb-2 text-[13px] font-bold">Credentials</legend>
          <FieldInputs
            fields={credFields}
            values={creds}
            secret
            onChange={(k, v) => setCreds(c => ({ ...c, [k]: v }))}
          />
        </fieldset>
      )}
      {p && (
        <>
          <section aria-label="Credentials" className="mt-4 rounded-[16px] bg-white/60 p-4">
            <h3 className="text-[14px] font-bold">Credentials</h3>
            {p.credentialsSource === 'ENV' ? (
              <p className="text-[13px] text-muted">
                Read from the server environment. Nothing to enter here.
              </p>
            ) : (
              <>
                <dl className="my-2 text-[13px]">
                  {Object.entries(p.credentialsMasked ?? {}).map(([k, v]) => (
                    <div key={k} className="flex gap-2">
                      <dt className="text-muted">{k}</dt>
                      <dd className="font-mono">{v}</dd>
                    </div>
                  ))}
                  {!p.credentialsMasked && <dd className="text-muted">No credentials saved yet.</dd>}
                </dl>
                {canEdit && (
                  <Button size="sm" variant="glass" onClick={() => setReplacing(true)}>
                    Replace credentials
                  </Button>
                )}
              </>
            )}
          </section>
          <section
            aria-label="Availability"
            className="mt-4 flex items-center justify-between gap-3 rounded-[16px] bg-white/60 p-4"
          >
            <div>
              <h3 className="text-[14px] font-bold">Enabled</h3>
              <p className="text-[13px] text-muted">Enable after a successful test.</p>
            </div>
            <Switch label="Enabled" checked={p.isEnabled} onChange={toggle} disabled={disabled} />
          </section>
          {canTest && (
            <section aria-label="Test send" className="mt-4 rounded-[16px] bg-white/60 p-4">
              <h3 className="text-[14px] font-bold">Test send</h3>
              {needsTarget && (
                <Input
                  label={p.channel === 'EMAIL' ? 'Send to (email)' : 'Send to (mobile number)'}
                  inputMode={p.channel === 'EMAIL' ? 'email' : 'numeric'}
                  value={to}
                  onChange={e => setTo(e.target.value)}
                />
              )}
              {p.channel === 'PUSH' && <p className="mb-2 text-[13px] text-muted">Sends to your browser.</p>}
              {['PAYMENT_GATEWAY', 'STORAGE', 'IVR'].includes(p.channel) && (
                <p className="mb-2 text-[13px] text-muted">Runs a connection test.</p>
              )}
              <Button size="sm" loading={testing} onClick={test}>
                {p.channel === 'PUSH'
                  ? 'Send to my browser'
                  : needsTarget
                    ? 'Send test'
                    : 'Run connection test'}
              </Button>
              {result && (
                <Alert tone={result.ok ? 'ok' : 'bad'} className="mt-3">
                  {result.ok
                    ? `Test passed${result.latencyMs ? ` in ${result.latencyMs} ms` : ''}.`
                    : `Test failed: ${result.error}`}
                </Alert>
              )}
              {p.lastTest && (
                <p className="mt-2 text-[12.5px] text-muted">
                  Last test {timeAgo(p.lastTest.at)}: {p.lastTest.ok ? 'passed' : 'failed'}
                </p>
              )}
            </section>
          )}
        </>
      )}
      {replacing && p && (
        <FormModal
          title="Replace credentials"
          description="Enter the complete new set. Values are never shown again."
          submitLabel="Replace"
          onClose={() => setReplacing(false)}
          onDone={() => {
            setReplacing(false);
            setNewCreds({});
          }}
          onSubmit={async () => {
            const missing = credFields.filter(f => !(newCreds[f.key] ?? '').trim());
            if (missing.length) return { error: `Enter: ${missing.map(m => m.label).join(', ')}.` };
            const next = await svc.replaceCredentials(p.id, {
              version: p.version,
              credentials: clean(newCreds, credFields) as Record<string, string>,
            });
            setP(next);
            onChanged();
            return { message: 'Credentials replaced.' };
          }}
        >
          <FieldInputs
            fields={credentialFields(p.vendor, p.channel)}
            values={newCreds}
            secret
            onChange={(k, v) => setNewCreds(c => ({ ...c, [k]: v }))}
          />
        </FormModal>
      )}
      {deleting && p && (
        <DeleteProvider
          provider={p}
          onClose={() => setDeleting(false)}
          onDone={() => {
            setDeleting(false);
            onChanged();
            onClose();
          }}
        />
      )}
    </Drawer>
  );
}

function DeleteProvider({
  provider,
  onClose,
  onDone,
}: {
  provider: Provider;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <FormModal
      title={`Delete ${provider.displayName}?`}
      description="Its credentials are wiped. This cannot be undone."
      submitLabel="Delete provider"
      variant="danger"
      onClose={onClose}
      onDone={onDone}
      onSubmit={async () => {
        if (reason.trim().length < 5) return { error: 'Enter a reason of at least 5 characters.' };
        await svc.deleteProvider(provider.id, { version: provider.version, reason: reason.trim() });
        return { message: 'Provider deleted.' };
      }}
    >
      <Input label="Reason" value={reason} onChange={e => setReason(e.target.value)} />
    </FormModal>
  );
}
