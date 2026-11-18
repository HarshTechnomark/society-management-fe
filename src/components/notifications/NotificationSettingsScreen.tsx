'use client';
import { useState } from 'react';
import { ErrorState } from '@/components/common/ErrorState';
import { Page, PageHead, Card } from '@/components/common/PageHead';
import { Segments } from '@/components/residents/common';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { useToast } from '@/components/ui/Toast';
import { useLoad } from '@/hooks/useLoad';
import { ApiError } from '@/lib/apiClient';
import { pushSupported, subscribeThisDevice, unsubscribeThisDevice } from '@/lib/pushSubscribe';
import { notificationsService } from '@/services/notifications.service';
import { PREF_CHANNELS, type PrefChannel, type Preferences, type QuietMode } from '@/types/notifications';
import { noticeError, plainError } from '@/components/notices/admin/format';
import { LOCALES, categoryLabel } from './format';
import { draftOf, quietProblem, toBody, type PrefsDraft } from './prefs';

const CHANNEL_LABEL: Record<PrefChannel, string> = {
  PUSH: 'Push',
  SMS: 'SMS',
  WHATSAPP: 'WhatsApp',
  EMAIL: 'Email',
};

/** Settings > Notifications (spec 11.6): the preference matrix, quiet hours, language, WhatsApp opt-in and this device. */
export function NotificationSettingsScreen() {
  const load = useLoad(() => notificationsService.preferences(), 'prefs');
  return (
    <Page>
      <PageHead
        title="Notification settings"
        sub="Choose how you hear about things. In-app alerts are always on."
      />
      {load.error != null ? (
        <ErrorState
          error={plainError(load.error)}
          action={
            <Button size="sm" onClick={load.reload}>
              Try again
            </Button>
          }
        />
      ) : !load.data ? (
        <div aria-busy="true" aria-label="Loading" className="skeleton h-48 w-full" />
      ) : (
        <PrefsForm key={load.data.version} prefs={load.data} onReload={load.reload} />
      )}
      <ThisDevice />
    </Page>
  );
}

