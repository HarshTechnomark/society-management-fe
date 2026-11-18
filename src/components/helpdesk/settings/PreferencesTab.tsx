'use client';
import { useState } from 'react';
import { ErrorState } from '@/components/common/ErrorState';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import { useToast } from '@/components/ui/Toast';
import { useFeatureState } from '@/lib/entitlements';
import { useLoad } from '@/hooks/useLoad';
import { helpdeskSettingsService as svc } from '@/services/helpdeskSettings.service';
import type { HelpdeskSettings } from '@/types/helpdesk';
import { helpdeskError, isStale, plainError } from '../admin/format';
import { PREFS, prefChanges, prefErrors } from './settingsFormat';

/** Preferences: the `helpdesk.*` settings of spec 7.9, saved together. */
export function PreferencesTab({ canEdit }: { canEdit: boolean }) {
  const load = useLoad(() => svc.settings(), 'prefs');
  if (load.error != null)
    return (
      <ErrorState
        error={plainError(load.error)}
        action={
          <Button size="sm" onClick={load.reload}>
            Try again
          </Button>
        }
      />
    );
  if (load.loading || !load.data)
    return (
      <div
        aria-busy="true"
        aria-label="Loading"
        className="skeleton h-40 w-full"
        data-testid="skeleton-row"
      />
    );
  return (
    <PrefsForm key={JSON.stringify(load.data)} settings={load.data} canEdit={canEdit} onSaved={load.reload} />
  );
}

function PrefsForm({
  settings,
  canEdit,
  onSaved,
}: {
  settings: HelpdeskSettings;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const toast = useToast();
  const meTooOk = useFeatureState('helpdesk.me_too_upvotes');
  const [values, setValues] = useState<Record<string, string | boolean>>(() =>
    Object.fromEntries(
      PREFS.flatMap(p => {
        const s = settings[p.key];
        return s ? [[p.key, p.bool ? s.value === true : String(s.value)]] : [];
      }),
    ),
  );
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const shown = PREFS.filter(p => settings[p.key] || values[p.key] !== undefined);
  const present = Object.fromEntries(Object.entries(values));
  const errors = prefErrors(
    Object.fromEntries(PREFS.map(p => [p.key, present[p.key] ?? (p.bool ? false : String(p.min))])),
  );
  const changes = prefChanges(settings, values);

  const save = async () => {
    setTouched(true);
    setProblem(null);
    if (Object.keys(errors).some(k => values[k] !== undefined) || changes.length === 0) {
      if (changes.length === 0) toast.show('Nothing to save.');
      return;
    }
    setBusy(true);
    try {
      await svc.saveSettings(changes);
      toast.show('Settings saved');
      onSaved();
    } catch (e) {
      setProblem(isStale(e) ? 'Someone else changed these settings. Reload.' : helpdeskError(e));
    } finally {
      setBusy(false);
    }
  };

  if (shown.length === 0) return <Alert tone="info">No helpdesk preferences are available yet.</Alert>;
  return (
    <fieldset disabled={!canEdit || busy} className="grid max-w-xl gap-4 border-0 p-0">
      {problem && <Alert tone="bad">{problem}</Alert>}
      {shown.map(p =>
        p.bool ? (
          <div key={p.key} className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[14px] font-semibold">{p.label}</p>
              <p className="text-[12.5px] text-muted">{p.hint}</p>
            </div>
            <Switch
              label={p.label}
              checked={values[p.key] === true}
              disabled={!canEdit || busy}
              onChange={v => setValues(s => ({ ...s, [p.key]: v }))}
            />
          </div>
        ) : (
          <Input
            key={p.key}
            label={p.unit ? `${p.label} (${p.unit})` : p.label}
            hint={
              p.key === 'helpdesk.upvoteRaiseThreshold' && !meTooOk
                ? 'Available on the Standard plan and above.'
                : p.hint
            }
            disabled={p.key === 'helpdesk.upvoteRaiseThreshold' && !meTooOk}
            inputMode="numeric"
            value={String(values[p.key] ?? '')}
            onChange={e => setValues(s => ({ ...s, [p.key]: e.target.value }))}
            error={touched ? (errors[p.key] ?? null) : null}
          />
        ),
      )}
      {canEdit && (
        <div>
          <Button loading={busy} onClick={() => void save()}>
            Save preferences
          </Button>
        </div>
      )}
    </fieldset>
  );
}
