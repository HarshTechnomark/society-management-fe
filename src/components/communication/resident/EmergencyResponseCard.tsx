'use client';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { communicationEmergencyService as svc } from '@/services/communicationEmergency.service';
import type { ActiveEmergency, ResponseStatus } from '@/types/communication';
import { ago, commError, typeLabel } from '../format';

/** "I am safe" (people stepper 1 to 20) and "Need help" (note) for one active alert (spec 11.7). */
export function EmergencyResponseCard({
  alert,
  onAnswered,
}: {
  alert: ActiveEmergency;
  onAnswered: () => void;
}) {
  const [unitId, setUnitId] = useState<number | null>(alert.myUnits[0]?.unitId ?? null);
  const [people, setPeople] = useState(1);
  const [helpOpen, setHelpOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<ResponseStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<Record<number, ResponseStatus>>({});
  const unit = alert.myUnits.find(u => u.unitId === unitId) ?? alert.myUnits[0];
  const key = unit?.unitId ?? 0;
  const current =
    sent[key] ?? unit?.response ?? (alert.myUnits.length <= 1 ? alert.myResponse : null) ?? null;

  const send = async (status: ResponseStatus) => {
    setBusy(status);
    setError(null);
    try {
      await svc.respond(alert.id, 'me', {
        status,
        ...(status === 'SAFE' ? { peopleCount: people } : {}),
        ...(status === 'NEED_HELP' && note.trim() ? { note: note.trim() } : {}),
        ...(alert.myUnits.length > 1 && unitId ? { unitId } : {}),
      });
      setSent(m => ({ ...m, [key]: status }));
      setHelpOpen(false);
      onAnswered();
    } catch (e) {
      setError(commError(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="text-center">
      <p className="text-[13px] font-bold uppercase tracking-wider">
        {alert.isDrill ? 'DRILL' : 'Emergency alert'} · {typeLabel(alert.type)}
      </p>
      <h2 className="mt-1 text-[26px] font-bold">{alert.title || typeLabel(alert.type)}</h2>
      <p className="mx-auto mt-2 max-w-md text-[17px]">{alert.message}</p>
      {alert.lastUpdateMessage && (
        <p className="mx-auto mt-3 max-w-md rounded-2xl bg-white/20 p-3 text-[15px]">
          Update: {alert.lastUpdateMessage}
        </p>
      )}
      <p className="mt-2 text-[12.5px] opacity-80">Sent {ago(alert.startedAt)}</p>

      {alert.collectResponses && (
        <div className="mx-auto mt-5 max-w-md rounded-3xl bg-white p-4 text-left text-ink">
          {error && <Alert tone="bad">{error}</Alert>}
          {current && (
            <Alert tone="ok">
              {current === 'SAFE'
                ? 'You told us you are safe.'
                : 'Help has been requested. Stay where you are.'}{' '}
              You can change your reply below.
            </Alert>
          )}
          {alert.myUnits.length > 1 && (
            <Select
              label="Reply for flat"
              value={String(unitId ?? '')}
              onChange={e => setUnitId(Number(e.target.value))}
              options={alert.myUnits.map(u => ({ value: String(u.unitId), label: u.label }))}
            />
          )}
          <div className="mb-3 flex items-center justify-between gap-2">
            <span id="people-label" className="text-[14px] font-semibold">
              People with you who are safe
            </span>
            <span className="flex items-center gap-2" role="group" aria-labelledby="people-label">
              <Button
                size="sm"
                variant="glass"
                aria-label="Fewer people"
                disabled={people <= 1}
                onClick={() => setPeople(p => p - 1)}
              >
                -
              </Button>
              <output aria-live="polite" className="w-6 text-center text-[16px] font-bold">
                {people}
              </output>
              <Button
                size="sm"
                variant="glass"
                aria-label="More people"
                disabled={people >= 20}
                onClick={() => setPeople(p => p + 1)}
              >
                +
              </Button>
            </span>
          </div>
          <Button block variant="primary" loading={busy === 'SAFE'} onClick={() => void send('SAFE')}>
            I’m safe
          </Button>
          {helpOpen ? (
            <div className="mt-3">
              <Textarea
                label="What help do you need? (optional)"
                rows={2}
                maxLength={300}
                value={note}
                onChange={e => setNote(e.target.value)}
              />
              <Button
                block
                variant="danger"
                loading={busy === 'NEED_HELP'}
                onClick={() => void send('NEED_HELP')}
              >
                Send help request
              </Button>
            </div>
          ) : (
            <Button block className="mt-3" variant="danger-soft" onClick={() => setHelpOpen(true)}>
              Need help
            </Button>
          )}
          <p className="mt-3 text-center text-[12.5px] text-muted">Need help? Press SOS.</p>
        </div>
      )}
    </div>
  );
}
