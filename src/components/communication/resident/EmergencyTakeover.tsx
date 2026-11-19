'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { ActiveEmergency } from '@/types/communication';
import { typeLabel } from '../format';
import { useActiveEmergency } from '../useActiveEmergency';
import { EmergencyResponseCard } from './EmergencyResponseCard';

const keyOf = (a: ActiveEmergency) => `emergency-seen:${a.id}:${a.version}`;
const seen = (a: ActiveEmergency): boolean => {
  try {
    return sessionStorage.getItem(keyOf(a)) === '1';
  } catch {
    return false;
  }
};
const remember = (a: ActiveEmergency) => {
  try {
    sessionStorage.setItem(keyOf(a), '1');
  } catch {
    /* private mode: the in-memory list still holds for this page */
  }
};

/** Real alerts before drills, newest first. */
export const takeoverOrder = (list: ActiveEmergency[]) =>
  [...list].sort(
    (a, b) =>
      Number(a.isDrill) - Number(b.isDrill) ||
      Date.parse(b.startedAt) - Date.parse(a.startedAt) ||
      b.id - a.id,
  );

/**
 * Spec 11.7 full-screen red takeover for an active emergency of the caller's society. Mounted once in the
 * resident layout, not on the alert page itself. A person may close it after replying, or at once when the alert
 * asks for no reply; a closed or answered alert (per alert id and version, kept for this browser tab) does not take
 * over again and stays as a small banner. Real alerts come before drills.
 */
export function EmergencyTakeover() {
  const path = usePathname() ?? '';
  const onAlertPage = path.startsWith('/resident/emergency-alert');
  const { list, reload } = useActiveEmergency('me', !onAlertPage);
  const [closed, setClosed] = useState<string[]>([]);
  const [replied, setReplied] = useState<number[]>([]);
  const shown = useRef(new Set<string>()); // an alert on screen stays until closed, even once it is answered
  if (onAlertPage) return null;
  const ordered = takeoverOrder(list);
  const done = (a: ActiveEmergency) =>
    closed.includes(keyOf(a)) ||
    seen(a) ||
    (!shown.current.has(keyOf(a)) &&
      a.collectResponses &&
      a.myUnits.length > 0 &&
      a.myUnits.every(u => u.response !== null));
  const next = ordered.find(a => !done(a));
  if (next) shown.current.add(keyOf(next));
  if (!next) {
    if (ordered.length === 0) return null;
    return (
      <Link
        href="/resident/emergency-alert"
        role="status"
        className="fixed inset-x-3 bottom-3 z-[90] rounded-2xl bg-[#a3201a] px-4 py-2.5 text-center text-[14px] font-semibold text-white shadow-lg"
      >
        {ordered.length === 1
          ? `${ordered[0].isDrill ? 'Drill' : 'Active alert'}: ${typeLabel(ordered[0].type)}`
          : `${ordered.length} active alerts`}{' '}
        · Open
      </Link>
    );
  }
  const answered = replied.includes(next.id) || next.myUnits.some(u => u.response !== null);
  const close = () => {
    remember(next);
    setClosed(c => [...c, keyOf(next)]);
  };
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
            <Button variant="glass" onClick={close}>
              Close
            </Button>
          </div>
        )}
        {!answered && next.collectResponses && !next.isDrill && (
          <div className="mt-4 text-center">
            <Button variant="ghost" className="!text-white" onClick={close}>
              Not now
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
