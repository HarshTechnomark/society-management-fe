'use client';
import Link from 'next/link';
import { EmptyState } from '@/components/common/EmptyState';
import { Card, Page } from '@/components/common/PageHead';
import { TicketDetailView } from './TicketDetailView';

/** `/admin/issues/[id]`: the same detail as the drawer, as a page (links from notifications and other screens). */
export function TicketPage({ id }: { id: number }) {
  return (
    <Page>
      <Link href="/admin/issues" className="mb-3 inline-block text-[14px] font-semibold underline">
        Back to issues
      </Link>
      <Card>
        {Number.isInteger(id) && id > 0 ? (
          <TicketDetailView id={id} />
        ) : (
          <EmptyState title="Issue not found" text="Check the link and try again." />
        )}
      </Card>
    </Page>
  );
}
