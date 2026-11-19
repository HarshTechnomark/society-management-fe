'use client';
import { useState } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { PERMISSIONS } from '@/constants/permissions';
import { useAnyPermission, usePermission } from '@/hooks/usePermission';
import { useLoad } from '@/hooks/useLoad';
import { useMe } from '@/lib/auth';
import { communicationEmergencyService as svc } from '@/services/communicationEmergency.service';
import { STATUS_TONE, istTime, plainCommError, typeLabel } from '../format';
import { EmergencyDrawer } from './EmergencyDrawer';
import { StartEmergencyModal } from './StartEmergencyModal';

const C = PERMISSIONS.communication;

/** The "Emergencies" tab (spec 11.4): history, the start modal and the roll-call drawer. */
export function EmergencyScreen() {
  const { ready } = useMe();
  const canManage = usePermission(C.emergency.create);
  const canView = useAnyPermission(C.emergency.create, PERMISSIONS.security.incidents.view);
  const list = useLoad(() => svc.list({ sortOrder: 'desc', limit: 100 }), 'list');
  const [starting, setStarting] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  if (!ready)
    return (
      <Page>
        <div className="skeleton h-40 w-full" />
      </Page>
    );
  if (!canView)
    return (
      <Page>
        <EmptyState
          title="You do not have access"
          text="Ask your chairman or secretary for access to emergency alerts."
        />
      </Page>
    );
  return (
    <Page>
      <PageHead
        title="Emergencies"
        sub="Alerts that reach every resident at once, with a live “I am safe” check-in."
        actions={
          canManage ? (
            <Button variant="danger" onClick={() => setStarting(true)}>
              Emergency broadcast
            </Button>
          ) : undefined
        }
      />
      <Card>
        {list.loading ? (
          <div className="skeleton h-28 w-full" />
        ) : list.error ? (
          <ErrorState
            error={plainCommError(list.error)}
            action={<Button onClick={list.reload}>Try again</Button>}
          />
        ) : (list.data ?? []).length === 0 ? (
          <EmptyState
            title="No emergency alerts yet"
            text="Alerts and drills you send will be listed here."
          />
        ) : (
          <ul className="grid gap-2.5">
            {(list.data ?? []).map(e => {
              const [label, tone] = STATUS_TONE[e.status];
              return (
                <li key={e.id}>
                  <button
                    onClick={() => setOpen(e.id)}
                    className="flex w-full flex-wrap items-center justify-between gap-2 rounded-2xl bg-white/60 p-3 text-left hover:bg-white/90"
                  >
                    <span>
                      <span className="block text-[15px] font-bold">
                        {e.isDrill ? 'DRILL: ' : ''}
                        {e.title || typeLabel(e.type)}
                      </span>
                      <span className="text-[13px] text-muted">
                        {istTime(e.startedAt)} · {e.safeCount} safe · {e.helpCount} need help · {e.unitCount}{' '}
                        flats
                      </span>
                    </span>
                    <Chip tone={tone}>{label}</Chip>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      {starting && (
        <StartEmergencyModal
          onClose={() => setStarting(false)}
          onStarted={b => {
            setStarting(false);
            list.reload();
            setOpen(b.id);
          }}
        />
      )}
      {open !== null && (
        <EmergencyDrawer
          id={open}
          canManage={canManage}
          onClose={() => setOpen(null)}
          onChanged={list.reload}
        />
      )}
    </Page>
  );
}
