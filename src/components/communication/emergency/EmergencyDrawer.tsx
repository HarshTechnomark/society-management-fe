'use client';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Drawer } from '@/components/ui/Drawer';
import { useToast } from '@/components/ui/Toast';
import { ErrorState } from '@/components/common/ErrorState';
import { usePolling } from '@/components/platformOps/usePolling';
import { communicationEmergencyService as svc } from '@/services/communicationEmergency.service';
import type { EmergencyDetail } from '@/types/communication';
import { STATUS_TONE, ago, commError, istTime, minutesSince, plainCommError, typeLabel, people } from '../format';
import { RollCallPanel } from './RollCallPanel';
import { TextActionModal } from './TextActionModal';

type Action = 'update' | 'resolve' | 'cancel' | null;

/** Spec 11.4 roll-call drawer: counts, need-help list, by-floor grid, flat list and the four actions. */
export function EmergencyDrawer({
  id,
  canManage,
  onClose,
  onChanged,
}: {
  id: number;
  /** `communication.emergency.create`; read-only viewers (security.incidents.view) see no buttons. */
  canManage: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [override, setOverride] = useState<EmergencyDetail | null>(null);
  const q = usePolling(() => svc.detail(id, 'admin', true), 10_000, true);
  const [action, setAction] = useState<Action>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const b = override && (!q.data || override.version >= q.data.version) ? override : q.data;
  const active = b?.status === 'ACTIVE';
  const done = (next: EmergencyDetail, msg: string) => {
    setOverride(next);
    setAction(null);
    toast.show(msg);
    onChanged();
  };
  const realert = async () => {
    if (!b) return;
    setBusy(true);
    setError(null);
    try {
      done(await svc.realert(b.id, { version: b.version }), 'Re-alert sent to those who have not replied');
    } catch (e) {
      setError(commError(e));
    } finally {
      setBusy(false);
    }
  };
  const attend = async (responseId: number) => {
    if (!b) return;
    setError(null);
    try {
      await svc.attend(b.id, responseId);
      toast.show('Marked: help on the way');
      void q.reload();
    } catch (e) {
      setError(commError(e));
    }
  };
  const [statusLabel, statusTone] = b ? STATUS_TONE[b.status] : ['', 'neutral' as const];

  return (
    <Drawer
      open
      onClose={onClose}
      title={b ? `${b.isDrill ? 'DRILL: ' : ''}${typeLabel(b.type)}` : 'Emergency'}
      size={640}
    >
      {!b ? (
        q.loading ? (
          <div className="skeleton h-48 w-full" />
        ) : (
          <ErrorState
            error={plainCommError(q.error)}
            action={<Button onClick={() => void q.reload()}>Try again</Button>}
          />
        )
      ) : (
        <div>
          {error && <Alert tone="bad">{error}</Alert>}
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Chip tone={statusTone}>{statusLabel}</Chip>
            <span className="text-[13px] text-muted">
              Started {istTime(b.startedAt)}
              {b.startedByName ? ` by ${b.startedByName}` : ''} · {people(b.recipientCount)} reached
            </span>
          </div>
          <p className="mb-3 text-[15px]">{b.message}</p>
          {b.lastUpdateMessage && (
            <Alert tone="info">
              Last update {ago(b.lastUpdateAt)}: {b.lastUpdateMessage}
            </Alert>
          )}
          {b.allClearMessage && <Alert tone="ok">All clear: {b.allClearMessage}</Alert>}
          {b.cancelReason && <Alert tone="warn">False alarm: {b.cancelReason}</Alert>}

          {b.collectResponses && (
            <section aria-label="I am safe check-in" className="mb-4">
              <h3 className="mb-2 text-[15px] font-bold">I am safe check-in</h3>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-2xl bg-[#dcefe5] p-3">
                  <p className="text-[26px] font-bold text-[#14583a]">{b.counts.safe}</p>
                  <p className="text-[12.5px] font-semibold">Safe</p>
                </div>
                <div className="rounded-2xl bg-[#f6dcda] p-3">
                  <p className="text-[26px] font-bold text-[#8a1d17]">{b.counts.needHelp}</p>
                  <p className="text-[12.5px] font-semibold">Need help</p>
                </div>
                <div className="rounded-2xl bg-[rgba(20,35,44,0.08)] p-3">
                  <p className="text-[26px] font-bold">{b.counts.noResponse}</p>
                  <p className="text-[12.5px] font-semibold">Not heard from</p>
                </div>
              </div>
            </section>
          )}

          {b.needHelp.length > 0 && (
            <section aria-label="Need help" className="mb-4">
              <h3 className="mb-2 text-[15px] font-bold">Need help</h3>
              <ul className="grid gap-2">
                {b.needHelp.map(n => (
                  <li
                    key={n.responseId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#f6dcda] p-3"
                  >
                    <div>
                      <p className="text-[15px] font-bold">{n.unitLabel}</p>
                      <p className="text-[13px]">
                        {people(n.peopleCount)} · {istTime(n.at)}
                        {n.note ? ` · ${n.note}` : ''}
                      </p>
                    </div>
                    {n.attendedBy ? (
                      <Chip tone="ok">On the way: {n.attendedBy}</Chip>
                    ) : (
                      canManage &&
                      active && (
                        <Button size="sm" onClick={() => void attend(n.responseId)}>
                          Help on the way
                        </Button>
                      )
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {canManage && active && (
            <div className="mb-4 flex flex-wrap gap-2">
              <Button variant="glass" onClick={() => setAction('update')}>
                Send update
              </Button>
              {b.collectResponses && (
                <Button variant="glass" loading={busy} onClick={() => void realert()}>
                  Re-alert non-responders
                </Button>
              )}
              <Button variant="gold" onClick={() => setAction('resolve')}>
                All clear
              </Button>
              {minutesSince(b.startedAt) < 15 && (
                <Button variant="danger-soft" onClick={() => setAction('cancel')}>
                  False alarm
                </Button>
              )}
            </div>
          )}

          {b.updates.length > 0 && (
            <section aria-label="Updates" className="mb-4">
              <h3 className="mb-2 text-[15px] font-bold">Updates</h3>
              <ul className="grid gap-1.5 text-[13.5px]">
                {b.updates.map((u, i) => (
                  <li key={i}>
                    <span className="text-muted">{istTime(u.at)}</span> {u.message}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {b.collectResponses && (
            <section aria-label="Flats">
              <h3 className="mb-2 text-[15px] font-bold">Flats</h3>
              <RollCallPanel broadcastId={b.id} audience="admin" live={active} />
            </section>
          )}

          {action === 'update' && (
            <TextActionModal
              title="Send update"
              description="Goes to the same people as the alert."
              label="Update message"
              min={10}
              max={500}
              submitLabel="Send update"
              onClose={() => setAction(null)}
              onSubmit={async t =>
                done(await svc.update(b.id, { version: b.version, message: t }), 'Update sent')
              }
            />
          )}
          {action === 'resolve' && (
            <TextActionModal
              title="All clear"
              description="Ends the alert and tells everyone it is over."
              label="All clear message"
              min={10}
              max={500}
              submitLabel="Send all clear"
              variant="gold"
              onClose={() => setAction(null)}
              onSubmit={async t =>
                done(await svc.resolve(b.id, { version: b.version, allClearMessage: t }), 'All clear sent')
              }
            />
          )}
          {action === 'cancel' && (
            <TextActionModal
              title="False alarm"
              description="Allowed only in the first 15 minutes. Everyone is told it was a false alarm."
              label="Reason"
              min={10}
              max={300}
              submitLabel="Declare false alarm"
              variant="danger"
              onClose={() => setAction(null)}
              onSubmit={async t =>
                done(await svc.cancel(b.id, { version: b.version, reason: t }), 'Marked as a false alarm')
              }
            />
          )}
        </div>
      )}
    </Drawer>
  );
}
