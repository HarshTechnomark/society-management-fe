'use client';
import { useState } from 'react';
import { Card } from '@/components/common/PageHead';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { useToast } from '@/components/ui/Toast';
import { useLoad } from '@/hooks/useLoad';
import { residentNoticesService as svc } from '@/services/residentNotices.service';
import { commError, ago } from '../format';
import { pushSupported, refusedRecently, registerThisDevice, rememberRefusal } from './push';

/** "Allow notifications on this phone" with Send test and Remove (spec 11.7). Asked only on a tap, never on load. */
export function PushDeviceCard() {
  const toast = useToast();
  const list = useLoad(() => svc.pushList(), 'push');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supported = pushSupported();
  const mine = (list.data ?? []).find(s => s.isThisDevice && s.status === 'ACTIVE');
  const allow = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await registerThisDevice();
      if (r === 'DENIED') {
        rememberRefusal();
        setError('Notifications are blocked for this browser. You can allow them in the browser settings.');
      } else if (r === 'NO_WORKER') setError('This browser is not set up for phone notifications yet.');
      else {
        toast.show('Notifications are on for this device');
        list.reload();
      }
    } catch (e) {
      setError(commError(e));
    } finally {
      setBusy(false);
    }
  };
  const test = async () => {
    if (!mine) return;
    setError(null);
    try {
      await svc.pushTest(mine.id);
      toast.show('Test sent');
    } catch (e) {
      setError(commError(e));
    }
  };
  const remove = async (id: number) => {
    setError(null);
    try {
      await svc.pushRevoke(id);
      list.reload();
    } catch (e) {
      setError(commError(e));
    }
  };
  return (
    <Card
      title="This device"
      sub="Allow notifications on this phone so alerts reach you even when the app is closed."
    >
      {error && <Alert tone="bad">{error}</Alert>}
      {!supported ? (
        <p className="text-[13.5px] text-muted">This browser does not support phone notifications.</p>
      ) : mine ? (
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="ok">On for this device</Chip>
          <Button size="sm" variant="glass" onClick={() => void test()}>
            Send test
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void remove(mine.id)}>
            Turn off
          </Button>
        </div>
      ) : (
        <div>
          <Button loading={busy} onClick={() => void allow()}>
            Allow notifications on this phone
          </Button>
          {refusedRecently() && (
            <p className="mt-2 text-[12.5px] text-muted">
              You said no recently; the browser may not ask again.
            </p>
          )}
        </div>
      )}
      {(list.data ?? []).filter(s => !s.isThisDevice && s.status === 'ACTIVE').length > 0 && (
        <ul className="mt-4 grid gap-1.5 text-[13.5px]">
          {(list.data ?? [])
            .filter(s => !s.isThisDevice && s.status === 'ACTIVE')
            .map(s => (
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
