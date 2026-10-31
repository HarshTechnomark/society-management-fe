'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { OtpInput } from '@/components/ui/OtpInput';
import { AuthHeading, AuthShell, BackLink, linkClass } from './AuthShell';
import { useLock } from './useLock';
import { useSignInResult } from './useSignIn';
import { useCountdown } from '@/hooks/useCountdown';
import { ApiError } from '@/lib/apiClient';
import { authErrorMessage, lockMessage, lockSeconds } from '@/lib/authErrors';
import { flow } from '@/lib/authFlow';
import { useHydrated } from '@/lib/clientApp';
import { authService } from '@/services/auth.service';
import type { OtpChannel } from '@/types/auth';

/** "Enter the OTP": used for sign-in and for the sign-up mobile check. State comes from `flow.otp` (memory only). */
export function OtpScreen() {
  const hydrated = useHydrated();
  return hydrated ? (
    <OtpForm />
  ) : (
    <AuthShell>
      <div className="min-h-[320px]" aria-busy="true" />
    </AuthShell>
  );
}

function OtpForm() {
  const router = useRouter();
  const { handle, suffix } = useSignInResult();
  const [otp, setOtp] = useState(() => flow.get().otp);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [alreadyHasAccount, setAlreadyHasAccount] = useState(false);
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const lock = useLock();
  const wait = useCountdown(otp?.resendAvailableAt);
  const signup = otp?.purpose === 'SIGNUP';
  const backHref = signup ? '/signup' : `/login${suffix}`;

  useEffect(() => {
    if (!otp) router.replace(backHref);
  }, [otp, router, backHref]);

  if (!otp) return null;

  const verify = async (value: string) => {
    if (busy || lock.locked) return;
    setBusy(true);
    setError(null);
    setShake(false);
    try {
      const result = await authService.verifyOtp(otp.challengeId, value);
      if (result.status === 'SIGNUP_VERIFIED') {
        flow.clear('otp');
        flow.set({
          signup: { signupToken: result.signupToken, mobile: result.mobile, expiresAt: result.expiresAt },
        });
        router.push('/signup/details');
      } else handle(result);
    } catch (e) {
      setCode('');
      if (e instanceof ApiError && e.code === 'OTP_INVALID') {
        const left = e.metaNumber('attemptsLeft');
        setError(
          `That code is not correct.${left !== undefined ? ` ${left} ${left === 1 ? 'attempt' : 'attempts'} left.` : ''}`,
        );
        setShake(true);
      } else if (e instanceof ApiError && e.code === 'OTP_EXPIRED') {
        setExpired(true);
        setError('That code has expired. Request a new one.');
      } else if (e instanceof ApiError && e.code === 'ACCOUNT_LOCKED') {
        lock.lock(lockSeconds(e));
      } else if (e instanceof ApiError && e.code === 'MOBILE_IN_USE') {
        setAlreadyHasAccount(true);
      } else setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const resend = async (channel?: OtpChannel) => {
    setResending(true);
    setError(null);
    try {
      const ch = await authService.resendOtp(otp.challengeId, channel);
      const next = { ...otp, ...ch };
      flow.set({ otp: next });
      setOtp(next);
      setCode('');
      setExpired(false);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'OTP_RESEND_LIMIT_REACHED')
        setError('You have used all resends. Go back and start again in a few minutes.');
      else if (e instanceof ApiError && e.code === 'OTP_RESEND_TOO_SOON')
        setError('Please wait a moment before asking for another code.');
      else if (e instanceof ApiError && e.code === 'ACCOUNT_LOCKED') lock.lock(lockSeconds(e));
      else if (e instanceof ApiError && e.code === 'OTP_EXPIRED') {
        setExpired(true);
        setError('This sign-in took too long. Go back and start again.');
      } else setError(authErrorMessage(e));
    } finally {
      setResending(false);
    }
  };

  const noResends = otp.resendsLeft <= 0;
  const canResend = wait === 0 && !noResends && !lock.locked;

  return (
    <AuthShell>
      <BackLink href={backHref} />
      <AuthHeading
        title="Enter the code"
        lead={`We sent a 6-digit code to ${otp.maskedMobile} if it is registered.${otp.channel === 'WHATSAPP' ? ' It is on WhatsApp.' : ''}`}
      />
      <div aria-live="assertive">
        {error && <Alert tone="bad">{error}</Alert>}
        {lock.locked && <Alert tone="bad">{lockMessage(lock.left)}</Alert>}
        {alreadyHasAccount && (
          <Alert tone="warn">
            This number already has an account.{' '}
            <Link href="/login" className={linkClass}>
              Sign in instead.
            </Link>
          </Alert>
        )}
      </div>
      <OtpInput
        key={`${otp.challengeId}:${shake}`}
        value={code}
        onChange={setCode}
        onComplete={verify}
        disabled={busy || lock.locked || expired}
        invalid={shake}
        autoFocus
      />
      <Button
        block
        loading={busy}
        disabled={code.length !== 6 || lock.locked || expired}
        onClick={() => verify(code)}
      >
        Verify and continue
      </Button>
      <div className="mt-4 flex flex-col items-center gap-2 text-[14px]">
        <Button variant="ghost" size="sm" disabled={!canResend} loading={resending} onClick={() => resend()}>
          Resend code
        </Button>
        {wait > 0 && !noResends && <p className="text-muted">You can request another code in {wait}s</p>}
        {noResends && <p className="text-muted">No more resends. Go back to start again in a few minutes.</p>}
        {otp.channel !== 'WHATSAPP' && (
          <Button variant="glass" size="sm" disabled={!canResend} onClick={() => resend('WHATSAPP')}>
            Send on WhatsApp instead
          </Button>
        )}
      </div>
    </AuthShell>
  );
}
