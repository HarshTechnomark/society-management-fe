'use client';
import { useState } from 'react';
import { ConfirmReason } from '@/components/common/ConfirmReason';
import { DataTable, type Column } from '@/components/common/DataTable';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { Alert } from '@/components/ui/Alert';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { billingSetupService } from '@/services/billingSetup.service';
import type { ChargeHead } from '@/types/billingSetup';
import { ChargeHeadDrawer } from './ChargeHeadDrawer';
import { GST_SHORT, HEAD_TYPE_LABEL, ROUTING_SHORT, billingSetupError, plainError } from './format';

type Show = 'ACTIVE' | 'ARCHIVED' | 'ALL';

/** Settings > Billing > Charge heads (spec 11.5): table with Name, Key, Type, Payer, GST, Ledger, Status. */
export function ChargeHeadsTab() {
  const toast = useToast();
  const canEdit = usePermission(PERMISSIONS.settings.billingRules.edit);
  const [show, setShow] = useState<Show>('ACTIVE');
  const { data, loading, error, reload } = useLoad(
    () => billingSetupService.chargeHeads({ status: show }),
    show,
  );
  const [editing, setEditing] = useState<ChargeHead | 'new' | null>(null);
  const [archiving, setArchiving] = useState<ChargeHead | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const columns: Column<ChargeHead>[] = [
    {
      key: 'name',
      label: 'Name',
      sortValue: h => h.name,
      render: h => (
        <span className="font-semibold">
          {h.name}
          {h.isSystem && <Chip className="ml-2">System</Chip>}
        </span>
      ),
    },
    {
      key: 'key',
      label: 'Key',
      sortValue: h => h.key,
      render: h => <code className="text-[12.5px]">{h.key}</code>,
    },
    { key: 'type', label: 'Type', render: h => HEAD_TYPE_LABEL[h.headType] ?? h.headType },
    { key: 'payer', label: 'Payer', render: h => ROUTING_SHORT[h.payerRouting] },
    {
      key: 'gst',
      label: 'GST',
      render: h => GST_SHORT[h.gstTreatment] + (h.sacCode ? ` · SAC ${h.sacCode}` : ''),
    },
    { key: 'ledger', label: 'Ledger', render: h => h.ledgerAccountCode },
    {
      key: 'status',
      label: 'Status',
      render: h => (
        <Chip tone={h.status === 'ACTIVE' ? 'ok' : 'neutral'}>
          {h.status === 'ACTIVE' ? 'Active' : 'Archived'}
        </Chip>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      hideLabel: true,
      render: h =>
        canEdit && h.status === 'ACTIVE' ? (
          <span className="flex gap-1.5">
            <Button size="xs" variant="glass" aria-label={`Edit ${h.name}`} onClick={() => setEditing(h)}>
              Edit
            </Button>
            {!h.isSystem && (
              <Button
                size="xs"
                variant="danger-soft"
                aria-label={`Archive ${h.name}`}
                onClick={() => setArchiving(h)}
              >
                Archive
              </Button>
            )}
          </span>
        ) : null,
    },
  ];

  return (
    <div>
      {notice && <Alert tone="bad">{notice}</Alert>}
      <DataTable
        caption="Charge heads"
        columns={columns}
        rows={data ?? []}
        rowKey={h => h.id}
        loading={loading}
        error={error ? plainError(error) : undefined}
        onRetry={reload}
        searchText={h => `${h.name} ${h.key}`}
        searchLabel="Search charge heads"
        pageSize={15}
        initialSort={{ key: 'name', dir: 'asc' }}
        empty={{
          title: 'No charge heads',
          text: 'Charge heads are added for you when billing starts. Add your own if you need more.',
        }}
        toolbar={
          <div className="flex flex-wrap items-end gap-2">
            <Select
              label="Show"
              value={show}
              onChange={e => setShow(e.target.value as Show)}
              options={[
                { value: 'ACTIVE', label: 'Active heads' },
                { value: 'ARCHIVED', label: 'Archived heads' },
                { value: 'ALL', label: 'All heads' },
              ]}
              className="!mb-0"
            />
            {canEdit && <Button onClick={() => setEditing('new')}>Add charge head</Button>}
          </div>
        }
      />
      {editing && (
        <ChargeHeadDrawer
          head={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
      <ConfirmReason
        open={archiving !== null}
        title={`Archive ${archiving?.name ?? 'charge head'}?`}
        description="Archived heads cannot be used in new rates or invoices. Issued bills keep their lines."
        confirmLabel="Archive"
        onCancel={() => setArchiving(null)}
        onConfirm={async reason => {
          if (!archiving) return;
          try {
            await billingSetupService.archiveChargeHead(archiving.id, reason, archiving.version);
            toast.show('Charge head archived.');
            setNotice(null);
            reload();
          } catch (e) {
            setNotice(billingSetupError(e));
          }
          setArchiving(null);
        }}
      />
    </div>
  );
}
