'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { downloadBlob } from '@/components/maintenance/ledger/format';
import { Segments } from '@/components/residents/common';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { todayIST } from '@/lib/indiaDate';
import { helpdeskService } from '@/services/helpdesk.service';
import type { TicketListQuery, TicketListItem, TicketStatus, TicketView } from '@/types/helpdesk';
import { PRIORITY_LABEL, STATUS_LABEL, STATUS_ORDER, helpdeskError, plainError } from './format';
import { IssueRow } from './IssueRow';
import { CategorySelect, useCategories, useLocations } from './pickers';
import { ReportIssueModal } from './ReportIssueModal';
import { StatsTiles } from './StatsTiles';
import { TicketDrawer } from './TicketDrawer';

const PRIORITIES = [
  { value: '', label: 'Any priority' },
  ...(['P1', 'P2', 'P3', 'P4'] as const).map(p => ({ value: p, label: PRIORITY_LABEL[p] })),
];
const STATUS_OPTIONS = [
  { value: '', label: 'Any status' },
  ...STATUS_ORDER.map(s => ({ value: s, label: STATUS_LABEL[s] })),
];
const PRIORITY_RANK: Record<string, number> = { P1: 1, P2: 2, P3: 3, P4: 4 };

/** Group by status in the order of spec 11.1, P1 first then oldest inside a group. */
export function groupByStatus(items: TicketListItem[]): { status: TicketStatus; items: TicketListItem[] }[] {
  const out: { status: TicketStatus; items: TicketListItem[] }[] = [];
  for (const status of STATUS_ORDER) {
    const rows = items
      .filter(i => i.status === status)
      .sort(
        (a, b) =>
          (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9) ||
          a.createdAt.localeCompare(b.createdAt),
      );
    if (rows.length) out.push({ status, items: rows });
  }
  return out;
}

