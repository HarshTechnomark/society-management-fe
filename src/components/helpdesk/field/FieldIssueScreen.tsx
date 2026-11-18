'use client';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { BuildingIssueForm } from '@/components/helpdesk/resident/BuildingIssueForm';
import type { IssueReported } from '@/types/helpdeskResident';

/**
 * Report a building issue from the guard console (`gate`) or the staff app (`work`), spec 11.7: location, category,
 * urgency, photo, and the similar list (no Me too). The placeholder apps have no layout of their own yet, so this
 * is a standalone route in each.
 */
export function FieldIssueScreen({ audience }: { audience: 'gate' | 'work' }) {
  const [done, setDone] = useState<IssueReported | null>(null);
  const [round, setRound] = useState(0);
  return (
    <>
      <main className="mx-auto max-w-xl p-4 sm:p-6">
        <div className="glass p-4 sm:p-6">
          <h1 className="text-[22px] font-bold tracking-tight">Report a building issue</h1>
          <p className="mb-4 mt-1 text-[14px] text-muted">
            Lifts, water, lights, security and other shared places.
          </p>
          {done && (
            <Alert tone="ok">
              <span>
                Reported as <b>{done.ticketNo}</b>.{' '}
                {done.priority === 'P1' ? 'It is marked urgent and the committee has been told. ' : ''}
                {done.message}
              </span>
            </Alert>
          )}
          {done ? (
            <Button
              block
              onClick={() => {
                setDone(null);
                setRound(r => r + 1);
              }}
            >
              Report another issue
            </Button>
          ) : (
            <BuildingIssueForm key={round} audience={audience} onReported={setDone} />
          )}
        </div>
      </main>
    </>
  );
}
