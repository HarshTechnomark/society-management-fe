'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { landingPath, setMe } from '@/lib/auth';
import { flow, safeNext } from '@/lib/authFlow';
import { useClientApp } from '@/lib/clientApp';
import type { SignInResult } from '@/types/auth';

/** Routes the three sign-in results (8.4): signed in, authenticator code needed, authenticator set-up needed. */
export function useSignInResult() {
  const router = useRouter();
  const app = useClientApp();
  const params = useSearchParams();
  const next = safeNext(params.get('next'));
  const suffix = next ? `?next=${encodeURIComponent(next)}` : '';

  return {
    next,
    suffix,
    handle(result: SignInResult) {
      if (result.status === 'SIGNED_IN') {
        flow.clear('otp', 'mfa');
        setMe(result.me);
        router.push(landingPath(result.me, app, next));
        return;
      }
      flow.set({
        mfa: { challengeToken: result.challengeToken, methods: result.methods, expiresAt: result.expiresAt },
      });
      router.push(result.status === 'MFA_REQUIRED' ? `/login/mfa${suffix}` : `/login/mfa/enroll${suffix}`);
    },
  };
}