/** Admin Issues (spec 11.1): segments, filters, SLA chips, stats and CSV export. */
export function IssuesScreen() {
  const canCreate = usePermission(PERMISSIONS.helpdesk.tickets.create);
  const canExport = usePermission(PERMISSIONS.helpdesk.tickets.export);
  const canAssign = usePermission(PERMISSIONS.helpdesk.tickets.edit);
  const toast = useToast();
  const [view, setView] = useState<TicketView>('OPEN');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [subId, setSubId] = useState('');
  const [assignee, setAssignee] = useState('');
  const [building, setBuilding] = useState('');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<number | null>(null);
  const [reporting, setReporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [tick, setTick] = useState(0);

  const cats = useCategories();
  const { buildings } = useLocations();
  const people = useLoad(
    () => (canAssign ? helpdeskService.assignees().catch(() => null) : Promise.resolve(null)),
    String(canAssign),
  );

  const query: TicketListQuery = {
    view,
    status: status || undefined,
    priority: priority || undefined,
    categoryId: subId ? Number(subId) : categoryId ? Number(categoryId) : undefined,
    assigneeUserId: assignee ? Number(assignee) : undefined,
    buildingId: building ? Number(building) : undefined,
    q: q.trim() || undefined,
    sortBy: 'priority',
    sortOrder: 'asc',
    page,
    limit: 20,
  };
  const key = JSON.stringify(query) + tick;
  const load = useLoad(() => helpdeskService.list(query), key);
  const reset = (fn: () => void) => {
    fn();
    setPage(1);
  };
  const refresh = () => {
    setTick(t => t + 1);
  };

  const counts = load.data?.counts;
  const groups = useMemo(() => groupByStatus(load.data?.items ?? []), [load.data]);
  const segments: { key: TicketView; label: string; count?: number }[] = [
    { key: 'OPEN', label: 'Open', count: counts?.OPEN },
    { key: 'BUILDING', label: 'Building issues', count: counts?.BUILDING },
    { key: 'FLATS', label: 'Flat tickets', count: counts?.FLATS },
    { key: 'URGENT', label: 'Urgent', count: counts?.URGENT },
    { key: 'RESOLVED', label: 'Resolved', count: counts?.RESOLVED },
    { key: 'ALL', label: 'All', count: counts?.ALL },
    { key: 'UNASSIGNED', label: 'Unassigned' },
    { key: 'BREACHED', label: 'SLA breached' },
  ];

  const exportCsv = async () => {
    setExporting(true);
    try {
      const blob = await helpdeskService.exportCsv({ ...query, page: undefined, limit: undefined });
      downloadBlob(blob, `tickets-${todayIST()}.csv`);
    } catch (e) {
      toast.show(helpdeskError(e));
    } finally {
      setExporting(false);
    }
  };

  return (
    <Page>
      <PageHead
        title="Issues"
        sub={
          counts
            ? `${counts.OPEN} open · ${counts.URGENT} urgent`
            : 'Complaints from flats and problems in the building.'
        }
        actions={
          <>
            {canExport && (
              <Button variant="glass" loading={exporting} onClick={() => void exportCsv()}>
                Export CSV
              </Button>
            )}
            {canCreate && <Button onClick={() => setReporting(true)}>Report issue</Button>}
          </>
        }
      />
      <StatsTiles version={tick} />
      <Card>
        <Input
          label="Search"
          placeholder="Search issues, places or people"
          value={q}
          onChange={e => reset(() => setQ(e.target.value))}
          autoComplete="off"
        />
        <div className="mt-3">
          <Segments
            label="Issue views"
            options={segments}
            value={view}
            onChange={v => reset(() => setView(v))}
          />
        </div>
        <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            label="Status"
            value={status}
            onChange={e => reset(() => setStatus(e.target.value))}
            options={STATUS_OPTIONS}
          />
          <Select
            label="Priority"
            value={priority}
            onChange={e => reset(() => setPriority(e.target.value))}
            options={PRIORITIES}
          />
          <CategorySelect
            categories={cats.tops}
            categoryId={categoryId}
            subCategoryId={subId}
            onChange={(c, s) =>
              reset(() => {
                setCategoryId(c);
                setSubId(s);
              })
            }
          />
          {canAssign && (
            <Select
              label="Assigned to"
              value={assignee}
              onChange={e => reset(() => setAssignee(e.target.value))}
              options={[
                { value: '', label: 'Anyone' },
                ...(people.data?.members ?? []).map(m => ({ value: String(m.userId), label: m.name })),
              ]}
            />
          )}
          <Select
            label="Building"
            value={building}
            onChange={e => reset(() => setBuilding(e.target.value))}
            options={[
              { value: '', label: 'Every building' },
              ...buildings.map(b => ({ value: String(b.buildingId), label: b.name })),
            ]}
          />
        </div>

        {load.error != null ? (
          <ErrorState
            error={plainError(load.error)}
            action={
              <Button size="sm" onClick={load.reload}>
                Try again
              </Button>
            }
          />
        ) : load.loading ? (
          <div aria-busy="true" aria-label="Loading">
            {[0, 1, 2, 3, 4, 5].map(i => (
              <div key={i} className="skeleton mb-2 h-20 w-full" data-testid="skeleton-row" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <EmptyState title="Nothing here" text="No issues match this view." />
        ) : (
          groups.map(g => (
            <section key={g.status} aria-label={STATUS_LABEL[g.status]} className="mb-4">
              <h2 className="mb-2 flex items-center gap-2 text-[14px] font-bold">
                {STATUS_LABEL[g.status]} <Chip>{g.items.length}</Chip>
              </h2>
              <ul className="grid gap-2">
                {g.items.map(i => (
                  <IssueRow key={i.id} item={i} onOpen={() => setOpenId(i.id)} />
                ))}
              </ul>
            </section>
          ))
        )}
        {(load.data?.totalPages ?? 1) > 1 && (
          <nav aria-label="Pages of issues" className="mt-3 flex items-center justify-between gap-2">
            <Button size="sm" variant="glass" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              Previous
            </Button>
            <span className="text-[13px] text-muted">
              Page {page} of {load.data?.totalPages}
            </span>
            <Button
              size="sm"
              variant="glass"
              disabled={page >= (load.data?.totalPages ?? 1)}
              onClick={() => setPage(p => p + 1)}
            >
              Next
            </Button>
          </nav>
        )}
      </Card>
      <p className="mt-3 text-[13px] text-muted">
        Open a ticket to assign it, post an update or change its status.{' '}
        <Link href="/admin/settings/helpdesk" className="underline">
          Helpdesk settings
        </Link>
      </p>
      {openId != null && <TicketDrawer id={openId} onClose={() => setOpenId(null)} onChanged={refresh} />}
      {reporting && (
        <ReportIssueModal
          onClose={() => setReporting(false)}
          onCreated={() => {
            setReporting(false);
            refresh();
          }}
        />
      )}
    </Page>
  );
}
