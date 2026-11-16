'use client';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { PublicPayScreen } from './PublicPayScreen';

function Inner({ code }: { code: string }) {
  const params = useSearchParams();
  // The token is the `t` part of the address; a link may also carry it after `#`.
  const hash =
    typeof window === 'undefined' ? '' : window.location.hash.replace(/^#t=?/, '').replace(/^#/, '');
  const token = params.get('t') ?? hash;
  return <PublicPayScreen code={code} token={token} />;
}

/** Reads the token of the public link from the address (never sent anywhere but the `X-Pay-Token` header). */
export function PublicPayLink({ code }: { code: string }) {
  return (
    <Suspense>
      <Inner code={code} />
    </Suspense>
  );
}
