'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { AuthHeading, AuthShell } from './AuthShell';
import { useSignInResult } from './useSignIn';
import { authErrorMessage } from '@/lib/authErrors';
import { flow } from '@/lib/authFlow';
import { APP_CHOICE, useHydrated } from '@/lib/clientApp';
import { authService } from '@/services/auth.service';
import type { ClientApp } from '@/types/auth';

/** Shown after sign-in when the person can open more than one app (for example a committee member who is also a resident). */
export function AppPicker() {
  const hydrated = useHydrated();
  return hydrated ? (
    <PickerForm />
  ) : (
    <AuthShell>
      <div className="min-h-[320px]" aria-busy="true" />
    </AuthShell>
  );
}

function PickerForm() {
  const router = useRouter();
  const { handle } = useSignInResult();
  const choice = flow.get().appChoice;
  const [busy, setBusy] = useState<ClientApp | null>(null);
  const [error, setError] = useState<string | null>(null);

  // the challenge lives in memory only: a reload loses it and the person starts again
  useEffect(() => {
    if (!choice) router.replace('/login?r=challenge');
  }, [choice, router]);

  const pick = async (app: ClientApp) => {
    if (!choice) return;
    setBusy(app);
    setError(null);
    try {
      handle(await authService.appChoose(choice.challengeToken, app));
    } catch (e) {
      setError(authErrorMessage(e));
      setBusy(null);
    }
  };

  return (
    <AuthShell>
      <AuthHeading
        title="Where do you want to go?"
        lead="Your account can open more than one app. Pick one now; you can switch later."
      />
      <div aria-live="assertive">{error && <Alert tone="bad">{error}</Alert>}</div>
      <ul className="grid gap-3">
        {choice?.apps.map(app => (
          <li key={app}>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void pick(app)}
              className="flex w-full items-center justify-between gap-3 rounded-[20px] border border-white/80 bg-white/60 p-4 text-left hover:bg-white/85 disabled:cursor-not-allowed disabled:opacity-55"
            >
              <span className="min-w-0">
                <b className="block truncate">{APP_CHOICE[app].name}</b>
                <span className="text-[13px] text-muted">{APP_CHOICE[app].text}</span>
              </span>
              {busy === app && <span className="text-[13px] text-muted">Opening…</span>}
            </button>
          </li>
        ))}
      </ul>
    </AuthShell>
  );
}
