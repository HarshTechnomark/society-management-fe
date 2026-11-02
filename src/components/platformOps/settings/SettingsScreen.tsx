'use client';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { FormModal } from '@/components/billing/FormModal';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Tabs } from '@/components/societies/bits';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { ApiError } from '@/lib/apiClient';
import { useMe } from '@/lib/auth';
import { platformOpsService as svc } from '@/services/platform-ops.service';
import type { Setting, SettingChange, SettingsData } from '@/types/platformOps';
import { opsError } from '../format';
import {
  SECURITY_KEYS,
  SETTINGS_TABS,
  STATE_CODES,
  fromDraft,
  toDraft,
  type SettingField,
  type SettingsTab,
} from './fields';

/** Spec 11.8 Settings: a tab per group, each saving only its changed keys in one PATCH with their versions. */
export function SettingsScreen() {
  const { ready } = useMe();
  const canView = usePermission(PERMISSIONS.platform.settings.view);
  const [tab, setTab] = useState(SETTINGS_TABS[0].id);
  const load = useLoad(() => svc.settings(), 'settings');
  if (ready && !canView)
    return (
      <Page>
        <PageHead title="Settings" />
        <EmptyState title="You do not have access to settings" />
      </Page>
    );
  const current = SETTINGS_TABS.find(t => t.id === tab)!;
  return (
    <Page>
      <PageHead
        title="Settings"
        sub="Company details, billing defaults, lifecycle, security and support rules."
      />
      <Tabs
        label="Settings sections"
        value={tab}
        onChange={setTab}
        tabs={SETTINGS_TABS.map(t => ({ value: t.id, label: t.label }))}
      />
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {load.error ? (
          <Card>
            <ErrorState
              error={load.error}
              action={
                <button className="underline" onClick={load.reload}>
                  Try again
                </button>
              }
            />
          </Card>
        ) : !load.data ? (
          <div className="skeleton h-64 w-full" />
        ) : (
          <TabForm
            key={`${tab}|${versionKey(load.data, current)}`}
            tab={current}
            data={load.data}
            onSaved={load.reload}
          />
        )}
      </div>
    </Page>
  );
}

const find = (data: SettingsData, tab: SettingsTab, key: string): Setting | undefined =>
  (data[tab.category] ?? []).find(s => s.key === key) ??
  Object.values(data)
    .flat()
    .find(s => s?.key === key);
const versionKey = (data: SettingsData, tab: SettingsTab) =>
  tab.fields.map(f => find(data, tab, f.key)?.version ?? 0).join('.');

