'use client';
import Link from 'next/link';
import { useState } from 'react';
import { PERMISSIONS } from '@/constants/permissions';
import { usePermission } from '@/hooks/usePermission';
import type { ActiveEmergency } from '@/types/communication';
import { istTime, typeLabel } from '../format';
import { useActiveEmergency } from '../useActiveEmergency';

const line = (a: ActiveEmergency) =>
  `${a.isDrill ? 'DRILL: ' : 'Emergency: '}${typeLabel(a.type)} · ${a.message} · ${istTime(a.startedAt)}`;

/**
 * Spec 11.8 red banner on every gate screen while an emergency is active (type, area, time). With several active
 * alerts it stays one compact line (count and the newest alert) that opens into the full list.
 */
export function GateEmergencyBanner() {
  const can = usePermission(PERMISSIONS.gate.sos.create);
  const { list } = useActiveEmergency('gate', can);
  const [open, setOpen] = useState(false);
  if (!can || list.length === 0) return null;
  const newest = [...list].sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))[0];
  const many = list.length > 1;
  return (
    <div role="alert" className="sticky top-0 z-40 bg-[#a3201a] px-4 py-2.5 text-white">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[14.5px] font-semibold">
        <span className="min-w-0 truncate">
          {many && (
            <span className="mr-2 rounded-full bg-white/25 px-2 py-0.5 text-[12.5px]">
              {list.length} active
            </span>
          )}
          {line(newest)}
        </span>
        <span className="flex items-center gap-2">
          {many && (
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpen(o => !o)}
              className="rounded-full bg-white/20 px-3 py-1 text-[13px]"
            >
              {open ? 'Hide' : 'Show all'}
            </button>
          )}
          <Link href="/gate/emergency" className="rounded-full bg-white px-3 py-1 text-[13px] text-[#a3201a]">
            Open roll call
          </Link>
        </span>
      </div>
      {many && open && (
        <ul className="mt-2 grid gap-1 text-[13.5px]">
          {list.map(a => (
            <li key={a.id}>{line(a)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
