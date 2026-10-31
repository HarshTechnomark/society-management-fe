'use client';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/common/ErrorState';
import { AuthenticatorCard } from './security/AuthenticatorCard';
import { ContactCard } from './security/ContactCard';
import { DeleteAccountCard, PendingDeletionBanner } from './security/DeleteAccountCard';
import { PasskeysCard } from './security/PasskeysCard';
import { PasswordCard } from './security/PasswordCard';
import { SessionsCard } from './security/SessionsCard';
import { loadMe } from '@/lib/auth';
import { authService } from '@/services/auth.service';
import type { SecurityOverview, SessionRow } from '@/types/auth';

/** "My security": every card of spec section 11. Cards stack in one column on phones. */
export function SecurityCenter() {
  const [data, setData] = useState<SecurityOverview | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [error, setError] = useState<unknown>(null);

  const apply = useCallback(
    (r: { overview: SecurityOverview; list: SessionRow[] } | { failure: unknown }) => {
      if ('failure' in r) return setError(r.failure);
      setData(r.overview);
      setSessions(r.list);
      setError(null);
    },
    [],
  );

  const fetchAll = useCallback(async () => {
    try {
      const [overview, list] = await Promise.all([authService.security(), authService.sessions()]);
      void loadMe(true);
      return { overview, list: list.data };
    } catch (failure) {
      return { failure };
    }
  }, []);

  const load = useCallback(() => fetchAll().then(apply), [fetchAll, apply]);

  useEffect(() => {
    let live = true;
    void fetchAll().then(r => live && apply(r));
    return () => {
      live = false;
    };
  }, [fetchAll, apply]);

  if (error)
    return (
      <ErrorState
        error={error}
        action={
          <Button size="sm" onClick={load}>
            Try again
          </Button>
        }
      />
    );
  if (!data)
    return (
      <p className="p-6 text-muted" aria-busy="true">
        Loading your security settings...
      </p>
    );

  return (
    <div className="mx-auto grid max-w-3xl gap-4">
      <h1 className="text-[28px] font-bold tracking-[-0.03em]">My security</h1>
      {data.deletionScheduledFor && (
        <PendingDeletionBanner date={data.deletionScheduledFor} onCancelled={load} />
      )}
      <PasswordCard hasPassword={data.hasPassword} email={data.email} onChanged={load} />
      <AuthenticatorCard data={data} onChanged={load} />
      <PasskeysCard passkeys={data.passkeys} onChanged={load} />
      <SessionsCard sessions={sessions} onChanged={load} />
      <ContactCard data={data} onChanged={load} />
      <DeleteAccountCard scheduledFor={data.deletionScheduledFor} onChanged={load} />
    </div>
  );
}
