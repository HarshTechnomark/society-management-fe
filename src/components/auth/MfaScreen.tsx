'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { OtpInput } from '@/components/ui/OtpInput';
import { AuthHeading, AuthShell, BackLink, linkClass } from './AuthShell';
import { useLock } from './useLock';
import { useSignInResult } from './useSignIn';
import { ApiError } from '@/lib/apiClient';
import { authErrorMessage, lockMessage, lockSeconds } from '@/lib/authErrors';
import { flow } from '@/lib/authFlow';
import { useHydrated } from '@/lib/clientApp';
import { isValidRecoveryCode, normaliseRecoveryCode } from '@/lib/validation';
import { authService } from '@/services/auth.service';

export function MfaScreen() {
  const hydrated = useHydrated();
  return hydrated ? (
    <MfaForm />
  ) : (
    <AuthShell>
      <div className="min-h-[320px]" aria-busy="true" />
    </AuthShell>
  );
}

function MfaForm() {
  const router = useRouter();
  const { handle, suffix } = useSignInResult();
  const [mfa] = useState(() => flow.get().mfa);
  const [useRecovery, setUseRecovery] = useState(false);
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState('');
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useLock();

  useEffect(() => {
    if (!mfa) router.replace(`/login${suffix ? suffix + '&' : '?'}r=challenge`);
  }, [mfa, router, suffix]);
  if (!mfa) return null;

  const submit = async (method: 'TOTP' | 'RECOVERY_CODE', value: string) => {
    if (busy || lock.locked) return;
    setBusy(true);
    setError(null);
    setShake(false);
    try {
      handle(await authService.mfaVerify(mfa.challengeToken, method, value));
    } catch (e) {
      setCode('');
      if (e instanceof ApiError && e.code === 'CHALLENGE_INVALID') {
        flow.clear('mfa');
        router.replace(`/login${suffix ? suffix + '&' : '?'}r=challenge`);
        return;
      }
      if (e instanceof ApiError && e.code === 'ACCOUNT_LOCKED') lock.lock(lockSeconds(e));
      else if (
        e instanceof ApiError &&
        ['TOTP_INVALID', 'RECOVERY_CODE_INVALID', 'TOTP_REUSED'].includes(e.code)
      ) {
        const left = e.metaNumber('attemptsLeft');
        const base =
          e.code === 'RECOVERY_CODE_INVALID'
            ? 'That recovery code is not valid or was already used.'
            : e.code === 'TOTP_REUSED'
              ? 'That code was already used. Wait for the next one.'
              : 'That code is not correct. Check the time on your phone and try again.';
        setError(
          `${base}${left !== undefined ? ` ${left} ${left === 1 ? 'attempt' : 'attempts'} left.` : ''}`,
        );
        setShake(true);
      } else setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const submitRecovery = (ev: FormEvent) => {
    ev.preventDefault();
    if (!isValidRecoveryCode(recovery)) return setRecoveryError('Enter a recovery code like RC-7K2M-Q9XD.');
    setRecoveryError(null);
    void submit('RECOVERY_CODE', normaliseRecoveryCode(recovery));
  };

  return (
    <AuthShell>
      <BackLink href={`/login${suffix}`}>Back to sign in</BackLink>
      <AuthHeading
        title="Two-step verification"
        lead={
          useRecovery
            ? 'Enter one of your recovery codes.'
            : 'Enter the 6-digit code from your authenticator app.'
        }
      />
      <div aria-live="assertive">
        {error && <Alert tone="bad">{error}</Alert>}
        {lock.locked && <Alert tone="bad">{lockMessage(lock.left)}</Alert>}
      </div>
      {useRecovery ? (
        <form onSubmit={submitRecovery} noValidate>
          <Input
            label="Recovery code"
            placeholder="RC-XXXX-XXXX"
            autoComplete="off"
            autoCapitalize="characters"
            value={recovery}
            onChange={e => setRecovery(e.target.value)}
            hint="Each recovery code works once."
            error={recoveryError}
            required
          />
          <Button type="submit" block loading={busy} disabled={lock.locked}>
            Verify and continue
          </Button>
        </form>
      ) : (
        <>
          <OtpInput
            key={`${shake}`}
            value={code}
            onChange={setCode}
            onComplete={c => submit('TOTP', c)}
            disabled={busy || lock.locked}
            invalid={shake}
            autoFocus
            label="Authenticator code"
          />
          <Button
            block
            loading={busy}
            disabled={code.length !== 6 || lock.locked}
            onClick={() => submit('TOTP', code)}
          >
            Verify and continue
          </Button>
        </>
      )}
      {mfa.methods.includes('RECOVERY_CODE') && (
        <p className="mt-4 text-center text-[14px]">
          <button
            type="button"
            className={linkClass}
            onClick={() => {
              setUseRecovery(u => !u);
              setError(null);
            }}
          >
            {useRecovery ? 'Use my authenticator app' : 'Use a recovery code'}
          </button>
        </p>
      )}
    </AuthShell>
  );
}
