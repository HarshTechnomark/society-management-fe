'use client';
import { useState } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Button } from '@/components/ui/Button';
import { Chip, type Tone } from '@/components/ui/Chip';
import { cx } from '@/components/ui/cx';
import { Select } from '@/components/ui/Select';
import { usePolling } from '@/components/platformOps/usePolling';
import { communicationEmergencyService as svc } from '@/services/communicationEmergency.service';
import type { EmergencyAudience, RollCallStatus, RollCallUnit } from '@/types/communication';
import { istTime, plainCommError, people } from '../format';

const STATUS: Record<RollCallStatus, [string, Tone]> = {
  SAFE: ['Safe', 'ok'],
  NEED_HELP: ['Need help', 'bad'],
  NO_RESPONSE: ['Not heard from', 'neutral'],
};

/** By-floor grid and flat list of the roll call (spec 11.4). `renderAction` adds the per-flat buttons (gate console). */
export function RollCallPanel({
  broadcastId,
  audience,
  live,
  renderAction,
}: {
  broadcastId: number;
  audience: EmergencyAudience;
  live: boolean;
  renderAction?: (u: RollCallUnit, reload: () => void) => React.ReactNode;
}) {
  const [status, setStatus] = useState<RollCallStatus | ''>('');
  const [page, setPage] = useState(1);
  const q = usePolling(
    () => svc.rollCall(broadcastId, audience, { status: status || undefined, page, limit: 100 }, true),
    10_000,
    live,
  );
  const pick = (s: RollCallStatus | '') => {
    setStatus(s);
    setPage(1);
  };
  if (q.loading && !q.data) return <div className="skeleton h-40 w-full" />;
  if (!q.data)
    return (
      <ErrorState
        error={plainCommError(q.error)}
        action={<Button onClick={() => void q.reload()}>Try again</Button>}
      />
    );
  const d = q.data;
  return (
    <div>
      {d.byFloor.length > 0 && (
        <div className="mb-4" aria-label="By floor">
          {Array.from(new Set(d.byFloor.map(f => f.buildingCode))).map(code => (
            <div key={code} className="mb-2">
              <p className="mb-1 text-[12px] font-bold uppercase tracking-wide text-faint">Tower {code}</p>
              <div className="flex flex-wrap gap-1.5">
                {d.byFloor
                  .filter(f => f.buildingCode === code)
                  .map(f => {
                    const tone =
                      f.needHelp > 0
                        ? 'bg-[#f6dcda] text-[#8a1d17]'
                        : f.safe >= f.units && f.units > 0
                          ? 'bg-[#dcefe5] text-[#14583a]'
                          : 'bg-[rgba(20,35,44,0.08)] text-ink';
                    return (
                      <span
                        key={`${code}-${f.floor}`}
                        title={`${f.safe} safe, ${f.needHelp} need help, ${f.units} flats`}
                        className={cx('rounded-xl px-2.5 py-1 text-[12.5px] font-semibold', tone)}
                      >
                        Floor {f.floor ?? '-'}: {f.safe}/{f.units}
                        {f.needHelp > 0 ? ` · ${f.needHelp} help` : ''}
                      </span>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      )}
      <Select
        label="Show"
        value={status}
        onChange={e => pick(e.target.value as RollCallStatus | '')}
        options={[
          { value: '', label: 'All flats' },
          { value: 'NEED_HELP', label: 'Need help' },
          { value: 'SAFE', label: 'Safe' },
          { value: 'NO_RESPONSE', label: 'Not heard from' },
        ]}
      />
      {d.items.length === 0 ? (
        <EmptyState title="No flats here" text="No flat matches this filter." />
      ) : (
        <ul className="grid gap-2">
          {d.items.map(u => {
            const [label, tone] = STATUS[u.status];
            return (
              <li key={u.unitId} className="rounded-2xl bg-white/60 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[15px] font-bold">{u.unitLabel}</p>
                  <Chip tone={tone}>{label}</Chip>
                </div>
                {u.status !== 'NO_RESPONSE' && (
                  <p className="mt-1 text-[13px] text-muted">
                    {people(u.peopleCount ?? 1)} · {istTime(u.respondedAt)}
                    {u.note ? ` · ${u.note}` : ''}
                  </p>
                )}
                {u.contacts.length > 0 && (
                  <p className="mt-1 text-[12.5px] text-muted">
                    {u.contacts.map(c => `${c.name} ${c.mobile}`).join(', ')}
                  </p>
                )}
                {renderAction?.(u, () => void q.reload())}
              </li>
            );
          })}
        </ul>
      )}
      {d.pages > 1 && (
        <div className="mt-3 flex items-center justify-between">
          <Button size="sm" variant="glass" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            Previous
          </Button>
          <span className="text-[13px] text-muted">
            Page {page} of {d.pages}
          </span>
          <Button size="sm" variant="glass" disabled={page >= d.pages} onClick={() => setPage(p => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
