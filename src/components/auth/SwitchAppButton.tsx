'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { landingPath, setMe } from '@/lib/auth';
import { APP_CHOICE, useIsUnified } from '@/lib/clientApp';
import { authService } from '@/services/auth.service';
import type { ClientApp } from '@/types/auth';

/**
 * "Open <app>" for each other app this sign-in can open (single sign-in address only; the API lists them, so a person who
 * signed in by mobile code is never offered the platform). Renders nothing when there is none.
 */
export function SwitchAppButton() {
  const unified = useIsUnified();
  const router = useRouter();
  const [apps, setApps] = useState<ClientApp[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!unified) return;
    let live = true;
    authService
      .apps()
      .then(r => live && setApps(r.available))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [unified]);

  if (!unified || apps.length === 0) return null;

  const open = async (app: ClientApp) => {
    setBusy(true);
    try {
      const me = await authService.switchApp(app);
      setMe(me);
      router.push(landingPath(me, me.session.clientApp, null));
    } catch {
      setBusy(false);
    }
  };

  return (
    <>
      {apps.map(app => (
        <Button key={app} variant="glass" size="sm" disabled={busy} onClick={() => void open(app)}>
          Open {APP_CHOICE[app].name}
        </Button>
      ))}
    </>
  );
}