function TabForm({ tab, data, onSaved }: { tab: SettingsTab; data: SettingsData; onSaved: () => void }) {
  const toast = useToast();
  const canEdit = usePermission(PERMISSIONS.platform.settings.edit);
  const initial = Object.fromEntries(
    tab.fields.map(f => [f.key, toDraft(f.kind, find(data, tab, f.key)?.value)]),
  );
  const [draft, setDraft] = useState<Record<string, string>>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState<SettingChange[] | null>(null);

  const set = (k: string, v: string) => setDraft(d => ({ ...d, [k]: v }));

  const changes = (): SettingChange[] | null => {
    const out: SettingChange[] = [];
    const errs: Record<string, string> = {};
    for (const f of tab.fields) {
      if (draft[f.key] === initial[f.key]) continue;
      const s = find(data, tab, f.key);
      if (!s || s.isReadOnly) continue;
      const r = fromDraft(f.kind, draft[f.key]);
      if (r.error) errs[f.key] = r.error;
      else out.push({ key: f.key, value: r.value, version: s.version });
    }
    setErrors(errs);
    return Object.keys(errs).length ? null : out;
  };

  const send = async (list: SettingChange[], reason?: string) => {
    await svc.saveSettings(list, reason);
    toast.show('Settings saved.');
    onSaved();
  };

  const save = async () => {
    setProblem(null);
    const list = changes();
    if (!list) return;
    if (list.length === 0) {
      setProblem('Nothing to save. Change a value first.');
      return;
    }
    if (list.some(c => SECURITY_KEYS.has(c.key))) {
      setAsking(list);
      return;
    }
    setBusy(true);
    try {
      await send(list);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const fail = (e: unknown) => {
    setProblem(opsError(e));
    if (e instanceof ApiError) {
      if (e.errors?.length) setErrors(Object.fromEntries(e.errors.map(x => [x.field, x.message])));
      if (e.code === 'STALE_VERSION') onSaved();
    }
  };

  return (
    <Card>
      {problem && <Alert tone="bad">{problem}</Alert>}
      <div className="grid gap-x-4 min-[800px]:grid-cols-2">
        {tab.fields.map(f => (
          <FieldInput
            key={f.key}
            field={f}
            setting={find(data, tab, f.key)}
            value={draft[f.key]}
            error={errors[f.key]}
            disabled={!canEdit || !!find(data, tab, f.key)?.isReadOnly}
            onChange={v => set(f.key, v)}
          />
        ))}
      </div>
      {canEdit && (
        <div className="mt-2 flex flex-wrap gap-2">
          <Button loading={busy} onClick={save}>
            Save {tab.label.toLowerCase()}
          </Button>
        </div>
      )}
      {asking && (
        <ReasonModal
          onClose={() => setAsking(null)}
          onSubmit={async reason => {
            await send(asking, reason);
            setAsking(null);
          }}
          onFail={e => {
            setAsking(null);
            fail(e);
          }}
        />
      )}
    </Card>
  );
}

function ReasonModal({
  onClose,
  onSubmit,
  onFail,
}: {
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
  onFail: (e: unknown) => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <FormModal
      title="Change security settings"
      description="This is audited. You may be asked to confirm it is you."
      submitLabel="Save security settings"
      onClose={onClose}
      onDone={() => undefined}
      onSubmit={async () => {
        if (reason.trim().length < 5) return { error: 'Enter a reason of at least 5 characters.' };
        try {
          await onSubmit(reason.trim());
        } catch (e) {
          onFail(e);
        }
        return {};
      }}
    >
      <Input label="Reason" value={reason} onChange={e => setReason(e.target.value)} />
    </FormModal>
  );
}

function SlaGrid({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  let parsed: Record<string, { firstResponse: number; resolution: number }> = {};
  try {
    parsed = JSON.parse(value);
  } catch {
    /* shown empty */
  }
  const update = (p: string, k: 'firstResponse' | 'resolution', v: string) =>
    onChange(JSON.stringify({ ...parsed, [p]: { ...parsed[p], [k]: v === '' ? 0 : Number(v) } }));
  return (
    <table className="w-full text-left text-[14px]">
      <thead>
        <tr className="text-[12px] uppercase text-muted">
          <th scope="col" className="py-1">
            Priority
          </th>
          <th scope="col" className="py-1">
            First response
          </th>
          <th scope="col" className="py-1">
            Resolution
          </th>
        </tr>
      </thead>
      <tbody>
        {['HIGH', 'MEDIUM', 'LOW'].map(p => (
          <tr key={p}>
            <th scope="row" className="py-1 pr-2 font-semibold">
              {p.charAt(0) + p.slice(1).toLowerCase()}
            </th>
            {(['firstResponse', 'resolution'] as const).map(k => (
              <td key={k} className="py-1 pr-2">
                <input
                  type="number"
                  min={1}
                  disabled={disabled}
                  aria-label={`${p.charAt(0) + p.slice(1).toLowerCase()} ${k === 'firstResponse' ? 'first response' : 'resolution'} hours`}
                  value={parsed[p]?.[k] ?? ''}
                  onChange={e => update(p, k, e.target.value)}
                  className="h-10 w-24 rounded-[12px] border-[1.5px] border-[rgba(20,35,44,0.16)] bg-white/80 px-3 text-[14px] disabled:opacity-60"
                />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function FieldInput({
  field,
  setting,
  value,
  error,
  disabled,
  onChange,
}: {
  field: SettingField;
  setting: Setting | undefined;
  value: string;
  error?: string;
  disabled: boolean;
  onChange: (v: string) => void;
}) {
  const hint = setting?.description;
  switch (field.kind) {
    case 'bool':
      return (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-[16px] bg-white/50 px-4 py-3">
          <div>
            <p className="text-[14px] font-semibold">{field.label}</p>
            {hint && <p className="text-[12.5px] text-muted">{hint}</p>}
          </div>
          <Switch
            label={field.label}
            checked={value === 'true'}
            onChange={v => onChange(String(v))}
            disabled={disabled}
          />
        </div>
      );
    case 'select':
      return (
        <Select
          label={field.label}
          hint={hint}
          error={error}
          disabled={disabled}
          value={value}
          onChange={e => onChange(e.target.value)}
          options={field.options ?? []}
        />
      );
    case 'state':
      return (
        <Select
          label={field.label}
          hint={hint}
          error={error}
          disabled={disabled}
          value={value}
          onChange={e => onChange(e.target.value)}
          options={STATE_CODES.map(([c, n]) => ({ value: c, label: `${n} (${c})` }))}
        />
      );
    case 'ips':
      return (
        <div className="min-[800px]:col-span-2">
          <Textarea
            label={field.label}
            hint={hint}
            error={error}
            disabled={disabled}
            value={value}
            onChange={e => onChange(e.target.value)}
          />
        </div>
      );
    case 'sla':
      return (
        <div className="mb-4 min-[800px]:col-span-2">
          <p className="mb-1 text-[13px] font-semibold">{field.label}</p>
          <SlaGrid value={value} onChange={onChange} disabled={disabled} />
          {error && (
            <p role="alert" className="mt-1 text-[12.5px] font-medium text-bad">
              {error}
            </p>
          )}
        </div>
      );
    default:
      return (
        <Input
          label={field.label + (field.suffix ? ` (${field.suffix})` : '')}
          hint={
            field.kind === 'paise'
              ? `${hint ?? ''} In rupees.`.trim()
              : field.kind === 'offsets'
                ? `${hint ?? ''} Negative numbers are days before the invoice is due.`.trim()
                : hint
          }
          error={error}
          disabled={disabled}
          inputMode={field.kind === 'text' ? undefined : field.kind === 'offsets' ? 'text' : 'decimal'}
          value={value}
          onChange={e => onChange(e.target.value)}
        />
      );
  }
}
