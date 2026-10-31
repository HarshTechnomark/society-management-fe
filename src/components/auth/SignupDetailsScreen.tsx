'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { AuthHeading, AuthShell } from './AuthShell';
import { flow } from '@/lib/authFlow';
import { useHydrated } from '@/lib/clientApp';
import { maskMobile } from '@/lib/validation';

/**
 * Placeholder for module 05's sign-up form (society name, your name, email). The verified `signupToken` is held in
 * memory in `flow.get().signup` for that form to send; this screen only confirms the number is verified.
 */
export function SignupDetailsScreen() {
  const hydrated = useHydrated();
  return hydrated ? (
    <Details />
  ) : (
    <AuthShell>
      <div className="min-h-[320px]" aria-busy="true" />
    </AuthShell>
  );
}

function Details() {
  const router = useRouter();
  const [signup] = useState(() => flow.get().signup);
  useEffect(() => {
    if (!signup) router.replace('/signup');
  }, [signup, router]);
  if (!signup) return null;
  return (
    <AuthShell>
      <AuthHeading title="Mobile verified" lead={`${maskMobile(signup.mobile)} is confirmed.`} />
      <Alert tone="info">
        The society details form arrives with the society set-up module. Keep this tab open: your verification
        lasts 15 minutes.
      </Alert>
    </AuthShell>
  );
}
