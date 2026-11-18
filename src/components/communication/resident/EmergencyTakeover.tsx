'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useActiveEmergency } from '../useActiveEmergency';
import { EmergencyResponseCard } from './EmergencyResponseCard';

/**
 * Spec 11.7 full-screen red takeover for an active emergency of the caller's society. Mounted once in the
 * resident layout. A person may close it (it stays as a banner on `/resident/emergency-alert`) after replying,
 * or at once when the alert asks for no reply.
 */
export function EmergencyTakeover() {
  const { list, reload } = useActiveEmergency('me');
  const [closed, setClosed] = useState<number[]>([]);
  const [replied, setReplied] = useState<number[]>([]);
  const next = list.find(a => !closed.includes(a.id));
  if (!next) return null;
  const answered = replied.includes(next.id) || next.myUnits.some(u => u.response !== null);
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label="Emergency alert"
      className="fixed inset-0 z-[100] overflow-y-auto bg-[#a3201a] px-4 py-8 text-white"
    >
      <div className="mx-auto max-w-lg">
        <EmergencyResponseCard
          key={next.id}
          alert={next}
          onAnswered={() => {
            setReplied(r => [...r, next.id]);
            reload();
          }}
        />
        {(answered || !next.collectResponses || next.isDrill) && (
          <div className="mt-4 text-center">
            <Button variant="glass" onClick={() => setClosed(c => [...c, next.id])}>
              Close
            </Button>
          </div>
        )}
        {!answered && next.collectResponses && !next.isDrill && (
          <div className="mt-4 text-center">
            <Button variant="ghost" className="!text-white" onClick={() => setClosed(c => [...c, next.id])}>
              Not now
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
