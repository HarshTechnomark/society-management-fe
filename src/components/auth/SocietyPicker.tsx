'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Chip } from '@/components/ui/Chip';
import { AuthHeading, AuthShell } from './AuthShell';
import { useSignInResult } from './useSignIn';
import { landingPath, loadMe, setMe, useMe } from '@/lib/auth';
import { authErrorMessage } from '@/lib/authErrors';
import { useClientApp, useHydrated } from '@/lib/clientApp';
import { authService } from '@/services/auth.service';
import type { Membership } from '@/types/auth';

export function SocietyPicker() {
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
  const app = useClientApp();
  const { next } = useSignInResult();
  const { me } = useMe();
  const [checked, setChecked] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadMe().then(m => {
      if (!m) router.replace('/login?r=expired');
      setChecked(true);
    });
  }, [router]);

  const pick = async (m: Membership) => {
    setBusyId(m.societyId);
    setError(null);
    try {
      const updated = await authService.switchSociety(m.societyId);
      setMe(updated);
      router.push(landingPath({ ...updated, needsSocietyPick: false }, app, next));
    } catch (e) {
      setError(authErrorMessage(e));
      setBusyId(null);
    }
  };

  return (
    <AuthShell>
      <AuthHeading
        title="Choose a society"
        lead="You belong to more than one. Pick where to go now; you can switch later."
      />
      <div aria-live="assertive">{error && <Alert tone="bad">{error}</Alert>}</div>
      {!me && !checked && <p className="text-muted">Loading your societies...</p>}
      <ul className="grid gap-3">
        {me?.memberships.map(m => {
          const suspended = m.status !== 'ACTIVE' || m.societyStatus === 'SUSPENDED';
          return (
            <li key={`${m.societyId}:${m.roleKey}`}>
              <button
                type="button"
                disabled={suspended || busyId !== null}
                onClick={() => pick(m)}
                className="flex w-full items-center justify-between gap-3 rounded-[20px] border border-white/80 bg-white/60 p-4 text-left hover:bg-white/85 disabled:cursor-not-allowed disabled:opacity-55"
              >
                <span className="min-w-0">
                  <b className="block truncate">{m.societyName}</b>
                  <span className="text-[13px] text-muted">
                    {[m.city, m.flats ? `${m.flats} flats` : null].filter(Boolean).join(' · ')}
                  </span>
                </span>
                {suspended ? <Chip tone="warn">Suspended</Chip> : <Chip tone="gold">{m.roleName}</Chip>}
              </button>
            </li>
          );
        })}
      </ul>
    </AuthShell>
  );
}
