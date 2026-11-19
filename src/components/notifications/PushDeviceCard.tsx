'use client';
import { useState } from 'react';
import { Card } from '@/components/common/PageHead';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Switch } from '@/components/ui/Switch';
import { useToast } from '@/components/ui/Toast';
import { ago, commError } from '@/components/communication/format';
import { useLoad } from '@/hooks/useLoad';
import {
  PushDeniedError,
  PushNotConfiguredError,
  pushSupported,
  refusedRecently,
  subscribeThisDevice,
  unsubscribeThisDevice,
} from '@/lib/pushSubscribe';
import { notificationsService } from '@/services/notifications.service';
import type { NotificationApp } from '@/types/notifications';

const NOT_SET_UP = 'Push notifications are not set up on this server yet.';
/** A calm message for each way turning push on can fail; the browser's own error text is never shown. */
export function pushMessage(e: unknown): string {
  if (e instanceof PushDeniedError)
    return 'Notifications are blocked for this browser. You can allow them in the browser settings.';
  if (e instanceof PushNotConfiguredError) return NOT_SET_UP;
  if (e instanceof Error && /atob|InvalidCharacterError|applicationServerKey|not valid|vapid/i.test(`${e.name} ${e.message}`))
    return NOT_SET_UP;
  if (e instanceof Error && e.name === 'NotAllowedError')
    return 'Notifications are blocked for this browser. You can allow them in the browser settings.';
  if (e instanceof Error && e.name === 'NotSupportedError') return 'This browser cannot receive push alerts.';
  return commError(e);
}

/**
 * "This device" (spec 8.24, 11.6, 11.7): turn push on or off for this browser, send a test and remove the other
 * devices. Permission is asked only on a tap, never on load. The service worker is the one `public/sw.js`.
 */
export function PushDeviceCard({ app }: { app: NotificationApp }) {
  const toast = useToast();
  const supported = pushSupported();
  const list = useLoad(() => notificationsService.pushList().catch(() => []), 'push');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rows = (list.data ?? []).filter(s => s.status === 'ACTIVE');
  const mine = rows.find(s => s.isThisDevice) ?? null;
  const others = rows.filter(s => !s.isThisDevice);

  const toggle = async (on: boolean) => {
    setBusy(true);
    setError(null);
    try {
      if (on) {
        const key = await notificationsService.vapidKey();
        const reg = await subscribeThisDevice(key, app);
        await notificationsService.pushRegister({ ...reg, app });
        toast.show('Push alerts are on for this device');
      } else if (mine) {
        await notificationsService.pushRemove(mine.id);
        await unsubscribeThisDevice().catch(() => undefined);
        toast.show('Push alerts are off for this device');
      }
      list.reload();
    } catch (e) {
      setError(pushMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const test = async () => {
    if (!mine) return;
    setError(null);
    try {
      await notificationsService.pushTest(mine.id);
      toast.show('Test alert sent');
    } catch (e) {
      setError(commError(e));
    }
  };
  const remove = async (id: number) => {
    setError(null);
    try {
      await notificationsService.pushRemove(id);
      list.reload();
    } catch (e) {
      setError(commError(e));
    }
  };
  return (
    <Card
      title="This device"
      sub="Allow push alerts on this device so they reach you even when the app is closed."
      className="mt-4"
    >
      {error && <Alert tone="bad">{error}</Alert>}
      {!supported ? (
        <p className="text-[13.5px] text-muted">This browser cannot receive push alerts.</p>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[14px] font-semibold">Push alerts on this device</p>
            <p className="text-[12.5px] text-muted">
              {mine ? <Chip tone="ok">On for this device</Chip> : 'Not turned on for this device.'}
              {!mine && refusedRecently() && ' You said no recently; the browser may not ask again.'}
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
              disabled={busy || list.loading}
              onChange={v => void toggle(v)}
            />
          </div>
        </div>
      )}
      {others.length > 0 && (
        <ul className="mt-4 grid gap-1.5 text-[13.5px]">
          {others.map(s => (
            <li key={s.id} className="flex items-center justify-between gap-2">
              <span>
                {s.deviceLabel} <span className="text-muted">last worked {ago(s.lastSuccessAt)}</span>
              </span>
              <Button size="xs" variant="ghost" onClick={() => void remove(s.id)}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
