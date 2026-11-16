'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { landingPath, setMe } from '@/lib/auth';
import { flow, safeNext } from '@/lib/authFlow';
import type { SignInResult } from '@/types/auth';

/**
 * Routes the sign-in results (8.4): signed in, authenticator code needed, authenticator set-up needed, and (single sign-in address) which
 * app to open. The landing page comes from the session's own app, so it is the same on a role host and on the single sign-in address.
 */
export function useSignInResult() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get('next'));
  const suffix = next ? `?next=${encodeURIComponent(next)}` : '';

  return {
    next,
    suffix,
    handle(result: SignInResult) {
      if (result.status === 'SIGNED_IN') {
        flow.clear('otp', 'mfa', 'appChoice');
        setMe(result.me);
        router.push(landingPath(result.me, result.me.session.clientApp, next));
        return;
      }
      if (result.status === 'APP_CHOICE_REQUIRED') {
        flow.set({
          appChoice: {
            challengeToken: result.challengeToken,
            apps: result.apps,
            expiresAt: result.expiresAt,
          },
        });
        router.push(`/login/app${suffix}`);
        return;
      }
      flow.clear('appChoice');
      flow.set({
        mfa: { challengeToken: result.challengeToken, methods: result.methods, expiresAt: result.expiresAt },
      });
      router.push(result.status === 'MFA_REQUIRED' ? `/login/mfa${suffix}` : `/login/mfa/enroll${suffix}`);
    },
  };
}
