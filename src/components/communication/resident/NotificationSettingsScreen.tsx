'use client';
import { useState } from 'react';
import { ErrorState } from '@/components/common/ErrorState';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { useToast } from '@/components/ui/Toast';
import { useLoad } from '@/hooks/useLoad';
import { residentNoticesService as svc } from '@/services/residentNotices.service';
import type { Preferences, PrefChannel } from '@/types/residentNotices';
import { commError, plainCommError } from '../format';
import { PushDeviceCard } from './PushDeviceCard';

const CHANNELS: { key: PrefChannel; label: string }[] = [
  { key: 'PUSH', label: 'Push' },
  { key: 'SMS', label: 'SMS' },
  { key: 'WHATSAPP', label: 'WhatsApp' },
  { key: 'EMAIL', label: 'Email' },
];
const CATEGORY_LABEL: Record<string, string> = {
  BILLING: 'Bills',
  PAYMENTS: 'Payments',
  NOTICES: 'Notices',
  VISITORS: 'Visitors',
  HELPDESK: 'Complaints',
  APPROVALS: 'Approvals',
  COMMUNITY: 'Community',
  GOVERNANCE: 'Governance',
  ACCOUNT: 'Account',
  SYSTEM: 'System',
  EMERGENCY: 'Emergency',
  SECURITY: 'Security',
};
export const LOCALES = [
  { value: '', label: 'Society default' },
  { value: 'en-IN', label: 'English' },
  { value: 'hi-IN', label: 'Hindi' },
  { value: 'mr-IN', label: 'Marathi' },
];

/** Spec 11.6 and 11.7: the preference matrix, quiet hours, language, WhatsApp opt-in and this device. */
export function NotificationSettingsScreen() {
  const q = useLoad(() => svc.preferences(), 'prefs');
  if (q.loading)
    return (
      <Page>
        <div className="skeleton h-64 w-full" />
      </Page>
    );
  if (!q.data)
    return (
      <Page>
        <ErrorState error={plainCommError(q.error)} action={<Button onClick={q.reload}>Try again</Button>} />
      </Page>
    );
  return <Form initial={q.data} reload={q.reload} />;
}

function Form({ initial, reload }: { initial: Preferences; reload: () => void }) {
  const toast = useToast();
  const [p, setP] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setChannel = (cat: string, ch: PrefChannel, on: boolean) =>
    setP(x => ({
      ...x,
      categories: x.categories.map(c =>
        c.key === cat ? { ...c, channels: { ...c.channels, [ch]: on } } : c,
      ),
    }));
  const custom = p.quietHours.mode === 'CUSTOM';
  const timesOk =
    !custom || (p.quietHours.start !== p.quietHours.end && !!p.quietHours.start && !!p.quietHours.end);
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const next = await svc.savePreferences({
        version: p.version,
        locale: p.locale,
        categories: Object.fromEntries(p.categories.filter(c => !c.locked).map(c => [c.key, c.channels])),
        quietHours: custom
          ? { mode: 'CUSTOM', start: p.quietHours.start, end: p.quietHours.end }
          : { mode: p.quietHours.mode },
        whatsappOptIn: p.whatsapp.optIn,
      });
      setP(next);
      toast.show('Notification settings saved');
    } catch (e) {
      setError(commError(e));
      if (e instanceof Error && 'code' in e && (e as { code: string }).code === 'STALE_VERSION') reload();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Page>
      <PageHead
        title="Notification settings"
        sub="Choose how you hear from your society. In-app messages are always on."
      />
      {error && <Alert tone="bad">{error}</Alert>}
      <Card title="What to send, and where">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-[14px]">
            <thead>
              <tr className="text-[12.5px] text-muted">
                <th scope="col" className="py-1.5">
                  Category
                </th>
                {CHANNELS.map(c => (
                  <th key={c.key} scope="col" className="px-2 py-1.5 text-center">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {p.categories.map(c => (
                <tr key={c.key} className="border-t border-[var(--line)]">
                  <th scope="row" className="py-2 font-semibold">
                    {CATEGORY_LABEL[c.key] ?? c.key}
                    {c.locked && <Chip className="ml-2">Always on</Chip>}
                  </th>
                  {CHANNELS.map(ch => (
                    <td key={ch.key} className="px-2 py-2 text-center">
                      <Switch
                        label={`${CATEGORY_LABEL[c.key] ?? c.key} by ${ch.label}`}
                        checked={c.channels[ch.key]}
                        disabled={c.locked || (ch.key === 'WHATSAPP' && !p.whatsapp.available)}
                        onChange={on => setChannel(c.key, ch.key, on)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="Quiet hours" className="mt-4">
        <Select
          label="Quiet hours"
          value={p.quietHours.mode}
          onChange={e =>
            setP(x => ({
              ...x,
              quietHours: { ...x.quietHours, mode: e.target.value as Preferences['quietHours']['mode'] },
            }))
          }
          options={[
            { value: 'SOCIETY_DEFAULT', label: 'Society default' },
            { value: 'CUSTOM', label: 'Custom' },
            { value: 'OFF', label: 'Off' },
          ]}
          hint="Emergency and security alerts ignore quiet hours."
        />
        {custom && (
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="From"
              type="time"
              value={p.quietHours.start}
              onChange={e => setP(x => ({ ...x, quietHours: { ...x.quietHours, start: e.target.value } }))}
            />
            <Input
              label="To"
              type="time"
              value={p.quietHours.end}
              error={!timesOk ? 'Choose different start and end times.' : null}
              onChange={e => setP(x => ({ ...x, quietHours: { ...x.quietHours, end: e.target.value } }))}
            />
          </div>
        )}
      </Card>
      <Card title="Language and WhatsApp" className="mt-4">
        <Select
          label="Language of messages"
          value={p.locale ?? ''}
          onChange={e => setP(x => ({ ...x, locale: e.target.value || null }))}
          options={LOCALES}
        />
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[14.5px] font-semibold">Get messages on WhatsApp</p>
            <p className="text-[12.5px] text-muted">
              {p.whatsapp.available
                ? 'Reply STOP at any time to turn it off.'
                : 'Your society’s plan does not include WhatsApp.'}
            </p>
          </div>
          <Switch
            label="WhatsApp messages"
            checked={p.whatsapp.optIn}
            disabled={!p.whatsapp.available}
            onChange={on => setP(x => ({ ...x, whatsapp: { ...x.whatsapp, optIn: on } }))}
          />
        </div>
        {p.email.address && (
          <p className="mt-3 text-[13px] text-muted">
            Email goes to {p.email.address}.
            {p.email.bounced ? ' Emails to this address bounced; update it in your profile.' : ''}
          </p>
        )}
      </Card>
      <div className="my-4">
        <Button loading={busy} disabled={!timesOk} onClick={() => void save()}>
          Save settings
        </Button>
      </div>
      <PushDeviceCard />
    </Page>
  );
}
