'use client';
import { useState } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { Page, PageHead } from '@/components/common/PageHead';
import { Gate } from '@/components/setup/Gate';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PERMISSIONS } from '@/constants/permissions';
import { communicationEmergencyService as svc } from '@/services/communicationEmergency.service';
import type { RollCallUnit } from '@/types/communication';
import { commError, istTime, typeLabel } from '../format';
import { RollCallPanel } from '../emergency/RollCallPanel';
import { useActiveEmergency } from '../useActiveEmergency';

/** Spec 11.8 roll-call screen: big Safe and Need help buttons per flat, recorded through /gate/... */
export function GateRollCallScreen() {
  return (
    <Gate view={PERMISSIONS.gate.sos.create} title="the emergency roll call">
      <Inner />
    </Gate>
  );
}

function FlatButtons({
  broadcastId,
  unit,
  reload,
}: {
  broadcastId: number;
  unit: RollCallUnit;
  reload: () => void;
}) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const send = async (status: 'SAFE' | 'NEED_HELP') => {
    setBusy(true);
    setError(null);
    try {
      await svc.respond(broadcastId, 'gate', {
        status,
        unitId: unit.unitId,
        ...(status === 'NEED_HELP' ? { note: note.trim() } : {}),
      });
      setHelpOpen(false);
      setNote('');
      reload();
    } catch (e) {
      setError(commError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-2">
      {error && <Alert tone="bad">{error}</Alert>}
      <div className="grid grid-cols-2 gap-2">
        <Button
          size="md"
          variant="primary"
          disabled={busy}
          onClick={() => void send('SAFE')}
          aria-label={`Safe ${unit.unitLabel}`}
        >
          Safe
        </Button>
        <Button
          size="md"
          variant="danger-soft"
          disabled={busy}
          onClick={() => setHelpOpen(true)}
          aria-label={`Need help ${unit.unitLabel}`}
        >
          Need help
        </Button>
      </div>
      {helpOpen && (
        <div className="mt-2">
          <Input
            label="What is needed? (5 or more characters)"
            value={note}
            maxLength={300}
            onChange={e => setNote(e.target.value)}
          />
          <Button
            variant="danger"
            disabled={note.trim().length < 5}
            loading={busy}
            onClick={() => void send('NEED_HELP')}
          >
            Record help request
          </Button>
        </div>
      )}
    </div>
  );
}

function Inner() {
  const { list, loading } = useActiveEmergency('gate');
  const [pick, setPick] = useState<number | null>(null);
  const current = list.find(a => a.id === pick) ?? list[0];
  return (
    <Page>
      <PageHead
        title="Emergency roll call"
        sub="Record each flat as safe or in need of help. Phone numbers are masked."
      />
      {!current ? (
        loading ? (
          <div className="skeleton h-40 w-full" />
        ) : (
          <EmptyState
            title="No active emergency"
            text="This page shows the roll call while an alert is active."
          />
        )
      ) : (
        <div>
          {list.length > 1 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {list.map(a => (
                <Button
                  key={a.id}
                  size="sm"
                  variant={a.id === current.id ? 'primary' : 'glass'}
                  onClick={() => setPick(a.id)}
                >
                  {typeLabel(a.type)}
                </Button>
              ))}
            </div>
          )}
          <Alert tone="warn">
            {current.isDrill ? 'DRILL: ' : ''}
            {current.message} ({istTime(current.startedAt)})
          </Alert>
          {current.collectResponses ? (
            <RollCallPanel
              key={current.id}
              broadcastId={current.id}
              audience="gate"
              live
              renderAction={(u, reload) => <FlatButtons broadcastId={current.id} unit={u} reload={reload} />}
            />
          ) : (
            <EmptyState title="Replies are off" text="This alert does not collect replies." />
          )}
        </div>
      )}
    </Page>
  );
}
