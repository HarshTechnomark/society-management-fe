'use client';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { useToast } from '@/components/ui/Toast';
import { EmptyState } from '@/components/common/EmptyState';
import { Row, SecurityCard } from './SecurityCard';
import { fmtDateTime } from './format';
import { authErrorMessage } from '@/lib/authErrors';
import { authService } from '@/services/auth.service';
import type { SessionRow } from '@/types/auth';

export function SessionsCard({ sessions, onChanged }: { sessions: SessionRow[]; onChanged: () => void }) {
  const toast = useToast();
  const [busyId, setBusyId] = useState<number | 'all' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const others = sessions.filter(s => !s.isCurrent);

  const run = async (id: number | 'all', fn: () => Promise<string>) => {
    setBusyId(id);
    setError(null);
    try {
      toast.show(await fn());
      onChanged();
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <SecurityCard title="Signed-in devices" id="sessions">
      <div aria-live="assertive">{error && <Alert tone="bad">{error}</Alert>}</div>
      {sessions.length === 0 ? (
        <EmptyState title="No active devices" />
      ) : (
        <ul>
          {sessions.map(s => (
            <li key={s.id}>
              <Row>
                <div className="min-w-0">
                  <b>{s.deviceLabel}</b> {s.isCurrent && <Chip tone="ok">This device</Chip>}
                  <p className="text-[13px] text-muted">
                    {[s.ipLast, `Last active ${fmtDateTime(s.lastSeenAt)}`].filter(Boolean).join(' · ')}
                  </p>
                </div>
                {!s.isCurrent && (
                  <Button
                    variant="danger-soft"
                    size="xs"
                    aria-label={`Revoke ${s.deviceLabel}`}
                    loading={busyId === s.id}
                    onClick={() =>
                      run(s.id, async () => (await authService.revokeSession(s.id), 'Device signed out.'))
                    }
                  >
                    Revoke
                  </Button>
                )}
              </Row>
            </li>
          ))}
        </ul>
      )}
      {others.length > 0 && (
        <div className="mt-3">
          <Button
            variant="glass"
            size="sm"
            loading={busyId === 'all'}
            onClick={() =>
              run('all', async () => {
                const r = await authService.revokeOthers();
                return `${r.revoked} ${r.revoked === 1 ? 'device' : 'devices'} signed out.`;
              })
            }
          >
            Sign out all others
          </Button>
        </div>
      )}
    </SecurityCard>
  );
}
