'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { AuthHeading, AuthShell } from './AuthShell';
import { RecoveryCodes } from './RecoveryCodes';
import { useSignInResult } from './useSignIn';
import { getMe, landingPath } from '@/lib/auth';
import { flow } from '@/lib/authFlow';
import { useClientApp, useHydrated } from '@/lib/clientApp';

export function RecoveryCodesScreen() {
  const hydrated = useHydrated();
  return hydrated ? (
    <CodesForm />
  ) : (
    <AuthShell>
      <div className="min-h-[320px]" aria-busy="true" />
    </AuthShell>
  );
}

function CodesForm() {
  const router = useRouter();
  const app = useClientApp();
  const { next, suffix } = useSignInResult();
  const [codes] = useState(() => flow.get().recoveryCodes);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!codes) router.replace(`/login${suffix}`);
  }, [codes, router, suffix]);
  if (!codes) return null;

  const done = () => {
    const me = getMe();
    flow.clear('recoveryCodes');
    router.push(me ? landingPath(me, app, next) : `/login${suffix}`);
  };

  return (
    <AuthShell wide>
      <AuthHeading
        title="Save your recovery codes"
        lead="Use one of these if you lose your phone. Each code works once. We cannot show them again."
      />
      <RecoveryCodes codes={codes} />
      <Checkbox
        label="I have saved these codes somewhere safe"
        checked={saved}
        onChange={e => setSaved(e.target.checked)}
      />
      <Button block disabled={!saved} onClick={done}>
        Continue
      </Button>
    </AuthShell>
  );
}
