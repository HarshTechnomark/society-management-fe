'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { OtpInput } from '@/components/ui/OtpInput';
import { AuthHeading, AuthShell, BackLink } from './AuthShell';
import { QrCode } from './QrCode';
import { useLock } from './useLock';
import { useSignInResult } from './useSignIn';
import { ApiError } from '@/lib/apiClient';
import { setMe } from '@/lib/auth';
import { authErrorMessage, lockMessage, lockSeconds } from '@/lib/authErrors';
import { flow } from '@/lib/authFlow';
import { useHydrated } from '@/lib/clientApp';
import { groupSecret } from '@/lib/validation';
import { authService } from '@/services/auth.service';
import type { TotpSetup } from '@/types/auth';

export function EnrollScreen() {
  const hydrated = useHydrated();
  return hydrated ? (
    <EnrollForm />
  ) : (
    <AuthShell>
      <div className="min-h-[320px]" aria-busy="true" />
    </AuthShell>
  );
}

function EnrollForm() {
  const router = useRouter();
  const { suffix } = useSignInResult();
  const [mfa] = useState(() => flow.get().mfa);
  const [setup, setSetup] = useState<TotpSetup | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);
  const started = useRef(false);
  const lock = useLock();

  const expire = () => {
    flow.clear('mfa');
    router.replace(`/login${suffix ? suffix + '&' : '?'}r=challenge`);
  };

  useEffect(() => {
    if (!mfa) return void router.replace(`/login${suffix ? suffix + '&' : '?'}r=challenge`);
    if (started.current) return;
    started.current = true;
    authService
      .mfaEnrollStart(mfa.challengeToken)
      .then(setSetup)
      .catch(e => {
        if (e instanceof ApiError && e.code === 'CHALLENGE_INVALID') {
          flow.clear('mfa');
          router.replace(`/login${suffix ? suffix + '&' : '?'}r=challenge`);
        } else setError(authErrorMessage(e));
      });
  }, [mfa, router, suffix]);

  if (!mfa) return null;

  const confirm = async (value: string) => {
    if (busy || lock.locked) return;
    setBusy(true);
    setError(null);
    setShake(false);
    try {
      const res = await authService.mfaEnrollConfirm(mfa.challengeToken, value);
      setMe(res.me);
      flow.clear('mfa');
      flow.set({ recoveryCodes: res.recoveryCodes });
      router.push(`/login/mfa/recovery-codes${suffix}`);
    } catch (e) {
      setCode('');
      if (e instanceof ApiError && e.code === 'CHALLENGE_INVALID') return expire();
      if (e instanceof ApiError && e.code === 'ACCOUNT_LOCKED') lock.lock(lockSeconds(e));
      else if (e instanceof ApiError && (e.code === 'TOTP_INVALID' || e.code === 'TOTP_REUSED')) {
        setError('That code is not correct. Check the time on your phone and try again.');
        setShake(true);
      } else setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell wide>
      <BackLink href={`/login${suffix}`}>Back to sign in</BackLink>
      <AuthHeading title="Set up your authenticator" lead="Two-step sign-in is required for your role." />
      <div aria-live="assertive">
        {error && <Alert tone="bad">{error}</Alert>}
        {lock.locked && <Alert tone="bad">{lockMessage(lock.left)}</Alert>}
      </div>
      <ol className="mb-4 list-decimal pl-5 text-[14px] text-muted">
        <li>Open an authenticator app such as Google Authenticator or Microsoft Authenticator.</li>
        <li>Scan the QR code, or enter the key below.</li>
        <li>Type the 6-digit code the app shows.</li>
      </ol>
      {setup ? (
        <div className="mb-4 flex flex-wrap items-center gap-5">
          <QrCode value={setup.otpauthUri} />
          <dl className="min-w-0 text-[13.5px]">
            <dt className="text-muted">Or enter this key</dt>
            <dd className="mb-2 break-all font-mono text-[15px] font-semibold">
              {groupSecret(setup.secret)}
            </dd>
            <dt className="text-muted">Account</dt>
            <dd className="mb-2 break-all font-semibold">{setup.accountLabel}</dd>
            <dt className="text-muted">Type</dt>
            <dd className="font-semibold">Time-based, 6 digits</dd>
          </dl>
        </div>
      ) : (
        !error && <p className="mb-4 text-muted">Preparing your key...</p>
      )}
      <OtpInput
        key={`${shake}`}
        value={code}
        onChange={setCode}
        onComplete={confirm}
        disabled={!setup || busy || lock.locked}
        invalid={shake}
        label="Authenticator code"
      />
      <Button
        block
        loading={busy}
        disabled={!setup || code.length !== 6 || lock.locked}
        onClick={() => confirm(code)}
      >
        Verify and turn on
      </Button>
    </AuthShell>
  );
}
