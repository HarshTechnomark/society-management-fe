'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { buttonClasses } from '@/components/ui/Button';
import { AuthHeading, AuthShell } from './AuthShell';
import { ApiError } from '@/lib/apiClient';
import { authService } from '@/services/auth.service';

const MESSAGE: Record<string, string> = {
  LINK_INVALID: 'This link is not valid.',
  LINK_EXPIRED: 'This link has expired. Ask for a new one from your security settings.',
  LINK_USED: 'This link was already used.',
  EMAIL_IN_USE: 'That email now belongs to another account.',
};

/** "Email confirmed": consumes the `verify-email?token=` link once. */
export function VerifyEmailScreen() {
  const token = useSearchParams().get('token') ?? '';
  const [state, setState] = useState<{ ok: true; email: string } | { ok: false; message: string } | null>(
    null,
  );
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    authService
      .verifyEmail(token)
      .then(r => setState({ ok: true, email: r.email }))
      .catch(e =>
        setState({
          ok: false,
          message:
            (e instanceof ApiError && MESSAGE[e.code]) || 'We could not confirm your email. Try again.',
        }),
      );
  }, [token]);

  return (
    <AuthShell>
      {!state && <AuthHeading title="Confirming your email" lead="One moment..." />}
      {state?.ok && <AuthHeading title="Your email is confirmed" lead={state.email} />}
      {state && !state.ok && <AuthHeading title="Email not confirmed" lead={state.message} />}
      {state && (
        <Link href="/login" className={buttonClasses('primary', 'md', true)}>
          Continue
        </Link>
      )}
    </AuthShell>
  );
}
