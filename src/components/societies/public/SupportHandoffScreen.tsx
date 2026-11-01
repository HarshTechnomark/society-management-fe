'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { buttonClasses } from '@/components/ui/Button';
import { AuthHeading, AuthShell } from '@/components/auth/AuthShell';
import { loadMe } from '@/lib/auth';
import { societiesService } from '@/services/societies.service';
import { PLATFORM_CONSOLE_URL } from '../admin/AdminShell';

/** Reads `#token=` from the URL fragment once, removes it from history and returns it. */
function takeToken(): string | null {
  const hash = window.location.hash.replace(/^#/, '');
  const token = new URLSearchParams(hash).get('token');
  if (hash) window.history.replaceState(null, '', window.location.pathname + window.location.search);
  return token;
}

/**
 * P-09 Support hand-off page on the admin host: redeems the 60-second token from the platform console (module 02),
 * then opens Today. Cookies are host-only, so this tab gets its own admin-app session tied to the grant.
 */
export function SupportHandoffScreen() {
  const router = useRouter();
  const started = useRef(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const token = takeToken();
    (token ? societiesService.redeemHandoff(token) : Promise.reject(new Error('No hand-off token')))
      .then(() => loadMe(true))
      .then(() => router.replace('/admin'))
      .catch(() => setFailed(true));
  }, [router]);

  return (
    <AuthShell>
      {failed ? (
        <>
          <AuthHeading
            title="Link expired"
            lead="This support link has expired or was already used. Start again from the platform console."
          />
          <a href={PLATFORM_CONSOLE_URL} className={buttonClasses('primary', 'md', true)}>
            Back to the platform console
          </a>
        </>
      ) : (
        <div aria-busy="true">
          <AuthHeading title="Opening the society" lead="Starting your support session…" />
        </div>
      )}
    </AuthShell>
  );
}