function PrefsForm({ prefs, onReload }: { prefs: Preferences; onReload: () => void }) {
  const toast = useToast();
  const [d, setD] = useState<PrefsDraft>(() => draftOf(prefs));
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const quiet = quietProblem(d);
  const set = (p: Partial<PrefsDraft>) => setD(x => ({ ...x, ...p }));
  const flip = (cat: string, ch: PrefChannel, v: boolean) =>
    setD(x => ({ ...x, categories: { ...x.categories, [cat]: { ...x.categories[cat], [ch]: v } } }));

  const save = async () => {
    if (quiet) return;
    setBusy(true);
    setProblem(null);
    try {
      await notificationsService.savePreferences(toBody(d, prefs.version));
      toast.show('Notification settings saved');
      onReload();
    } catch (e) {
      const isStale = e instanceof ApiError && e.code === 'STALE_VERSION';
      setProblem(
        isStale ? 'Your settings were changed somewhere else. Reload and try again.' : noticeError(e),
      );
      setStale(isStale);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {problem && (
        <Alert tone="bad">
          {problem}{' '}
          {stale && (
            <button className="font-semibold underline" onClick={onReload}>
              Reload settings
            </button>
          )}
        </Alert>
      )}
      <Card title="Alerts to me" sub="Pick the channels for each kind of alert.">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13.5px]">
            <thead>
              <tr className="text-muted">
                <th scope="col" className="py-1.5 pr-3">
                  Alert
                </th>
                {PREF_CHANNELS.map(c => (
                  <th key={c} scope="col" className="px-2 text-center">
                    {CHANNEL_LABEL[c]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {prefs.categories.map(cat => (
                <tr key={cat.key} className="border-t border-[var(--line)]">
                  <th scope="row" className="py-2 pr-3 font-semibold">
                    {categoryLabel(cat.key)}
                    {cat.locked && (
                      <Chip tone="gold" className="ml-2">
                        Always on
                      </Chip>
                    )}
                  </th>
                  {PREF_CHANNELS.map(c => (
                    <td key={c} className="px-2 text-center">
                      <input
                        type="checkbox"
                        className="h-[18px] w-[18px] accent-[#143041]"
                        aria-label={`${categoryLabel(cat.key)} by ${CHANNEL_LABEL[c]}`}
                        checked={cat.locked ? true : (d.categories[cat.key]?.[c] ?? false)}
                        disabled={cat.locked || (c === 'WHATSAPP' && !prefs.whatsapp.available)}
                        onChange={e => flip(cat.key, c, e.target.checked)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {prefs.email.bounced && (
          <p className="mt-2 text-[13px] font-medium text-bad">
            E-mail to {prefs.email.address ?? 'your address'} bounced. Update your e-mail in your profile.
          </p>
        )}
      </Card>

      <Card
        title="Quiet hours"
        sub="Non-urgent alerts wait until quiet hours end. Emergencies always go through."
        className="mt-4"
      >
        <Segments
          label="Quiet hours"
          options={[
            { key: 'SOCIETY_DEFAULT' as QuietMode, label: 'Society default' },
            { key: 'CUSTOM' as QuietMode, label: 'Custom' },
            { key: 'OFF' as QuietMode, label: 'Off' },
          ]}
          value={d.quietMode}
          onChange={k => set({ quietMode: k })}
        />
        {d.quietMode === 'CUSTOM' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="From"
              type="time"
              value={d.quietStart}
              onChange={e => set({ quietStart: e.target.value })}
            />
            <Input
              label="Until"
              type="time"
              value={d.quietEnd}
              error={quiet}
              onChange={e => set({ quietEnd: e.target.value })}
            />
          </div>
        )}
      </Card>

      <Card title="Language and WhatsApp" className="mt-4">
        <Select
          label="Language of alerts"
          value={d.locale}
          onChange={e => set({ locale: e.target.value })}
          options={LOCALES}
        />
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[14px] font-semibold">WhatsApp alerts</p>
            <p className="text-[12.5px] text-muted">
              {prefs.whatsapp.available
                ? 'Allow messages on WhatsApp. Reply STOP to switch them off.'
                : 'WhatsApp is not part of your plan.'}
            </p>
          </div>
          <Switch
            label="WhatsApp alerts"
            checked={d.whatsappOptIn}
            disabled={!prefs.whatsapp.available}
            onChange={v => set({ whatsappOptIn: v })}
          />
        </div>
      </Card>
      <div className="mt-4">
        <Button loading={busy} disabled={!!quiet} onClick={() => void save()}>
          Save changes
        </Button>
      </div>
    </>
  );
}

/** "This device": push toggle and "Send test" for this browser's subscription. */
function ThisDevice() {
  const toast = useToast();
  const supported = pushSupported();
  const subs = useLoad(() => notificationsService.pushList().catch(() => []), 'push');
  const mine = subs.data?.find(s => s.isThisDevice && s.status === 'ACTIVE') ?? null;
  const [busy, setBusy] = useState(false);

  const toggle = async (on: boolean) => {
    setBusy(true);
    try {
      if (on) {
        const key = await notificationsService.vapidKey();
        const reg = await subscribeThisDevice(key);
        await notificationsService.pushRegister({ ...reg, app: 'ADMIN' });
        toast.show('Push alerts are on for this device');
      } else if (mine) {
        await notificationsService.pushRemove(mine.id);
        await unsubscribeThisDevice().catch(() => undefined);
        toast.show('Push alerts are off for this device');
      }
      subs.reload();
    } catch (e) {
      toast.show(noticeError(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  const test = async () => {
    if (!mine) return;
    try {
      await notificationsService.pushTest(mine.id);
      toast.show('Test alert sent');
    } catch (e) {
      toast.show(noticeError(e), 'error');
    }
  };
  return (
    <Card title="This device" className="mt-4">
      {!supported ? (
        <p className="text-[13.5px] text-muted">This browser cannot receive push alerts.</p>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[14px] font-semibold">Push alerts on this device</p>
            <p className="text-[12.5px] text-muted">
              {subs.data?.length
                ? `${subs.data.filter(s => s.status === 'ACTIVE').length} device(s) registered.`
                : 'Not registered yet.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {mine && (
              <Button size="sm" variant="glass" onClick={() => void test()}>
                Send test
              </Button>
            )}
            <Switch
              label="Push alerts on this device"
              checked={!!mine}
              disabled={busy || subs.loading}
              onChange={v => void toggle(v)}
            />
          </div>
        </div>
      )}
    </Card>
  );
}
