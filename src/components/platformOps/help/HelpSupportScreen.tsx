'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Pager } from '@/components/billing/useServerList';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { useMe } from '@/lib/auth';
import { platformOpsService as svc } from '@/services/platform-ops.service';
import { TicketStatusChip, timeAgo } from '../format';
import { NewTicketDrawer } from './NewTicketDrawer';
import { TicketThreadDrawer } from './TicketThreadDrawer';

/** Spec 11.10 Help and support (admin app). Works while the society is suspended. */
export function HelpSupportScreen() {
  const { ready } = useMe();
  const canView = usePermission(PERMISSIONS.settings.support.view);
  const canCreate = usePermission(PERMISSIONS.settings.support.create);
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const load = useLoad(() => svc.societyTickets({ page, limit: 20 }), page);
  if (ready && !canView)
    return (
      <Page>
        <PageHead title="Help and support" />
        <EmptyState title="You do not have access to help and support" />
      </Page>
    );
  const rows = load.data?.items ?? [];
  return (
    <Page>
      <PageHead
        title="Help and support"
        sub="Ask the SocietyApp team. Tickets here go to our support desk, not to your committee."
        actions={canCreate && <Button onClick={() => setCreating(true)}>New ticket</Button>}
      />
      <Card>
        {load.error ? (
          <ErrorState
            error={load.error}
            action={
              <button className="underline" onClick={load.reload}>
                Try again
              </button>
            }
          />
        ) : load.loading ? (
          <div className="skeleton h-24 w-full" aria-busy="true" />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No tickets yet"
            text="When you ask us for help, the conversation shows up here."
            action={canCreate ? <Button onClick={() => setCreating(true)}>New ticket</Button> : undefined}
          />
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {rows.map(t => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(t.id)}
                  className="flex w-full flex-wrap items-center justify-between gap-2 py-3 text-left hover:bg-white/40"
                >
                  <span className="min-w-0">
                    <span className="block font-semibold">{t.subject}</span>
                    <span className="font-mono text-[12.5px] text-muted">{t.ticketNo}</span>
                  </span>
                  <span className="flex items-center gap-3 text-[12.5px] text-muted">
                    <TicketStatusChip status={t.status} />
                    <span>Updated {timeAgo(t.lastMessageAt ?? t.updatedAt)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <Pager pagination={load.data?.pagination ?? null} page={page} onPage={setPage} />
      </Card>
      {creating && <NewTicketDrawer onClose={() => setCreating(false)} onCreated={load.reload} />}
      {openId !== null && (
        <TicketThreadDrawer id={openId} onClose={() => setOpenId(null)} onChanged={load.reload} />
      )}
    </Page>
  );
}
