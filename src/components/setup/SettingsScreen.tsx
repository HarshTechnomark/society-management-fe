'use client';
import { useMemo, useState } from 'react';
import { Page, PageHead, Card } from '@/components/common/PageHead';
import { ConfirmReason } from '@/components/common/ConfirmReason';
import { ErrorState } from '@/components/common/ErrorState';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { societySetupService } from '@/services/society-setup.service';
import type { SettingItem } from '@/types/societySetup';
import { Gate } from './Gate';
import { setupError } from './format';

export const NAMESPACE_LABEL: Record<string, string> = {
  structure: 'Structure',
  billing: 'Billing',
  payments: 'Payments',
  approvals: 'Approvals',
  committee: 'Committee',
  amenities: 'Amenities',
  helpdesk: 'Helpdesk',
  staff: 'Staff',
  parking: 'Parking',
  vendors: 'Vendors',
  finance: 'Finance',
  visitors: 'Visitors',
  security: 'Security',
  office: 'Office',
  communication: 'Communication',
  residents: 'Residents',
};
const ORDER = Object.keys(NAMESPACE_LABEL);

const words = (key: string) => {
  const tail = key.split('.')[1] ?? key;
  const s = tail.replace(/([A-Z])/g, ' $1').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** The JSON text of a value, so a draft and a saved value compare the same way. */
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Hint such as "= ₹25,000" under an amount in paise. */
function unitHint(item: SettingItem, value: unknown): string | undefined {
  const n = Number(value);
  if (item.key.endsWith('Paise') && Number.isFinite(n))
    return `Stored in paise. That is ₹${(n / 100).toLocaleString('en-IN')}.`;
  if (item.key.endsWith('Pct')) return 'Percent';
  return undefined;
}

/** Settings > typed key editor by namespace (spec 5.2 and section 8.4/8.5). */
export function SettingsScreen() {
  return (
    <Gate view={PERMISSIONS.settings.society.view} feature="property.society_settings" title="Settings">
      <Inner />
    </Gate>
  );
}

function Inner() {
  const { data, error, loading, reload } = useLoad(() => societySetupService.settings());
  return (
    <Page>
      <PageHead
        title="Settings"
        sub="Rules other parts of SocietyApp read, such as bill dates, office hours and approval limits."
      />
      {error ? (
        <Card>
          <ErrorState
            error={error}
            action={
              <button className="underline" onClick={reload}>
                Try again
              </button>
            }
          />
        </Card>
      ) : loading || !data ? (
        <Card>
          <div className="space-y-3" aria-busy="true">
            <div className="skeleton h-10 w-full" />
            <div className="skeleton h-10 w-full" />
          </div>
        </Card>
      ) : (
        <Editor initial={data} onReload={reload} />
      )}
    </Page>
  );
}

function Editor({ initial, onReload }: { initial: SettingItem[]; onReload: () => void }) {
  const toast = useToast();
  const [items, setItems] = useState(initial);
  const editable = useMemo(() => items.filter(i => i.editVia === 'SETTINGS'), [items]);
  const namespaces = useMemo(() => {
    const present = new Set(editable.map(i => i.namespace));
    return [...ORDER.filter(n => present.has(n)), ...[...present].filter(n => !ORDER.includes(n))];
  }, [editable]);
  const [ns, setNs] = useState(namespaces[0] ?? '');
  const [drafts, setDrafts] = useState<Record<string, unknown>>({});
  const [jsonText, setJsonText] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  const current = editable.filter(i => i.namespace === ns);
  const valueOf = (i: SettingItem) => (i.key in drafts ? drafts[i.key] : i.value);
  const dirty = current.filter(i => i.key in drafts && !same(drafts[i.key], i.value));
  const needsReason = dirty.some(i => i.requiresReason);

  const setDraft = (i: SettingItem, v: unknown) => setDrafts(d => ({ ...d, [i.key]: v }));

  const save = async (reason?: string) => {
    setBusy(true);
    setFormError(null);
    setErrors({});
    try {
      const saved = await societySetupService.saveSettings(
        dirty.map(i => ({ key: i.key, value: drafts[i.key], version: i.version })),
        reason,
      );
      setItems(list => list.map(i => saved.find(s => s.key === i.key) ?? i));
      setDrafts(d => {
        const n = { ...d };
        dirty.forEach(i => delete n[i.key]);
        return n;
      });
      toast.show('Settings saved.');
      setAsking(false);
    } catch (e) {
      const fe: Record<string, string> = {};
      const err = e as { errors?: { field: string; message: string }[]; code?: string };
      for (const x of err.errors ?? []) fe[x.field] = x.message;
      setErrors(fe);
      setFormError(setupError(e));
      setStale(err.code === 'STALE_VERSION');
      setAsking(false);
    } finally {
      setBusy(false);
    }
  };

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    const bad: Record<string, string> = {};
    for (const i of dirty)
      if (i.type === 'JSON') {
        try {
          JSON.parse(jsonText[i.key] ?? '');
        } catch {
          bad[i.key] = 'Enter valid JSON.';
        }
      }
    setErrors(bad);
    if (Object.keys(bad).length) return;
    if (needsReason) setAsking(true);
    else void save();
  };

  if (namespaces.length === 0)
    return (
      <Card>
        <p className="text-[14px] text-muted">There are no settings you can view.</p>
      </Card>
    );

  return (
    <Card>
      <div role="tablist" aria-label="Settings groups" className="mb-4 flex flex-wrap gap-1.5">
        {namespaces.map(n => (
          <Button
            key={n}
            size="sm"
            role="tab"
            aria-selected={ns === n}
            variant={ns === n ? 'primary' : 'glass'}
            onClick={() => {
              setNs(n);
              setErrors({});
              setFormError(null);
            }}
          >
            {NAMESPACE_LABEL[n] ?? n}
          </Button>
        ))}
      </div>
      {formError && (
        <Alert tone="bad">
          {formError}{' '}
          {stale && (
            <button className="font-semibold underline" onClick={onReload}>
              Reload settings
            </button>
          )}
        </Alert>
      )}
      <form onSubmit={submit} noValidate aria-label={`${NAMESPACE_LABEL[ns] ?? ns} settings`}>
        {current.map(i => (
          <SettingField
            key={i.key}
            item={i}
            value={valueOf(i)}
            error={errors[i.key]}
            json={jsonText[i.key]}
            onJson={t => {
              setJsonText(x => ({ ...x, [i.key]: t }));
              try {
                setDraft(i, JSON.parse(t));
              } catch {
                setDraft(i, t);
              }
            }}
            onChange={v => setDraft(i, v)}
          />
        ))}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <span className="text-[13px] text-muted">
            {dirty.length > 0
              ? `${dirty.length} unsaved ${dirty.length === 1 ? 'change' : 'changes'}`
              : 'No changes yet'}
          </span>
          <Button type="submit" loading={busy && !asking} disabled={dirty.length === 0}>
            Save changes
          </Button>
        </div>
      </form>
      <ConfirmReason
        open={asking}
        title="Why are you changing this?"
        description="The reason is kept in the audit trail. You may be asked for a fresh code."
        confirmLabel="Save changes"
        variant="primary"
        onCancel={() => setAsking(false)}
        onConfirm={save}
      />
    </Card>
  );
}

