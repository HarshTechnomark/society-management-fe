'use client';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { Segments } from '@/components/residents/common';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { ApiError } from '@/lib/apiClient';
import { approvalsService } from '@/services/approvals.service';
import type { ApprovalRow } from '@/types/approvals';
import { ApprovalDrawer } from '../detail/ApprovalDrawer';
import { STATUS_LABEL, plainError, typeLabel } from '../format';
import { NoSociety, isNoSociety } from '../NoSociety';
import { ApprovalRowItem } from './ApprovalRowItem';
import { BulkApproveDialog } from './BulkApproveDialog';

type Tab = 'FOR_ME' | 'SUBMITTED' | 'DECIDED' | 'ALL_PENDING';
const MAX_BULK = 50;

function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      {[0, 1, 2].map(i => (
        <div key={i} className="skeleton mb-2 h-16 w-full" data-testid="skeleton-row" />
      ))}
    </div>
  );
}

/** The approvals inbox (spec 11.1): pending for me, sent by me and history, with filters, counts and bulk approve. */
export function ApprovalsScreen() {
  const canInbox = usePermission(PERMISSIONS.approvals.inbox.view);
  const canRules = usePermission(PERMISSIONS.settings.approvalRules.view);
  const [tab, setTab] = useState<Tab>('FOR_ME');
  // The "All pending" tab goes away when the server refuses it (403 or 400).
  const [noAllPending, setNoAllPending] = useState(false);
  const params = useSearchParams();
  const [type, setType] = useState(() => params?.get('type') ?? '');
  const [status, setStatus] = useState('');
  const [overdue, setOverdue] = useState(false);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<ApprovalRow | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const [bulk, setBulk] = useState<ApprovalRow[] | null>(null);
  // Makers without inbox access see "Sent by me" only.
  const showAll = canInbox && canRules && !noAllPending;
  const active: Tab = !canInbox ? 'SUBMITTED' : tab === 'ALL_PENDING' && !showAll ? 'FOR_ME' : tab;

  const counts = useLoad(
    () => (canInbox ? approvalsService.counts() : Promise.resolve(null)),
    String(canInbox),
  );
  const types = useLoad(() => approvalsService.types().catch(() => []), 'types');
  const load = useLoad(() => {
    const q = {
      type: type || undefined,
      status: active !== 'FOR_ME' && status ? status : undefined,
      overdue: active === 'FOR_ME' && overdue ? true : undefined,
      page,
      limit: 20,
    };
    if (active === 'ALL_PENDING') {
      return approvalsService
        .inbox({ ...q, status: undefined, overdue: undefined, scope: 'all_pending' })
        .catch(e => {
          if (e instanceof ApiError && (e.status === 403 || e.status === 400)) setNoAllPending(true);
          throw e;
        });
    }
    return active === 'SUBMITTED'
      ? approvalsService.submitted(q)
      : approvalsService.inbox({ ...q, view: active });
  }, `${active}|${type}|${status}|${overdue}|${page}`);

  const refresh = () => {
    setPicked([]);
    load.reload();
    counts.reload();
  };

  const rows = useMemo(() => load.data?.items ?? [], [load.data]);
  const selectable = (r: ApprovalRow) => active === 'FOR_ME' && r.bulkEligible && r.canAct;
  const eligible = rows.filter(selectable);
  const chosen = useMemo(() => rows.filter(r => picked.includes(r.id)), [rows, picked]);
  const c = counts.data;
  const typeOptions = [
    { value: '', label: 'All types' },
    ...(types.data ?? []).map(t => ({ value: t.type, label: typeLabel(t.type, t.label) })),
  ];
  const statusOptions = [
    { value: '', label: 'Any outcome' },
    ...(active === 'DECIDED'
      ? ['APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED']
      : Object.keys(STATUS_LABEL)
    ).map(s => ({ value: s, label: STATUS_LABEL[s] })),
  ];
  const reset = (fn: () => void) => {
    fn();
    setPicked([]);
    setPage(1);
  };
  const goPage = (p: number) => {
    setPicked([]);
    setPage(p);
  };
  const tabs: { key: Tab; label: string; count?: number }[] = canInbox
    ? [
        { key: 'FOR_ME', label: 'Pending for me', count: c?.forMe },
        { key: 'SUBMITTED', label: 'Submitted by me', count: c?.submittedOpen },
        { key: 'DECIDED', label: 'History' },
        ...(showAll ? [{ key: 'ALL_PENDING' as const, label: 'All pending', count: c?.allPending }] : []),
      ]
    : [{ key: 'SUBMITTED', label: 'Submitted by me' }];

  return (
    <Page>
      <PageHead
        title="Approvals"
        sub="One queue for every decision. The person who created an item can never approve it."
        actions={
          chosen.length >= 1 && (
            <Button onClick={() => setBulk(chosen)}>Approve {chosen.length} selected</Button>
          )
        }
      />
      {c && c.stuck > 0 && (
        <Alert tone="bad" className="mb-3">
          {c.stuck} {c.stuck === 1 ? 'approval cannot' : 'approvals cannot'} be routed. Nobody who can approve
          is available: open it and hand it to another member.
        </Alert>
      )}
      <Card>
        <Segments label="Approvals" options={tabs} value={active} onChange={k => reset(() => setTab(k))} />
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <Select
            label="Type"
            value={type}
            onChange={e => reset(() => setType(e.target.value))}
            options={typeOptions}
          />
          {active !== 'FOR_ME' && active !== 'ALL_PENDING' && (
            <Select
              label="State"
              value={status}
              onChange={e => reset(() => setStatus(e.target.value))}
              options={statusOptions}
            />
          )}
          {active === 'FOR_ME' && (
            <button
              type="button"
              aria-pressed={overdue}
              onClick={() => reset(() => setOverdue(o => !o))}
              className={`h-11 rounded-full px-4 text-[13px] font-semibold ${overdue ? 'bg-navy text-[#FDF8EE]' : 'bg-white/60'}`}
            >
              Overdue only{c ? ` ${c.overdueForMe}` : ''}
            </button>
          )}
          {eligible.length >= 2 && (
            <Button
              size="sm"
              variant="glass"
              onClick={() => setPicked(eligible.slice(0, MAX_BULK).map(r => r.id))}
            >
              Select all {Math.min(eligible.length, MAX_BULK)} eligible
            </Button>
          )}
        </div>
        {active === 'FOR_ME' && eligible.length > 0 && (
          <p className="mb-2 text-[13px] text-muted">
            Bulk approve skips large money items and anything that needs a fresh code.
          </p>
        )}

        {load.error != null && isNoSociety(load.error) ? (
          <NoSociety />
        ) : load.error != null ? (
          <ErrorState
            error={plainError(load.error)}
            action={
              <Button size="sm" onClick={load.reload}>
                Try again
              </Button>
            }
          />
        ) : load.loading ? (
          <Skeleton />
        ) : rows.length === 0 ? (
          <EmptyState
            title={active === 'FOR_ME' ? 'All caught up' : 'Nothing here'}
            text={
              active === 'FOR_ME'
                ? 'Nothing is waiting for a decision.'
                : active === 'ALL_PENDING'
                  ? 'No request is waiting in this society.'
                  : active === 'SUBMITTED'
                    ? 'Requests you send for approval appear here.'
                    : 'Decided requests appear here.'
            }
          />
        ) : (
          <ul aria-label="Approvals list" className="divide-y divide-[var(--line)]">
            {rows.map(r => (
              <ApprovalRowItem
                key={r.id}
                row={r}
                selectable={selectable(r)}
                selected={picked.includes(r.id)}
                onSelect={on =>
                  setPicked(p => (on ? (p.length < MAX_BULK ? [...p, r.id] : p) : p.filter(x => x !== r.id)))
                }
                onOpen={() => setOpen(r)}
              />
            ))}
          </ul>
        )}
        {(load.data?.totalPages ?? 1) > 1 && (
          <nav
            aria-label="Pages of approvals"
            className="mt-3 flex items-center justify-between text-[13.5px]"
          >
            <Button size="sm" variant="glass" disabled={page <= 1} onClick={() => goPage(page - 1)}>
              Previous
            </Button>
            <span>
              Page {page} of {load.data?.totalPages}
            </span>
            <Button
              size="sm"
              variant="glass"
              disabled={page >= (load.data?.totalPages ?? 1)}
              onClick={() => goPage(page + 1)}
            >
              Next
            </Button>
          </nav>
        )}
      </Card>
      {open && (
        <ApprovalDrawer id={open.id} title={open.title} onClose={() => setOpen(null)} onChanged={refresh} />
      )}
      {bulk && (
        <BulkApproveDialog
          items={bulk}
          onClose={() => {
            setBulk(null);
            setPicked([]);
          }}
          onDone={refresh}
        />
      )}
    </Page>
  );
}
