'use client';
import { useState } from 'react';
import { ConfirmReason } from '@/components/common/ConfirmReason';
import { DataTable, type Column } from '@/components/common/DataTable';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { useToast } from '@/components/ui/Toast';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { inr } from '@/lib/money';
import { billingSetupService } from '@/services/billingSetup.service';
import type { SplitRule } from '@/types/billingSetup';
import { SplitRuleDrawer } from './SplitRuleDrawer';
import { BASIS_LABEL, billingSetupError, plainError } from './format';
import { scopeText } from './versionForm';

/** Settings > Billing > Split rules (spec 11.5): list and editor. */
export function SplitRulesTab() {
  const toast = useToast();
  const canEdit = usePermission(PERMISSIONS.settings.billingRules.edit);
  const { data, loading, error, reload } = useLoad(() => billingSetupService.splitRules());
  const [editing, setEditing] = useState<SplitRule | 'new' | null>(null);
  const [archiving, setArchiving] = useState<SplitRule | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const columns: Column<SplitRule>[] = [
    {
      key: 'name',
      label: 'Name',
      sortValue: r => r.name,
      render: r => (
        <span>
          <span className="font-semibold">{r.name}</span>
          {r.description && <span className="block text-[12.5px] text-muted">{r.description}</span>}
        </span>
      ),
    },
    { key: 'basis', label: 'Split by', render: r => BASIS_LABEL[r.basis] },
    {
      key: 'amount',
      label: 'Total',
      render: r =>
        r.amountSource === 'FIXED' ? `${inr(r.fixedAmountPaise)} per month` : 'Entered on each run',
    },
    { key: 'scope', label: 'Flats', render: r => scopeText(r) },
    {
      key: 'status',
      label: 'Status',
      render: r => (
        <Chip tone={r.status === 'ACTIVE' ? 'ok' : 'neutral'}>
          {r.status === 'ACTIVE' ? 'Active' : 'Archived'}
        </Chip>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      hideLabel: true,
      render: r =>
        canEdit && r.status === 'ACTIVE' ? (
          <span className="flex gap-1.5">
            <Button size="xs" variant="glass" aria-label={`Edit ${r.name}`} onClick={() => setEditing(r)}>
              Edit
            </Button>
            <Button
              size="xs"
              variant="danger-soft"
              aria-label={`Archive ${r.name}`}
              onClick={() => setArchiving(r)}
            >
              Archive
            </Button>
          </span>
        ) : null,
    },
  ];

  return (
    <div>
      {notice && <Alert tone="bad">{notice}</Alert>}
      <p className="mb-3 text-[13.5px] text-muted">
        A split rule shares one total, such as a lift contract, across flats. Changes apply from the next
        billing run.
      </p>
      <DataTable
        caption="Split rules"
        columns={columns}
        rows={data ?? []}
        rowKey={r => r.id}
        loading={loading}
        error={error ? plainError(error) : undefined}
        onRetry={reload}
        pageSize={10}
        empty={{
          title: 'No split rules yet',
          text: 'Add one to share a total, such as a lift AMC, across flats.',
          action: canEdit ? <Button onClick={() => setEditing('new')}>Add split rule</Button> : undefined,
        }}
        toolbar={
          canEdit && (data?.length ?? 0) > 0 ? (
            <Button onClick={() => setEditing('new')}>Add split rule</Button>
          ) : undefined
        }
      />
      {editing && (
        <SplitRuleDrawer
          rule={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
      <ConfirmReason
        open={archiving !== null}
        title={`Archive ${archiving?.name ?? 'split rule'}?`}
        description="A split rule used by a live rate cannot be archived."
        confirmLabel="Archive"
        onCancel={() => setArchiving(null)}
        onConfirm={async reason => {
          if (!archiving) return;
          try {
            await billingSetupService.archiveSplitRule(archiving.id, reason, archiving.version);
            toast.show('Split rule archived.');
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
