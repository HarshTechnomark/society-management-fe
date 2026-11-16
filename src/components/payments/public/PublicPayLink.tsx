'use client';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { PublicPayScreen } from './PublicPayScreen';

function Inner({ code }: { code: string }) {
  const params = useSearchParams();
  // The API builds `/pay/<code>#<token>` (spec 8.5); `?t=` and `#t=<token>` are accepted as well.
  const raw = typeof window === 'undefined' ? '' : window.location.hash;
  const hash = raw.startsWith('#t=') ? raw.slice(3) : raw.replace(/^#/, '');
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
