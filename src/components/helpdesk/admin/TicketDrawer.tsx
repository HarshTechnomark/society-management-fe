'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Drawer } from '@/components/ui/Drawer';
import { TicketDetailView } from './TicketDetailView';

/** The ticket as a side panel over the list (full screen on phones). */
export function TicketDrawer({
  id,
  onClose,
  onChanged,
}: {
  id: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [no, setNo] = useState('Issue');
  return (
    <Drawer open onClose={onClose} title={no} size={640}>
      <TicketDetailView id={id} onChanged={onChanged} onLoaded={t => setNo(t.ticketNo)} />
      <p className="mt-4 text-[13px]">
        <Link href={`/admin/issues/${id}`} className="font-semibold underline">
          Open as a page
        </Link>
      </p>
    </Drawer>
  );
}
