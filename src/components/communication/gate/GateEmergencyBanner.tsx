'use client';
import Link from 'next/link';
import { PERMISSIONS } from '@/constants/permissions';
import { usePermission } from '@/hooks/usePermission';
import { istTime, typeLabel } from '../format';
import { useActiveEmergency } from '../useActiveEmergency';

/** Spec 11.8 red banner on every gate screen while an emergency is active (type, area, time). */
export function GateEmergencyBanner() {
  const can = usePermission(PERMISSIONS.gate.sos.create);
  const { list } = useActiveEmergency('gate', can);
  if (!can || list.length === 0) return null;
  return (
    <div role="alert" className="sticky top-0 z-40 bg-[#a3201a] px-4 py-2.5 text-white">
      {list.map(a => (
        <p
          key={a.id}
          className="flex flex-wrap items-center justify-between gap-2 text-[14.5px] font-semibold"
        >
          <span>
            {a.isDrill ? 'DRILL: ' : 'Emergency: '}
            {typeLabel(a.type)} · {a.message} · {istTime(a.startedAt)}
          </span>
          <Link href="/gate/emergency" className="rounded-full bg-white px-3 py-1 text-[13px] text-[#a3201a]">
            Open roll call
          </Link>
        </p>
      ))}
    </div>
  );
}
