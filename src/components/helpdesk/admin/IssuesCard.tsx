'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Card } from '@/components/common/PageHead';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { ApiError } from '@/lib/apiClient';
import { plural } from '@/lib/plural';
import { helpdeskService } from '@/services/helpdesk.service';
import type { TicketList } from '@/types/helpdesk';
import { ago, priorityTone } from './format';
import { ReportIssueModal } from './ReportIssueModal';

/** The admin home asks once: when the helpdesk answers 404 the card stays hidden without asking again. */
let missing = false;
export const resetIssuesCardMemory = () => {
  missing = false;
};

/** Admin home "Building issues, most urgent first" (spec 11.4): up to 4 open tickets and the open and urgent counts. */
export function IssuesCard() {
  const can = usePermission(PERMISSIONS.helpdesk.tickets.view);
  const canCreate = usePermission(PERMISSIONS.helpdesk.tickets.create);
  const [reporting, setReporting] = useState(false);
  const load = useLoad<TicketList | null>(async () => {
    if (!can || missing) return null;
    try {
      return await helpdeskService.list({ view: 'OPEN', sortBy: 'priority', limit: 4 });
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) missing = true;
      return null;
    }
  }, String(can));
  if (!can || !load.data) return null;
  const { items, counts } = load.data;
  return (
    <Card title="Building issues" sub="Most urgent first" className="mb-4">
      <p className="mb-2 text-[15px] font-bold" data-testid="issues-open">
        {counts.OPEN || items.length} open
        {counts.URGENT > 0 && <span className="font-semibold text-bad"> · {counts.URGENT} urgent</span>}
      </p>
      {items.length === 0 ? (
        <p className="text-[14px] text-muted">No open issues</p>
      ) : (
        <ul aria-label="Open issues" className="flex flex-col gap-2">
          {items.map(i => (
            <li key={i.id}>
              <Link
                href={`/admin/issues/${i.id}`}
                className="flex items-start justify-between gap-2 rounded-xl bg-white/50 p-2.5 text-[14px]"
              >
                <span className="min-w-0">
                  <span className="block font-bold">{i.title}</span>
                  <span className="block text-[12.5px] text-muted">
                    {[
                      i.locationLabel,
                      ago(i.createdAt),
                      i.kind === 'BUILDING' && i.affectedUnitCount > 0
                        ? `${plural(i.affectedUnitCount, 'flat')} affected`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                <Chip tone={priorityTone(i.priority)}>{i.priority}</Chip>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-[13.5px]">
        <Link href="/admin/issues" className="font-semibold underline">
          Open issues
        </Link>
        {canCreate && (
          <Button size="sm" variant="glass" onClick={() => setReporting(true)}>
            Report issue
          </Button>
        )}
      </div>
      {reporting && (
        <ReportIssueModal
          onClose={() => setReporting(false)}
          onCreated={() => {
            setReporting(false);
            load.reload();
          }}
        />
      )}
    </Card>
  );
}
