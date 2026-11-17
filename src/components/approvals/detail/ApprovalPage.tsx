'use client';
import Link from 'next/link';
import { Card, Page } from '@/components/common/PageHead';
import { EmptyState } from '@/components/common/EmptyState';
import { ApprovalDetailView } from './ApprovalDetailView';

/** `/admin/approvals/[id]`: the same detail as the inbox drawer, as a page (links from notifications and entity screens). */
export function ApprovalPage({ id }: { id: number }) {
  return (
    <Page>
      <Link href="/admin/approvals" className="mb-3 inline-block text-[14px] font-semibold underline">
        Back to approvals
      </Link>
      <Card>
        {Number.isInteger(id) && id > 0 ? (
          <ApprovalDetailView id={id} />
        ) : (
          <EmptyState title="Request not found" text="Check the link and try again." />
        )}
      </Card>
    </Page>
  );
}
