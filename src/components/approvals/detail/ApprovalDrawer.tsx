'use client';
import { Drawer } from '@/components/ui/Drawer';
import { ApprovalDetailView } from './ApprovalDetailView';

/** The inbox detail: a side panel on desktop, full width on phones. */
export function ApprovalDrawer({
  id,
  title,
  onClose,
  onChanged,
}: {
  id: number;
  title: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  return (
    <Drawer open onClose={onClose} title={title} size={640}>
      <ApprovalDetailView id={id} onChanged={onChanged} />
    </Drawer>
  );
}