function SettingField({
  item,
  value,
  error,
  json,
  onChange,
  onJson,
}: {
  item: SettingItem;
  value: unknown;
  error?: string;
  json?: string;
  onChange: (v: unknown) => void;
  onJson: (t: string) => void;
}) {
  const label = words(item.key);
  const ro = !item.canEdit;
  const rules = item.rules ?? {};
  const badges = (
    <span className="ml-2 inline-flex gap-1 align-middle">
      {item.requiresStepUp && <Chip tone="warn">Fresh code needed</Chip>}
      {ro && <Chip>View only</Chip>}
    </span>
  );
  const hintText = [
    item.description,
    item.appliesFrom ? `Applies from FY ${item.appliesFrom}.` : null,
    unitHint(item, value),
  ]
    .filter(Boolean)
    .join(' ');
  const hint = (
    <>
      {hintText}
      {badges}
    </>
  );

  if (item.type === 'BOOL')
    return (
      <div className="mb-4 flex items-start justify-between gap-3 rounded-[14px] bg-white/50 p-3">
        <div>
          <p className="text-[14px] font-semibold">
            {label}
            {badges}
          </p>
          {hintText && <p className="text-[12.5px] text-muted">{hintText}</p>}
          {error && <p className="text-[12.5px] font-medium text-bad">{error}</p>}
        </div>
        <Switch label={label} checked={value === true} onChange={onChange} disabled={ro} />
      </div>
    );

  const options = rules.oneOf;
  if (options || item.type === 'ENUM')
    return (
      <Select
        label={label}
        hint={hint}
        error={error}
        disabled={ro}
        value={String(value ?? '')}
        onChange={e => {
          const raw = e.target.value;
          onChange(item.type === 'INT' ? Number(raw) : raw);
        }}
        options={(options ?? [String(value ?? '')]).map(o => ({
          value: String(o),
          label: String(o)
            .replace(/_/g, ' ')
            .toLowerCase()
            .replace(/^./, c => c.toUpperCase()),
        }))}
      />
    );

  if (item.type === 'JSON')
    return (
      <Textarea
        label={label}
        hint={hintText ? hint : <>JSON{badges}</>}
        error={error}
        disabled={ro}
        rows={4}
        value={json ?? JSON.stringify(value)}
        onChange={e => onJson(e.target.value)}
      />
    );

  const inputType =
    item.type === 'TIME'
      ? 'time'
      : item.type === 'DATE'
        ? 'date'
        : item.type === 'INT' || item.type === 'DEC'
          ? 'number'
          : 'text';
  return (
    <Input
      label={label}
      hint={hint}
      error={error}
      disabled={ro}
      type={inputType}
      step={item.type === 'DEC' ? '0.0001' : undefined}
      min={rules.min}
      max={rules.max}
      value={value === null || value === undefined ? '' : String(value)}
      onChange={e => {
        const raw = e.target.value;
        onChange(
          item.type === 'INT'
            ? raw === ''
              ? ''
              : Number(raw)
            : raw === '' && item.type !== 'STRING'
              ? null
              : raw,
        );
      }}
    />
  );
}
