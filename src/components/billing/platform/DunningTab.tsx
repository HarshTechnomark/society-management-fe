'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Button, buttonClasses } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { useToast } from '@/components/ui/Toast';
import { Card } from '@/components/common/PageHead';
import { DataTable, type Column } from '@/components/common/DataTable';
import { PERMISSIONS } from '@/constants/permissions';
import { usePermission } from '@/hooks/usePermission';
import { inr, shortDate } from '@/lib/money';
import { platformBillingService as svc } from '@/services/platform-billing.service';
import type { DunningItem, InvoiceDetail, InvoiceListItem } from '@/types/platformBilling';
import { billingError } from '../format';
import { Pager, useServerList } from '../useServerList';
import { ExtendGraceModal, RemindModal } from './dialogs';

/** Spec 11.1 Dunning tab. */
export function DunningTab() {
  const canEdit = usePermission(PERMISSIONS.platform.billing.edit);
  const canSuspend = usePermission(PERMISSIONS.platform.societies.approve);
  const toast = useToast();
  const list = useServerList(page => svc.dunning({ page, limit: 20 }), 'all');
  const [dlg, setDlg] = useState<
    { kind: 'remind'; invoice: InvoiceListItem } | { kind: 'grace'; invoice: InvoiceDetail } | null
  >(null);
  const [busy, setBusy] = useState<number | null>(null);

  /** The dunning row is per society; the actions work on its oldest overdue invoice. */
  const pick = async (row: DunningItem, kind: 'remind' | 'grace') => {
    setBusy(row.societyId);
    try {
      const r = await svc.platformInvoices({
        societyId: row.societyId,
        status: 'OVERDUE',
        sortBy: 'dueDate',
        sortOrder: 'asc',
        limit: 1,
      });
      const inv = r.items[0];
      if (!inv) {
        toast.show('No overdue invoice found for this society.', 'warning');
        return;
      }
      setDlg(
        kind === 'remind' ? { kind, invoice: inv } : { kind, invoice: await svc.platformInvoice(inv.id) },
      );
    } catch (e) {
      toast.show(billingError(e), 'error');
    } finally {
      setBusy(null);
    }
  };

  const columns: Column<DunningItem>[] = [
    { key: 'soc', label: 'Society', render: r => <b>{r.societyName}</b> },
    {
      key: 'st',
      label: 'Status',
      render: r => (
        <Chip tone={r.status === 'SUSPENDED' ? 'bad' : 'warn'}>
          {r.status === 'SUSPENDED' ? 'Suspended' : 'Past due'}
        </Chip>
      ),
    },
    {
      key: 'over',
      label: 'Overdue',
      className: 'text-right tabular-nums',
      render: r => inr(r.overduePaise),
      sortValue: r => r.overduePaise,
    },
    {
      key: 'late',
      label: 'Days late',
      className: 'text-right tabular-nums',
      render: r => r.daysLate,
      sortValue: r => r.daysLate,
    },
    { key: 'step', label: 'Dunning step', render: r => r.lastStep ?? '-' },
    { key: 'next', label: 'Next suspension', render: r => shortDate(r.nextSuspensionDate) },
    {
      key: 'act',
      label: 'Actions',
      hideLabel: true,
      render: r => (
        <span className="flex gap-1.5">
          {canEdit && (
            <>
              <Button
                size="xs"
                variant="glass"
                disabled={busy === r.societyId}
                onClick={() => pick(r, 'remind')}
                aria-label={`Remind ${r.societyName}`}
              >
                Remind
              </Button>
              <Button
                size="xs"
                variant="glass"
                disabled={busy === r.societyId}
                onClick={() => pick(r, 'grace')}
                aria-label={`Extend grace for ${r.societyName}`}
              >
                Extend grace
              </Button>
            </>
          )}
          {canSuspend && r.status !== 'SUSPENDED' && (
            <Link
              href={`/platform/societies/${r.societyId}`}
              className={buttonClasses('danger-soft', 'xs')}
              aria-label={`Suspend ${r.societyName}`}
            >
              Suspend
            </Link>
          )}
        </span>
      ),
    },
  ];
  return (
    <Card
      title="Past due and suspended"
      sub="Reminders 7 days before, on the due date, 3 and 7 days after. Past due the next day, suspended 15 days after the due date."
    >
      <DataTable
        caption="Past due and suspended societies"
        columns={columns}
        rows={list.rows}
        rowKey={r => r.societyId}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        pageSize={20}
        empty={{ title: 'Nothing past due', text: 'Every society is paid up.' }}
      />
      <Pager pagination={list.pagination} page={list.page} onPage={list.setPage} />
      {dlg?.kind === 'remind' && (
        <RemindModal invoice={dlg.invoice} onClose={() => setDlg(null)} onDone={() => setDlg(null)} />
      )}
      {dlg?.kind === 'grace' && (
        <ExtendGraceModal
          invoice={dlg.invoice}
          onClose={() => setDlg(null)}
          onDone={() => {
            setDlg(null);
            list.reload();
          }}
        />
      )}
    </Card>
  );
}
